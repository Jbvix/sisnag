/* global window, document, fetch */
(function attachCamera(global) {
  global.captureScreenshot = async function captureScreenshot() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';

    input.onchange = async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('screenshot', file);

      if (typeof global.addChatMessage === 'function') {
        global.addChatMessage('Sistema', 'Enviando imagem para análise…');
      }

      try {
        const res = await fetch(window.__sisnagApiUrl('/analyze-screenshot'), {
          method: 'POST',
          body: formData,
        });
        const result = await res.json().catch(() => ({}));
        const text = result.analysis || result.error || 'Resposta vazia do servidor.';
        if (typeof global.addChatMessage === 'function') {
          global.addChatMessage('IA', text, { html: true });
        }
      } catch (err) {
        if (typeof global.addChatMessage === 'function') {
          global.addChatMessage('Sistema', String(err.message || err));
        }
      }
    };

    input.click();
  };
})(window);
