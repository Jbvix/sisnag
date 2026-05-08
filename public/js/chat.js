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
    row.style.marginBottom = '8px';
    row.style.fontSize = '13px';
    row.style.lineHeight = '1.35';
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

    root.style.display = 'flex';
    root.style.flexDirection = 'column';
    root.innerHTML = '';

    const header = document.createElement('div');
    header.style.padding = '10px 12px';
    header.style.borderBottom = '1px solid #e5e7eb';
    header.style.fontWeight = '600';
    header.textContent = 'Agente IA';
    root.appendChild(header);

    const messages = document.createElement('div');
    messages.id = 'chat-messages';
    messages.style.flex = '1';
    messages.style.overflow = 'auto';
    messages.style.padding = '10px 12px';
    root.appendChild(messages);

    const form = document.createElement('div');
    form.style.display = 'flex';
    form.style.gap = '8px';
    form.style.padding = '10px 12px';
    form.style.borderTop = '1px solid #e5e7eb';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Mensagem…';
    input.style.flex = '1';
    input.style.padding = '8px 10px';
    input.style.borderRadius = '8px';
    input.style.border = '1px solid #d1d5db';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Enviar';
    btn.style.padding = '8px 12px';
    btn.style.borderRadius = '8px';
    btn.style.border = 'none';
    btn.style.background = '#1d4ed8';
    btn.style.color = '#fff';
    btn.style.cursor = 'pointer';

    async function send() {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      addChatMessage('Você', escapeHtml(text));
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text }),
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
