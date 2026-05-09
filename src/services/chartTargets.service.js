/**
 * Alvos na carta sem API Marine Traffic: mapa incorporado (embed) no cliente
 * + Grok Vision em capturas enviadas a POST /api/chart-targets/from-screenshot.
 */
export const chartTargetsService = {
  /**
   * @param {import('socket.io').Server} io
   * @param {import('socket.io').Socket} socket
   */
  init(io, socket) {
    socket.emit('vessels', {
      source: 'embed',
      ships: [],
      message:
        'Marine Traffic incorporado na app: abra o painel, faça captura de ecrã do mapa e use “Captura → Grok” para extrair alvos.',
    });

    socket.on('chart_targets_refresh', () => {
      io.emit('vessels', {
        source: 'embed_refresh',
        ships: [],
        ts: Date.now(),
        message:
          'Pedido de atualização: abra o Marine Traffic incorporado, capture o mapa e envie para análise Grok (ou reponha marcadores no mapa OSM).',
      });
    });
  },
};
