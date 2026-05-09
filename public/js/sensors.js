/* global window, document, navigator */
(function attachSensors(global) {
  global.startSensors = function startSensors(socket) {
    const statusEl = document.getElementById('sensors-status');
    function gpsErrorNote(err) {
      if (!statusEl) return;
      var code = err && err.code;
      if (code === 1) {
        statusEl.textContent =
          '📍 GPS bloqueado: reponha permissão em “Informações da página” (ícone 🔒 ao lado da URL no Chrome).';
      } else if (code === 2 || code === 3) {
        statusEl.textContent = '📍 GPS temporariamente indisponível ou sem fix (tente outra vez ao ar livre).';
      } else {
        statusEl.textContent = '📍 GPS: permissão ou erro (' + String(code != null ? code : '') + ').';
      }
    }

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
          if (typeof window.__sisnagSetVesselPosition === 'function') {
            window.__sisnagSetVesselPosition(data.lat, data.lon, data.sog);
          }
          /** GPS mais recente — enviado ao /api/chat para filtrar avisos SeaLag.om por proximidade. */
          global.__sisnagLastKnownGps = { lat: data.lat, lng: data.lon, ts: Date.now() };
        },
        (err) => gpsErrorNote(err),
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
