import { WebSocketServer, WebSocket } from 'ws';
import type { ServerEvent, ClientEvent } from '@local-voice-agent/shared';
import { createLogger } from '../logger.js';

const log = createLogger('websocket');

export class WSServer {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private eventHandlers: Map<string, Array<(data: ClientEvent, ws: WebSocket) => void>> = new Map();

  async start(port: number, host: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({ port, host }, () => {
        log.info(`WebSocket server listening on ws://${host}:${port}`);
        resolve();
      });

      this.wss.on('error', (error) => {
        log.error('WebSocket server error', { error: error.message });
        reject(error);
      });

      this.wss.on('connection', (ws, req) => {
        const addr = req.socket.remoteAddress;
        log.info(`Client connected from ${addr}`);
        this.clients.add(ws);

        // Send initial status
        this.send(ws, {
          type: 'status.update',
          listening: false,
          processing: false,
          vadActive: false,
          message: 'Connected to LocalVoiceAgent backend',
        });

        ws.on('message', (data) => {
          try {
            const event = JSON.parse(data.toString()) as ClientEvent;
            this.handleEvent(event, ws);
          } catch (err) {
            log.error('Failed to parse WebSocket message', { error: (err as Error).message });
          }
        });

        ws.on('close', () => {
          log.info('Client disconnected');
          this.clients.delete(ws);
        });

        ws.on('error', (error) => {
          log.error('Client WebSocket error', { error: error.message });
          this.clients.delete(ws);
        });
      });
    });
  }

  on(eventType: string, handler: (data: ClientEvent, ws: WebSocket) => void): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  private handleEvent(event: ClientEvent, ws: WebSocket): void {
    const handlers = this.eventHandlers.get(event.type) ?? [];
    for (const handler of handlers) {
      try {
        handler(event, ws);
      } catch (err) {
        log.error('Event handler error', { type: event.type, error: (err as Error).message });
      }
    }

    // Also emit to wildcard handlers
    const wildcardHandlers = this.eventHandlers.get('*') ?? [];
    for (const handler of wildcardHandlers) {
      try {
        handler(event, ws);
      } catch (err) {
        log.error('Wildcard handler error', { error: (err as Error).message });
      }
    }
  }

  send(ws: WebSocket, event: ServerEvent): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  }

  broadcast(event: ServerEvent): void {
    const data = JSON.stringify(event);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.wss) {
        for (const client of this.clients) {
          client.close();
        }
        this.clients.clear();
        this.wss.close(() => {
          log.info('WebSocket server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
