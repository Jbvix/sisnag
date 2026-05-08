/**
 * Ponte legada AIS / alvos na carta.
 * A documentação SISNAG prevê Grok Vision + Marine Traffic em vez de AISSTREAM.
 * Este módulo mantém a API `init(socket)` para o servidor subir; lógica externa pode ser ligada depois.
 */
export const aisStreamService = {
  init(socket) {
    socket.emit('vessels', { source: 'stub', ships: [], message: 'AISSTREAM desligado; integre Marine Traffic / Grok Vision aqui.' });

    socket.on('ais_client_ping', () => {
      socket.emit('vessels', { source: 'stub', ships: [], ts: Date.now() });
    });
  },
};
