/**
 * @fileoverview Main server entry point.
 * @module server
 *
 * @summary Starts the ONUW multiplayer game server.
 *
 * @description
 * This file creates and starts the combined HTTP/WebSocket game server:
 * - HTTP server handles REST API requests via ApiHandler
 * - WebSocket server handles real-time game communication
 * It also initializes the PostgreSQL database connection.
 *
 * @pattern Facade Pattern - ApiHandler simplifies REST API access
 * @pattern Observer Pattern - WebSocket for real-time updates
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer as WsServer, WebSocket } from 'ws';
import { IWebSocketServerBackend } from './network/WebSocketServer';
import { IWebSocket } from './network/WebSocketConnection';
import { GameServerFacade } from './server/GameServerFacade';
import { ApiHandler } from './server/ApiHandler';
import { getDatabase } from './database';

/**
 * @summary WebSocket server backend using the 'ws' library with HTTP server.
 *
 * @description
 * Implements IWebSocketServerBackend using the popular 'ws' package,
 * attached to an HTTP server that also handles REST API requests.
 *
 * @pattern Adapter Pattern - Adapts ws library to IWebSocketServerBackend
 */
class WsServerBackend implements IWebSocketServerBackend {
  private httpServer: ReturnType<typeof createServer> | null = null;
  private wss: WsServer | null = null;
  private connectionHandler: ((socket: IWebSocket) => void) | null = null;
  private errorHandler: ((error: Error) => void) | null = null;
  private apiHandler: ApiHandler;

  constructor() {
    this.apiHandler = new ApiHandler();
  }

  listen(port: number, host: string, callback: () => void): void {
    // Create HTTP server that handles REST API requests
    this.httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const handled = await this.apiHandler.handleRequest(req, res);

      if (!handled) {
        // Non-API HTTP requests get a helpful message
        res.writeHead(426, {
          'Content-Type': 'text/plain',
          'Upgrade': 'websocket'
        });
        res.end('WebSocket connection required. Connect via ws:// protocol for game communication.');
      }
    });

    // Attach WebSocket server to HTTP server
    this.wss = new WsServer({ server: this.httpServer });

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

    this.httpServer.on('error', (error: Error) => {
      if (this.errorHandler) {
        this.errorHandler(error);
      }
    });

    // Start listening
    this.httpServer.listen(port, host, () => {
      callback();
    });
  }

  close(callback: () => void): void {
    if (this.wss) {
      this.wss.close(() => {
        if (this.httpServer) {
          this.httpServer.close(() => {
            this.wss = null;
            this.httpServer = null;
            callback();
          });
        } else {
          this.wss = null;
          callback();
        }
      });
    } else if (this.httpServer) {
      this.httpServer.close(() => {
        this.httpServer = null;
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

// Initialize database and start server
async function startServer(): Promise<void> {
  const db = getDatabase();

  // Connect to database
  if (process.env.DATABASE_URL) {
    try {
      console.log('Connecting to PostgreSQL database...');
      await db.connect();
      console.log('Database connected successfully');
    } catch (error) {
      console.warn('Database connection failed, running without persistence:', error);
      // Continue without database - game will work but won't persist data
    }
  } else {
    console.log('No DATABASE_URL configured, running without persistence');
  }

  // Start WebSocket server
  await server.start();

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║     One Night Ultimate Werewolf - Multiplayer Server      ║
╠═══════════════════════════════════════════════════════════╣
║  WebSocket: ws://${HOST}:${PORT.toString().padEnd(32)}║
║  REST API:  http://${HOST}:${PORT.toString().padEnd(30)}║
${process.env.DATABASE_URL ? '║  Database:  PostgreSQL connected                          ║\n' : '║  Database:  Not configured (in-memory only)              ║\n'}║  Press Ctrl+C to stop                                     ║
╚═══════════════════════════════════════════════════════════╝
`);
}

startServer().catch((error: Error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

// Handle graceful shutdown
async function shutdown(): Promise<void> {
  console.log('\nShutting down server...');

  // Stop WebSocket server
  await server.stop();

  // Disconnect database
  const db = getDatabase();
  await db.disconnect();

  console.log('Server stopped');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
