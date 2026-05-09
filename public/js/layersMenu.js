/* global L, window, document */
(function layersMenu(global) {
  function buildWindyUrl(lat, lng, zoom) {
    const z = Math.max(3, Math.min(11, Math.round(Number(zoom) || 9)));
    const la = Number(lat).toFixed(4);
    const lo = Number(lng).toFixed(4);
    return `https://embed.windy.com/embed2.html?lat=${la}&lon=${lo}&detailLat=${la}&detailLon=${lo}&width=650&height=450&zoom=${z}&level=surface&overlay=wind&product=ecmwf&metric=kmh&message=true`;
  }

  function syncWindyIframe(map, iframe) {
    if (!iframe) return;
    const c = map.getCenter();
    iframe.src = buildWindyUrl(c.lat, c.lng, map.getZoom());
  }

  /**
   * @param {L.Map} map
   */
  global.initSisnagLayersMenu = function initSisnagLayersMenu(map) {
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    });

    const satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: '&copy; Esri, Maxar, Earthstar Geographics',
      },
    );

    const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="https://opentopomap.org/">OpenTopoMap</a>',
    });

    const ocean = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 16,
        attribution: '&copy; Esri, Garmin, GEBCO, NOAA NGDC',
      },
    );

    const seamark = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
      maxZoom: 18,
      opacity: 1,
      attribution: '&copy; <a href="https://www.openseamap.org/">OpenSeaMap</a>',
    });

    const depth = L.tileLayer('https://tiles.openseamap.org/depth/{z}/{x}/{y}.png', {
      maxZoom: 18,
      opacity: 0.85,
      attribution: '&copy; OpenSeaMap depth',
    });

    osm.addTo(map);
    let activeBase = osm;

    function switchBase(layer) {
      if (layer === activeBase) return;
      map.removeLayer(activeBase);
      layer.addTo(map);
      activeBase = layer;
      if (overlayState.seamark && map.hasLayer(seamark)) seamark.bringToFront();
      if (overlayState.depth && map.hasLayer(depth)) depth.bringToFront();
    }

    const overlayState = { seamark: false, depth: false };

    function toggleOverlay(layer, key, on) {
      if (on) {
        if (!map.hasLayer(layer)) layer.addTo(map);
        overlayState[key] = true;
      } else {
        if (map.hasLayer(layer)) map.removeLayer(layer);
        overlayState[key] = false;
      }
    }

    const root = document.createElement('div');
    root.className = 'sisnag-layers-root';
    root.innerHTML = `
      <button type="button" class="sisnag-hb" id="sisnag-hb-open" aria-expanded="false" aria-controls="sisnag-layers-drawer" title="Camadas">☰</button>
      <div class="sisnag-layers-backdrop" id="sisnag-layers-backdrop" hidden></div>
      <aside class="sisnag-layers-drawer" id="sisnag-layers-drawer" hidden aria-label="Camadas do mapa">
        <div class="sisnag-layers-head">
          <strong>Camadas</strong>
          <button type="button" class="sisnag-hb-close" id="sisnag-hb-close" aria-label="Fechar">✕</button>
        </div>
        <div class="sisnag-layers-body">
          <p class="sisnag-layers-hint">Mapa base</p>
          <label class="sisnag-row"><input type="radio" name="sisnag-base" value="osm" checked /> Ruas (OSM)</label>
          <label class="sisnag-row"><input type="radio" name="sisnag-base" value="satellite" /> Satélite (Esri)</label>
          <label class="sisnag-row"><input type="radio" name="sisnag-base" value="topo" /> Relevo (OpenTopoMap)</label>
          <label class="sisnag-row"><input type="radio" name="sisnag-base" value="ocean" /> Fundo oceânico (Esri)</label>

          <p class="sisnag-layers-hint">Sobreposições</p>
          <label class="sisnag-row"><input type="checkbox" id="sisnag-osm-seamark" /> OpenSeaMap — balizagem / marcas</label>
          <label class="sisnag-row"><input type="checkbox" id="sisnag-osm-depth" /> OpenSeaMap — batimetria (onde disponível)</label>

          <p class="sisnag-layers-hint">Painéis (embed)</p>
          <button type="button" class="sisnag-panel-btn" id="sisnag-open-windy">🌬️ Windy (meteo)</button>
          <button type="button" class="sisnag-panel-btn" id="sisnag-open-mt">🚢 Marine Traffic (AIS)</button>
        </div>
      </aside>
    `;
    document.body.appendChild(root);

    const windyPanel = document.getElementById('windy-panel');
    const windyIframe = document.getElementById('windy-iframe');
    const btnWindyClose = document.getElementById('windy-close');
    const btnWindySync = document.getElementById('windy-sync-map');

    const drawer = root.querySelector('#sisnag-layers-drawer');
    const backdrop = root.querySelector('#sisnag-layers-backdrop');
    const btnOpen = root.querySelector('#sisnag-hb-open');
    const btnClose = root.querySelector('#sisnag-hb-close');

    function openDrawer() {
      drawer.hidden = false;
      backdrop.hidden = false;
      btnOpen.setAttribute('aria-expanded', 'true');
    }
    function closeDrawer() {
      drawer.hidden = true;
      backdrop.hidden = true;
      btnOpen.setAttribute('aria-expanded', 'false');
    }

    btnOpen.addEventListener('click', () => openDrawer());
    btnClose.addEventListener('click', () => closeDrawer());
    backdrop.addEventListener('click', () => closeDrawer());

    root.querySelectorAll('input[name="sisnag-base"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        const v = radio.value;
        if (v === 'osm') switchBase(osm);
        else if (v === 'satellite') switchBase(satellite);
        else if (v === 'topo') switchBase(topo);
        else if (v === 'ocean') switchBase(ocean);
      });
    });

    root.querySelector('#sisnag-osm-seamark').addEventListener('change', (e) => {
      toggleOverlay(seamark, 'seamark', e.target.checked);
    });
    root.querySelector('#sisnag-osm-depth').addEventListener('change', (e) => {
      toggleOverlay(depth, 'depth', e.target.checked);
    });

    root.querySelector('#sisnag-open-windy').addEventListener('click', () => {
      closeDrawer();
      if (windyPanel && windyIframe) {
        windyPanel.classList.add('is-open');
        syncWindyIframe(map, windyIframe);
      }
    });

    root.querySelector('#sisnag-open-mt').addEventListener('click', () => {
      closeDrawer();
      if (typeof global.openMarineTrafficPanel === 'function') {
        global.openMarineTrafficPanel();
      }
    });

    if (btnWindyClose && windyPanel) {
      btnWindyClose.addEventListener('click', () => windyPanel.classList.remove('is-open'));
    }
    if (btnWindySync && windyIframe) {
      btnWindySync.addEventListener('click', () => syncWindyIframe(map, windyIframe));
    }

    global.openWindyPanel = function () {
      if (windyPanel && windyIframe) {
        windyPanel.classList.add('is-open');
        syncWindyIframe(map, windyIframe);
      }
    };
  };
})(window);
