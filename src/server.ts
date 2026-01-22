/**
 * @fileoverview Main server entry point.
 * @module server
 *
 * @summary Starts the ONUW multiplayer game server.
 *
 * @description
 * This file creates and starts the WebSocket game server,
 * wiring up the ws library backend with the GameServerFacade.
 */

import { WebSocketServer as WsServer, WebSocket } from 'ws';
import { IWebSocketServerBackend } from './network/WebSocketServer';
import { IWebSocket } from './network/WebSocketConnection';
import { GameServerFacade } from './server/GameServerFacade';

/**
 * @summary WebSocket server backend using the 'ws' library.
 *
 * @description
 * Implements IWebSocketServerBackend using the popular 'ws' package.
 */
class WsServerBackend implements IWebSocketServerBackend {
  private wss: WsServer | null = null;
  private connectionHandler: ((socket: IWebSocket) => void) | null = null;
  private errorHandler: ((error: Error) => void) | null = null;

  listen(port: number, host: string, callback: () => void): void {
    this.wss = new WsServer({ port, host });

    this.wss.on('listening', () => {
      callback();
    });

    this.wss.on('connection', (ws: WebSocket) => {
      // The ws WebSocket matches our IWebSocket interface
      const socket = ws as unknown as IWebSocket;

      if (this.connectionHandler) {
        this.connectionHandler(socket);
      }
    });

    this.wss.on('error', (error: Error) => {
      if (this.errorHandler) {
        this.errorHandler(error);
      }
    });
  }

  close(callback: () => void): void {
    if (this.wss) {
      this.wss.close(() => {
        this.wss = null;
        callback();
      });
    } else {
      callback();
    }
  }

  onConnection(handler: (socket: IWebSocket) => void): void {
    this.connectionHandler = handler;
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandler = handler;
  }
}

// Configuration
const PORT = parseInt(process.env.PORT ?? '8080', 10);
const HOST = process.env.HOST ?? '0.0.0.0';

// Create backend and server
const backend = new WsServerBackend();
const server = new GameServerFacade(backend, {
  port: PORT,
  host: HOST,
  maxRooms: 100,
  reconnectionGracePeriodMs: 30000
});

// Start server
server.start()
  .then(() => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║     One Night Ultimate Werewolf - Multiplayer Server      ║
╠═══════════════════════════════════════════════════════════╣
║  Server running on ws://${HOST}:${PORT.toString().padEnd(25)}║
║  Press Ctrl+C to stop                                     ║
╚═══════════════════════════════════════════════════════════╝
`);
  })
  .catch((error: Error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down server...');
  await server.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down server...');
  await server.stop();
  process.exit(0);
});
