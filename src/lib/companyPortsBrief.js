import { COMPANY_PORTS_BR } from '../data/companyPortsBr.js';
import { haversineNm } from './navigationBrief.js';

/** Distância máxima (NM) para considerar waypoint «no» porto; acima disso indica-se só o mais próximo. */
const NEAR_PORT_NM = 25;

/**
 * @param {number} lat
 * @param {number} lng
 */
export function nearestCompanyPort(lat, lng) {
  let best = null;
  for (const p of COMPANY_PORTS_BR) {
    const d = haversineNm(lat, lng, p.lat, p.lng);
    if (!best || d < best.distanceNm) {
      best = {
        region: p.region,
        name: p.name,
        lat: p.lat,
        lng: p.lng,
        distanceNm: Math.round(d * 100) / 100,
      };
    }
  }
  return best;
}

function portsByRegionText() {
  const groups = {};
  for (const p of COMPANY_PORTS_BR) {
    if (!groups[p.region]) groups[p.region] = [];
    groups[p.region].push(p.name);
  }
  const order = ['Norte', 'Nordeste', 'Sudeste', 'Sul'];
  return order
    .filter((r) => groups[r])
    .map((r) => `${r}: ${groups[r].join(', ')}.`)
    .join('\n');
}

function formatPortMatch(label, lat, lng, match) {
  if (!match) return `  ${label}: (sem porto na lista)`;
  const near =
    match.distanceNm <= NEAR_PORT_NM
      ? 'próximo / na área do porto'
      : `porto filial mais próximo (${match.distanceNm} NM)`;
  return `  ${label}: ${match.name} (${match.region}) — ${near}`;
}

/**
 * Bloco de conhecimento + associação waypoint/GPS → porto filial.
 * @param {object} [navigation] — payload do cliente (waypoints, gps)
 */
export function buildCompanyPortsBrief(navigation) {
  const lines = [];
  lines.push('[Portos com filial da empresa — Brasil]');
  lines.push(
    'A empresa opera rebocagem nestes terminais. Identifique o porto pelo waypoint ou posição GPS mais próximo (Haversine em NM).',
  );
  lines.push('Lista por região:');
  lines.push(portsByRegionText());

  const associations = [];
  const wps = Array.isArray(navigation?.waypoints) ? navigation.waypoints : [];
  const sorted = [...wps].sort((a, b) => (a.order || 0) - (b.order || 0));

  for (const w of sorted) {
    const lat = Number(w.lat);
    const lng = Number(w.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const m = nearestCompanyPort(lat, lng);
    associations.push({
      kind: 'waypoint',
      order: w.order,
      name: w.name,
      lat,
      lng,
      port: m,
    });
    lines.push(
      formatPortMatch(
        `#${w.order} ${w.name || 'Waypoint'} (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
        lat,
        lng,
        m,
      ),
    );
  }

  const gps = navigation?.gps;
  const gpsLat = gps?.lat != null ? Number(gps.lat) : null;
  const gpsLng = gps?.lng != null ? Number(gps.lng ?? gps.lon) : null;
  if (Number.isFinite(gpsLat) && Number.isFinite(gpsLng)) {
    const gm = nearestCompanyPort(gpsLat, gpsLng);
    associations.push({ kind: 'gps', port: gm });
    lines.push(formatPortMatch(`GPS actual (${gpsLat.toFixed(5)}, ${gpsLng.toFixed(5)})`, gpsLat, gpsLng, gm));
  }

  if (!associations.length) {
    lines.push(
      '(Sem waypoints nem GPS na mensagem — use a lista acima quando o comandante citar um porto ou região.)',
    );
  } else if (sorted.length >= 2) {
    const first = nearestCompanyPort(sorted[0].lat, sorted[0].lng);
    const last = nearestCompanyPort(sorted[sorted.length - 1].lat, sorted[sorted.length - 1].lng);
    if (first && last) {
      lines.push(
        `Resumo rota: origem #1 → ${first.name} (${first.region}); destino #${sorted[sorted.length - 1].order} → ${last.name} (${last.region}).`,
      );
    }
  }

  lines.push(
    'Ao falar de operação local (praticagem, rebocador, agência, restrições de porto), priorize o terminal filial identificado acima.',
  );

  return {
    brief: lines.join('\n'),
    meta: associations.length ? 'matched' : 'catalog_only',
    associations,
  };
}
