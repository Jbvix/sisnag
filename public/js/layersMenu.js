/* global L, window, document */
(function layersMenu(global) {
  function refreshEmbedStack() {
    if (typeof global.__sisnagRefreshEmbedCombo === 'function') {
      global.__sisnagRefreshEmbedCombo();
    }
  }

  global.__sisnagRefreshEmbedStack = refreshEmbedStack;

  /**
   * @param {L.Map} map
   */
  global.initSisnagLayersMenu = function initSisnagLayersMenu(map) {
    if (typeof global.__sisnagAttachEmbedMapListeners === 'function') {
      global.__sisnagAttachEmbedMapListeners(map);
    }
    var tCommon = { detectRetina: false };

    function setMapTileStatus(msg) {
      var el = document.getElementById('targets-status');
      if (el) el.textContent = msg || 'Alvos: —';
    }

    function makeBase(id, url, opts) {
      return L.tileLayer(url, Object.assign({}, tCommon, opts, { className: 'sisnag-base-' + id }));
    }

    /** Ordem de arranque: CDNs que costumam funcionar em rede móvel / Starlink. */
    var baseCarto = makeBase(
      'carto',
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      {
        subdomains: 'abcd',
        maxZoom: 20,
        attribution: '&copy; OSM &copy; <a href="https://carto.com/">CARTO</a>',
      },
    );
    var baseEsriStreet = makeBase(
      'esri-street',
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 23, attribution: '&copy; Esri' },
    );
    var osm = makeBase('osm', 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    });

    var baseFallbackChain = [baseCarto, baseEsriStreet, osm];
    var baseFailCount = 0;
    var fallbackIndex = 0;

    var satellite = makeBase(
      'satellite',
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: '&copy; Esri, Maxar' },
    );

    var topo = makeBase('topo', 'https://tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution: '&copy; OSM, <a href="https://opentopomap.org/">OpenTopoMap</a>',
    });

    var ocean = makeBase(
      'ocean',
      'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 16, attribution: '&copy; Esri, GEBCO' },
    );

    if (!map.getPane('sisnagSeamarkPane')) {
      map.createPane('sisnagSeamarkPane');
      map.getPane('sisnagSeamarkPane').style.zIndex = 450;
    }
    if (!map.getPane('sisnagDepthPane')) {
      map.createPane('sisnagDepthPane');
      map.getPane('sisnagDepthPane').style.zIndex = 440;
    }

    var seamark = L.tileLayer('https://t1.openseamap.org/seamark/{z}/{x}/{y}.png', {
      maxZoom: 18,
      opacity: 1,
      detectRetina: false,
      pane: 'sisnagSeamarkPane',
      attribution: '&copy; <a href="https://www.openseamap.org/">OpenSeaMap</a>',
    });

    var depth = L.tileLayer('https://t1.openseamap.org/depth/{z}/{x}/{y}.png', {
      maxZoom: 18,
      opacity: 0.85,
      detectRetina: false,
      pane: 'sisnagDepthPane',
      attribution: '&copy; OpenSeaMap depth',
    });

    var seamarkMirror = null;
    var depthMirror = null;

    var overlayState = { seamark: false, depth: false };
    var seamarkFail = 0;

    seamark.on('tileerror', function () {
      seamarkFail++;
      if (seamarkFail >= 6) {
        setMapTileStatus('OpenSeaMap: rede bloqueou tiles — abra «Carta completa» no menu.');
      }
    });
    seamark.on('tileload', function () {
      if (overlayState.seamark) setMapTileStatus('OpenSeaMap: balizagem no mapa SISNAG');
    });

    function setActiveBaseLabel(v) {
      global.__sisnagActiveBaseLayer = v;
    }

    function switchBase(layer, label) {
      if (layer === activeBase) return;
      map.removeLayer(activeBase);
      layer.addTo(map);
      activeBase = layer;
      if (label) setActiveBaseLabel(label);
      if (overlayState.seamark && map.hasLayer(seamark)) seamark.bringToFront();
      if (overlayState.depth && map.hasLayer(depth)) depth.bringToFront();
      setTimeout(function () {
        try {
          map.invalidateSize(false);
        } catch (e) {
          /* ignore */
        }
      }, 50);
    }

    var activeBase = baseCarto;
    activeBase.addTo(map);
    setActiveBaseLabel('carto');

    function tryNextBaseFallback() {
      fallbackIndex++;
      if (fallbackIndex >= baseFallbackChain.length) {
        setMapTileStatus('Mapa: sem tiles (rede bloqueou OSM/Esri/Carto).');
        return;
      }
      var next = baseFallbackChain[fallbackIndex];
      if (next === activeBase) {
        tryNextBaseFallback();
        return;
      }
      switchBase(next, 'fallback');
      setMapTileStatus('Mapa: base ' + (fallbackIndex + 1) + '/' + baseFallbackChain.length);
    }

    baseFallbackChain.forEach(function (layer) {
      layer.on('tileerror', function () {
        if (layer !== activeBase) return;
        baseFailCount++;
        if (baseFailCount >= 3) {
          baseFailCount = 0;
          tryNextBaseFallback();
        }
      });
      layer.on('tileload', function () {
        if (layer === activeBase) setMapTileStatus('Alvos: —');
      });
    });

    function syncVectorMirror(key, on) {
      var vMap = global.__sisnagVectorMap;
      if (!vMap) return;
      if (key === 'seamark') {
        if (on) {
          if (!seamarkMirror) {
            seamarkMirror = L.tileLayer('https://t1.openseamap.org/seamark/{z}/{x}/{y}.png', {
              maxZoom: 18,
              opacity: 1,
              detectRetina: false,
            });
          }
          if (!vMap.hasLayer(seamarkMirror)) seamarkMirror.addTo(vMap);
        } else if (seamarkMirror && vMap.hasLayer(seamarkMirror)) {
          vMap.removeLayer(seamarkMirror);
        }
      } else if (key === 'depth') {
        if (on) {
          if (!depthMirror) {
            depthMirror = L.tileLayer('https://t1.openseamap.org/depth/{z}/{x}/{y}.png', {
              maxZoom: 18,
              opacity: 0.85,
              detectRetina: false,
            });
          }
          if (!vMap.hasLayer(depthMirror)) depthMirror.addTo(vMap);
        } else if (depthMirror && vMap.hasLayer(depthMirror)) {
          vMap.removeLayer(depthMirror);
        }
      }
    }

    function toggleOverlay(layer, key, on) {
      if (on) {
        if (!map.hasLayer(layer)) layer.addTo(map);
        overlayState[key] = true;
        syncVectorMirror(key, true);
        layer.bringToFront();
      } else {
        if (map.hasLayer(layer)) map.removeLayer(layer);
        overlayState[key] = false;
        syncVectorMirror(key, false);
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
      <button type="button" class="sisnag-dock-btn sisnag-dock-btn--layers" id="sisnag-hb-open" aria-expanded="false" aria-controls="sisnag-layers-drawer" title="Camadas">
        <svg class="sisnag-ico" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
      </button>
      <div class="sisnag-layers-backdrop" id="sisnag-layers-backdrop" hidden></div>
      <aside class="sisnag-layers-drawer" id="sisnag-layers-drawer" hidden aria-label="Camadas do mapa">
        <div class="sisnag-layers-head">
          <strong>Visualização e Camadas</strong>
          <button type="button" class="sisnag-hb-close" id="sisnag-hb-close" aria-label="Fechar">✕</button>
        </div>
        <div class="sisnag-layers-body">
          <p class="sisnag-layers-hint">Visualização Ativa</p>
          <label class="sisnag-row"><input type="radio" name="sisnag-map-view" value="sisnag" checked /> 🗺️ Mapa Padrão (SISNAG)</label>
          <label class="sisnag-row"><input type="radio" name="sisnag-map-view" value="windy" /> 🌬️ Meteorologia (Windy)</label>
          <label class="sisnag-row"><input type="radio" name="sisnag-map-view" value="mt" /> 🚢 Tráfego Marítimo (Marine Traffic)</label>
          <label class="sisnag-row"><input type="radio" name="sisnag-map-view" value="osm" /> ⚓ Carta Náutica (OpenSeaMap)</label>

          <p class="sisnag-layers-hint">Mapa base (Mapa Padrão)</p>
          <label class="sisnag-row"><input type="radio" name="sisnag-base" value="carto" checked /> Ruas (CARTO / OSM)</label>
          <label class="sisnag-row"><input type="radio" name="sisnag-base" value="osm" /> Ruas (OSM direto)</label>
          <label class="sisnag-row"><input type="radio" name="sisnag-base" value="satellite" /> Satélite (Esri)</label>
          <label class="sisnag-row"><input type="radio" name="sisnag-base" value="topo" /> Relevo (OpenTopoMap)</label>
          <label class="sisnag-row"><input type="radio" name="sisnag-base" value="ocean" /> Fundo oceânico (Esri)</label>

          <p class="sisnag-layers-hint">Sobreposições (Mapa Padrão)</p>
          <label class="sisnag-row"><input type="checkbox" id="sisnag-osm-seamark" checked /> Balizagem OpenSeaMap</label>
          <label class="sisnag-row"><input type="checkbox" id="sisnag-osm-depth" /> Batimetria OpenSeaMap</label>

          <p class="sisnag-layers-hint">Controles de Alinhamento</p>
          <button type="button" class="sisnag-panel-btn sisnag-panel-btn--primary" id="sisnag-align-btn">↻ Alinhar cidades + derrota</button>
          <p class="sisnag-layers-hint" style="font-size:11px;color:#64748b;margin-top:4px;text-transform:none;letter-spacing:normal;">
            Toque para fixar o centro do mapa pelas cidades visíveis (marcadores azuis) e derrota.
          </p>

          <p class="sisnag-layers-hint">Opções</p>
          <label class="sisnag-row"><input type="checkbox" id="sisnag-embed-click-through" checked /> Mapa comanda (arrastar move a derrota; Windy/MT/OSM seguem)</label>
          <label class="sisnag-row"><input type="checkbox" id="sisnag-embed-touch-windy" /> Permitir tocar nos mapas externos (pode desalinhar)</label>
        </div>
      </aside>
    `;
    document.body.appendChild(root);

    var btnOpenMounted = root.querySelector('#sisnag-hb-open');
    var dockRight = document.getElementById('sisnag-dock-right');
    /** Botão camadas à direita (mapa / overlays OpenSeaMap); navegação fica à esquerda. */
    if (dockRight && btnOpenMounted) {
      dockRight.insertBefore(btnOpenMounted, dockRight.firstChild);
    }

    var windyPanel = document.getElementById('windy-panel');
    var windyIframe = document.getElementById('windy-iframe');
    var btnWindyClose = document.getElementById('windy-close');
    var btnWindySync = document.getElementById('windy-sync-map');
    var embedStack = document.getElementById('embed-stack');

    function applyMapViewChange(view) {
      var mtPanel = document.getElementById('mt-panel');
      var osmPanel = document.getElementById('osm-panel');

      // Hide all first
      if (windyPanel) windyPanel.classList.remove('is-open');
      if (mtPanel) mtPanel.classList.remove('is-open');
      if (osmPanel) osmPanel.classList.remove('is-open');

      if (view === 'windy') {
        if (windyPanel) windyPanel.classList.add('is-open');
        refreshEmbedStack();
        updateEmbedPointerMode();
        setTimeout(function () {
          if (typeof global.__sisnagSyncEmbedsToRoute === 'function') {
            global.__sisnagSyncEmbedsToRoute(map);
          }
        }, 100);
      } else if (view === 'mt') {
        if (typeof global.openMarineTrafficPanel === 'function') {
          global.openMarineTrafficPanel();
        } else {
          if (mtPanel) mtPanel.classList.add('is-open');
          refreshEmbedStack();
          updateEmbedPointerMode();
        }
      } else if (view === 'osm') {
        if (typeof global.openOpenSeaMapPanel === 'function') {
          global.openOpenSeaMapPanel();
        } else {
          if (osmPanel) osmPanel.classList.add('is-open');
          refreshEmbedStack();
          updateEmbedPointerMode();
        }
      } else {
        // 'sisnag'
        refreshEmbedStack();
        updateEmbedPointerMode();
      }
    }

    root.querySelectorAll('input[name="sisnag-map-view"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (radio.checked) {
          applyMapViewChange(radio.value);
        }
      });
    });

    global.__sisnagSelectDefaultMapView = function () {
      var rad = root.querySelector('input[name="sisnag-map-view"][value="sisnag"]');
      if (rad && !rad.checked) {
        rad.checked = true;
      }
      applyMapViewChange('sisnag');
    };

    var btnAlign = root.querySelector('#sisnag-align-btn');
    if (btnAlign) {
      btnAlign.addEventListener('click', function () {
        closeDrawer();
        if (typeof global.__sisnagSyncEmbedsToRoute === 'function') {
          global.__sisnagSyncEmbedsToRoute(map);
        }
      });
    }

    function updateEmbedPointerMode() {
      if (!embedStack) return;
      var drive = document.getElementById('sisnag-embed-click-through');
      var touch = document.getElementById('sisnag-embed-touch-windy');
      var driveOn = !drive || drive.checked;
      var touchOn = touch && touch.checked;
      if (driveOn && !touchOn) {
        embedStack.classList.add('embed-click-through');
        embedStack.classList.remove('sisnag-allow-embed-touch');
        document.body.classList.add('sisnag-embed-drive');
      } else {
        embedStack.classList.remove('embed-click-through');
        if (touchOn) embedStack.classList.add('sisnag-allow-embed-touch');
        else embedStack.classList.remove('sisnag-allow-embed-touch');
        if (!document.getElementById('windy-panel')?.classList.contains('is-open') &&
            !document.getElementById('mt-panel')?.classList.contains('is-open') &&
            !document.getElementById('osm-panel')?.classList.contains('is-open')) {
          document.body.classList.remove('sisnag-embed-drive');
        }
      }
    }

    var chkDrive = root.querySelector('#sisnag-embed-click-through');
    var chkTouch = root.querySelector('#sisnag-embed-touch-windy');
    if (chkDrive) chkDrive.addEventListener('change', updateEmbedPointerMode);
    if (chkTouch) {
      chkTouch.addEventListener('change', function () {
        if (chkTouch.checked && chkDrive) chkDrive.checked = false;
        updateEmbedPointerMode();
      });
    }

    var drawer = root.querySelector('#sisnag-layers-drawer');
    var backdrop = root.querySelector('#sisnag-layers-backdrop');
    var btnOpen = btnOpenMounted || root.querySelector('#sisnag-hb-open');
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
        if (v === 'osm') switchBase(osm, 'osm');
        else if (v === 'carto') switchBase(baseCarto, 'carto');
        else if (v === 'satellite') switchBase(satellite, 'satellite');
        else if (v === 'topo') switchBase(topo, 'topo');
        else if (v === 'ocean') switchBase(ocean, 'ocean');
      });
    });

    var chkSeamark = root.querySelector('#sisnag-osm-seamark');
    chkSeamark.addEventListener('change', function (e) {
      toggleOverlay(seamark, 'seamark', e.target.checked);
    });
    root.querySelector('#sisnag-osm-depth').addEventListener('change', function (e) {
      toggleOverlay(depth, 'depth', e.target.checked);
    });

    /** Balizagem activa ao arranque; espelho no overlay vectorial quando existir. */
    chkSeamark.checked = true;
    toggleOverlay(seamark, 'seamark', true);

    global.__sisnagRefreshOsmOverlays = function () {
      if (overlayState.seamark) syncVectorMirror('seamark', true);
      if (overlayState.depth) syncVectorMirror('depth', true);
    };

    global.__sisnagSeamarkLayerActive = function () {
      return overlayState.seamark;
    };

    function closeWindy() {
      if (windyPanel) windyPanel.classList.remove('is-open');
      global.__sisnagSelectDefaultMapView();
    }

    if (btnWindyClose && windyPanel) {
      btnWindyClose.addEventListener('click', closeWindy);
    }
    if (btnWindySync) {
      btnWindySync.addEventListener('click', function () {
        if (typeof global.__sisnagSyncEmbedsToRoute === 'function') {
          global.__sisnagSyncEmbedsToRoute(map);
        }
      });
    }

    global.openWindyPanel = function () {
      var rad = root.querySelector('input[name="sisnag-map-view"][value="windy"]');
      if (rad && !rad.checked) {
        rad.checked = true;
      }
      applyMapViewChange('windy');
    };

    map.whenReady(function () {
      try {
        map.invalidateSize(true);
      } catch (e) {
        /* ignore */
      }
    });

    setTimeout(function () {
      try {
        map.invalidateSize(true);
      } catch (e) {
        /* ignore */
      }
    }, 100);
    setTimeout(function () {
      try {
        map.invalidateSize(true);
      } catch (e) {
        /* ignore */
      }
    }, 800);
  };
})(window);
