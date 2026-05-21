/* global window */
/**
 * Contexto enviado ao /api/chat: waypoints, mapa, GPS, combustível.
 * ETAs finais são recalculadas no servidor (navigationBrief.js).
 */
(function navigationContext(global) {
  function readPlannedSog() {
    try {
      var v = parseFloat(localStorage.getItem('sisnag_planned_sog_kn'));
      return Number.isFinite(v) && v >= 0.3 ? v : null;
    } catch (e) {
      return null;
    }
  }

  global.__sisnagGetNavigationContext = function __sisnagGetNavigationContext() {
    var ctx = {
      generatedAt: new Date().toISOString(),
      waypoints: [],
      gps: null,
      plannedSogKn: readPlannedSog(),
      map: {},
      gpx: null,
      fuel: {},
    };

    if (typeof global.__sisnagCollectWaypoints === 'function') {
      ctx.waypoints = global.__sisnagCollectWaypoints();
    }

    var gps = global.__sisnagLastKnownGps;
    if (gps && Number.isFinite(gps.lat) && Number.isFinite(gps.lng)) {
      ctx.gps = {
        lat: gps.lat,
        lng: gps.lng,
        sog: gps.sog != null ? Number(gps.sog) : null,
        cog: gps.cog != null ? Number(gps.cog) : null,
        accuracy: gps.accuracy != null ? gps.accuracy : null,
        ts: gps.ts || Date.now(),
      };
    }

    try {
      var mm = global.__sisnagMainMap;
      if (mm && typeof mm.getCenter === 'function') {
        var c = mm.getCenter();
        ctx.map = {
          centerLat: c.lat,
          centerLng: c.lng,
          zoom: mm.getZoom(),
          baseLayer: global.__sisnagActiveBaseLayer || null,
        };
      }
    } catch (e) {
      /* ignore */
    }

    if (typeof global.__sisnagGetGpxSummary === 'function') {
      ctx.gpx = global.__sisnagGetGpxSummary();
    }

    if (typeof global.__sisnagGetFuelLph === 'function') {
      var lph = global.__sisnagGetFuelLph();
      if (lph != null) ctx.fuel.lph = lph;
    }
    if (typeof global.__sisnagGetFuelBalanceLiters === 'function') {
      var bal = global.__sisnagGetFuelBalanceLiters();
      if (bal != null) ctx.fuel.balanceLiters = bal;
    }

    return ctx;
  };
})(window);
