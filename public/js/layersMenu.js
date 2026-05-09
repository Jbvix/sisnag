/* global L, window, document */
(function layersMenu(global) {
  function buildWindyUrl(lat, lng, zoom) {
    const z = Math.max(3, Math.min(11, Math.round(Number(zoom) || 9)));
    const la = Number(lat).toFixed(4);
    const lo = Number(lng).toFixed(4);
    const w = Math.min(1650, Math.max(520, Math.round(window.innerWidth || 1280)));
    const h = Math.min(1200, Math.max(520, Math.round(window.innerHeight || 820)));
    return `https://embed.windy.com/embed2.html?lat=${la}&lon=${lo}&detailLat=${la}&detailLon=${lo}&width=${w}&height=${h}&zoom=${z}&level=surface&overlay=wind&product=ecmwf&metric=kmh&message=false`;
  }

  function refreshEmbedStack() {
    var stack = document.getElementById('embed-stack');
    var windy = document.getElementById('windy-panel');
    var mt = document.getElementById('mt-panel');
    if (!stack) return;
    var open = (windy && windy.classList.contains('is-open')) || (mt && mt.classList.contains('is-open'));
    if (open) stack.classList.add('has-open-pointer');
    else stack.classList.remove('has-open-pointer');
  }

  global.__sisnagRefreshEmbedStack = refreshEmbedStack;

  function syncWindyIframe(map, iframe) {
    if (!iframe) return;
    const c = map.getCenter();
    iframe.src = buildWindyUrl(c.lat, c.lng, map.getZoom());
  }

  /**
   * @param {L.Map} map
   */
  global.initSisnagLayersMenu = function initSisnagLayersMenu(map) {
    var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    });

    var satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: '&copy; Esri, Maxar, Earthstar Geographics',
      },
    );

    var topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution:
        'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="https://opentopomap.org/">OpenTopoMap</a>',
    });

    var ocean = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 16,
        attribution: '&copy; Esri, Garmin, GEBCO, NOAA NGDC',
      },
    );

    var seamark = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
      maxZoom: 18,
      opacity: 1,
      attribution: '&copy; <a href="https://www.openseamap.org/">OpenSeaMap</a>',
    });

    var depth = L.tileLayer('https://tiles.openseamap.org/depth/{z}/{x}/{y}.png', {
      maxZoom: 18,
      opacity: 0.85,
      attribution: '&copy; OpenSeaMap depth',
    });

    osm.addTo(map);
    var activeBase = osm;

    function switchBase(layer) {
      if (layer === activeBase) return;
      map.removeLayer(activeBase);
      layer.addTo(map);
      activeBase = layer;
      if (overlayState.seamark && map.hasLayer(seamark)) seamark.bringToFront();
      if (overlayState.depth && map.hasLayer(depth)) depth.bringToFront();
    }

    var overlayState = { seamark: false, depth: false };

    function toggleOverlay(layer, key, on) {
      if (on) {
        if (!map.hasLayer(layer)) layer.addTo(map);
        overlayState[key] = true;
      } else {
        if (map.hasLayer(layer)) map.removeLayer(layer);
        overlayState[key] = false;
      }
    }

    window.addEventListener('resize', function () {
      setTimeout(function () {
        map.invalidateSize(false);
      }, 100);
    });

    var root = document.createElement('div');
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
          <p class="sisnag-layers-hint">Painéis (ecrã completo + transparência)</p>
          <label class="sisnag-slider-row">
            Opacidade Windy
            <input type="range" id="sisnag-windy-op" min="25" max="100" value="82" />
          </label>
          <label class="sisnag-slider-row">
            Opacidade Marine Traffic
            <input type="range" id="sisnag-mt-op" min="25" max="100" value="82" />
          </label>
          <label class="sisnag-row"><input type="checkbox" id="sisnag-embed-click-through" /> Cliques através (iframes ignoram dedo → mapa base / waypoints)</label>

          <p class="sisnag-layers-hint">Mapa base</p>
          <label class="sisnag-row"><input type="radio" name="sisnag-base" value="osm" checked /> Ruas (OSM)</label>
          <label class="sisnag-row"><input type="radio" name="sisnag-base" value="satellite" /> Satélite (Esri)</label>
          <label class="sisnag-row"><input type="radio" name="sisnag-base" value="topo" /> Relevo (OpenTopoMap)</label>
          <label class="sisnag-row"><input type="radio" name="sisnag-base" value="ocean" /> Fundo oceânico (Esri)</label>

          <p class="sisnag-layers-hint">Sobreposições</p>
          <label class="sisnag-row"><input type="checkbox" id="sisnag-osm-seamark" /> OpenSeaMap — balizagem</label>
          <label class="sisnag-row"><input type="checkbox" id="sisnag-osm-depth" /> OpenSeaMap — batimetria</label>

          <p class="sisnag-layers-hint">Painéis (embed)</p>
          <button type="button" class="sisnag-panel-btn" id="sisnag-open-windy">🌬️ Windy (meteo)</button>
          <button type="button" class="sisnag-panel-btn" id="sisnag-open-mt">🚢 Marine Traffic</button>
        </div>
      </aside>
    `;
    document.body.appendChild(root);

    var windyPanel = document.getElementById('windy-panel');
    var windyIframe = document.getElementById('windy-iframe');
    var btnWindyClose = document.getElementById('windy-close');
    var btnWindySync = document.getElementById('windy-sync-map');
    var embedStack = document.getElementById('embed-stack');

    var windyOp = root.querySelector('#sisnag-windy-op');
    var mtOp = root.querySelector('#sisnag-mt-op');
    windyOp.addEventListener('input', function () {
      document.documentElement.style.setProperty('--sisnag-windy-opacity', Number(windyOp.value) / 100);
    });
    mtOp.addEventListener('input', function () {
      document.documentElement.style.setProperty('--sisnag-mt-opacity', Number(mtOp.value) / 100);
    });

    root.querySelector('#sisnag-embed-click-through').addEventListener('change', function (ev) {
      if (!embedStack) return;
      if (ev.target.checked) embedStack.classList.add('embed-click-through');
      else embedStack.classList.remove('embed-click-through');
    });

    var drawer = root.querySelector('#sisnag-layers-drawer');
    var backdrop = root.querySelector('#sisnag-layers-backdrop');
    var btnOpen = root.querySelector('#sisnag-hb-open');
    var btnClose = root.querySelector('#sisnag-hb-close');

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

    root.querySelectorAll('input[name="sisnag-base"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (!radio.checked) return;
        var v = radio.value;
        if (v === 'osm') switchBase(osm);
        else if (v === 'satellite') switchBase(satellite);
        else if (v === 'topo') switchBase(topo);
        else if (v === 'ocean') switchBase(ocean);
      });
    });

    root.querySelector('#sisnag-osm-seamark').addEventListener('change', function (e) {
      toggleOverlay(seamark, 'seamark', e.target.checked);
    });
    root.querySelector('#sisnag-osm-depth').addEventListener('change', function (e) {
      toggleOverlay(depth, 'depth', e.target.checked);
    });

    root.querySelector('#sisnag-open-windy').addEventListener('click', function () {
      closeDrawer();
      if (windyPanel && windyIframe) {
        windyPanel.classList.add('is-open');
        refreshEmbedStack();
        syncWindyIframe(map, windyIframe);
      }
    });

    root.querySelector('#sisnag-open-mt').addEventListener('click', function () {
      closeDrawer();
      if (typeof global.openMarineTrafficPanel === 'function') {
        global.openMarineTrafficPanel();
      }
    });

    function closeWindy() {
      windyPanel.classList.remove('is-open');
      refreshEmbedStack();
    }

    if (btnWindyClose && windyPanel) {
      btnWindyClose.addEventListener('click', closeWindy);
    }
    if (btnWindySync && windyIframe) {
      btnWindySync.addEventListener('click', function () {
        syncWindyIframe(map, windyIframe);
      });
    }

    global.openWindyPanel = function () {
      if (windyPanel && windyIframe) {
        windyPanel.classList.add('is-open');
        refreshEmbedStack();
        syncWindyIframe(map, windyIframe);
      }
    };

  };
})(window);
