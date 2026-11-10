import { createServer } from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import express from 'express';
import { Context } from '@deepseek-ai/cordis';
import type { ServerConfig } from './config.js';
import { LocalContentStore, SessionStore, openLocalStorage } from '@devmesh/blob-store';
import type { LocalStorage } from '@devmesh/blob-store';
import { mountInternalAgents,environmentCredentials } from '@devmesh/a2a-adapter';
import type { CredentialResolver } from '@devmesh/a2a-adapter';

export { loadConfig, ConfigError } from './config.js';
export type { ServerConfig } from './config.js';

export interface FoundationServer {
  readonly address: Readonly<AddressInfo>;
  stop(): Promise<void>;
  services?: { local:LocalStorage; content:LocalContentStore; sessions:SessionStore } | undefined;
  agents?:ReturnType<typeof mountInternalAgents>|undefined;
}

export async function startPlatform(config: Readonly<ServerConfig>,options:{resolveCredential?:CredentialResolver}={}): Promise<FoundationServer> {
  if(config.a2a&&!config.storage)throw new Error('A2A requires explicitly initialized durable storage');
  const context = new Context();
  let services: FoundationServer['services'];
  const storageFiber=config.storage?context.plugin({name:'devmesh-local-storage',async apply(scope:Context){
    await scope.effect(async()=>{
      const local=await openLocalStorage(config.storage!);
      try{
        const content=new LocalContentStore(local.storage,local.dataRoot,local.minimumFreeBytes),sessions=new SessionStore(content);
        await content.recoverPublished();
        const integrity=await content.verifyAll();
        if(integrity.failures.length)throw new Error(`Storage integrity blocked startup: ${integrity.failures.length} unavailable objects`);
        services={local,content,sessions};
        return ()=>local.close();
      }catch(error){await local.close();throw error;}
    },'devmesh.storage');
  }}):undefined;
  if(storageFiber)await storageFiber;
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
  let agents: ReturnType<typeof mountInternalAgents>|undefined;
  try{if(config.a2a&&services)agents=mountInternalAgents(app,services.local.storage,{...config.a2a,resolveCredential:options.resolveCredential??environmentCredentials()});}
  catch(error){await storageFiber?.dispose();throw error;}
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
    if(agents)await agents.activate();
    ready = true;
  } catch (error) {
    await agents?.stop();
    await fiber.dispose();
    await storageFiber?.dispose();
    server.closeAllConnections();
    for (const socket of sockets) socket.destroy();
    throw error;
  }

  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('HTTP server did not acquire a TCP address');
  let stopping: Promise<void> | undefined;
  return {
    address: Object.freeze({ ...address }),
    ...(services?{services}:{}),
    ...(agents?{agents}:{}),
    stop() {
      ready = false;
      stopping ??= (async () => {
        try{await agents?.stop();await fiber.dispose();}finally{await storageFiber?.dispose();}
        if (cleanupError) throw cleanupError;
        if (server.listening || sockets.size !== 0) throw new Error('HTTP resources remained active after Cordis disposal');
      })();
      return stopping;
    },
  };
}
