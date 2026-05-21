/** Cálculos de rota / ETA para o copiloto (waypoints ordenados + SOG GPS ou planeada). */

const EARTH_RADIUS_NM = 3440.065;
const GPS_MAX_AGE_MS = 10 * 60 * 1000;
const MIN_SOG_KN = 0.3;
const DEFAULT_SOG_KN = 8;

export function haversineNm(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.sqrt(Math.min(1, a)));
}

function parseCoord(v) {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function normalizeWaypoints(raw) {
  if (!Array.isArray(raw)) return [];
  const rows = raw
    .map((w, idx) => {
      const lat = parseCoord(w.lat ?? w.latitude);
      const lng = parseCoord(w.lng ?? w.lon ?? w.longitude);
      if (lat == null || lng == null) return null;
      const order = Number.isFinite(Number(w.order)) ? Number(w.order) : idx + 1;
      return {
        order,
        name: String(w.name || `WP-${order}`).slice(0, 80),
        lat,
        lng,
      };
    })
    .filter(Boolean);
  rows.sort((a, b) => a.order - b.order);
  return rows.map((w, i) => ({ ...w, order: i + 1 }));
}

function gpsIsFresh(gps) {
  if (!gps || gps.lat == null || gps.lng == null) return false;
  const ts = Number(gps.ts);
  if (!Number.isFinite(ts)) return true;
  return Date.now() - ts <= GPS_MAX_AGE_MS;
}

export function resolveSpeedKnots(gps, plannedSogKn) {
  const planned = parseCoord(plannedSogKn);
  const gpsSog = parseCoord(gps?.sog);
  if (gpsIsFresh(gps) && gpsSog != null && gpsSog >= MIN_SOG_KN) {
    return { sogKn: gpsSog, source: 'gps', note: 'SOG do GPS do tablet' };
  }
  if (planned != null && planned >= MIN_SOG_KN) {
    return { sogKn: planned, source: 'planned', note: 'velocidade planeada definida no SISNAG (combustível)' };
  }
  return { sogKn: DEFAULT_SOG_KN, source: 'default', note: `sem GPS/SOG válido — assumido ${DEFAULT_SOG_KN} kn` };
}

/** Distância em NM desde (startLat,startLng) até o waypoint de índice `toIndex` (0-based), seguindo a ordem da lista. */
export function distanceNmAlongRoute(startLat, startLng, waypoints, toIndex) {
  if (!waypoints.length || toIndex < 0 || toIndex >= waypoints.length) return 0;
  let total = 0;
  let lat = startLat;
  let lng = startLng;
  for (let i = 0; i <= toIndex; i++) {
    total += haversineNm(lat, lng, waypoints[i].lat, waypoints[i].lng);
    lat = waypoints[i].lat;
    lng = waypoints[i].lng;
  }
  return total;
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 3600 * 1000);
}

function fmtUtc(d) {
  return d.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}

function fmtBr(d) {
  try {
    return d.toLocaleString('pt-BR', { timeZone: 'America/Bahia', hour12: false });
  } catch {
    return d.toLocaleString('pt-BR', { hour12: false });
  }
}

function fmtDuration(hours) {
  if (!Number.isFinite(hours) || hours < 0) return '—';
  const m = Math.round(hours * 60);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h <= 0) return `${r} min`;
  return `${h} h ${r} min`;
}

/**
 * @param {object} nav — payload do cliente (waypoints, gps, map, plannedSogKn, …)
 * @param {Date} [now]
 */
