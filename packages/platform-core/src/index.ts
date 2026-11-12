import { createServer } from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import express from 'express';
import { Context } from '@deepseek-ai/cordis';
import type { ServerConfig } from './config.js';
import type { LocalStorage, LocalContentStore, SessionStore } from '@devmesh/blob-store';
import type { mountInternalAgents, CredentialResolver } from '@devmesh/a2a-adapter';
import type { PreparationConsumer, RuntimeConsumer, RuntimeTool,RuntimeWorkspaceLifecycle } from '@devmesh/agent-runtime';
import type { IdentityResolver, mountInputApi,PreviewAccessGateway } from '@devmesh/input-api';
import type { WorkflowScheduler, WorkflowSchedulerOptions } from './scheduler.js';
import type {WorkflowMcpOptions,WorkflowMcpServices} from '@devmesh/mcp-tools';

export { loadConfig, ConfigError } from './config.js';
export type { ServerConfig } from './config.js';
export type { WorkflowSchedulerOptions } from './scheduler.js';
export {DatasetPreparer} from './dataset-preparer.js';
export {AcceptancePreparer} from './acceptance-preparer.js';
export {ReleaseAcceptor} from './release-acceptor.js';
export {PreviewLifecycleManager} from './preview-lifecycle.js';
export type {PreviewRecoveryScope} from './preview-lifecycle.js';

export interface FoundationServer {
  readonly address: Readonly<AddressInfo>;
  stop(): Promise<void>;
  services?: { local:LocalStorage; content:LocalContentStore; sessions:SessionStore } | undefined;
  agents?:ReturnType<typeof mountInternalAgents>|undefined;
  consumer?:RuntimeConsumer|undefined;
  preparationConsumer?:PreparationConsumer|undefined;
  scheduler?:WorkflowScheduler|undefined;
  inputApi?:ReturnType<typeof mountInputApi>|undefined;
  mcp?:WorkflowMcpServices|undefined;
}

