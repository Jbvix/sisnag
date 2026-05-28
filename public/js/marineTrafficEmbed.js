/* global L, window, document */
(function marineTrafficEmbed(global) {
  global.initMarineTrafficEmbed = function initMarineTrafficEmbed(map, socket) {
    const panel = document.getElementById('mt-panel');
    const iframe = document.getElementById('mt-iframe');
    const statusEl = document.getElementById('targets-status');

    function setStatus(t) {
      if (statusEl) statusEl.textContent = t || '';
    }

    function syncIframeFromMap() {
      if (typeof global.__sisnagSyncEmbedsToRoute === 'function') {
        global.__sisnagSyncEmbedsToRoute(map);
      }
    }

    const btnOpen = document.getElementById('btn-mt-embed');
    const btnClose = document.getElementById('mt-close');
    const btnSync = document.getElementById('mt-sync-map');
    const btnCapture = document.getElementById('mt-capture-grok');
    const btnSocketRefresh = document.getElementById('mt-socket-refresh');

    function openPanel() {
      if (!panel) return;
      panel.classList.add('is-open');
      if (typeof global.__sisnagRefreshEmbedCombo === 'function') global.__sisnagRefreshEmbedCombo();
      setTimeout(syncIframeFromMap, 120);
      var combo =
        document.getElementById('windy-panel')?.classList.contains('is-open') &&
        panel.classList.contains('is-open');
      setStatus(
        combo
          ? 'Windy + Marine Traffic sobrepostos. Arraste o mapa SISNAG; use opacidade no menu ☰.'
          : 'Marine Traffic segue o mapa SISNAG. Arraste o mapa (não o iframe).',
      );
    }

    global.openMarineTrafficPanel = openPanel;

    if (btnOpen && panel) {
      btnOpen.addEventListener('click', openPanel);
    }
    if (btnClose && panel) {
      btnClose.addEventListener('click', () => {
        panel.classList.remove('is-open');
        if (typeof global.__sisnagSelectDefaultMapView === 'function') {
          global.__sisnagSelectDefaultMapView();
        } else {
          if (typeof global.__sisnagRefreshEmbedCombo === 'function') global.__sisnagRefreshEmbedCombo();
        }
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
      if (typeof global.__sisnagSetAisMarkers === 'function') {
        global.__sisnagSetAisMarkers(payload.ships);
      }
      if (payload.message) setStatus(payload.message);
    });
  };
})(window);
