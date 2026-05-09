/* global L, io, window, document */
(function main() {
  const map = L.map('map').setView([-12.97, -38.48], 9);

  if (typeof window.initSisnagLayersMenu === 'function') {
    window.initSisnagLayersMenu(map);
  }

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
})();
