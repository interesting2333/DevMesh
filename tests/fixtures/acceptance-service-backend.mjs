// Actual Runner Worker, data files, template read-only database and HTTP routes.
// Container/network/OCI identities and physical fences remain explicit fixtures.
import {createServer} from 'node:http';
import {readFile,writeFile,symlink} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire,stripTypeScriptTypes} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {RunnerAcceptancePreparationBackend,openRunnerStore} from '../../packages/runner/dist/index.mjs';
import {acceptanceDatasetFixture,acceptanceDatasetPreparation} from './acceptance-datasets.mjs';
import {hash,canonical} from './storage-data.mjs';
export const bound=r=>({controllerId:r.controllerId,reservationId:r.reservationId,requestHash:r.requestHash});
export async function acceptanceServiceBackendFixture(t,{preparation=acceptanceDatasetPreparation({initialData:'DEMO'})}={}){
 const data=await acceptanceDatasetFixture(t);let store=data.layout.store,application;
 const compat=join(data.root,'compat'),resolveDependency=createRequire(new URL('../../packages/input-api/package.json',import.meta.url));
 await symlink(dirname(resolveDependency.resolve('express/package.json')),join(compat,'node_modules','express'),process.platform==='win32'?'junction':'dir');
 await writeFile(join(compat,'server','app.js'),stripTypeScriptTypes(await readFile(new URL('../../templates/web-crud-v1/src/server/app.ts',import.meta.url),'utf8'),{mode:'transform'}));
 const makeApplication=(await import(pathToFileURL(join(compat,'server','app.js')).href)).application;
 const server=createServer((req,res)=>{if(driver.unhealthy&&req.url==='/api/health'){res.writeHead(503);res.end('explicit unhealthy HTTP');return;}if(!application){res.writeHead(503);res.end('not started');return;}application(req,res);});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});data.cleanup.push(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
 const driver={configured:true,networks:new Map(),containers:new Map(),calls:[],failAfter:null,prepareFails:false,unhealthy:false,beforeStart:null,beforeCreate:null,
  lost(kind){if(this.failAfter===kind){this.failAfter=null;throw Error('explicit '+kind+' ACK loss');}},
  async probe(){},async prepare(p){if(p.purpose!=='ACCEPTANCE'||p.accessMode!=='READ_ONLY')throw Error('wrong fixture purpose');if(this.prepareFails)throw Error('explicit quota failure');},
  async network(p){this.calls.push('query-network');return this.networks.get(p.networkName)??null;},
  async createNetwork(p,r,authorize){if(!await authorize())throw Error('explicit authority denied');this.calls.push('NETWORK_CREATE');const id=hash(p.reservationId+':network');this.networks.set(p.networkName,id);this.lost('NETWORK_CREATE');return id;},
  async inspect(p,r,networkId,containerId){this.calls.push('query-container');const f=this.containers.get(p.containerName);if(f&&(f.networkId!==networkId||containerId!==null&&f.containerId!==containerId))throw Error('explicit wrong original container');return f?structuredClone(f):null;},
  async create(p,r,networkId,authorize){await this.beforeCreate?.();if(!await authorize())throw Error('explicit authority denied');this.calls.push('CREATE');const f={containerId:hash(p.reservationId+':container'),networkId,state:'created',pid:0,exitCode:null,endpoint:null};this.containers.set(p.containerName,f);this.lost('CREATE');return structuredClone(f);},
  async start(p,r,networkId,containerId,authorize){await this.beforeStart?.();if(!await authorize())throw Error('explicit authority denied');this.calls.push('START');const q=r.preparation,db=data.app({request:{projectId:q.projectId,datasetId:q.target.datasetId}},true);application=makeApplication({async list(){return db.list();},async mutate(input){return db.mutate(input);},async close(){}});const f=this.containers.get(p.containerName);Object.assign(f,{state:'running',pid:123,endpoint:{host:'127.0.0.1',port:server.address().port}});this.lost('START');return structuredClone(f);}
 };
 const client={options:store.options,request:(m,i)=>store.request(m,i)},options={enabled:true,runnerId:data.options.runnerId,controllerId:'controller.acceptance.backend.fixture',backendRef:data.acceptanceOptions.backendRef,repository:'registry.example/devmesh-acceptance',capacity:{maximumJobs:4,cpu:4,memoryMiB:1024},resourceLimits:{cpu:1,memoryMiB:128,pids:32,temporaryMiB:32}},backend=new RunnerAcceptancePreparationBackend(client,data.paths,data.acceptance,driver,options);
 const reservation=()=>client.request('acceptanceServiceByOperation',{controllerId:options.controllerId,operationId:preparation.operationId});
  return {data,preparation,driver,options,store:client,backend,origin:'http://127.0.0.1:'+server.address().port,mutations:()=>driver.calls.filter(c=>!c.startsWith('query-')),reservation,async journal(){const r=await reservation();return client.request('acceptanceServiceJournal',bound(r));},sql(fn){const db=new DatabaseSync(client.options.databasePath);try{return fn(db);}finally{db.close();}},async closeCurrent(){await store.close();},async reopen(terminate=false){if(terminate)await store.terminate();else await store.close();store=await openRunnerStore({...client.options,initialize:false});data.cleanup.push(()=>store.close());},canonical};
}
