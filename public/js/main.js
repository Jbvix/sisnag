/* global L, io, window, document */
(function main() {
  const map = L.map('map').setView([-12.97, -38.48], 9);

  /** Leaflet com contentor 100vh pode medir 0×0 no 1.º frame — força relayout para carregar tiles. */
  function sisnagMapResize() {
    try {
      map.invalidateSize(false);
    } catch (e) {
      /* ignore */
    }
  }

  if (typeof window.initSisnagLayersMenu === 'function') {
    window.initSisnagLayersMenu(map);
  }

  requestAnimationFrame(sisnagMapResize);
  window.addEventListener('load', sisnagMapResize);
  window.addEventListener('pageshow', function (ev) {
    if (ev.persisted) sisnagMapResize();
  });
  window.setTimeout(sisnagMapResize, 350);
  window.setTimeout(sisnagMapResize, 1600);

  if (typeof window.initNavigationOverlay === 'function') {
    window.initNavigationOverlay(map);
  }

  if (typeof window.initFuelPanel === 'function') {
    window.initFuelPanel();
  }

  const apiOrigin = typeof window.__sisnagApiOrigin === 'function' ? window.__sisnagApiOrigin() : '';
  const socket = apiOrigin ? io(apiOrigin) : io();

  if (typeof window.initMarineTrafficEmbed === 'function') {
    window.initMarineTrafficEmbed(map, socket);
  }

  if (typeof window.startSensors === 'function') {
    window.startSensors(socket);
  }
  if (typeof window.initChat === 'function') {
    window.initChat(socket);
  }

  function sisnagStarlinkUiOnline() {
    var el = document.getElementById('sisnag-icon-starlink');
    if (!el) return;
    var on = typeof navigator !== 'undefined' && navigator.onLine !== false;
    el.classList.toggle('sisnag-signal--ok', on);
    el.classList.toggle('sisnag-signal--bad', !on);
    el.title = on
      ? 'Starlink / dados: browser online (ligações por satélite não são medidas pela app).'
      : 'Sem ligação de rede no dispositivo.';
  }
  sisnagStarlinkUiOnline();
  window.addEventListener('online', sisnagStarlinkUiOnline);
  window.addEventListener('offline', sisnagStarlinkUiOnline);
})();
