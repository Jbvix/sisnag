/* global L, window, document */
/**
 * Alinhamento das camadas sobrepostas (Leaflet, Windy, MT) por cidades costeiras WGS84.
 */
(function cityReferenceAlign(global) {
  /** Cidades costeiras BR — âncoras para coincidir rótulos entre mapas. */
  var REF_CITIES = [
    { name: 'Fortaleza', lat: -3.7319, lng: -38.5267 },
    { name: 'Natal', lat: -5.7945, lng: -35.211 },
    { name: 'Mossoró', lat: -5.1878, lng: -37.344 },
    { name: 'João Pessoa', lat: -7.1195, lng: -34.845 },
    { name: 'Recife', lat: -8.0476, lng: -34.877 },
    { name: 'Maceió', lat: -9.6658, lng: -35.735 },
    { name: 'Aracaju', lat: -10.9472, lng: -37.0731 },
    { name: 'Salvador', lat: -12.9714, lng: -38.5014 },
    { name: 'Ilhéus', lat: -14.7886, lng: -39.0489 },
    { name: 'Vitória', lat: -20.3155, lng: -40.3128 },
    { name: 'Rio de Janeiro', lat: -22.9068, lng: -43.1729 },
    { name: 'Santos', lat: -23.9608, lng: -46.3336 },
    { name: 'Paranaguá', lat: -25.5163, lng: -48.5228 },
    { name: 'Florianópolis', lat: -27.5954, lng: -48.548 },
    { name: 'Suape', lat: -8.39, lng: -34.961 },
    { name: 'São Luís', lat: -2.5387, lng: -44.2825 },
    { name: 'Belém', lat: -1.4558, lng: -48.4902 },
  ];

  var cityLayerGroup = null;
  var lastAlignState = null;

  function citiesInBounds(bounds) {
    if (!bounds) return [];
    return REF_CITIES.filter(function (c) {
      return bounds.contains([c.lat, c.lng]);
    });
  }

  function waypointsInBounds(map) {
    if (typeof global.__sisnagCollectWaypoints !== 'function') return [];
    var bounds = map.getBounds();
    return global.__sisnagCollectWaypoints().filter(function (w) {
      return bounds.contains([w.lat, w.lng]);
    });
  }

  /**
   * Vista única para todos os mapas: centro = média das cidades visíveis (+ derrota se existir).
   * @param {L.Map} map
   * @returns {{ lat: number, lng: number, zoom: number, cities: string[], source: string }}
   */
  global.__sisnagCityAlignedView = function (map) {
    if (!map || typeof map.getBounds !== 'function') {
      return { lat: -12.97, lng: -38.48, zoom: 9, cities: [], source: 'fallback' };
    }

    var bounds = map.getBounds();
    var cities = citiesInBounds(bounds);
    var wps = waypointsInBounds(map);
    var points = [];

    cities.forEach(function (c) {
      points.push({ lat: c.lat, lng: c.lng, name: c.name, kind: 'city' });
    });
    wps.forEach(function (w) {
      points.push({ lat: w.lat, lng: w.lng, name: w.name || 'WP', kind: 'wp' });
    });

    if (points.length === 0) {
      var c0 = map.getCenter();
      return {
        lat: c0.lat,
        lng: c0.lng,
        zoom: map.getZoom(),
        cities: [],
        source: 'map-center',
      };
    }

    var latSum = 0;
    var lngSum = 0;
    var cityNames = [];
    points.forEach(function (p) {
      latSum += p.lat;
      lngSum += p.lng;
      if (p.kind === 'city') cityNames.push(p.name);
    });

    var lat = latSum / points.length;
    var lng = lngSum / points.length;
    var zoom = map.getZoom();

    try {
      var bb = L.latLngBounds(
        points.map(function (p) {
          return [p.lat, p.lng];
        }),
      );
      var fitZ = map.getBoundsZoom(bb, { padding: [56, 56], maxZoom: 11 });
      if (Number.isFinite(fitZ)) {
        zoom = Math.min(map.getZoom(), Math.max(4, fitZ));
      }
    } catch (e) {
      /* ignore */
    }

    var source = 'cities';
    if (cityNames.length >= 2) source = 'cities-' + cityNames.length;
    else if (cityNames.length === 1) source = 'city-' + cityNames[0];
    else if (wps.length) source = 'route';

    return {
      lat: lat,
      lng: lng,
      zoom: zoom,
      cities: cityNames,
      source: source,
    };
  };

  /** Aplica a mesma vista no Leaflet (waypoints seguem). */
  global.__sisnagApplyCityAlignedViewToMap = function (map, view) {
    if (!map || !view) return;
    try {
      map.setView([view.lat, view.lng], view.zoom, { animate: false });
    } catch (e) {
      /* ignore */
    }
  };

  function formatAlignStatus(view) {
    if (!view.cities || !view.cities.length) {
      return 'Alinhamento: centro do mapa (sem cidade de ref. no ecrã)';
    }
    var names = view.cities.slice(0, 4).join(', ');
    if (view.cities.length > 4) names += '…';
    return 'Alinhamento: ' + names;
  }

  global.__sisnagUpdateCityReferenceMarkers = function (map) {
    var v = global.__sisnagVectorMap;
    if (!v || !map) return;

    if (!cityLayerGroup) {
      cityLayerGroup = L.layerGroup();
      cityLayerGroup.addTo(v);
    }
    cityLayerGroup.clearLayers();

    if (!hasOpenEmbeds()) return;

    var bounds = map.getBounds();
    var visible = citiesInBounds(bounds);
    visible.forEach(function (c) {
      var icon = L.divIcon({
        className: 'sisnag-city-ref-icon',
        html:
          '<div class="sisnag-city-ref-pin"><span class="sisnag-city-ref-dot"></span><span class="sisnag-city-ref-label">' +
          (typeof global.__sisnagEscapeHtml === 'function' ? global.__sisnagEscapeHtml(c.name) : c.name) +
          '</span></div>',
        iconSize: [72, 28],
        iconAnchor: [8, 14],
      });
      L.marker([c.lat, c.lng], { icon: icon, interactive: false, zIndexOffset: 500 }).addTo(cityLayerGroup);
    });
  };

  function hasOpenEmbeds() {
    return (
      document.getElementById('windy-panel')?.classList.contains('is-open') ||
      document.getElementById('mt-panel')?.classList.contains('is-open') ||
      document.getElementById('osm-panel')?.classList.contains('is-open')
    );
  }

  global.__sisnagPublishCityAlignStatus = function (view) {
    lastAlignState = view;
    var el = document.getElementById('targets-status');
    if (!el) return;
    var base =
      typeof global.__sisnagFormatNauticalReference === 'function'
        ? global.__sisnagFormatNauticalReference()
        : '';
    var line = formatAlignStatus(view);
    el.textContent = base ? base + ' · ' + line : line;
  };

  global.__sisnagGetLastCityAlign = function () {
    return lastAlignState ? Object.assign({}, lastAlignState) : null;
  };

  /** Bounds para fit: cidades da derrota + waypoints. */
  global.__sisnagBoundsForRouteAndCities = function (wps) {
    var pts = [];
    (wps || []).forEach(function (w) {
      if (Number.isFinite(w.lat) && Number.isFinite(w.lng)) pts.push([w.lat, w.lng]);
    });
    if (pts.length) {
      try {
        var routeBounds = L.latLngBounds(pts);
        REF_CITIES.forEach(function (c) {
          if (routeBounds.contains([c.lat, c.lng])) pts.push([c.lat, c.lng]);
        });
        var near = REF_CITIES.filter(function (c) {
          var center = routeBounds.getCenter();
          var dLat = Math.abs(c.lat - center.lat);
          var dLng = Math.abs(c.lng - center.lng);
          return dLat < 6 && dLng < 8;
        });
        near.forEach(function (c) {
          pts.push([c.lat, c.lng]);
        });
      } catch (e) {
        /* ignore */
      }
    }
    return pts.length ? L.latLngBounds(pts) : null;
  };
})(window);
