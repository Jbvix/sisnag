/* global L, io, window, document */
(function main() {
  const map = L.map('map').setView([-12.97, -38.48], 9);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap',
  }).addTo(map);

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
