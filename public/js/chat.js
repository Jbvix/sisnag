/* global window, document */
(function attachChat(global) {
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
    root.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'sisnag-chat-head';
    header.textContent = 'Copiloto IA';
    root.appendChild(header);

    const messages = document.createElement('div');
    messages.id = 'chat-messages';
    messages.className = 'sisnag-chat-messages';
    root.appendChild(messages);

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

    async function send() {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      addChatMessage('Você', escapeHtml(text));
      try {
        const coords = nearPayloadForSealagom();
        const res = await fetch(window.__sisnagApiUrl('/api/chat'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, ...coords }),
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
    root.appendChild(form);

    socket.on('sensor_broadcast', (p) => {
      if (p && p.type === 'gps' && p.data) {
        addChatMessage('Telemetria', `GPS outro cliente: ${p.data.lat?.toFixed?.(4)}, ${p.data.lon?.toFixed?.(4)}`);
      }
    });

    addChatMessage('IA', 'Copiloto SISNAG pronto. Envie uma pergunta ou use a captura de tela dos displays.');
  };
})(window);
