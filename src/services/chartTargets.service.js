/**
 * Alvos na carta (Marine Traffic / Grok Vision, etc.).
 * Sem AISSTREAM: apenas ganchos Socket.io até integrar a fonte real.
 */
export const chartTargetsService = {
  init(socket) {
    socket.emit('vessels', {
      source: 'chart_stub',
      ships: [],
      message: 'Alvos na carta: configure Marine Traffic + Grok Vision (sem AISSTREAM).',
    });

    socket.on('chart_targets_refresh', () => {
      socket.emit('vessels', { source: 'chart_stub', ships: [], ts: Date.now() });
    });
  },
};
