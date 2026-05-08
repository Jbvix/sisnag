/* global window, document, navigator */
(function attachSensors(global) {
  global.startSensors = function startSensors(socket) {
    const statusEl = document.getElementById('sensors-status');
    if (navigator.geolocation) {
      navigator.geolocation.watchPosition(
        (pos) => {
          const data = {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            sog: pos.coords.speed ? (pos.coords.speed * 1.94384).toFixed(1) : 0,
            cog: pos.coords.heading || 0,
            accuracy: pos.coords.accuracy,
          };
          socket.emit('sensor_update', { type: 'gps', data });
          if (statusEl) {
            statusEl.textContent = `📍 ${data.lat.toFixed(4)}, ${data.lon.toFixed(4)} | ${data.sog} kn`;
          }
        },
        (err) => console.error('GPS', err),
        { enableHighAccuracy: true, maximumAge: 5000 },
      );
    } else if (statusEl) {
      statusEl.textContent = '📍 GPS indisponível neste dispositivo';
    }

    window.addEventListener('deviceorientation', (e) => {
      socket.emit('sensor_update', { type: 'compass', data: { heading: e.alpha } });
    });

    window.addEventListener('devicemotion', (e) => {
      const acc = e.accelerationIncludingGravity;
      socket.emit('sensor_update', {
        type: 'motion',
        data: {
          roll: acc?.x || 0,
          pitch: acc?.y || 0,
          yaw: acc?.z || 0,
        },
      });
    });
  };
})(window);
