/* global window */
/**
 * Persistência local da derrota SISNAG (waypoints + trilha GPX + vista do mapa).
 * localStorage — sobrevive a fechar o browser / recarregar a página.
 */
(function routeStorage(global) {
  var LS_ROUTE = 'sisnag_route_v2';
  var LS_LEGACY_WP = 'sisnag_waypoints_v1';
  var MAX_GPX_POINTS = 4000;

  function nowIso() {
    return new Date().toISOString();
  }

  function downsample(points, max) {
    if (!points || points.length <= max) return points || [];
    var out = [];
    var step = (points.length - 1) / (max - 1);
    for (var i = 0; i < max; i++) {
      out.push(points[Math.min(points.length - 1, Math.round(i * step))]);
    }
    return out;
  }

  function normalizeGpxPoints(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .map(function (p) {
        if (Array.isArray(p) && p.length >= 2) {
          var la = Number(p[0]);
          var lo = Number(p[1]);
          if (Number.isFinite(la) && Number.isFinite(lo)) return [la, lo];
        }
        if (p && Number.isFinite(p.lat) && Number.isFinite(p.lng)) return [p.lat, p.lng];
        return null;
      })
      .filter(Boolean);
  }

  function migrateLegacyWaypoints() {
    try {
      var raw = localStorage.getItem(LS_LEGACY_WP);
      if (!raw) return null;
      var rows = JSON.parse(raw);
      if (!Array.isArray(rows) || !rows.length) return null;
      var waypoints = rows
        .filter(function (r) {
          return typeof r.lat === 'number' && typeof r.lng === 'number';
        })
        .map(function (r) {
          return {
            id: r.id,
            lat: r.lat,
            lng: r.lng,
            name: r.name || 'Waypoint',
          };
        });
      return { waypoints: waypoints, gpxTrack: null, gpxMeta: null, mapView: null, name: 'Derrota SISNAG' };
    } catch (e) {
      return null;
    }
  }

  function emptyRoute() {
    return {
      version: 2,
      updatedAt: nowIso(),
      name: 'Derrota SISNAG',
      waypoints: [],
      gpxTrack: null,
      gpxMeta: null,
      mapView: null,
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(LS_ROUTE);
      if (raw) {
        var data = JSON.parse(raw);
        if (data && data.version === 2) {
          data.waypoints = Array.isArray(data.waypoints) ? data.waypoints : [];
          data.gpxTrack = data.gpxTrack ? normalizeGpxPoints(data.gpxTrack) : null;
          return data;
        }
      }
      var migrated = migrateLegacyWaypoints();
      if (migrated) {
        var snap = Object.assign(emptyRoute(), migrated, { version: 2, updatedAt: nowIso() });
        save(snap);
        return snap;
      }
    } catch (e) {
      /* ignore */
    }
    return emptyRoute();
  }

  function save(snapshot) {
    var snap = snapshot || emptyRoute();
    snap.version = 2;
    snap.updatedAt = nowIso();
    if (Array.isArray(snap.gpxTrack) && snap.gpxTrack.length) {
      var norm = normalizeGpxPoints(snap.gpxTrack);
      if (norm.length > MAX_GPX_POINTS) {
        snap.gpxTrack = downsample(norm, MAX_GPX_POINTS);
        snap.gpxMeta = snap.gpxMeta || {};
        snap.gpxMeta.downsampled = true;
        snap.gpxMeta.storedPoints = snap.gpxTrack.length;
        snap.gpxMeta.originalPoints = norm.length;
      } else {
        snap.gpxTrack = norm;
      }
    } else {
      snap.gpxTrack = null;
    }
    try {
      localStorage.setItem(LS_ROUTE, JSON.stringify(snap));
      return { ok: true, updatedAt: snap.updatedAt };
    } catch (e) {
      if (snap.gpxTrack && snap.gpxTrack.length > 500) {
        try {
          snap.gpxTrack = downsample(snap.gpxTrack, 800);
          snap.gpxMeta = snap.gpxMeta || {};
          snap.gpxMeta.downsampled = true;
          snap.gpxMeta.quotaRetry = true;
          localStorage.setItem(LS_ROUTE, JSON.stringify(snap));
          return { ok: true, updatedAt: snap.updatedAt, warning: 'quota' };
        } catch (e2) {
          /* ignore */
        }
      }
      return { ok: false, error: String(e.message || e) };
    }
  }

  function clear() {
    try {
      localStorage.removeItem(LS_ROUTE);
      localStorage.removeItem(LS_LEGACY_WP);
    } catch (e) {
      /* ignore */
    }
  }

  function buildGpxXml(route) {
    var wps = route.waypoints || [];
    var trk = route.gpxTrack || [];
    var lines = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<gpx version="1.1" creator="SISNAG" xmlns="http://www.topografix.com/GPX/1/1">',
      '  <metadata><time>' + nowIso() + '</time></metadata>',
    ];
    wps.forEach(function (w, i) {
      lines.push(
        '  <wpt lat="' +
          w.lat +
          '" lon="' +
          w.lng +
          '"><name>' +
          escapeXml(w.name || 'WP-' + (i + 1)) +
          '</name></wpt>',
      );
    });
    if (trk.length) {
      lines.push('  <trk><name>' + escapeXml(route.name || 'Derrota') + '</name><trkseg>');
      trk.forEach(function (p) {
        lines.push('    <trkpt lat="' + p[0] + '" lon="' + p[1] + '"></trkpt>');
      });
      lines.push('  </trkseg></trk>');
    }
    lines.push('</gpx>');
    return lines.join('\n');
  }

  function escapeXml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function downloadGpx(route) {
    var xml = buildGpxXml(route);
    var blob = new Blob([xml], { type: 'application/gpx+xml;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'sisnag-derrota-' + (route.updatedAt || nowIso()).slice(0, 10) + '.gpx';
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 2000);
  }

  global.sisnagRouteStorage = {
    load: load,
    save: save,
    clear: clear,
    buildGpxXml: buildGpxXml,
    downloadGpx: downloadGpx,
    MAX_GPX_POINTS: MAX_GPX_POINTS,
  };
})(window);
