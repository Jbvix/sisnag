/**
 * Formata características de luz para referência náutica (IALA / carta).
 * @param {object} l
 */
export function formatLightCharacteristic(l) {
  const parts = [];
  if (l.character) parts.push(String(l.character));
  if (l.colour) parts.push(String(l.colour));
  if (l.period != null && Number.isFinite(Number(l.period))) parts.push(`${Number(l.period)}s`);
  if (l.rangeNm != null && Number.isFinite(Number(l.rangeNm))) parts.push(`${Number(l.rangeNm)}M`);
  if (l.heightM != null && Number.isFinite(Number(l.heightM))) parts.push(`h${Number(l.heightM)}m`);
  const code = parts.join(' ').trim();
  return code || l.note || 'característica não catalogada';
}
