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

1. No [Railway](https://railway.com), **New project → Deploy from GitHub** e escolha o repositório `sisnag`.
2. **Root directory:** deixe vazio (raiz), onde estão `server.js`, `package.json` e `railway.json`.
3. O **Railpack** (predefinição) deteta Node e corre `npm install` + `npm start`. O ficheiro `railway.json` define healthcheck em `GET /health`, timeout 120 s e `watchPatterns` para redesploiar quando mudar `server.js`, `src/`, `public/` ou dependências.
4. Em **Variables** do serviço, configure as variáveis da tabela abaixo. O **PORT** é injectado pela Railway — não defina manualmente a menos que saiba o que está a fazer.
5. Após o primeiro deploy, copie o **URL público do Railway** (ex.: `https://sisnag-production.up.railway.app`) e coloque-o no Netlify como `SISNAG_API_ORIGIN`. Na **Railway**, em Variables, defina `CORS_ORIGIN` com o **URL do site Netlify** (ex.: `https://sisnag.netlify.app`), para o browser poder chamar a API e o Socket.io.

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `GROK_API_KEY` ou `XAI_API_KEY` | Sim (IA) | Chave em [console.x.ai](https://console.x.ai/). |
| `CORS_ORIGIN` | Recomendada | URL **exato** do site Netlify **sem barra no fim**, ex. `https://sisnag.netlify.app`. Se estiver errado ou com `/` no fim, o browser bloqueia Socket.io e `/api/*`. Várias origens: vírgula. Deixe **vazio** ou `*` para modo permissivo (só testes). Após deploy, veja nos logs do Railway a linha `[CORS] ...`. |
| `GROK_API_BASE_URL` | Não | Predefinido `https://api.x.ai/v1`. |
| `GROK_CHAT_MODEL` | Não | Ex.: `grok-2-latest`. |
| `GROK_VISION_MODEL` | Não | Ex.: `grok-2-vision-latest`. |
| `HOST` | Não | Predefinido `0.0.0.0` (correcto atrás do proxy da Railway). |

O servidor usa `trust proxy` e escuta em `0.0.0.0` para o proxy da Railway. Socket.io usa a mesma lógica de origens que `CORS_ORIGIN` (lista ou `*`).

### Netlify (só ficheiros estáticos de `public/`)

O Netlify **não** executa o Node do SISNAG nem deve receber a chave Grok: o browser fala com o Railway.

No Netlify: **Site configuration → Environment variables → Build** (e Deploy, se quiser o mesmo valor):

| Variável | Obrigatória? | Descrição |
|----------|--------------|-----------|
| `SISNAG_API_ORIGIN` | **Sim** (produção) | URL pública do Railway **sem** barra no fim, ex.: `https://sisnag-production.up.railway.app`. O build gera `public/js/config.public.js` com este valor para `fetch` e Socket.io. |

O comando de build está em `netlify.toml`: `npm run build:netlify` (escreve `config.public.js`). O Netlify corre `npm install` por defeito quando existe `package.json` na raiz.

Se o deploy falhar com **ERESOLVE** / `langchain` vs `@langchain/core`: o código atual **não depende de LangChain** (apenas Grok). Atualize o `package.json` na branch que o Netlify usa (remova `langchain`) e faça push do `package-lock.json` gerado com `npm install`. O `netlify.toml` inclui `NPM_CONFIG_LEGACY_PEER_DEPS` como rede de segurança durante o install.

**Não** coloque `GROK_API_KEY` no Netlify para o site estático atual (ficaria exposta no JS gerado). Chaves só no Railway.

### Railway: `SIGTERM` e `npm warn config production`

- **`SIGTERM` no comando `node server.js`**: em muitos casos não é erro de código, e sim o **Railway a parar um deploy anterior** quando publica uma versão nova, ou o **restart** quando o **healthcheck** falha repetidamente. Nos logs procure **`[sisnag] listening pid=…`** logo após o arranque; se **nunca** aparece, há uma excepção antes de `listen()` (reveja variáveis e build).
- O **deploy** usa `startCommand`: `node server.js` (sem `npm start`) para o processo ser o próprio Node. O **`healthcheckTimeout`** está alto (300 s) por defeito para arranques lentos.
- O aviso **`npm warn config production Use --omit=dev`** vem da combinação **NPM 10 + `NODE_ENV=production`**; é cosmético. Pode ignorar ou definir nas variáveis do serviço: `NPM_CONFIG_OMIT=dev`.

Repositório: [github.com/Jbvix/sisnag](https://github.com/Jbvix/sisnag.git).
