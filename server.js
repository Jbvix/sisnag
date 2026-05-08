import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { aisStreamService } from './src/services/aisstream.service.js';
import { sensorSocketHandler } from './src/sockets/sensorSocketHandler.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

app.use(express.static('public'));
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => res.json({ status: 'OK', starlinkReady: true }));

io.on('connection', (socket) => {
  console.log('Cliente mobile conectado (Starlink)');
  
  aisStreamService.init(socket);
  
  sensorSocketHandler(socket);
  
  socket.on('disconnect', () => console.log('Cliente desconectado'));
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚢 SISNAG - Agente IA Náutico rodando em http://localhost:${PORT}`);
  console.log('📱 Pronto para Starlink + sensores mobile + análise de displays Caterpillar/MTU');
});