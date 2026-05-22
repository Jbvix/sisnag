/* global L, window, document */
/**
 * Ponto de referência náutico único (WGS84) — alinha Leaflet+OpenSeaMap tiles, Windy, Marine Traffic e embed OSM.
 */
(function nauticalReference(global) {
  var refMarker = null;
  var state = {
    lat: null,
    lng: null,
    zoom: 9,
    source: 'unset',
    label: '',
    updatedAt: null,
  };

  /** Faróis próximos para “snap” opcional à carta (mesma base do copiloto). */
  var SNAP_LIGHTS = [
    { name: 'Farol da Barra (Salvador)', lat: -13.0107, lng: -38.5317 },
    { name: 'Farol do Mucuripe', lat: -3.718, lng: -38.476 },
    { name: 'Farol de Suape', lat: -8.39, lng: -34.961 },
    { name: 'Farol de Santos', lat: -23.96, lng: -46.331 },
    { name: 'Farol de Vitória', lat: -20.318, lng: -40.294 },
    { name: 'Farol de Rio Grande', lat: -32.032, lng: -52.098 },
  ];

  function haversineNm(lat1, lon1, lat2, lon2) {
    var R = 3440.065;
    var toRad = function (d) {
      return (d * Math.PI) / 180;
    };
    var dLat = toRad(lat2 - lat1);
    var dLon = toRad(lon2 - lon1);
    var a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(Math.min(1, a)));
  }

  function nearestSnap(lat, lng, maxNm) {
    var best = null;
    SNAP_LIGHTS.forEach(function (l) {
      var d = haversineNm(lat, lng, l.lat, l.lng);
      if (d <= maxNm && (!best || d < best.distanceNm)) {
        best = { name: l.name, lat: l.lat, lng: l.lng, distanceNm: Math.round(d * 100) / 100 };
      }
    });
    return best;
  }

  function formatRefLine() {
    if (state.lat == null || state.lng == null) return 'Ref. carta: —';
    var lat = state.lat;
    var lng = state.lng;
    var ns = lat >= 0 ? 'N' : 'S';
    var ew = lng >= 0 ? 'E' : 'W';
    var line =
      'Ref. ' +
      (state.label || 'carta') +
      ': ' +
      Math.abs(lat).toFixed(4) +
      '°' +
      ns +
      ' ' +
      Math.abs(lng).toFixed(4) +
      '°' +
      ew +
      ' · z' +
      state.zoom;
    if (state.source === 'snap-seamark') line += ' (farol próximo)';
    return line;
  }

  function publishStatus() {
    var el = document.getElementById('targets-status');
    if (el) el.textContent = formatRefLine();
    global.__sisnagNauticalReference = Object.assign({}, state);
  }

  function placeMarker(map) {
    if (!map || state.lat == null) return;
    if (refMarker) {
      try {
        map.removeLayer(refMarker);
      } catch (e) {
        /* ignore */
      }
      refMarker = null;
    }
    var v = global.__sisnagVectorMap || map;
    refMarker = L.circleMarker([state.lat, state.lng], {
      radius: 9,
      color: '#f59e0b',
      weight: 3,
      fillColor: '#fbbf24',
      fillOpacity: 0.85,
    });
    refMarker.bindPopup(
      '<b>Referência náutica</b><br>' +
        formatRefLine() +
        '<br><small>Windy, Marine Traffic e OpenSeaMap usam este centro ao sincronizar.</small>',
    );
    refMarker.addTo(v);
  }

  /**
   * Define o ponto de referência a partir do mapa SISNAG (tiles OpenSeaMap = carta de fundo).
   * @param {L.Map} map
   * @param {object} [opts]
   */
  global.__sisnagFixNauticalReference = function (map, opts) {
    if (!map) return state;
    opts = opts || {};
    var lat;
    var lng;
    var zoom;
    if (opts.forceCenter && Number.isFinite(opts.forceCenter.lat) && Number.isFinite(opts.forceCenter.lng)) {
      lat = opts.forceCenter.lat;
      lng = opts.forceCenter.lng;
      zoom = Number.isFinite(opts.forceCenter.zoom) ? opts.forceCenter.zoom : map.getZoom();
    } else {
      var c = map.getCenter();
      lat = c.lat;
      lng = c.lng;
      zoom = map.getZoom();
    }
    var label = 'carta SISNAG';
    var source = 'leaflet-openseamap';

    if (global.__sisnagSeamarkLayerActive && global.__sisnagSeamarkLayerActive()) {
      label = 'OpenSeaMap+OSM';
      source = 'openseamap-tiles';
    }

    var lockedCenter = !!(opts.forceCenter && Number.isFinite(opts.forceCenter.lat));

    if (!lockedCenter && opts.snapSeamark !== false) {
      var snap = nearestSnap(lat, lng, 8);
      if (snap) {
        lat = snap.lat;
        lng = snap.lng;
        label = snap.name;
        source = 'snap-seamark';
      }
    }

    var gps = global.__sisnagLastKnownGps;
    if (!lockedCenter && opts.preferGps && gps && Number.isFinite(gps.lat) && Number.isFinite(gps.lng)) {
      var age = gps.ts ? Date.now() - gps.ts : 0;
      if (age < 600000) {
        lat = gps.lat;
        lng = gps.lng;
        label = 'GPS';
        source = 'gps';
      }
    }

    if (!lockedCenter && opts.useRoute && typeof global.__sisnagCollectWaypoints === 'function') {
      var wps = global.__sisnagCollectWaypoints();
      if (wps.length >= 2) {
        try {
          var b = L.latLngBounds(
            wps.map(function (w) {
              return [w.lat, w.lng];
            }),
          );
          var bc = b.getCenter();
          lat = bc.lat;
          lng = bc.lng;
          zoom = map.getBoundsZoom(b, { padding: [48, 48], maxZoom: 11 });
          label = 'centro da derrota';
          source = 'route-center';
        } catch (e) {
          /* ignore */
        }
      } else if (wps.length === 1) {
        lat = wps[0].lat;
        lng = wps[0].lng;
        label = wps[0].name || 'WP#1';
        source = 'waypoint';
      }
    }

    state = {
      lat: lat,
      lng: lng,
      zoom: zoom,
      source: source,
      label: label,
      updatedAt: new Date().toISOString(),
    };
    publishStatus();
    placeMarker(map);
    return state;
  };

  global.__sisnagGetNauticalReference = function () {
    return Object.assign({}, state);
  };

  global.__sisnagFormatNauticalReference = formatRefLine;
})(window);