export async function startPlatform(config: Readonly<ServerConfig>,options:{resolveCredential?:CredentialResolver;runtimeTools?:RuntimeTool[];workspaceLifecycle?:(services:NonNullable<FoundationServer['services']>)=>Promise<RuntimeWorkspaceLifecycle>|RuntimeWorkspaceLifecycle;identityResolver?:IdentityResolver;previewGateway?:PreviewAccessGateway;scheduler?:WorkflowSchedulerOptions;mcp?:(services:NonNullable<FoundationServer['services']>)=>Promise<WorkflowMcpOptions>|WorkflowMcpOptions}={}): Promise<FoundationServer> {
  if(config.a2a&&!config.storage)throw new Error('A2A requires explicitly initialized durable storage');
  if(config.runtime&&(!config.storage||!config.a2a))throw new Error('Runtime requires durable storage and hosted A2A endpoints');
  if(config.inputApi&&!config.storage)throw new Error('Input API requires durable storage');
  if(options.previewGateway&&!config.inputApi)throw new Error('Preview entry requires the explicitly configured Input API');
  if(options.mcp&&!config.storage)throw new Error('MCP services require durable storage');
  if(options.workspaceLifecycle&&!config.runtime)throw new Error('Managed workspaces require an explicitly configured Runtime');
  if(options.scheduler&&(!config.runtime||!config.a2a?.identities.some(identity=>identity.principalId===options.scheduler?.callerId)))
    throw new Error('Scheduler requires configured Runtime and an internal service identity');
  const inputModule=config.inputApi?await import('@devmesh/input-api'):undefined;
  const inputBaseline=config.inputApi?await inputModule!.resolveTemplateBaseline(config.inputApi.repositoryRoot,config.inputApi.commit,config.inputApi.templatePath):undefined;
  const runtimeModule=config.runtime?await import('@devmesh/agent-runtime'):undefined;
  const runtimeConfig=runtimeModule?.parseRuntimeConfig(config.runtime);
  if(runtimeConfig?.preparation&&!config.inputApi)throw new Error('Preparation requires the input API and its trusted baseline');
  const context = new Context();
  let services: FoundationServer['services'];
  const storageFiber=config.storage?context.plugin({name:'devmesh-local-storage',async apply(scope:Context){
    await scope.effect(async()=>{
      const { openLocalStorage, LocalContentStore, SessionStore } = await import('@devmesh/blob-store');
      const local=await openLocalStorage(config.storage!);
      try{
        const content=new LocalContentStore(local.storage,local.dataRoot,local.minimumFreeBytes),sessions=new SessionStore(content);
        await content.recoverPublished();
        await local.storage.request('recoverUploadIntakes',{});
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
  let consumer:RuntimeConsumer|undefined;
  let preparationConsumer:PreparationConsumer|undefined;
  let scheduler:WorkflowScheduler|undefined;
  let a2aModule:typeof import('@devmesh/a2a-adapter')|undefined;
  let inputApi:ReturnType<typeof mountInputApi>|undefined;
  let mcp:WorkflowMcpServices|undefined;
  try{if(config.a2a&&services){a2aModule=await import('@devmesh/a2a-adapter');agents=a2aModule.mountInternalAgents(app,services.local.storage,{...config.a2a,resolveCredential:options.resolveCredential??a2aModule.environmentCredentials()});}}
  catch(error){await storageFiber?.dispose();throw error;}
  try{if(inputModule&&inputBaseline&&services)inputApi=inputModule.mountInputApi(app,services.content,{enabled:true,baseline:inputBaseline,identityResolver:options.identityResolver,previewGateway:options.previewGateway});}
  catch(error){await agents?.stop();await storageFiber?.dispose();throw error;}
  app.use((_request, response) => { response.status(404).json({ error: 'NOT_FOUND' }); });
  const server = createServer({ headersTimeout: 5000, requestTimeout: config.inputApi?35000:10000 }, app);
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

  async function releaseServices(){
    mcp?.stopAdmission();const failures:unknown[]=[];
    const actions=[()=>inputApi?.stop(),()=>scheduler?.stop(),()=>preparationConsumer?.stop(),()=>consumer?.stop(),()=>mcp?.close(),()=>agents?.stop(),()=>fiber.dispose(),()=>storageFiber?.dispose()];
    for(const action of actions)try{await action();}catch(error){failures.push(error);}
    if(failures.length){server.closeAllConnections();for(const socket of sockets)socket.destroy();throw new AggregateError(failures,'Platform resource release failed');}
  }

  try {
    await fiber;
    if(agents)await agents.activate();
    if(options.mcp&&services){const {startWorkflowMcpServices}=await import('@devmesh/mcp-tools');mcp=await startWorkflowMcpServices(services.local.storage,services.content,await options.mcp(services));}
    if(runtimeConfig&&services&&runtimeModule){
      const { DeepSeekProvider, AgentRuntime, RuntimeConsumer } = runtimeModule;
      const credentials=options.resolveCredential??a2aModule!.environmentCredentials();
      const providers=runtimeConfig.providers.map(p=>new DeepSeekProvider(p,credentials));
      const runtime=new AgentRuntime(services.local.storage,services.content,providers,[...(options.runtimeTools??[]),...(mcp?.tools??[])],runtimeConfig.tokenLimit,await options.workspaceLifecycle?.(services));
      const localEndpoints=config.a2a!.manifest.endpoints.filter(e=>e.hosting==='local'&&e.enabled);
      consumer=new RuntimeConsumer(services.local.storage,runtime,localEndpoints.map(e=>e.endpointId),'runtime.local');
      await consumer.start();
      if(options.scheduler){
        const {WorkflowScheduler}=await import('./scheduler.js');
        scheduler=new WorkflowScheduler(services.local.storage,agents!.registry,credentials,options.scheduler);
        scheduler.start();
      }
      const prep=runtimeConfig.preparation;
      if(prep){
        const {PreparationRuntime,PreparationConsumer}=runtimeModule;
        if(!config.a2a!.identities.some(identity=>identity.principalId===prep.callerId))throw new Error('Preparation caller must be a configured internal identity');
        const preparation=new PreparationRuntime(services.content,agents!.registry,credentials,{
          callerId:prep.callerId,workerId:'preparation.local',tokenLimit:runtimeConfig.tokenLimit,maxInputBytes:prep.maxInputBytes,maxOutputTokens:prep.maxOutputTokens,
          providers:{product:providers.find(p=>p.config.providerId===prep.productProviderId)!,architect:providers.find(p=>p.config.providerId===prep.architectProviderId)!},
          available:async provider=>!!await credentials(provider.config.credentialRef),
          ...(prep.bootstrapPaths.length?{bootstrap:{repositoryRoot:config.inputApi!.repositoryRoot,paths:prep.bootstrapPaths}}:{}),
        });
        preparationConsumer=new PreparationConsumer(preparation,localEndpoints.filter(e=>e.supportedSkills.includes('devmesh.prepare.'+e.role)).map(e=>e.endpointId));
        await preparationConsumer.start();
      }
    }
    ready = true;
  } catch (error) {
    await releaseServices().catch(()=>{});
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
    ...(consumer?{consumer}:{}),
    ...(preparationConsumer?{preparationConsumer}:{}),
    ...(scheduler?{scheduler}:{}),
    ...(inputApi?{inputApi}:{}),
    ...(mcp?{mcp}:{}),
    stop() {
      ready = false;
      mcp?.stopAdmission();
      stopping ??= (async () => {
        await releaseServices();
        if (cleanupError) throw cleanupError;
        if (server.listening || sockets.size !== 0) throw new Error('HTTP resources remained active after Cordis disposal');
      })();
      return stopping;
    },
  };
}
