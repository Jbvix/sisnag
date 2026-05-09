/* global window, document, navigator */
(function attachSensors(global) {
  function setGpsIcon(kind, title) {
    var wrap = document.getElementById('sisnag-icon-gps');
    if (!wrap) return;
    wrap.classList.remove('sisnag-signal--ok', 'sisnag-signal--warn', 'sisnag-signal--bad', 'sisnag-signal--idle');
    wrap.classList.add('sisnag-signal--' + (kind || 'idle'));
    if (title) wrap.title = title;
  }

  global.startSensors = function startSensors(socket) {
    function gpsErrorNote(err) {
      var code = err && err.code;
      if (code === 1) {
        setGpsIcon(
          'bad',
          'GPS bloqueado — repor permissão em Informações da página (ícone ao lado do URL). Marine Traffic: usar captura → Grok.',
        );
      } else if (code === 2 || code === 3) {
        setGpsIcon('warn', 'GPS sem fix ou impreciso — tente ao ar livre.');
      } else {
        setGpsIcon('warn', 'GPS: erro ou permissão (' + String(code != null ? code : '') + ').');
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
          setGpsIcon(
            'ok',
            'GPS OK · ' +
              data.lat.toFixed(4) +
              ', ' +
              data.lon.toFixed(4) +
              ' · SOG ' +
              data.sog +
              ' kn · ±' +
              (data.accuracy != null ? Math.round(data.accuracy) : '?') +
              ' m',
          );
          if (typeof window.__sisnagSetVesselPosition === 'function') {
            window.__sisnagSetVesselPosition(data.lat, data.lon, data.sog);
          }
          /** GPS mais recente — enviado ao /api/chat para filtrar avisos SeaLag.om por proximidade. */
          global.__sisnagLastKnownGps = { lat: data.lat, lng: data.lon, ts: Date.now() };
        },
        (err) => gpsErrorNote(err),
        { enableHighAccuracy: true, maximumAge: 5000 },
      );
    } else {
      setGpsIcon('bad', 'Geolocalização não disponível neste dispositivo.');
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
