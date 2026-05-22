/* global L, window, document */
/**
 * Windy / Marine Traffic / OpenSeaMap — mesmo centro WGS84 que o mapa Leaflet (#map).
 * Waypoints (#map-vector-overlay) seguem o Leaflet em tempo real; iframes atualizam no fim do arrasto.
 */
(function embedMapSync(global) {
  var debounceTimer = null;
  var lastSyncKey = '';

  function hasOpenEmbeds() {
    return (
      document.getElementById('windy-panel')?.classList.contains('is-open') ||
      document.getElementById('mt-panel')?.classList.contains('is-open') ||
      document.getElementById('osm-panel')?.classList.contains('is-open')
    );
  }

  function embedShellSize() {
    var shell = document.querySelector(
      '#windy-panel.is-open .embed-shell, #mt-panel.is-open .embed-shell, #osm-panel.is-open .embed-shell',
    );
    if (shell) {
      var r = shell.getBoundingClientRect();
      if (r.width > 100 && r.height > 100) {
        return { w: Math.round(r.width), h: Math.round(r.height) };
      }
    }
    var mapEl = document.getElementById('map');
    if (mapEl) {
      var mr = mapEl.getBoundingClientRect();
      return {
        w: Math.max(400, Math.round(mr.width)),
        h: Math.max(300, Math.round(mr.height)),
      };
    }
    return { w: 800, h: 500 };
  }

  function leafletZoomToWindy(leafletZoom) {
    var z = Number(leafletZoom) || 9;
    return Math.max(3, Math.min(11, Math.round(z)));
  }

  function leafletZoomToMarineTraffic(leafletZoom) {
    var z = Number(leafletZoom) || 9;
    return Math.max(2, Math.min(17, Math.round(z)));
  }

  /** Windy embed clássico (mesmo formato CHARTER-VIEW-2 — melhor alinhamento que embed2). */
  function buildWindyUrl(lat, lng, zoom) {
    var z = leafletZoomToWindy(zoom);
    var la = Number(lat).toFixed(5);
    var lo = Number(lng).toFixed(5);
    return (
      'https://embed.windy.com/embed.html?type=map&location=coordinates&zoom=' +
      z +
      '&lat=' +
      la +
      '&lon=' +
      lo +
      '&detailLat=' +
      la +
      '&detailLon=' +
      lo +
      '&metricWind=kt&metricTemp=%C2%B0C&message=false'
    );
  }

  function buildMarineTrafficUrl(lat, lng, zoom) {
    var z = leafletZoomToMarineTraffic(zoom);
    var y = Number(lat).toFixed(5);
    var x = Number(lng).toFixed(5);
    return (
      'https://www.marinetraffic.com/en/ais/embed/zoom:' +
      z +
      '/centery:' +
      y +
      '/centerx:' +
      x +
      '/maptype:0/shownames:true/mmsi:0/shipid:0/fleet:/fleet_id:/vtypes:/showmenu:false/remember:false'
    );
  }

  function buildOpenSeaMapUrl(lat, lng, zoom) {
    var z = Math.max(3, Math.min(18, Math.round(Number(zoom) || 9)));
    var la = Number(lat).toFixed(5);
    var lo = Number(lng).toFixed(5);
    return 'https://map.openseamap.org/?zoom=' + z + '&lat=' + la + '&lon=' + lo;
  }

  function viewFromLeafletCenter(map) {
    var c = map.getCenter();
    return { lat: c.lat, lng: c.lng, zoom: map.getZoom(), cities: [], source: 'map-center' };
  }

  /** Centro por cidades visíveis — só no botão «Alinhar cidades + derrota». */
  function viewFromCities(map, useFitZoom) {
    if (typeof global.__sisnagCityAlignedView === 'function') {
      return global.__sisnagCityAlignedView(map, { useFitZoom: !!useFitZoom });
    }
    return viewFromLeafletCenter(map);
  }

  function syncVectorToMain(map) {
    var v = global.__sisnagVectorMap;
    if (!v || !map) return;
    try {
      var c = map.getCenter();
      v.setView(c, map.getZoom(), { animate: false, padding: [0, 0] });
    } catch (e) {
      /* ignore */
    }
  }

  function publishRefMarker(map, view) {
    if (typeof global.__sisnagFixNauticalReference !== 'function') return;
    try {
      global.__sisnagFixNauticalReference(map, {
        snapSeamark: false,
        useRoute: false,
        preferGps: false,
        forceCenter: view,
      });
    } catch (e) {
      /* ignore */
    }
  }

  function applySyncFromMap(map, force) {
    if (!map) return;

    var stack = document.getElementById('embed-stack');
    if (stack) stack.style.transform = '';

    var view = force ? viewFromCities(map, true) : viewFromLeafletCenter(map);

    if (force && typeof global.__sisnagApplyCityAlignedViewToMap === 'function') {
      global.__sisnagApplyCityAlignedViewToMap(map, view);
      view = viewFromLeafletCenter(map);
    }

    syncVectorToMain(map);

    var windyZ = leafletZoomToWindy(view.zoom);
    var mtZ = leafletZoomToMarineTraffic(view.zoom);
    var key =
      view.lat.toFixed(4) +
      ',' +
      view.lng.toFixed(4) +
      ',' +
      windyZ +
      ',' +
      mtZ +
      ',' +
      embedShellSize().w +
      'x' +
      embedShellSize().h;
    if (!force && key === lastSyncKey) return;
    lastSyncKey = key;

    if (force) {
      publishRefMarker(map, view);
      if (typeof global.__sisnagPublishCityAlignStatus === 'function') {
        global.__sisnagPublishCityAlignStatus(viewFromCities(map, false));
      }
    }
    if (typeof global.__sisnagUpdateCityReferenceMarkers === 'function') {
      global.__sisnagUpdateCityReferenceMarkers(map);
    }

    var windyPanel = document.getElementById('windy-panel');
    var windyIframe = document.getElementById('windy-iframe');
    if (windyPanel && windyPanel.classList.contains('is-open') && windyIframe) {
      var wUrl = buildWindyUrl(view.lat, view.lng, view.zoom);
      if (windyIframe.src !== wUrl) windyIframe.src = wUrl;
    }

    var mtPanel = document.getElementById('mt-panel');
    var mtIframe = document.getElementById('mt-iframe');
    if (mtPanel && mtPanel.classList.contains('is-open') && mtIframe) {
      var mUrl = buildMarineTrafficUrl(view.lat, view.lng, view.zoom);
      if (mtIframe.src !== mUrl) mtIframe.src = mUrl;
    }

    var osmPanel = document.getElementById('osm-panel');
    var osmIframe = document.getElementById('osm-iframe');
    if (osmPanel && osmPanel.classList.contains('is-open') && osmIframe) {
      var oUrl = buildOpenSeaMapUrl(view.lat, view.lng, view.zoom);
      if (osmIframe.src !== oUrl) osmIframe.src = oUrl;
    }
  }

  global.__sisnagSetEmbedDriveMode = function (active) {
    var stack = document.getElementById('embed-stack');
    var chk = document.getElementById('sisnag-embed-click-through');
    if (active) {
      document.body.classList.add('sisnag-embed-drive');
      if (stack) stack.classList.add('embed-click-through');
      if (chk) chk.checked = true;
    } else {
      var windyOpen = document.getElementById('windy-panel')?.classList.contains('is-open');
      var mtOpen = document.getElementById('mt-panel')?.classList.contains('is-open');
      if (!windyOpen && !mtOpen) {
        document.body.classList.remove('sisnag-embed-drive');
        if (stack) stack.classList.remove('embed-click-through');
        if (chk) chk.checked = false;
      }
    }
  };

  function runAfterMapSettled(map, force) {
    try {
      map.invalidateSize(false);
    } catch (e) {
      /* ignore */
    }
    applySyncFromMap(map, force);
  }

  global.__sisnagSyncEmbedsToRoute = function (map) {
    if (!map) return;
    global.__sisnagSetEmbedDriveMode(true);
    lastSyncKey = '';

    var wps =
      typeof global.__sisnagCollectWaypoints === 'function' ? global.__sisnagCollectWaypoints() : [];

    function finish() {
      setTimeout(function () {
        runAfterMapSettled(map, true);
      }, 150);
    }

    if (wps.length >= 2) {
      try {
        var bounds =
          typeof global.__sisnagBoundsForRouteAndCities === 'function'
            ? global.__sisnagBoundsForRouteAndCities(wps)
            : L.latLngBounds(
                wps.map(function (w) {
                  return [w.lat, w.lng];
                }),
              );
        if (bounds) {
          map.once('moveend', finish);
          map.fitBounds(bounds, { padding: [56, 56], maxZoom: 11, animate: false });
          setTimeout(finish, 500);
          return;
        }
      } catch (e) {
        /* ignore */
      }
    } else if (wps.length === 1) {
      map.setView([wps[0].lat, wps[0].lng], 11, { animate: false });
      finish();
      return;
    }
    finish();
  };

  global.__sisnagSyncEmbedsToMap = function (map) {
    applySyncFromMap(map, false);
  };

  global.__sisnagDebouncedEmbedSync = function (map) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      global.__sisnagSyncEmbedsToMap(map);
    }, 550);
  };

  global.__sisnagBuildWindyUrl = buildWindyUrl;
  global.__sisnagBuildMarineTrafficUrl = buildMarineTrafficUrl;
  global.__sisnagBuildOpenSeaMapUrl = buildOpenSeaMapUrl;

  global.__sisnagAttachEmbedMapListeners = function (map) {
    if (!map || map.__sisnagEmbedListeners) return;
    map.__sisnagEmbedListeners = true;

    function onMapChange() {
      if (!hasOpenEmbeds()) {
        if (typeof global.__sisnagUpdateCityReferenceMarkers === 'function') {
          global.__sisnagUpdateCityReferenceMarkers(map);
        }
        return;
      }
      global.__sisnagDebouncedEmbedSync(map);
    }

    map.on('move', function () {
      syncVectorToMain(map);
      if (hasOpenEmbeds() && typeof global.__sisnagUpdateCityReferenceMarkers === 'function') {
        global.__sisnagUpdateCityReferenceMarkers(map);
      }
    });
    map.on('moveend', onMapChange);
    map.on('zoomend', onMapChange);
    window.addEventListener('resize', function () {
      lastSyncKey = '';
      onMapChange();
    });
  };
})(window);
