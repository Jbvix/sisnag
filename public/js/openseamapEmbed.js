/* global window, document */
(function openseamapEmbed(global) {
  /**
   * Mapa web oficial OpenSeaMap (permalink lat/lon/zoom).
   * @see https://map.openseamap.org/
   */
  function buildOpenSeaMapUrl(lat, lng, zoom) {
    const z = Math.max(3, Math.min(18, Math.round(Number(zoom) || 9)));
    const la = Number(lat).toFixed(5);
    const lo = Number(lng).toFixed(5);
    return `https://map.openseamap.org/?zoom=${z}&lat=${la}&lon=${lo}`;
  }

  global.initOpenSeaMapEmbed = function initOpenSeaMapEmbed(map) {
    const panel = document.getElementById('osm-panel');
    const iframe = document.getElementById('osm-iframe');
    const statusEl = document.getElementById('targets-status');

    function setStatus(t) {
      if (statusEl) statusEl.textContent = t || '';
    }

    function syncIframeFromMap() {
      if (!iframe || !map) return;
      const c = map.getCenter();
      iframe.src = buildOpenSeaMapUrl(c.lat, c.lng, map.getZoom());
    }

    function openPanel() {
      if (!panel) return;
      panel.classList.add('is-open');
      syncIframeFromMap();
      setStatus('OpenSeaMap: carta náutica (balizagem). Feche para voltar ao mapa SISNAG.');
      if (typeof global.__sisnagRefreshEmbedStack === 'function') global.__sisnagRefreshEmbedStack();
    }

    global.openOpenSeaMapPanel = openPanel;

    const btnClose = document.getElementById('osm-close');
    const btnSync = document.getElementById('osm-sync-map');
    const btnExternal = document.getElementById('osm-open-external');

    if (btnClose && panel) {
      btnClose.addEventListener('click', function () {
        panel.classList.remove('is-open');
        setStatus('Alvos: —');
        if (typeof global.__sisnagRefreshEmbedStack === 'function') global.__sisnagRefreshEmbedStack();
      });
    }
    if (btnSync) btnSync.addEventListener('click', syncIframeFromMap);
    if (btnExternal && map) {
      btnExternal.addEventListener('click', function () {
        const c = map.getCenter();
        const url = buildOpenSeaMapUrl(c.lat, c.lng, map.getZoom());
        window.open(url, '_blank', 'noopener,noreferrer');
      });
    }
  };
})(window);
