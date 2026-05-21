import { LIGHTHOUSES_BR, LIGHTHOUSES_META } from '../data/lighthousesBr.js';
import { haversineNm } from './navigationBrief.js';
import { formatLightCharacteristic } from './lighthouseFormat.js';

const MAX_LIGHTS_PER_POINT = 4;
const MAX_RANGE_NM = 55;

/**
 * @param {number} lat
 * @param {number} lng
 * @param {number} [limit]
 */
export function nearestLighthouses(lat, lng, limit = MAX_LIGHTS_PER_POINT) {
  const ranked = LIGHTHOUSES_BR.map((l) => ({
    ...l,
    distanceNm: Math.round(haversineNm(lat, lng, l.lat, l.lng) * 100) / 100,
    characteristic: formatLightCharacteristic(l),
  }))
    .filter((l) => l.distanceNm <= MAX_RANGE_NM)
    .sort((a, b) => a.distanceNm - b.distanceNm);
  return ranked.slice(0, limit);
}

function formatLightLine(l) {
  return `${l.name} (${l.distanceNm} NM) — ${l.characteristic} · ${l.lat.toFixed(4)}, ${l.lng.toFixed(4)}`;
}

/**
 * @param {object} [navigation]
 */
export function buildLighthousesBrief(navigation) {
  const lines = [];
  lines.push('[Faróis — costa brasileira (referência navegação costeira)]');
  lines.push(
    `Base SISNAG: ${LIGHTHOUSES_META.count} faróis principais (${LIGHTHOUSES_META.source}). ` +
      'Use cor, ritmo (Fl/Oc/Iso), período (s) e alcance (M) para identificar e cruzar com carta/OpenSeaMap. ' +
      'Legenda: Fl=flash, Oc=occulting, Iso=isophase; W/R/G=cor; 5s=período; 16M=alcance nominal.',
  );
  lines.push(
    'Na navegação costeira: 1) identifique o farol visível ou radar; 2) confira característica; 3) compare distância/bearing com waypoint/GPS; 4) confirme sempre na carta DHN/ENC.',
  );

  const wps = Array.isArray(navigation?.waypoints) ? [...navigation.waypoints] : [];
  wps.sort((a, b) => (a.order || 0) - (b.order || 0));

  let matched = 0;
  for (const w of wps) {
    const lat = Number(w.lat);
    const lng = Number(w.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const near = nearestLighthouses(lat, lng);
    if (!near.length) {
      lines.push(`  Waypoint #${w.order} ${w.name || ''}: nenhum farol catalogado até ${MAX_RANGE_NM} NM.`);
      continue;
    }
    matched++;
    lines.push(`  Waypoint #${w.order} ${w.name || ''} — faróis de referência próximos:`);
    near.forEach((l) => lines.push(`    · ${formatLightLine(l)}`));
  }

  const gps = navigation?.gps;
  const gpsLat = gps?.lat != null ? Number(gps.lat) : null;
  const gpsLng = gps?.lng != null ? Number(gps.lng ?? gps.lon) : null;
  if (Number.isFinite(gpsLat) && Number.isFinite(gpsLng)) {
    const nearGps = nearestLighthouses(gpsLat, gpsLng);
    if (nearGps.length) {
      matched++;
      lines.push('  GPS actual — faróis de referência próximos:');
      nearGps.forEach((l) => lines.push(`    · ${formatLightLine(l)}`));
    }
  }

  if (!matched) {
    lines.push(
      '(Sem waypoints/GPS: cite faróis pela região ou peça ao comandante a posição — a lista completa está na base SISNAG por coordenadas.)',
    );
  }

  lines.push(
    'Ao orientar o comandante, sugira identificação visual (cor/ritmo), distância estimada e alinhamento com a derrota; avise que características podem variar em reformas — validar com ROTEIRO/Boletim e carta oficial.',
  );

  return {
    brief: lines.join('\n'),
    meta: matched ? 'matched' : 'catalog_only',
    count: LIGHTHOUSES_META.count,
  };
}