export function buildNavigationBrief(nav, now = new Date()) {
  const waypoints = normalizeWaypoints(nav?.waypoints);
  if (!waypoints.length) {
    return { brief: '', meta: 'no_waypoints', navigation: null };
  }

  const gpsRaw = nav?.gps;
  const gps =
    gpsRaw && parseCoord(gpsRaw.lat) != null && parseCoord(gpsRaw.lng ?? gpsRaw.lon) != null
      ? {
          lat: parseCoord(gpsRaw.lat),
          lng: parseCoord(gpsRaw.lng ?? gpsRaw.lon),
          sog: parseCoord(gpsRaw.sog),
          cog: parseCoord(gpsRaw.cog),
          accuracyM: parseCoord(gpsRaw.accuracy ?? gpsRaw.accuracyM),
          ts: Number(gpsRaw.ts),
        }
      : null;

  const speed = resolveSpeedKnots(gps, nav?.plannedSogKn ?? nav?.planned_sog_kn);
  const freshGps = gpsIsFresh(gps);

  const legs = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const nm = haversineNm(
      waypoints[i].lat,
      waypoints[i].lng,
      waypoints[i + 1].lat,
      waypoints[i + 1].lng,
    );
    legs.push({
      fromOrder: i + 1,
      toOrder: i + 2,
      fromName: waypoints[i].name,
      toName: waypoints[i + 1].name,
      distanceNm: Math.round(nm * 100) / 100,
    });
  }

  const totalRouteNm = legs.reduce((s, l) => s + l.distanceNm, 0);

  const startLat = freshGps ? gps.lat : waypoints[0].lat;
  const startLng = freshGps ? gps.lng : waypoints[0].lng;
  const startLabel = freshGps ? 'posição GPS actual' : 'origem (#1) — sem GPS recente';

  const etas = waypoints.map((wp, idx) => {
    const nm = Math.round(distanceNmAlongRoute(startLat, startLng, waypoints, idx) * 100) / 100;
    const hours = nm / speed.sogKn;
    const eta = addHours(now, hours);
    return {
      order: wp.order,
      name: wp.name,
      lat: wp.lat,
      lng: wp.lng,
      distanceNm: nm,
      etaUtc: eta.toISOString(),
      etaLocalBr: fmtBr(eta),
      durationFromNow: fmtDuration(hours),
    };
  });

  const dest = waypoints[waypoints.length - 1];
  const origin = waypoints[0];

  const map = nav?.map || {};
  const mapCenterLat = parseCoord(map.centerLat ?? map.lat);
  const mapCenterLng = parseCoord(map.centerLng ?? map.lng ?? map.lon);
  const mapZoom = parseCoord(map.zoom);

  const lines = [];
  lines.push('[Contexto de navegação SISNAG — gerado no servidor; use para ETAs e rota]');
  lines.push(`Referência temporal: ${fmtUtc(now)} (${fmtBr(now)} horário Bahia, se aplicável)`);
  lines.push(`Origem da rota: #1 ${origin.name} (${origin.lat.toFixed(5)}, ${origin.lng.toFixed(5)})`);
  lines.push(
    `Destino da rota: #${dest.order} ${dest.name} (${dest.lat.toFixed(5)}, ${dest.lng.toFixed(5)})`,
  );
  lines.push(`Total da derrota planeada (entre waypoints): ${Math.round(totalRouteNm * 100) / 100} NM`);

  if (freshGps) {
    lines.push(
      `GPS (${startLabel}): ${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}` +
        (gps.sog != null ? ` · SOG ${gps.sog} kn` : '') +
        (gps.cog != null ? ` · COG ${gps.cog}°` : '') +
        (gps.accuracyM != null ? ` · ±${Math.round(gps.accuracyM)} m` : ''),
    );
  } else {
    lines.push(
      'GPS: indisponível ou antigo (>10 min) — ETAs calculadas a partir da origem (#1) ou do centro do mapa; peça ao comandante para activar GPS para tempo real.',
    );
  }

  lines.push(`Velocidade usada nas ETAs: ${speed.sogKn} kn (${speed.note})`);

  if (legs.length) {
    lines.push('Pernas entre waypoints:');
    legs.forEach((l) => {
      lines.push(`  #${l.fromOrder} ${l.fromName} → #${l.toOrder} ${l.toName}: ${l.distanceNm} NM`);
    });
  }

  lines.push('ETA estimada a cada waypoint (a partir de agora, ordem da lista):');
  etas.forEach((e) => {
    lines.push(
      `  #${e.order} ${e.name}: ${e.distanceNm} NM · ${e.durationFromNow} · ${e.etaLocalBr} (${e.etaUtc})`,
    );
  });

  if (mapCenterLat != null && mapCenterLng != null) {
    lines.push(
      `Mapa no tablet: centro ${mapCenterLat.toFixed(5)}, ${mapCenterLng.toFixed(5)}` +
        (mapZoom != null ? ` · zoom ${mapZoom}` : ''),
    );
  }

  const baseLayer = nav?.map?.baseLayer;
  if (baseLayer) lines.push(`Camada base activa: ${baseLayer}`);

  if (nav?.gpx?.pointCount > 0) {
    lines.push(`Derrota GPX importada: ${nav.gpx.pointCount} pontos (referência visual no mapa).`);
  }

  const fuelLph = parseCoord(nav?.fuel?.lph);
  const fuelBalance = parseCoord(nav?.fuel?.balanceLiters);
  if (fuelLph != null || fuelBalance != null) {
    lines.push(
      `Combustível: ${fuelLph != null ? `${fuelLph} L/h` : 'L/h —'} · saldo ${fuelBalance != null ? `${fuelBalance} L` : '—'}`,
    );
  }

  lines.push(
    'Instrução: ao responder sobre “quando passamos” num ponto, compare coordenadas do ponto com os waypoints e pernas acima; com GPS activo recalcule mentalmente com SOG actual se diferente da velocidade usada.',
  );

  const navigation = {
    origin,
    destination: dest,
    waypoints,
    legs,
    totalRouteNm: Math.round(totalRouteNm * 100) / 100,
    speed,
    gps: freshGps ? gps : null,
    etas,
    generatedAt: now.toISOString(),
  };

  return {
    brief: lines.join('\n'),
    meta: freshGps ? 'gps_ok' : 'no_gps',
    navigation,
  };
}
