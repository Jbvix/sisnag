/* global L, window, document */
/**
 * Mapa vectorial sincronizado por cima dos iframes (pointer-events:none) —
 * derrota GPX, waypoints editáveis, posição da embarcação.
 */
(function navigationOverlay(global) {
  var vectorMap = null;
  var gpxLine = null;
  /** Polilinha pela ordem da lista (#1 → #2 → …); distinta da derrota GPX (trk/rte). */
  var waypointLegPolyline = null;
  var waypoints = []; // { id, lat, lng, name, marker }
  var waypointGroup = null;
  var vesselMarker = null;
  var aisGroup = null;
  var waypointIdSeq = 1;
  var routeName = 'Derrota SISNAG';
  var gpxMeta = null;
  var saveRouteTimer = null;

  function syncFromMain(mainMap) {
    if (!vectorMap || !mainMap) return;
    vectorMap.setView(mainMap.getCenter(), mainMap.getZoom(), { animate: false, padding: [0, 0] });
  }

  function openWaypointEditor(wp) {
    var name = window.prompt('Nome do waypoint:', wp.name || '');
    if (name === null) return;
    var latStr = window.prompt('Latitude (decimal):', String(wp.lat));
    if (latStr === null) return;
    var lngStr = window.prompt('Longitude (decimal):', String(wp.lng));
    if (lngStr === null) return;
    var lat = parseFloat(latStr);
    var lng = parseFloat(lngStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    wp.lat = lat;
    wp.lng = lng;
    wp.name = name || wp.name || 'Waypoint';
    if (wp.marker) wp.marker.setLatLng([lat, lng]);
    saveWaypointsLs();
    refreshWaypointNumerationAndLegs();
    renderWaypointList();
  }

  /** Ordem de seguimento: índice 1-based na lista `waypoints`. */
  function escapePopup(wp, orderNum) {
    var seq = typeof orderNum === 'number' && orderNum >= 1 ? orderNum : waypoints.indexOf(wp) + 1;
    var safe = global.__sisnagEscapeHtml ? global.__sisnagEscapeHtml(wp.name) : String(wp.name);
    return (
      '<b>#' +
      seq +
      '</b> · ' +
      safe +
      '<br><small>' +
      wp.lat.toFixed(5) +
      ', ' +
      wp.lng.toFixed(5) +
      '</small>'
    );
  }

  function buildWaypointNumberIcon(orderNum) {
    var txt = Math.max(1, Math.round(Number(orderNum) || 1));
    var safe = txt > 99 ? '⋯' : String(txt);
    return L.divIcon({
      className: 'sisnag-wp-icon',
      html: '<div class="sisnag-wp-num">' + safe + '</div>',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  }

  function refreshWaypointNumerationAndLegs() {
    if (!vectorMap || !waypointGroup) return;
    waypoints.forEach(function (wp, i) {
      var n = i + 1;
      if (wp.marker) {
        wp.marker.setIcon(buildWaypointNumberIcon(n));
        wp.marker.setPopupContent(escapePopup(wp, n));
      }
    });
    if (waypointLegPolyline && waypointGroup.removeLayer) {
      try {
        waypointGroup.removeLayer(waypointLegPolyline);
      } catch (e) {
        /* ignore */
      }
      waypointLegPolyline = null;
    }
    if (waypoints.length >= 2) {
      waypointLegPolyline = L.polyline(
        waypoints.map(function (w) {
          return [w.lat, w.lng];
        }),
        {
          color: '#ca8a04',
          weight: 3,
          opacity: 0.92,
          dashArray: '10 8',
          lineCap: 'round',
          lineJoin: 'round',
        },
      ).addTo(waypointGroup);
      waypointLegPolyline.bringToBack();
    }
  }

  function removeWaypointById(id) {
    waypoints = waypoints.filter(function (wp) {
      if (wp.id === id) {
        if (waypointGroup && wp.marker) waypointGroup.removeLayer(wp.marker);
        return false;
      }
      return true;
    });
    saveWaypointsLs();
    refreshWaypointNumerationAndLegs();
    renderWaypointList();
  }

  function gpxPointsFromLine() {
    if (!gpxLine) return null;
    try {
      var ll = gpxLine.getLatLngs();
      var flat = [];
      function walk(arr) {
        arr.forEach(function (p) {
          if (Array.isArray(p)) walk(p);
          else if (p && Number.isFinite(p.lat)) flat.push([p.lat, p.lng]);
        });
      }
      walk(ll);
      return flat.length ? flat : null;
    } catch (e) {
      return null;
    }
  }

  function updateRouteSaveStatus(result) {
    var el = document.getElementById('nav-route-save-status');
    if (!el) return;
    if (result && result.ok) {
      var t = result.updatedAt ? new Date(result.updatedAt) : new Date();
      var when = t.toLocaleString('pt-BR', { hour12: false });
      el.textContent = 'Guardado localmente · ' + when;
      el.classList.remove('sisnag-route-status--err');
    } else if (result && result.error) {
      el.textContent = 'Erro ao guardar: ' + result.error;
      el.classList.add('sisnag-route-status--err');
    }
  }

  function buildRouteSnapshot() {
    var mm = global.__sisnagMainMap;
    var mapView = null;
    if (mm && typeof mm.getCenter === 'function') {
      var c = mm.getCenter();
      mapView = { lat: c.lat, lng: c.lng, zoom: mm.getZoom() };
    }
    return {
      version: 2,
      name: routeName,
      waypoints: waypoints.map(function (w) {
        return { id: w.id, lat: w.lat, lng: w.lng, name: w.name };
      }),
      gpxTrack: gpxPointsFromLine(),
      gpxMeta: gpxMeta,
      mapView: mapView,
    };
  }

  /** Grava derrota completa (waypoints + GPX + vista). */
  function persistRoute(immediate) {
    if (!global.sisnagRouteStorage) return;
    if (saveRouteTimer) {
      clearTimeout(saveRouteTimer);
      saveRouteTimer = null;
    }
    function run() {
      var result = global.sisnagRouteStorage.save(buildRouteSnapshot());
      updateRouteSaveStatus(result);
    }
    if (immediate) run();
    else saveRouteTimer = setTimeout(run, 350);
  }

  function saveWaypointsLs() {
    persistRoute(false);
  }

  function applyGpxTrack(points, meta, fitMap) {
    if (!vectorMap) return;
    if (gpxLine) {
      vectorMap.removeLayer(gpxLine);
      gpxLine = null;
    }
    if (!points || !points.length) {
      gpxMeta = null;
      persistRoute(true);
      return;
    }
    gpxLine = L.polyline(points, {
      color: '#f472b6',
      weight: 4,
      opacity: 1,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(vectorMap);
    gpxMeta = meta || { restored: true, pointCount: points.length };
    var mainMap = global.__sisnagMainMap;
    if (fitMap && mainMap) {
      if (points.length === 1) {
        mainMap.setView(points[0], 13);
      } else {
        mainMap.fitBounds(L.latLngBounds(points), { maxZoom: 14, padding: [48, 48] });
      }
      syncFromMain(mainMap);
    }
    persistRoute(false);
  }

  function restoreMapView(mapView) {
    if (!mapView || !global.__sisnagMainMap) return;
    var la = Number(mapView.lat);
    var lo = Number(mapView.lng);
    var z = Number(mapView.zoom);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) return;
    global.__sisnagMainMap.setView([la, lo], Number.isFinite(z) ? z : 9);
    syncFromMain(global.__sisnagMainMap);
  }

  function loadPersistedRoute() {
    if (!global.sisnagRouteStorage) return;
    var route = global.sisnagRouteStorage.load();
    if (!route) return;
    routeName = route.name || routeName;
    gpxMeta = route.gpxMeta || null;

    (route.waypoints || []).forEach(function (row) {
      if (typeof row.lat === 'number' && typeof row.lng === 'number') {
        var wid = typeof row.id === 'number' ? row.id : parseInt(row.id, 10);
        addWaypointMarker(row.lat, row.lng, row.name || 'WP', Number.isFinite(wid) ? wid : null);
      }
    });
    var maxId = waypoints.reduce(function (m, w) {
      return Math.max(m, w.id || 0);
    }, 0);
    waypointIdSeq = Math.max(waypointIdSeq, maxId + 1);

    if (route.gpxTrack && route.gpxTrack.length) {
      applyGpxTrack(route.gpxTrack, route.gpxMeta, false);
    }

    if (route.mapView) {
      restoreMapView(route.mapView);
    } else if (waypoints.length === 1) {
      restoreMapView({ lat: waypoints[0].lat, lng: waypoints[0].lng, zoom: 13 });
    } else if (waypoints.length >= 2) {
      var bounds = L.latLngBounds(
        waypoints.map(function (w) {
          return [w.lat, w.lng];
        }),
      );
      if (global.__sisnagMainMap) {
        global.__sisnagMainMap.fitBounds(bounds, { maxZoom: 14, padding: [48, 48] });
        syncFromMain(global.__sisnagMainMap);
      }
    }

    updateRouteSaveStatus({ ok: true, updatedAt: route.updatedAt });
  }

  function clearAllRouteData() {
    waypoints.forEach(function (wp) {
      if (waypointGroup && wp.marker) waypointGroup.removeLayer(wp.marker);
    });
    waypoints = [];
    applyGpxTrack(null, null, false);
    refreshWaypointNumerationAndLegs();
    if (global.sisnagRouteStorage) {
      global.sisnagRouteStorage.clear();
      global.sisnagRouteStorage.save(buildRouteSnapshot());
    }
    routeName = 'Derrota SISNAG';
    gpxMeta = null;
    updateRouteSaveStatus({ ok: true, updatedAt: new Date().toISOString() });
  }

  function renderWaypointList() {
    var list = document.getElementById('nav-wp-list');
    if (!list) return;
    list.innerHTML = '';
    waypoints.forEach(function (wp, wi) {
      var row = document.createElement('div');
      row.className = 'nav-wp-row';
      row.innerHTML =
        '<span class="nav-wp-idx" title="Ordem na rota">' +
        '#' +
        (wi + 1) +
        '</span><span class="nav-wp-name">' +
        global.__sisnagEscapeHtml(wp.name) +
        '</span>' +
        '<button type="button" data-act="focus" data-id="' +
        wp.id +
        '">Ir</button>' +
        '<button type="button" data-act="edit" data-id="' +
        wp.id +
        '">Editar</button>' +
        '<button type="button" data-act="del" data-id="' +
        wp.id +
        '">✕</button>';
      row.querySelector('[data-act="focus"]').onclick = function () {
        var mm = global.__sisnagMainMap;
        if (!mm) return;
        var mz = Math.max(mm.getZoom(), 13);
        mm.setView([wp.lat, wp.lng], mz);
        syncFromMain(mm);
      };
      row.querySelector('[data-act="edit"]').onclick = function () {
        openWaypointEditor(wp);
      };
      row.querySelector('[data-act="del"]').onclick = function () {
        removeWaypointById(wp.id);
      };
      list.appendChild(row);
    });
    if (!waypoints.length) {
      list.innerHTML = '<p style="margin:8px 0 0;color:#64748b;font-size:11px;">Nenhum waypoint. Toque «Novo waypoint» ou importe GPX.</p>';
    }
  }

  function addWaypointMarker(lat, lng, name, fixedId) {
    if (!waypointGroup) return;
    var id;
    if (fixedId != null && Number.isFinite(Number(fixedId))) {
      id = Number(fixedId);
    } else {
      id = waypointIdSeq++;
      while (waypoints.some(function (w) { return w.id === id; })) id = waypointIdSeq++;
    }
    var provisory = Math.max(1, waypoints.length + 1);
    var m = L.marker([lat, lng], { draggable: true, icon: buildWaypointNumberIcon(provisory) });
    var wp = { id: id, lat: lat, lng: lng, name: name || 'Waypoint', marker: m };
    m.bindPopup(escapePopup(wp, provisory));
    m.on('dragend', function () {
      var ll = m.getLatLng();
      wp.lat = ll.lat;
      wp.lng = ll.lng;
      saveWaypointsLs();
      refreshWaypointNumerationAndLegs();
      renderWaypointList();
    });
    m.on('click', function () {
      m.openPopup();
    });
    m.addTo(waypointGroup);
    waypoints.push(wp);
    refreshWaypointNumerationAndLegs();
    renderWaypointList();
    saveWaypointsLs();
    return wp;
  }

  function parseGPX(text) {
    var parser = new DOMParser();
    var xml = parser.parseFromString(text, 'text/xml');
    if (xml.querySelector('parsererror')) throw new Error('GPX XML inválido');
    var points = [];

    xml.querySelectorAll('trkpt, rtept').forEach(function (el) {
      var la = parseFloat(el.getAttribute('lat'));
      var lo = parseFloat(el.getAttribute('lon'));
      if (Number.isFinite(la) && Number.isFinite(lo)) points.push([la, lo]);
    });

    xml.querySelectorAll('wpt').forEach(function (el) {
      var la = parseFloat(el.getAttribute('lat'));
      var lo = parseFloat(el.getAttribute('lon'));
      if (!Number.isFinite(la) || !Number.isFinite(lo)) return;
      var nm =
        el.querySelector('name') && el.querySelector('name').textContent
          ? el.querySelector('name').textContent.trim()
          : 'WPT';
      addWaypointMarker(la, lo, nm);
    });

    return points;
  }

  global.__sisnagEscapeHtml = function (s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  /** Chamado por marineTrafficEmbed para AIS por cima dos embeds. */
  global.__sisnagSetAisMarkers = function (ships) {
    if (!aisGroup || !ships) return;
    aisGroup.clearLayers();
    ships.forEach(function (s) {
      if (s.lat == null || s.lon == null || !Number.isFinite(s.lat) || !Number.isFinite(s.lon)) return;
      var c = L.circleMarker([s.lat, s.lon], {
        radius: 6,
        color: '#0369a1',
        weight: 2,
        fillColor: '#38bdf8',
        fillOpacity: 0.9,
      });
      var lines = [];
      lines.push('<strong>' + global.__sisnagEscapeHtml(s.name || 'Navio') + '</strong>');
      if (s.mmsi) lines.push('MMSI: ' + global.__sisnagEscapeHtml(String(s.mmsi)));
      if (s.sog != null) lines.push('SOG: ' + safeNum(s.sog) + ' kn');
      if (s.cog != null) lines.push('COG: ' + safeNum(s.cog) + '°');
      if (s.source) lines.push(global.__sisnagEscapeHtml(String(s.source)));
      c.bindPopup(lines.join('<br>'));
      c.addTo(aisGroup);
    });
  };

  function safeNum(v) {
    var n = Number(v);
    return Number.isFinite(n) ? String(n) : '—';
  }

  /** Atualiza posição da embarcação no overlay (GPS). */
  global.__sisnagSetVesselPosition = function (lat, lng, sog) {
    if (!vectorMap) return;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    var html =
      '<div class="sisnag-ownship-inner"><span class="sisnag-ownship-tri"></span>' +
      (sog != null ? '<small>' + String(sog) + ' kn</small>' : '') +
      '</div>';
    var icon = L.divIcon({
      className: 'sisnag-ownship',
      html: html,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
    if (!vesselMarker) {
      vesselMarker = L.marker([lat, lng], { icon: icon, zIndexOffset: 100000 }).addTo(vectorMap);
    } else {
      vesselMarker.setLatLng([lat, lng]);
      if (vesselMarker.setIcon) vesselMarker.setIcon(icon);
    }
  };

  global.initNavigationOverlay = function initNavigationOverlay(mainMap) {
    var el = document.getElementById('map-vector-overlay');
    if (!el) return;

    global.__sisnagMainMap = mainMap;

    vectorMap = L.map('map-vector-overlay', {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      touchZoom: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
    });
    vectorMap.setView(mainMap.getCenter(), mainMap.getZoom());
    global.__sisnagVectorMap = vectorMap;
    waypointGroup = L.layerGroup().addTo(vectorMap);
    aisGroup = L.layerGroup().addTo(vectorMap);

    if (typeof global.__sisnagRefreshOsmOverlays === 'function') {
      global.__sisnagRefreshOsmOverlays();
    }

    mainMap.on('move', function () {
      syncFromMain(mainMap);
    });
    mainMap.on('zoom', function () {
      syncFromMain(mainMap);
    });
    mainMap.on('moveend', function () {
      persistRoute(false);
    });

    syncFromMain(mainMap);
    setTimeout(function () {
      vectorMap.invalidateSize(true);
      mainMap.invalidateSize(true);
    }, 400);

    window.addEventListener('resize', function () {
      if (vectorMap) vectorMap.invalidateSize(false);
      if (mainMap) mainMap.invalidateSize(false);
    });

    var btnImport = document.getElementById('nav-import-gpx');
    if (btnImport) {
      btnImport.onclick = function () {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.gpx,application/gpx+xml,application/xml,text/xml';
        input.onchange = function (ev) {
          var file = ev.target.files && ev.target.files[0];
          if (!file) return;
          var fr = new FileReader();
          fr.onload = function () {
            try {
              var pts = parseGPX(String(fr.result));
              if (!pts.length && !waypoints.length) {
                alert('GPX sem trk/rte pontos nem wpt válidos.');
                return;
              }
              if (pts.length) {
                gpxMeta = {
                  fileName: file.name || 'import.gpx',
                  importedAt: new Date().toISOString(),
                  pointCount: pts.length,
                };
                applyGpxTrack(pts, gpxMeta, true);
                setTimeout(function () {
                  vectorMap.invalidateSize(false);
                  mainMap.invalidateSize(false);
                }, 200);
              } else {
                persistRoute(true);
              }
            } catch (err) {
              alert('Erro ao ler GPX: ' + String(err.message || err));
            }
          };
          fr.readAsText(file);
        };
        input.click();
      };
    }

    var btnNewWp = document.getElementById('nav-new-wp');
    if (btnNewWp) {
      btnNewWp.onclick = function () {
        alert('Toque uma vez no mapa base para colocar o waypoint (fecha este aviso primeiro). Ative “Cliques através” nos embeds.');
        global.__sisnagPlaceWaypointMode = true;
        mainMap.once('click', function (e) {
          if (!global.__sisnagPlaceWaypointMode) return;
          global.__sisnagPlaceWaypointMode = false;
          var n = window.prompt('Nome do waypoint:', 'WP-' + waypointIdSeq);
          if (n === null) return;
          addWaypointMarker(e.latlng.lat, e.latlng.lng, n || 'Waypoint');
          syncFromMain(mainMap);
        });
      };
    }

    loadPersistedRoute();
    refreshWaypointNumerationAndLegs();
    renderWaypointList();

    window.addEventListener('beforeunload', function () {
      persistRoute(true);
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') persistRoute(true);
    });

    var btnExport = document.getElementById('nav-export-gpx');
    if (btnExport && global.sisnagRouteStorage) {
      btnExport.addEventListener('click', function () {
        persistRoute(true);
        global.sisnagRouteStorage.downloadGpx(buildRouteSnapshot());
      });
    }

    var btnClear = document.getElementById('nav-clear-route');
    if (btnClear) {
      btnClear.addEventListener('click', function () {
        if (
          !window.confirm(
            'Apagar derrota guardada neste dispositivo (waypoints e trilha GPX)? Esta acção não pode ser desfeita.',
          )
        ) {
          return;
        }
        clearAllRouteData();
        refreshWaypointNumerationAndLegs();
        renderWaypointList();
      });
    }

    global.__sisnagCollectWaypoints = function () {
      return waypoints.map(function (w, i) {
        return {
          order: i + 1,
          id: w.id,
          name: w.name || 'Waypoint',
          lat: w.lat,
          lng: w.lng,
        };
      });
    };

    global.__sisnagGetGpxSummary = function () {
      var pts = gpxPointsFromLine();
      if (!pts || !pts.length) return null;
      return {
        pointCount: pts.length,
        fileName: gpxMeta && gpxMeta.fileName ? gpxMeta.fileName : null,
        importedAt: gpxMeta && gpxMeta.importedAt ? gpxMeta.importedAt : null,
      };
    };
  };

  /** Duplica geometria GPX também no mapa base (tiles) para navegação quando embeds fechados — opcional. */
  global.__sisnagMirrorGpxToMain = null;
})(window);
