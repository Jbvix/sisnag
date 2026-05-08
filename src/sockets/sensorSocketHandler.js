/**
 * Recebe atualizações de sensores do cliente (GPS, bússola, movimento) e retransmite para telemetria / salas.
 */
export function sensorSocketHandler(socket) {
  socket.on('sensor_update', (payload) => {
    if (!payload || typeof payload !== 'object') return;
    socket.broadcast.emit('sensor_broadcast', {
      from: socket.id,
      receivedAt: Date.now(),
      ...payload,
    });
  });
}
