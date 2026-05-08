# SISNAG — Sistema Inteligente de Navegação Náutica

Copiloto IA para rebocadores (mapa Leaflet, Socket.io, sensores do dispositivo, chat e análise de imagem dos displays).

## Arranque local

```bash
cp .env.example .env
npm install
npm start
```

Abra `http://localhost:3000`. Opcional: defina `OPENAI_API_KEY` no `.env` para chat (`/api/chat`) e análise de capturas (`POST /analyze-screenshot`).

## Estrutura

- `server.js` — Express + Socket.io + rotas de API.
- `public/` — UI estática (também publicada no Netlify).
- `src/services/aisstream.service.js` — stub de alvos na carta (substituir por Marine Traffic / Grok conforme a doc interna).
- `src/sockets/sensorSocketHandler.js` — retransmissão de telemetria.

## Deploy (quando ligar os serviços)

- **Railway:** raiz do repositório, `npm start`, healthcheck `GET /health`. Ver `railway.json`.
- **Netlify:** `public` como diretório de publicação; ver `netlify.toml` na raiz ou `frontend/netlify.toml` se usar base `frontend`.

Em produção, o front estático no Netlify precisa de **URL do backend** para `fetch` e `io()` — configure CORS e um `API_URL` / proxy quando for esse o próximo passo.

Repositório remoto: [github.com/Jbvix/sisnag](https://github.com/Jbvix/sisnag.git).
