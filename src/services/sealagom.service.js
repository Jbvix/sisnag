/**
 * SeaLag.om — avisos NAVAREA e costeiros (documentação em https://www.sealagom.com/api/docs/).
 * Token só no servidor; nunca no browser.
 * Pedido com include_coordinates/enhanced/keywords — em plano **Pro ou Full** o filtro Haversine (NM) faz sentido; em Basic as coords costumam faltar e usamos fallback textual.
 */

const DEFAULT_BASE = 'https://sealagom.com/api/v1';

function haversineNm(lat1, lon1, lat2, lon2) {
  const R_km = 6371;
  const toR = Math.PI / 180;
  const dLat = (lat2 - lat1) * toR;
  const dLon = (lon2 - lon1) * toR;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLon / 2) ** 2;
  const km = R_km * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  return km / 1.852; // NM
}

/** Extrai [[lat,lng], ...] a partir da estrutura de coordinates da API. */
function decimalPairsFromCoordinates(coords) {
  if (!coords || typeof coords !== 'object') return [];
  const dec = coords.decimal_coordinates;
  if (!Array.isArray(dec)) return [];
  /** @type {Array<[number, number]>} */
  const out = [];
  for (let i = 0; i < dec.length; i++) {
    const row = dec[i];
    if (Array.isArray(row) && row.length >= 2) {
      const la = Number(row[0]);
      const lo = Number(row[1]);
      if (Number.isFinite(la) && Number.isFinite(lo)) out.push([la, lo]);
    }
  }
  return out;
}

/** @param {unknown} blob */
function getResults(blob) {
  if (blob && typeof blob === 'object' && Array.isArray(blob.results)) return blob.results;
  return [];
}

/**
 * Distância mínima ao ponto (NM) ou null se não houver coordenadas.
 */
function minDistanceNm(pairs, nearLat, nearLon) {
  if (pairs.length === 0 || !Number.isFinite(nearLat) || !Number.isFinite(nearLon)) return null;
  let m = Infinity;
  for (let i = 0; i < pairs.length; i++) {
    const d = haversineNm(nearLat, nearLon, pairs[i][0], pairs[i][1]);
    if (d < m) m = d;
  }
  return m === Infinity ? null : m;
}

function sanitizeText(s, max) {
  if (s == null) return '';
  const t = String(s).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

async function fetchJson(url, headers) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 24000);
  try {
    const res = await fetch(url, {
      headers,
      signal: ac.signal,
      redirect: 'follow',
    });
    if (!res.ok) {
      return { ok: false, status: res.status, data: null };
    }
    const data = await res.json();
    return { ok: true, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: null, err: String(e.message || e) };
  } finally {
    clearTimeout(t);
  }
}

let cached = { atMs: 0, coastal: null, navarea: null, errs: '' };

async function fetchBothPages(token, baseUrl) {
  const qs =
    '?include_messages=true&include_coordinates=true&include_enhanced_coordinates=true&include_keywords=true';
  const hdr = {
    Accept: 'application/json',
    'X-API-Token': token,
    'User-Agent': 'SISNAG-maritime-copilot/1.0 (+https://github.com/)',
  };
  const cUrl = `${baseUrl.replace(/\/$/, '')}/coastal/${qs}`;
  const nUrl = `${baseUrl.replace(/\/$/, '')}/navarea/${qs}`;
  const [c, n] = await Promise.all([fetchJson(cUrl, hdr), fetchJson(nUrl, hdr)]);
  const errs = [];
  if (!c.ok) errs.push(`coastal ${c.status || c.err || 'fail'}`);
  if (!n.ok) errs.push(`navarea ${n.status || n.err || 'fail'}`);
  return {
    coastal: c.ok ? c.data : null,
    navarea: n.ok ? n.data : null,
    errs,
  };
}

/** @typedef {{ coastal: unknown, navarea: unknown, errs: string[] }} CachedBundle */

async function getBundle() {
  const token = process.env.SEALAGOM_API_TOKEN?.trim();
  if (!token) return /** @type {CachedBundle|null} */ (null);

  const ttlSec = Math.min(900, Math.max(30, parseInt(process.env.SEALAGOM_CACHE_SECONDS || '300', 10) || 300));
  const ttlMs = ttlSec * 1000;
  const now = Date.now();
  if (cached.atMs && now - cached.atMs < ttlMs) {
    return { coastal: cached.coastal, navarea: cached.navarea, errs: cached.errs };
  }

  const baseUrl = process.env.SEALAGOM_API_BASE_URL || DEFAULT_BASE;
  const fresh = await fetchBothPages(token, baseUrl);
  cached = {
    atMs: Date.now(),
    coastal: fresh.coastal,
    navarea: fresh.navarea,
    errs: fresh.errs.join('; '),
  };
  return { coastal: fresh.coastal, navarea: fresh.navarea, errs: fresh.errs.join('; ') };
}

/**
 * Produz texto curto para o system prompt do assistente (PT-BR).
 * @param {number|null} nearLat
 * @param {number|null} nearLng
 * @param {number} radiusNm
 */
