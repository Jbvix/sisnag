/* global window, document */
(function fuelPanel(global) {
  var LS = 'sisnag_fuel_lph';

  function read() {
    var v = parseFloat(localStorage.getItem(LS));
    return Number.isFinite(v) ? v : null;
  }

  function write(val) {
    if (val === null || val === '') {
      localStorage.removeItem(LS);
    } else {
      localStorage.setItem(LS, String(val));
    }
    updateBadge();
  }

  function updateBadge() {
    var el = document.getElementById('fuel-badge');
    if (!el) return;
    var v = read();
    el.textContent =
      v !== null && Number.isFinite(v) ? String(v) + ' L/h — clique para editar' : 'Consumo: — (clique para definir)';
  }

  global.initFuelPanel = function initFuelPanel() {
    var btn = document.getElementById('nav-fuel');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var cur = read();
      var s = window.prompt(
        'Consumo de combustível (litros por hora, L/h).\n\nDeixe vazio para apagar:',
        cur !== null ? String(cur) : '',
      );
      if (s === null) return;
      s = s.trim().replace(',', '.');
      if (s === '') {
        write(null);
        return;
      }
      var n = parseFloat(s);
      if (!Number.isFinite(n) || n < 0) {
        alert('Valor inválido.');
        return;
      }
      write(n);
    });
    updateBadge();
  };

  global.__sisnagGetFuelLph = read;
})(window);
