# SISNAG — Sistema Inteligente de Navegação Náutica

Copiloto IA para rebocadores (mapa Leaflet, Socket.io, sensores do dispositivo, chat e análise de imagem dos displays).

A API de IA usa **Grok (xAI)** em modo compatível com OpenAI (`https://api.x.ai/v1`). Não há AISSTREAM; alvos na carta vêm de integrações futuras (ex.: Marine Traffic + Grok Vision).

## Arranque local

```bash
cp .env.example .env
npm install
npm start
```

Abra `http://localhost:3000`. Defina `GROK_API_KEY` (ou `XAI_API_KEY`) no `.env` para chat (`/api/chat`) e análise de capturas (`POST /analyze-screenshot`). Ajuste `GROK_CHAT_MODEL` e `GROK_VISION_MODEL` se a sua conta xAI usar outros nomes de modelo.

Documentação xAI: [docs.x.ai](https://docs.x.ai/docs/tutorial).

## Estrutura

- `server.js` — Express + Socket.io + rotas de API (Grok).
- `public/` — UI estática (Netlify).
- `src/lib/grokClient.js` — cliente Grok (SDK `openai` + `baseURL` xAI).
- `src/services/chartTargets.service.js` — stub de alvos na carta (sem AISSTREAM).
- `src/sockets/sensorSocketHandler.js` — retransmissão de telemetria.

## Deploy

- **Railway:** raiz, `npm start`, `GET /health`. Variáveis: `GROK_API_KEY`, etc.
- **Netlify:** publicar pasta `public` (ver `netlify.toml` na raiz).

Em produção, o front no Netlify precisa da **URL do backend** para `fetch` e `io()`.

Repositório: [github.com/Jbvix/sisnag](https://github.com/Jbvix/sisnag.git).
