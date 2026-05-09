/* global window */
(function apiOriginShim(global) {
  /** URL base do backend (Railway). Vazio = mesmo host que serve o HTML (ex.: npm start local). */
  global.__sisnagApiOrigin = function __sisnagApiOrigin() {
    var o = typeof global.__SISNAG_API_ORIGIN__ === 'string' ? global.__SISNAG_API_ORIGIN__.trim() : '';
    return o.replace(/\/$/, '');
  };

  /** Caminho absoluto na API (ex.: /api/chat → https://rail.../api/chat). */
  global.__sisnagApiUrl = function __sisnagApiUrl(path) {
    var p = String(path || '/');
    if (p.charAt(0) !== '/') p = '/' + p;
    var base = global.__sisnagApiOrigin();
    return base ? base + p : p;
  };
})(window);
