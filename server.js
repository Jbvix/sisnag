import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { chartTargetsService } from './src/services/chartTargets.service.js';
import { extractVesselsFromMarineTrafficScreenshot } from './src/services/marineTrafficGrok.service.js';
import { sensorSocketHandler } from './src/sockets/sensorSocketHandler.js';
import { createGrokClient, grokChatModel, grokVisionModel } from './src/lib/grokClient.js';
import { createCorsOriginCallback, corsStartupLogLine } from './src/http/corsConfig.js';

dotenv.config();

const corsOrigin = createCorsOriginCallback();

const app = express();
app.set('trust proxy', 1);

app.use(
  cors({
    origin: corsOrigin,
    methods: ['GET', 'HEAD', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
    optionsSuccessStatus: 204,
  }),
);

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
    credentials: false,
  },
  allowEIO3: true,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

app.use(express.static('public'));
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => res.json({ status: 'OK', starlinkReady: true }));

app.post('/analyze-screenshot', upload.single('screenshot'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado (campo screenshot).' });
    }

    const grok = createGrokClient();
    if (!grok) {
      return res.json({
        analysis:
          '<p>Defina <strong>GROK_API_KEY</strong> ou <strong>XAI_API_KEY</strong> no servidor (Railway / .env) para análise por Grok Vision.</p>' +
          `<p>Imagem recebida: ${req.file.mimetype}, ${req.file.size} bytes.</p>`,
      });
    }

    const b64 = req.file.buffer.toString('base64');
    const dataUrl = `data:${req.file.mimetype};base64,${b64}`;
    const completion = await grok.chat.completions.create({
      model: grokVisionModel(),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Você é um assistente náutico/motor. Descreva em português do Brasil o que aparece: alarmes, painéis Caterpillar/MTU, RPM, temperaturas, se visível. Seja objetivo.',
            },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      max_tokens: 900,
    });
    const text = completion.choices[0]?.message?.content || '';
    return res.json({ analysis: text.replace(/\n/g, '<br>') });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      error: String(e.message || e),
      analysis: '<p>Falha ao analisar a imagem com Grok.</p>',
    });
  }
});

/** Captura do mapa Marine Traffic incorporado → Grok Vision → alvos na carta (Socket `vessels`). */
app.post('/api/chart-targets/from-screenshot', upload.single('screenshot'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo (campo screenshot).' });
    }

    const { ships, grokRaw, error } = await extractVesselsFromMarineTrafficScreenshot(
      req.file.buffer,
      req.file.mimetype,
    );

    let message = '';
    if (error === 'missing_grok_key') {
      message = 'Servidor sem GROK_API_KEY / XAI_API_KEY — não foi possível analisar a captura.';
    } else if (ships.length) {
      message = `${ships.length} alvo(s) com coordenadas extraídos do embed (Grok).`;
    } else {
      message =
        'Grok não devolveu coordenadas válidas. Tente captura mais nítida do mapa Marine Traffic incorporado.';
    }

    const payload = {
      source: 'grok_marine_traffic_embed',
      ships,
      ts: Date.now(),
      message,
      grokPreview: typeof grokRaw === 'string' ? grokRaw.slice(0, 1500) : '',
    };
    io.emit('vessels', payload);
    return res.json(payload);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: String(e.message || e), ships: [] });
  }
});

app.post('/api/chat', async (req, res) => {
  const message = req.body?.message;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Campo "message" (string) é obrigatório.' });
  }

  const grok = createGrokClient();
  if (!grok) {
    return res.json({
      reply:
        'Servidor sem GROK_API_KEY (ou XAI_API_KEY). Configure no Railway ou em .env para respostas do Grok.',
    });
  }

  try {
    const completion = await grok.chat.completions.create({
      model: grokChatModel(),
      messages: [
        {
          role: 'system',
          content:
            'Você é o copiloto náutico SISNAG (rebocador): navegação, COLREGs, meteorologia básica, motores Caterpillar/MTU quando relevante. Português do Brasil, respostas curtas e prudentes.',
        },
        { role: 'user', content: message },
      ],
      max_tokens: 700,
    });
    return res.json({ reply: completion.choices[0]?.message?.content || '' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: String(e.message || e) });
  }
});

io.on('connection', (socket) => {
  console.log('Cliente mobile conectado (Starlink)');

  chartTargetsService.init(io, socket);
  sensorSocketHandler(socket);

  socket.on('disconnect', () => console.log('Cliente desconectado'));
});

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
httpServer.listen(PORT, HOST, () => {
  console.log(`🚢 SISNAG — http://${HOST}:${PORT}`);
  console.log(corsStartupLogLine());
  console.log('📱 Grok + Marine Traffic incorporado (captura → /api/chart-targets/from-screenshot)');
});
