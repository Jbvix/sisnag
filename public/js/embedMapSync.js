/* global L, window, document */
/**
 * Windy / Marine Traffic seguem o mapa Leaflet (waypoints).
 * O iframe não recebe arrasto por defeito — só o mapa SISNAG comanda centro/zoom.
 */
(function embedMapSync(global) {
  var debounceTimer = null;
  var lastSyncKey = '';

  function embedShellSize() {
    var shell = document.querySelector(
      '#windy-panel.is-open .embed-shell, #mt-panel.is-open .embed-shell',
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

  function viewFromMap(map) {
    var c = map.getCenter();
    return {
      lat: c.lat,
      lng: c.lng,
      zoom: map.getZoom(),
    };
  }

  function buildWindyUrl(lat, lng, zoom) {
    var size = embedShellSize();
    var z = leafletZoomToWindy(zoom);
    var la = Number(lat).toFixed(5);
    var lo = Number(lng).toFixed(5);
    return (
      'https://embed.windy.com/embed2.html?lat=' +
      la +
      '&lon=' +
      lo +
      '&detailLat=' +
      la +
      '&detailLon=' +
      lo +
      '&width=' +
      size.w +
      '&height=' +
      size.h +
      '&zoom=' +
      z +
      '&level=surface&overlay=wind&product=ecmwf&metric=kmh&message=false'
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
      '/maptype:0/shownames:true/mmsi:0/shipid:0/fleet:/fleet_id:/vtypes:/showmenu:true/remember:false'
    );
  }

  function syncVectorToMain(map) {
    var v = global.__sisnagVectorMap;
    if (!v || !map) return;
    try {
      v.setView(map.getCenter(), map.getZoom(), { animate: false, padding: [0, 0] });
    } catch (e) {
      /* ignore */
    }
  }

  function applySyncFromMap(map, force) {
    if (!map) return;
    var view = viewFromMap(map);
    var key =
      view.lat.toFixed(4) +
      ',' +
      view.lng.toFixed(4) +
      ',' +
      view.zoom +
      ',' +
      embedShellSize().w +
      'x' +
      embedShellSize().h;
    if (!force && key === lastSyncKey) return;
    lastSyncKey = key;

    var windyPanel = document.getElementById('windy-panel');
    var windyIframe = document.getElementById('windy-iframe');
    if (windyPanel && windyPanel.classList.contains('is-open') && windyIframe) {
      windyIframe.src = buildWindyUrl(view.lat, view.lng, view.zoom);
    }

    var mtPanel = document.getElementById('mt-panel');
    var mtIframe = document.getElementById('mt-iframe');
    if (mtPanel && mtPanel.classList.contains('is-open') && mtIframe) {
      mtIframe.src = buildMarineTrafficUrl(view.lat, view.lng, view.zoom);
    }

    syncVectorToMain(map);
  }

  /** Modo condução: mapa Leaflet manda; iframe só desenha meteo/AIS por cima. */
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
    syncVectorToMain(map);
    applySyncFromMap(map, force);
  }

  global.__sisnagSyncEmbedsToRoute = function (map) {
    if (!map) return;
    global.__sisnagSetEmbedDriveMode(true);
    lastSyncKey = '';

    var wps =
      typeof global.__sisnagCollectWaypoints === 'function' ? global.__sisnagCollectWaypoints() : [];

    function done() {
      setTimeout(function () {
        runAfterMapSettled(map, true);
      }, 120);
    }

    if (wps.length >= 2) {
      try {
        var bounds = L.latLngBounds(
          wps.map(function (w) {
            return [w.lat, w.lng];
          }),
        );
        map.once('moveend', done);
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 11, animate: false });
        setTimeout(done, 400);
        return;
      } catch (e) {
        /* ignore */
      }
    }
    done();
  };

  global.__sisnagSyncEmbedsToMap = function (map) {
    applySyncFromMap(map, false);
  };

  global.__sisnagDebouncedEmbedSync = function (map) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      global.__sisnagSyncEmbedsToMap(map);
    }, 450);
  };

  global.__sisnagBuildWindyUrl = buildWindyUrl;
  global.__sisnagBuildMarineTrafficUrl = buildMarineTrafficUrl;

  global.__sisnagAttachEmbedMapListeners = function (map) {
    if (!map || map.__sisnagEmbedListeners) return;
    map.__sisnagEmbedListeners = true;
    function onMapChange() {
      var windyOpen = document.getElementById('windy-panel')?.classList.contains('is-open');
      var mtOpen = document.getElementById('mt-panel')?.classList.contains('is-open');
      if (!windyOpen && !mtOpen) return;
      global.__sisnagDebouncedEmbedSync(map);
    }
    map.on('moveend', onMapChange);
    map.on('zoomend', onMapChange);
    window.addEventListener('resize', function () {
      lastSyncKey = '';
      onMapChange();
    });
  };
})(window);
