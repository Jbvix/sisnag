/* global L, window, document */
(function marineTrafficEmbed(global) {
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * URL oficial de embed AIS (parâmetros documentados pela MarineTraffic).
   * @see https://www.marinetraffic.com/en/p/embed-map
   */
  function buildMarineTrafficEmbedUrl(lat, lng, zoom) {
    const z = Math.max(2, Math.min(17, Math.round(Number(zoom) || 10)));
    const y = Number(lat).toFixed(5);
    const x = Number(lng).toFixed(5);
    return `https://www.marinetraffic.com/en/ais/embed/zoom:${z}/centery:${y}/centerx:${x}/maptype:0/shownames:true/mmsi:0/shipid:0/fleet:/fleet_id:/vtypes:/showmenu:true/remember:false`;
  }

  global.initMarineTrafficEmbed = function initMarineTrafficEmbed(map, socket) {
    const markersLayer = L.layerGroup().addTo(map);
    const panel = document.getElementById('mt-panel');
    const iframe = document.getElementById('mt-iframe');
    const statusEl = document.getElementById('targets-status');

    function setStatus(t) {
      if (statusEl) statusEl.textContent = t || '';
    }

    function syncIframeFromMap() {
      if (!iframe) return;
      const c = map.getCenter();
      iframe.src = buildMarineTrafficEmbedUrl(c.lat, c.lng, map.getZoom());
    }

    const btnOpen = document.getElementById('btn-mt-embed');
    const btnClose = document.getElementById('mt-close');
    const btnSync = document.getElementById('mt-sync-map');
    const btnCapture = document.getElementById('mt-capture-grok');
    const btnSocketRefresh = document.getElementById('mt-socket-refresh');

    function openPanel() {
      if (!panel) return;
      panel.classList.add('is-open');
      syncIframeFromMap();
      setStatus('Marine Traffic incorporado: use captura de ecrã do mapa e “Captura → Grok”.');
    }

    global.openMarineTrafficPanel = openPanel;

    if (btnOpen && panel) {
      btnOpen.addEventListener('click', openPanel);
    }
    if (btnClose && panel) {
      btnClose.addEventListener('click', () => {
        panel.classList.remove('is-open');
      });
    }
    if (btnSync) btnSync.addEventListener('click', syncIframeFromMap);

    if (btnCapture) {
      btnCapture.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.onchange = async (ev) => {
          const file = ev.target.files && ev.target.files[0];
          if (!file) return;
          setStatus('A enviar captura para Grok…');
          const fd = new FormData();
          fd.append('screenshot', file);
          try {
            const res = await fetch(window.__sisnagApiUrl('/api/chart-targets/from-screenshot'), {
              method: 'POST',
              body: fd,
            });
            const data = await res.json();
            setStatus(data.message || (data.ships && `${data.ships.length} alvo(s)`) || 'Resposta recebida.');
          } catch (e) {
            setStatus(String(e.message || e));
          }
        };
        input.click();
      });
    }

    if (btnSocketRefresh && socket) {
      btnSocketRefresh.addEventListener('click', () => {
        socket.emit('chart_targets_refresh');
      });
    }

    socket.on('vessels', (payload) => {
      if (!payload || !Array.isArray(payload.ships)) return;
      markersLayer.clearLayers();
      payload.ships.forEach((s) => {
        if (s.lat == null || s.lon == null || !Number.isFinite(s.lat) || !Number.isFinite(s.lon)) return;
        const m = L.circleMarker([s.lat, s.lon], {
          radius: 7,
          color: '#0369a1',
          weight: 2,
          fillColor: '#38bdf8',
          fillOpacity: 0.9,
        });
        const lines = [`<strong>${escapeHtml(s.name || 'Navio')}</strong>`];
        if (s.mmsi) lines.push('MMSI: ' + escapeHtml(s.mmsi));
        if (s.sog != null) lines.push(`SOG: ${s.sog} kn`);
        if (s.cog != null) lines.push(`COG: ${s.cog}°`);
        if (s.source) lines.push(`Fonte: ${escapeHtml(s.source)}`);
        m.bindPopup(lines.join('<br>'));
        m.addTo(markersLayer);
      });
      if (payload.message) setStatus(payload.message);
    });
  };
})(window);
