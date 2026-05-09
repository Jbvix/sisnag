/**
 * CORS partilhado entre Express e Socket.io (Engine.io).
 * Normaliza origens: sem barra final, para bater com o header Origin do browser.
 */
function normalizeOriginHeader(o) {
  if (o == null || o === '') return '';
  return String(o).trim().replace(/\/$/, '');
}

function parseAllowlist(raw) {
  const s = raw == null ? '' : String(raw).trim();
  if (s === '' || s === '*') return null;
  return s
    .split(',')
    .map(normalizeOriginHeader)
    .filter(Boolean);
}

/**
 * Callback no formato esperado pelo pacote `cors` e pelo Socket.io.
 */
export function createCorsOriginCallback() {
  const allowlist = parseAllowlist(process.env.CORS_ORIGIN);

  return function corsOrigin(origin, callback) {
    if (allowlist === null) {
      callback(null, true);
      return;
    }
    if (!origin) {
      callback(null, true);
      return;
    }
    const n = normalizeOriginHeader(origin);
    if (allowlist.includes(n)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  };
}

export function corsStartupLogLine() {
  const allowlist = parseAllowlist(process.env.CORS_ORIGIN);
  if (allowlist === null) return '[CORS] modo permissivo (* ou vazio)';
  return `[CORS] origens permitidas: ${allowlist.join(', ')}`;
}
