import { createServer } from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import express from 'express';
import { Context } from '@deepseek-ai/cordis';
import type { ServerConfig } from './config.js';

export { loadConfig, ConfigError } from './config.js';
export type { ServerConfig } from './config.js';

export interface FoundationServer {
  readonly address: Readonly<AddressInfo>;
  stop(): Promise<void>;
}

export async function startPlatform(config: Readonly<ServerConfig>): Promise<FoundationServer> {
  const context = new Context();
  const sockets = new Set<Socket>();
  let ready = false;
  let cleanupError: unknown;
  const app = express();
  app.disable('x-powered-by');
  app.disable('etag');
  app.get('/healthz', (_request, response) => {
    response.json({ status: 'ok', component: 'devmesh-server', scope: 'platform-foundation' });
  });
  app.get('/readyz', (_request, response) => {
    response.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'starting-or-stopping', scope: 'platform-foundation' });
  });
  app.use((_request, response) => { response.status(404).json({ error: 'NOT_FOUND' }); });
  const server = createServer({ headersTimeout: 5000, requestTimeout: 10000 }, app);
  server.on('connection', socket => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });

  const fiber = context.plugin({
    name: 'devmesh-http-foundation',
    async apply(scope: Context) {
      await scope.effect(async () => {
        await new Promise<void>((resolve, reject) => {
          const failed = (error: Error) => { server.off('listening', listening); reject(error); };
          const listening = () => { server.off('error', failed); resolve(); };
          server.once('error', failed);
          server.once('listening', listening);
          server.listen({ host: config.host, port: config.port });
        });
        return async () => {
          ready = false;
          const connectionsClosed = [...sockets].map(socket => new Promise<void>(resolve => { socket.once('close', () => resolve()); }));
          const timer = setTimeout(() => {
            server.closeAllConnections();
            for (const socket of sockets) socket.destroy();
          }, config.shutdownTimeoutMs);
          timer.unref();
          try {
            await Promise.all([
              new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); }),
              ...connectionsClosed,
            ]);
          } catch (error) {
            cleanupError = error;
            throw error;
          } finally {
            clearTimeout(timer);
          }
        };
      }, 'devmesh.http');
    },
  });

  try {
    await fiber;
    ready = true;
  } catch (error) {
    await fiber.dispose();
    server.closeAllConnections();
    for (const socket of sockets) socket.destroy();
    throw error;
  }

  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('HTTP server did not acquire a TCP address');
  let stopping: Promise<void> | undefined;
  return {
    address: Object.freeze({ ...address }),
    stop() {
      ready = false;
      stopping ??= (async () => {
        await fiber.dispose();
        if (cleanupError) throw cleanupError;
        if (server.listening || sockets.size !== 0) throw new Error('HTTP resources remained active after Cordis disposal');
      })();
      return stopping;
    },
  };
}
