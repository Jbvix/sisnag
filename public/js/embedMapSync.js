/* global L, window, document */
/**
 * Sincroniza centro/zoom dos iframes Windy e Marine Traffic com o mapa Leaflet e a derrota.
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
        return {
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
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
    return {
      w: Math.min(1650, Math.max(520, Math.round(window.innerWidth || 1280))),
      h: Math.min(1200, Math.max(400, Math.round(window.innerHeight * 0.55 || 600))),
    };
  }

  /**
   * Windy embed usa escala diferente do Leaflet — aproximação empírica.
   * @param {number} leafletZoom
   */
  function leafletZoomToWindy(leafletZoom) {
    var z = Number(leafletZoom) || 9;
    var windy = Math.round(z - 1);
    return Math.max(3, Math.min(11, windy));
  }

  function leafletZoomToMarineTraffic(leafletZoom) {
    var z = Number(leafletZoom) || 9;
    return Math.max(2, Math.min(17, Math.round(z)));
  }

  /**
   * Centro/zoom alinhados à derrota (waypoints) ou ao mapa actual.
   * @param {L.Map} map
   */
  function getSyncView(map) {
    if (!map) return { lat: 0, lng: 0, zoom: 9 };
    var wps =
      typeof global.__sisnagCollectWaypoints === 'function' ? global.__sisnagCollectWaypoints() : [];
    if (wps.length >= 2) {
      try {
        var bounds = L.latLngBounds(
          wps.map(function (w) {
            return [w.lat, w.lng];
          }),
        );
        var c = bounds.getCenter();
        var z = map.getBoundsZoom(bounds, { padding: [40, 40], maxZoom: 12 });
        return { lat: c.lat, lng: c.lng, zoom: z, source: 'route' };
      } catch (e) {
        /* fallback */
      }
    }
    if (wps.length === 1) {
      return {
        lat: wps[0].lat,
        lng: wps[0].lng,
        zoom: Math.max(map.getZoom(), 10),
        source: 'waypoint',
      };
    }
    var center = map.getCenter();
    return {
      lat: center.lat,
      lng: center.lng,
      zoom: map.getZoom(),
      source: 'map',
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

  function syncKey(view) {
    return (
      view.lat.toFixed(4) +
      ',' +
      view.lng.toFixed(4) +
      ',' +
      view.zoom +
      ',' +
      embedShellSize().w +
      'x' +
      embedShellSize().h
    );
  }

  function applySync(map, opts) {
    if (!map) return;
    var force = opts && opts.force;
    var useRoute = opts && opts.useRoute;
    var view = useRoute ? getSyncView(map) : getSyncView(map);
    if (!useRoute && map) {
      var c = map.getCenter();
      view = { lat: c.lat, lng: c.lng, zoom: map.getZoom(), source: 'map' };
    }
    if (!force) {
      var key = syncKey(view);
      if (key === lastSyncKey) return;
      lastSyncKey = key;
    }

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
  }

  /** Ao abrir painel: enquadrar derrota se existir waypoints. */
  global.__sisnagSyncEmbedsToRoute = function (map) {
    if (!map) return;
    var wps =
      typeof global.__sisnagCollectWaypoints === 'function' ? global.__sisnagCollectWaypoints() : [];
    if (wps.length >= 2) {
      try {
        var bounds = L.latLngBounds(
          wps.map(function (w) {
            return [w.lat, w.lng];
          }),
        );
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 12, animate: false });
        if (typeof global.__sisnagMainMap !== 'undefined' && global.__sisnagVectorMap) {
          var v = global.__sisnagVectorMap;
          v.setView(map.getCenter(), map.getZoom(), { animate: false });
        }
      } catch (e) {
        /* ignore */
      }
    }
    lastSyncKey = '';
    applySync(map, { force: true, useRoute: true });
  };

  /** Segue o mapa (pan/zoom) com debounce. */
  global.__sisnagSyncEmbedsToMap = function (map) {
    applySync(map, { useRoute: false });
  };

  global.__sisnagDebouncedEmbedSync = function (map) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      global.__sisnagSyncEmbedsToMap(map);
    }, 600);
  };

  global.__sisnagBuildWindyUrl = buildWindyUrl;
  global.__sisnagBuildMarineTrafficUrl = buildMarineTrafficUrl;
  global.__sisnagGetEmbedSyncView = getSyncView;

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
