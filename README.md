# SISNAG — Sistema Inteligente de Navegação Náutica

Copiloto IA para rebocadores (mapa Leaflet, Socket.io, sensores do dispositivo, chat e análise de imagem dos displays).

A API de IA usa **Grok (xAI)** em modo compatível com OpenAI (`https://api.x.ai/v1`). Não há AISSTREAM nem API Marine Traffic no servidor: o **mapa Marine Traffic é incorporado** (iframe) na app; as posições na carta OSM vêm de **capturas de ecrã** analisadas por Grok (`POST /api/chart-targets/from-screenshot`).

## Arranque local

```bash
cp .env.example .env
npm install
npm start
```

Abra `http://localhost:3000`. Defina `GROK_API_KEY` (ou `XAI_API_KEY`) no `.env` para chat (`/api/chat`), análise de displays (`POST /analyze-screenshot`) e alvos a partir do embed (`POST /api/chart-targets/from-screenshot`). Ajuste `GROK_CHAT_MODEL` e `GROK_VISION_MODEL` se necessário.

Embed Marine Traffic: [página oficial de embed](https://www.marinetraffic.com/en/p/embed-map). A captura deve ser feita pelo dispositivo (câmera/galeria) sobre o mapa incorporado — iframes de outro domínio não podem ser lidos por script por políticas do browser.

Documentação xAI: [docs.x.ai](https://docs.x.ai/docs/tutorial).

## Estrutura

- `server.js` — Express + Socket.io + rotas de API (Grok).
- `public/` — UI estática (Netlify).
- `src/lib/grokClient.js` — cliente Grok (SDK `openai` + `baseURL` xAI).
- `src/services/chartTargets.service.js` — eventos Socket para alvos (embed + refresh).
- `src/services/marineTrafficGrok.service.js` — Grok Vision em captura do mapa incorporado.
- `src/sockets/sensorSocketHandler.js` — retransmissão de telemetria.

## Deploy

### Railway (API + Grok + Socket.io)

- Raiz do repo, `npm start`, healthcheck `GET /health`.
- **Obrigatório (segredo):** `GROK_API_KEY` ou `XAI_API_KEY`, e opcionalmente `GROK_CHAT_MODEL`, `GROK_VISION_MODEL`, `GROK_API_BASE_URL`.
- **CORS:** com o site no Netlify, defina `CORS_ORIGIN` para o URL exato do site (ex.: `https://sisnag.netlify.app`) ou use `*` só em testes.

### Netlify (só ficheiros estáticos de `public/`)

O Netlify **não** executa o Node do SISNAG nem deve receber a chave Grok: o browser fala com o Railway.

No Netlify: **Site configuration → Environment variables → Build** (e Deploy, se quiser o mesmo valor):

| Variável | Obrigatória? | Descrição |
|----------|--------------|-----------|
| `SISNAG_API_ORIGIN` | **Sim** (produção) | URL pública do Railway **sem** barra no fim, ex.: `https://sisnag-production.up.railway.app`. O build gera `public/js/config.public.js` com este valor para `fetch` e Socket.io. |

O comando de build está em `netlify.toml`: `npm run build:netlify` (escreve `config.public.js`). O Netlify corre `npm install` por defeito quando existe `package.json` na raiz.

Se o deploy falhar com **ERESOLVE** / `langchain` vs `@langchain/core`: o código atual **não depende de LangChain** (apenas Grok). Atualize o `package.json` na branch que o Netlify usa (remova `langchain`) e faça push do `package-lock.json` gerado com `npm install`. O `netlify.toml` inclui `NPM_CONFIG_LEGACY_PEER_DEPS` como rede de segurança durante o install.

**Não** coloque `GROK_API_KEY` no Netlify para o site estático atual (ficaria exposta no JS gerado). Chaves só no Railway.

Repositório: [github.com/Jbvix/sisnag](https://github.com/Jbvix/sisnag.git).
