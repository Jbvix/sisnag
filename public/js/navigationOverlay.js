/* global L, window, document */
/**
 * Mapa vectorial sincronizado por cima dos iframes (pointer-events:none) —
 * derrota GPX, waypoints editáveis, posição da embarcação.
 */
(function navigationOverlay(global) {
  var vectorMap = null;
  var gpxLine = null;
  var waypoints = []; // { id, lat, lng, name, marker }
  var waypointGroup = null;
  var vesselMarker = null;
  var aisGroup = null;
  var waypointIdSeq = 1;

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
    if (wp.marker) {
      wp.marker.setLatLng([lat, lng]);
      wp.marker.setPopupContent(escapePopup(wp));
    }
  }

  function escapePopup(wp) {
    var safe = global.__sisnagEscapeHtml ? global.__sisnagEscapeHtml(wp.name) : String(wp.name);
    return '<b>' + safe + '</b><br>' + wp.lat.toFixed(5) + ', ' + wp.lng.toFixed(5);
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
    renderWaypointList();
  }

  var LS_WP = 'sisnag_waypoints_v1';

  function saveWaypointsLs() {
    try {
      var data = waypoints.map(function (w) {
        return { id: w.id, lat: w.lat, lng: w.lng, name: w.name };
      });
      localStorage.setItem(LS_WP, JSON.stringify(data));
    } catch (e) {
      /* ignore */
    }
  }

  function loadWaypointsLs() {
    try {
      var raw = localStorage.getItem(LS_WP);
      if (!raw) return;
      JSON.parse(raw).forEach(function (row) {
        if (typeof row.lat === 'number' && typeof row.lng === 'number') {
          var wid = typeof row.id === 'number' ? row.id : parseInt(row.id, 10);
          addWaypointMarker(row.lat, row.lng, row.name || 'WP', Number.isFinite(wid) ? wid : null);
        }
      });
      var maxId = waypoints.reduce(function (m, w) {
        return Math.max(m, w.id || 0);
      }, 0);
      waypointIdSeq = Math.max(waypointIdSeq, maxId + 1);
    } catch (e) {
      /* ignore */
    }
  }

  function renderWaypointList() {
    var list = document.getElementById('nav-wp-list');
    if (!list) return;
    list.innerHTML = '';
    waypoints.forEach(function (wp) {
      var row = document.createElement('div');
      row.className = 'nav-wp-row';
      row.innerHTML =
        '<span class="nav-wp-name">' +
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
        saveWaypointsLs();
        renderWaypointList();
      };
      row.querySelector('[data-act="del"]').onclick = function () {
        removeWaypointById(wp.id);
      };
      list.appendChild(row);
    });
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
    var icon = L.divIcon({
      className: 'sisnag-wp-icon',
      html: '<div class="sisnag-wp-pin">⚓</div>',
      iconSize: [28, 28],
      iconAnchor: [14, 28],
    });
    var m = L.marker([lat, lng], { draggable: true, icon: icon });
    var wp = { id: id, lat: lat, lng: lng, name: name || 'Waypoint', marker: m };
    m.bindPopup(escapePopup(wp));
    m.on('dragend', function () {
      var ll = m.getLatLng();
      wp.lat = ll.lat;
      wp.lng = ll.lng;
      saveWaypointsLs();
      renderWaypointList();
    });
    m.on('click', function () {
      m.openPopup();
    });
    m.addTo(waypointGroup);
    waypoints.push(wp);
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
    waypointGroup = L.layerGroup().addTo(vectorMap);
    aisGroup = L.layerGroup().addTo(vectorMap);

    mainMap.on('move', function () {
      syncFromMain(mainMap);
    });
    mainMap.on('zoom', function () {
      syncFromMain(mainMap);
    });

    syncFromMain(mainMap);
    setTimeout(function () {
      vectorMap.invalidateSize(false);
      mainMap.invalidateSize(false);
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
              if (gpxLine && vectorMap) vectorMap.removeLayer(gpxLine);
              if (pts.length) {
                gpxLine = L.polyline(pts, {
                  color: '#f472b6',
                  weight: 4,
                  opacity: 1,
                  lineCap: 'round',
                  lineJoin: 'round',
                }).addTo(vectorMap);
                if (pts.length === 1) {
                  mainMap.setView(pts[0], 13);
                } else {
                  var b = L.latLngBounds(pts);
                  mainMap.fitBounds(b, { maxZoom: 14, padding: [48, 48] });
                }
                syncFromMain(mainMap);
                setTimeout(function () {
                  vectorMap.invalidateSize(false);
                  mainMap.invalidateSize(false);
                }, 200);
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

    loadWaypointsLs();
    renderWaypointList();
  };

  /** Duplica geometria GPX também no mapa base (tiles) para navegação quando embeds fechados — opcional. */
  global.__sisnagMirrorGpxToMain = null;
})(window);
