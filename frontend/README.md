Deploy estático no Netlify:

- **Opção A (recomendada):** na raiz do repositório, use o ficheiro `netlify.toml` (publish = `public`).
- **Opção B:** no painel do Netlify, defina **Base directory** = `frontend` e use o `netlify.toml` desta pasta (publicação = `../public`).

O backend em tempo real (Socket.io, uploads, `/api/chat`) corre no **Railway** com o `server.js` na raiz; o Netlify serve apenas ficheiros estáticos. Para chat e análise de imagem em produção, o front deve apontar para a URL do Railway (próximo passo: variável de ambiente ou proxy).
