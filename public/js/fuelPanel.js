/* global window, document */
(function fuelPanel(global) {
  var LS_LPH = 'sisnag_fuel_lph';
  var LS_BALANCE = 'sisnag_fuel_balance_l';

  function readLph() {
    var v = parseFloat(localStorage.getItem(LS_LPH));
    return Number.isFinite(v) ? v : null;
  }

  function readBalance() {
    var v = parseFloat(localStorage.getItem(LS_BALANCE));
    return Number.isFinite(v) ? v : null;
  }

  function writeLph(val) {
    if (val === null || val === '') {
      localStorage.removeItem(LS_LPH);
    } else {
      localStorage.setItem(LS_LPH, String(val));
    }
    updateBadge();
  }

  function writeBalance(val) {
    if (val === null || val === '') {
      localStorage.removeItem(LS_BALANCE);
    } else {
      localStorage.setItem(LS_BALANCE, String(val));
    }
    updateBadge();
  }

  function updateBadge() {
    var el = document.getElementById('fuel-badge');
    if (!el) return;
    var v = readLph();
    var b = readBalance();
    var lphLine = v !== null && Number.isFinite(v) ? String(v) + '\nL/h' : '—\nL/h';
    var balLine = b !== null && Number.isFinite(b) ? String(Math.round(b * 100) / 100) + '\nL' : '—\nL';
    el.textContent = lphLine + '\n' + balLine;
    var parts = [];
    if (v !== null && Number.isFinite(v)) parts.push('Consumo: ' + String(v) + ' L/h');
    if (b !== null && Number.isFinite(b)) parts.push('Saldo tanques: ' + String(Math.round(b * 100) / 100) + ' L');
    parts.push('Toque no ícone combustível para editar.');
    el.title = parts.join(' · ');
  }

  global.initFuelPanel = function initFuelPanel() {
    var btn = document.getElementById('nav-fuel');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var cur = readLph();
      var s = window.prompt(
        'Consumo de combustível (litros por hora, L/h).\n\nDeixe vazio para apagar:',
        cur !== null ? String(cur) : '',
      );
      if (s === null) return;
      s = s.trim().replace(',', '.');
      if (s === '') {
        writeLph(null);
      } else {
        var n = parseFloat(s);
        if (!Number.isFinite(n) || n < 0) {
          alert('Valor inválido.');
          return;
        }
        writeLph(n);
      }

      var curB = readBalance();
      var t = window.prompt(
        'Saldo total nos tanques (litros).\n\nOK vazio ou Cancel = manter atual. Escreva LIMPAR ou - para apagar.',
        curB !== null ? String(curB) : '',
      );
      if (t === null) return;
      t = t.trim().replace(',', '.');
      if (t === '') return;
      if (t === '-' || t.toLowerCase() === 'limpar') {
        writeBalance(null);
        return;
      }
      var nb = parseFloat(t);
      if (!Number.isFinite(nb) || nb < 0) {
        alert('Saldo inválido.');
        return;
      }
      writeBalance(nb);
    });
    updateBadge();
  };

  /** @deprecated usar readLph */
  global.__sisnagGetFuelLph = readLph;
  global.__sisnagGetFuelBalanceLiters = readBalance;
})(window);