export async function buildSealagomBriefForChat(nearLat, nearLng, radiusNm = 180) {
  const bundle = await getBundle();
  if (!bundle) {
    return { brief: '', meta: 'no_token', cacheNote: '' };
  }

  const hasNear = Number.isFinite(nearLat) && Number.isFinite(nearLng);
  /** @type {Array<{kind:string,region:string,dist:number|null,number:string,key:string,text:string}>} */
  const nearbyRows = [];

  /** @param {unknown} dataset @param {'COASTAL'|'NAVAREA'} kind */
  function walk(dataset, kind) {
    const results = getResults(dataset);
    for (let r = 0; r < results.length; r++) {
      const zone = results[r];
      const regionTitle = sanitizeText(zone?.title ?? zone?.country ?? '?', 80);
      const msgs = zone?.active_messages;
      if (!Array.isArray(msgs)) continue;
      for (let m = 0; m < msgs.length; m++) {
        const msg = msgs[m];
        const pairs = decimalPairsFromCoordinates(msg?.coordinates);
        const num = sanitizeText(msg?.number ?? '?', 20);
        const dist = hasNear ? minDistanceNm(pairs, nearLat, nearLng) : null;
        if (hasNear && dist !== null && dist <= radiusNm) {
          nearbyRows.push({
            kind,
            region: regionTitle,
            dist,
            number: num,
            key: sanitizeText(JSON.stringify(msg?.keywords || {}), 200),
            text: sanitizeText(msg?.content, 650),
          });
        }
      }
    }
  }

  walk(bundle.coastal, 'COASTAL');
  walk(bundle.navarea, 'NAVAREA');

  nearbyRows.sort((a, b) => (a.dist ?? 9e9) - (b.dist ?? 9e9));
  const cap = parseInt(process.env.SEALAGOM_MAX_MESSAGES_IN_CHAT || '18', 10) || 18;
  const chosen = nearbyRows.slice(0, cap);

  const lines = [];

  lines.push('[SeaLag.om — avisos marítimos; complementar apenas. Confirmar sempre com MMSI/authority e avisos oficiais.]');
  if (bundle.errs) lines.push(`(Nota técnico: ${sanitizeText(bundle.errs, 160)})`);

  if (hasNear) {
    lines.push(
      `Referência próxima para filtro: latitude ${nearLat?.toFixed(4)}, longitude ${nearLng?.toFixed(4)} (raio ~${radiusNm} NM quando há coordenadas na mensagem).`,
    );
  } else {
    lines.push(
      '(Sem lat/lng do cliente — apenas resumo amplamente relevante quando não há filtros espaciais; preferir GPS/map center.)',
    );
  }

  if (!chosen.length) {
    lines.push(hasNear ? '(Nenhum aviso com coordenadas na resposta dentro do raio; plano BASIC pode omitir coords.)' : '');
    /** Fallback: primeiras mensagens texto sem filtro geo */
    const fallback = summarizeWithoutCoords(bundle, 10);
    if (fallback) lines.push('Resumo (sem garantia geo):');
    lines.push(fallback || '(Sem mensagens disponíveis na cache.)');
  } else {
    lines.push(`Avisos com coordenadas ≤ ${radiusNm} NM (${chosen.length} itens truncados):`);
    for (let i = 0; i < chosen.length; i++) {
      const it = chosen[i];
      lines.push(
        `${i + 1}. ${it.kind} [${it.number}] «${it.region}» • ~${it.dist?.toFixed(0) ?? '?'} NM — ${it.key ? `Kw: ${it.key} · ` : ''}${it.text}`,
      );
    }
  }

  const brief = lines.filter(Boolean).join('\n').slice(0, 24000);

  return {
    brief,
    meta: 'active',
    cacheNote: cached.atMs ? new Date(cached.atMs).toISOString() : '',
  };
}

/** @param {CachedBundle|null} bundle @param {number} maxMsgs */
function summarizeWithoutCoords(bundle, maxMsgs) {
  if (!bundle) return '';
  /** @type {string[]} */
  const out = [];
  let count = 0;
  /** @param {unknown} dataset @param {'COASTAL'|'NAVAREA'} kind */
  function walk(dataset, kind) {
    const results = getResults(dataset);
    for (let r = 0; r < results.length && count < maxMsgs; r++) {
      const zone = results[r];
      const title = sanitizeText(zone?.title, 72);
      const msgs = zone?.active_messages;
      if (!Array.isArray(msgs)) continue;
      for (let m = 0; m < msgs.length && count < maxMsgs; m++) {
        const msg = msgs[m];
        const num = sanitizeText(msg?.number, 16);
        const txt = sanitizeText(msg?.content, 380);
        if (!txt && !num) continue;
        out.push(`- ${kind} ${title} · #${num}: ${txt}`);
        count++;
      }
    }
  }
  walk(bundle.coastal, 'COASTAL');
  walk(bundle.navarea, 'NAVAREA');
  return out.join('\n');
}
