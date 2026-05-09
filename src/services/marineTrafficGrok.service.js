import { createGrokClient, grokVisionModel } from '../lib/grokClient.js';

const VISION_PROMPT = `Esta imagem é um mapa ou lista do Marine Traffic (ou equivalente AIS na web).

Extraia os navios visíveis. Responda APENAS com um JSON válido: um array de objetos, cada um com chaves:
"name" (string), "mmsi" (string ou null), "lat" (número ou null), "lon" (número ou null), "sog" (nós, número ou null), "cog" (graus, número ou null).
Use null quando não souber. No máximo 50 navios. Coordenadas em graus decimais (WGS84). Sem markdown, sem texto fora do JSON.`;

function tryParseShipsJson(text) {
  if (!text || typeof text !== 'string') return [];
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : trimmed;
  try {
    const parsed = JSON.parse(candidate);
    if (Array.isArray(parsed)) return normalizeShips(parsed);
    if (parsed && Array.isArray(parsed.ships)) return normalizeShips(parsed.ships);
    if (parsed && Array.isArray(parsed.vessels)) return normalizeShips(parsed.vessels);
  } catch {
    const a = candidate.indexOf('[');
    const b = candidate.lastIndexOf(']');
    if (a >= 0 && b > a) {
      try {
        const parsed = JSON.parse(candidate.slice(a, b + 1));
        if (Array.isArray(parsed)) return normalizeShips(parsed);
      } catch {
        /* ignore */
      }
    }
  }
  return [];
}

function normalizeShips(arr) {
  return arr
    .filter((x) => x && typeof x === 'object')
    .map((x) => ({
      name: x.name != null ? String(x.name) : '—',
      mmsi: x.mmsi != null ? String(x.mmsi) : null,
      lat: typeof x.lat === 'number' && Number.isFinite(x.lat) ? x.lat : null,
      lon: typeof x.lon === 'number' && Number.isFinite(x.lon) ? x.lon : null,
      sog: typeof x.sog === 'number' && Number.isFinite(x.sog) ? x.sog : null,
      cog: typeof x.cog === 'number' && Number.isFinite(x.cog) ? x.cog : null,
      source: 'grok_marine_traffic_embed',
    }))
    .filter((s) => s.lat != null && s.lon != null);
}

/**
 * Analisa captura de ecrã (Marine Traffic / mapa AIS) com Grok Vision.
 * @returns {{ ships: Array, grokRaw: string }}
 */
export async function extractVesselsFromMarineTrafficScreenshot(buffer, mimeType) {
  const grok = createGrokClient();
  if (!grok) {
    return { ships: [], grokRaw: '', error: 'missing_grok_key' };
  }

  const dataUrl = `data:${mimeType || 'image/jpeg'};base64,${buffer.toString('base64')}`;
  const completion = await grok.chat.completions.create({
    model: grokVisionModel(),
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: VISION_PROMPT }, { type: 'image_url', image_url: { url: dataUrl } }],
      },
    ],
    max_tokens: 2500,
  });

  const raw = completion.choices[0]?.message?.content || '';
  const ships = tryParseShipsJson(raw);
  return { ships, grokRaw: raw };
}
