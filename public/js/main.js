/* global L, io, window, document */
(function main() {
  const map = L.map('map').setView([-12.97, -38.48], 9);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap',
  }).addTo(map);

  const socket = io();

  socket.on('vessels', (payload) => {
    if (payload && payload.message && window.console) {
      console.info('[SISNAG]', payload.message);
    }
  });

  if (typeof window.startSensors === 'function') {
    window.startSensors(socket);
  }
  if (typeof window.initChat === 'function') {
    window.initChat(socket);
  }
})();
