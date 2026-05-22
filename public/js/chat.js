/* global window, document */
(function attachChat(global) {
  var CHAT_H_STORAGE = 'sisnag_chat_footer_h';
  var CHAT_H_MIN = 112;
  var CHAT_H_MAX_PX = 340;

  function chatFooterMaxPx() {
    var vh = window.innerHeight || 600;
    return Math.min(CHAT_H_MAX_PX, Math.round(vh * 0.52));
  }

  function applyChatFooterHeight(px) {
    var h = Math.max(CHAT_H_MIN, Math.min(chatFooterMaxPx(), Math.round(px)));
    document.documentElement.style.setProperty('--sisnag-footer-chat-h', h + 'px');
    return h;
  }

  function restoreChatFooterHeight() {
    try {
      var v = parseInt(localStorage.getItem(CHAT_H_STORAGE), 10);
      if (Number.isFinite(v) && v >= CHAT_H_MIN) applyChatFooterHeight(v);
    } catch (e) {
      /* ignore */
    }
  }

  function invalidateMapsAfterChatResize() {
    try {
      var mm = global.__sisnagMainMap || global.__sisnagMainLeafletMap;
      if (mm && typeof mm.invalidateSize === 'function') mm.invalidateSize(false);
      var vm = global.__sisnagVectorMap;
      if (vm && typeof vm.invalidateSize === 'function') vm.invalidateSize(false);
    } catch (e) {
      /* ignore */
    }
    if (typeof global.__sisnagDebouncedEmbedSync === 'function') {
      var m = global.__sisnagMainMap || global.__sisnagMainLeafletMap;
      if (m) global.__sisnagDebouncedEmbedSync(m);
    }
  }

  function attachChatResizeHandle(root, handle) {
    root = root || document.getElementById('chat');
    handle = handle || document.getElementById('sisnag-chat-resize');
    if (!root || !handle || handle.dataset.sisnagResizeBound === '1') return;
    handle.dataset.sisnagResizeBound = '1';

    var dragging = false;
    var startY = 0;
    var startH = 0;

    function onPointerMove(e) {
      if (!dragging) return;
      applyChatFooterHeight(startH + (startY - e.clientY));
    }

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      document.body.classList.remove('sisnag-chat-resizing');
      try {
        var h = applyChatFooterHeight(root.getBoundingClientRect().height);
        localStorage.setItem(CHAT_H_STORAGE, String(h));
      } catch (err) {
        /* ignore */
      }
      invalidateMapsAfterChatResize();
      window.setTimeout(invalidateMapsAfterChatResize, 120);
    }

    handle.addEventListener('pointerdown', function (e) {
      dragging = true;
      startY = e.clientY;
      startH = root.getBoundingClientRect().height;
      document.body.classList.add('sisnag-chat-resizing');
      handle.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    handle.addEventListener('pointermove', onPointerMove);
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
    handle.addEventListener('lostpointercapture', endDrag);

    handle.addEventListener('dblclick', function () {
      document.documentElement.style.removeProperty('--sisnag-footer-chat-h');
      try {
        localStorage.removeItem(CHAT_H_STORAGE);
      } catch (err) {
        /* ignore */
      }
      invalidateMapsAfterChatResize();
    });
  }

  function bootChatResize() {
    attachChatResizeHandle(document.getElementById('chat'), document.getElementById('sisnag-chat-resize'));
  }

  restoreChatFooterHeight();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootChatResize);
  } else {
    bootChatResize();
  }

  window.addEventListener('resize', function () {
    try {
      var cur = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue('--sisnag-footer-chat-h'),
        10,
      );
      if (Number.isFinite(cur)) applyChatFooterHeight(cur);
    } catch (e) {
      /* ignore */
    }
  });

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  global.addChatMessage = function addChatMessage(sender, htmlOrText, opts) {
    const useHtml = opts && opts.html === true;
    const wrap = document.getElementById('chat-messages');
    if (!wrap) return;
    const row = document.createElement('div');
    row.className = 'sisnag-chat-line';
    const who = document.createElement('strong');
    who.textContent = sender + ': ';
    row.appendChild(who);
    const body = document.createElement('span');
    if (useHtml) {
      body.innerHTML = htmlOrText;
    } else {
      body.textContent = htmlOrText;
    }
    row.appendChild(body);
    wrap.appendChild(row);
    wrap.scrollTop = wrap.scrollHeight;
  };

  global.initChat = function initChat(socket) {
    const root = document.getElementById('chat');
    if (!root) return;

    root.removeAttribute('hidden');
    root.style.display = 'flex';
    root.style.flexDirection = 'column';
    bootChatResize();

    var body = document.getElementById('chat-body');
    if (!body) {
      body = document.createElement('div');
      body.id = 'chat-body';
      root.appendChild(body);
    }
    body.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'sisnag-chat-head';
    header.textContent = 'Copiloto IA';
    body.appendChild(header);

    const messages = document.createElement('div');
    messages.id = 'chat-messages';
    messages.className = 'sisnag-chat-messages';
    body.appendChild(messages);

    const form = document.createElement('div');
    form.className = 'sisnag-chat-form';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Mensagem…';
    input.className = 'sisnag-chat-input';
    input.autocomplete = 'off';
    input.enterKeyHint = 'send';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Enviar';
    btn.className = 'sisnag-chat-send';
    btn.style.border = 'none';
    btn.style.background = '#1d4ed8';
    btn.style.color = '#fff';
    btn.style.cursor = 'pointer';

    function nearPayloadForSealagom() {
      const out = {};
      const gps = global.__sisnagLastKnownGps;
      if (gps && Number.isFinite(gps.lat) && Number.isFinite(gps.lng)) {
        out.lat = gps.lat;
        out.lng = gps.lng;
        return out;
      }
      try {
        const mm = global.__sisnagMainMap;
        if (mm && typeof mm.getCenter === 'function') {
          const c = mm.getCenter();
          if (Number.isFinite(c.lat) && Number.isFinite(c.lng)) {
            out.lat = c.lat;
            out.lng = c.lng;
          }
        }
      } catch (e) {
        /* ignore */
      }
      return out;
    }

    function buildChatPayload(text) {
      const payload = { message: text, ...nearPayloadForSealagom() };
      if (typeof global.__sisnagGetNavigationContext === 'function') {
        payload.navigation = global.__sisnagGetNavigationContext();
      }
      return payload;
    }

    async function send() {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      addChatMessage('Você', escapeHtml(text));
      try {
        const res = await fetch(window.__sisnagApiUrl('/api/chat'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildChatPayload(text)),
        });
        const data = await res.json().catch(() => ({}));
        const reply = data.reply || data.error || 'Sem resposta do servidor.';
        addChatMessage('IA', escapeHtml(reply));
      } catch (e) {
        addChatMessage('Sistema', escapeHtml(String(e.message || e)));
      }
    }

    btn.addEventListener('click', send);
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') send();
    });

    form.appendChild(input);
    form.appendChild(btn);
    body.appendChild(form);

    socket.on('sensor_broadcast', (p) => {
      if (p && p.type === 'gps' && p.data) {
        addChatMessage('Telemetria', `GPS outro cliente: ${p.data.lat?.toFixed?.(4)}, ${p.data.lon?.toFixed?.(4)}`);
      }
    });

    addChatMessage(
      'IA',
      'Copiloto SISNAG pronto: waypoints, ETAs, portos com filial e faróis da costa brasileira (características de luz) perto da rota. Ex.: «Que farol é este Fl W 5s?» ou «ETA ao waypoint 3».',
    );
  };
})(window);
