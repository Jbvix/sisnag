/* global window, document */
/**
 * Sobreposição Windy (fundo) + Marine Traffic (frente), sincronizados com o mapa SISNAG.
 */
(function embedOverlay(global) {
  function panels() {
    return {
      stack: document.getElementById('embed-stack'),
      windy: document.getElementById('windy-panel'),
      mt: document.getElementById('mt-panel'),
      osm: document.getElementById('osm-panel'),
    };
  }

  function isWindyOpen() {
    var p = panels().windy;
    return !!(p && p.classList.contains('is-open'));
  }

  function isMtOpen() {
    var p = panels().mt;
    return !!(p && p.classList.contains('is-open'));
  }

  function isComboActive() {
    return isWindyOpen() && isMtOpen();
  }

  global.__sisnagRefreshEmbedCombo = function () {
    var el = panels();
    if (!el.stack) return;
    var anyOpen =
      isWindyOpen() ||
      isMtOpen() ||
      !!(el.osm && el.osm.classList.contains('is-open'));
    if (anyOpen) {
      el.stack.classList.add('has-open-pointer');
      el.stack.removeAttribute('aria-hidden');
    } else {
      el.stack.classList.remove('has-open-pointer');
      el.stack.setAttribute('aria-hidden', 'true');
    }
    el.stack.classList.toggle('sisnag-combo-active', false);
    if (isWindyOpen() || isMtOpen()) {
      if (typeof global.__sisnagSetEmbedDriveMode === 'function') {
        global.__sisnagSetEmbedDriveMode(true);
      }
      document.body.classList.add('sisnag-embed-drive');
    } else if (!el.osm || !el.osm.classList.contains('is-open')) {
      document.body.classList.remove('sisnag-embed-drive');
      if (typeof global.__sisnagSetEmbedDriveMode === 'function') {
        global.__sisnagSetEmbedDriveMode(false);
      }
    }
  };

  global.__sisnagCloseWindyMtOverlays = function () {
    var el = panels();
    if (el.windy) el.windy.classList.remove('is-open');
    if (el.mt) el.mt.classList.remove('is-open');
    if (el.osm) el.osm.classList.remove('is-open');
    global.__sisnagRefreshEmbedCombo();
  };

  /** Abre Windy e sincroniza com a derrota. */
  global.__sisnagOpenWindyMtOverlay = function (map) {
    var el = panels();
    if (el.osm) el.osm.classList.remove('is-open');
    if (el.mt) el.mt.classList.remove('is-open');
    if (el.windy) el.windy.classList.add('is-open');
    global.__sisnagRefreshEmbedCombo();
    if (map && typeof global.__sisnagSyncEmbedsToRoute === 'function') {
      setTimeout(function () {
        global.__sisnagSyncEmbedsToRoute(map);
      }, 120);
    }
  };

  global.__sisnagInitEmbedOverlayUi = function (map, socket) {
    var btnSync = document.getElementById('overlay-sync');
    var btnClose = document.getElementById('overlay-close-all');
    var btnCap = document.getElementById('overlay-mt-capture');
    var btnSock = document.getElementById('overlay-mt-refresh');

    if (btnSync) {
      btnSync.addEventListener('click', function () {
        if (map && typeof global.__sisnagSyncEmbedsToRoute === 'function') {
          global.__sisnagSyncEmbedsToRoute(map);
        }
      });
    }
    if (btnClose) {
      btnClose.addEventListener('click', function () {
        global.__sisnagCloseWindyMtOverlays();
      });
    }
    if (btnCap) {
      btnCap.addEventListener('click', function () {
        var legacy = document.getElementById('mt-capture-grok');
        if (legacy) legacy.click();
      });
    }
    if (btnSock && socket) {
      btnSock.addEventListener('click', function () {
        var legacy = document.getElementById('mt-socket-refresh');
        if (legacy) legacy.click();
        else socket.emit('chart_targets_refresh');
      });
    }
  };
})(window);
