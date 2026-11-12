import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {openStorage} from '../../packages/storage-sqlite/dist/index.mjs';
import {createDomain} from '../../packages/storage-sqlite/dist/domain.mjs';
import {previewIntentFixture} from './preview-intents.mjs';
import {hash,canonical} from './storage-data.mjs';
export const emptyBody=hash('');
let seed;
async function originalSeed(t){
 if(seed)return seed;
 // Build once through the existing explicit fixtures, then isolate every case
 // with a byte copy. No shared mutable DB or upstream quality/grant bypass.
 const f=await previewIntentFixture(t),d=await f.readyDataset(await f.createDataset()),p=await f.readyPreview(await f.createPreview(d)),path=join(f.root,'access-seed.sqlite');
 f.db.prepare('VACUUM INTO ?').run(path);
 seed={bytes:readFileSync(path),d,p,candidate:f.candidate,principalId:f.principalId,configured:f.configured};
 return seed;
}
// Candidate/dataset/container facts are explicit fixtures. No generated app HTTP.
export async function previewAccessFixture(t,{worker=false}={}){
 let storage,db,root;
 // Close before nested filesystem cleanup, including Windows SQLite WAL files.
 t.after(async()=>{try{await storage?.close?.();}finally{db?.close();if(root)rmSync(root,{recursive:true,force:true});}});
 const source=await originalSeed(t),{d,p,candidate,principalId,configured}=structuredClone({...source,bytes:undefined});
 root=mkdtempSync(join(tmpdir(),'devmesh-preview-access-'));const seedPath=join(root,'seed.sqlite');writeFileSync(seedPath,source.bytes);
 db=new DatabaseSync(seedPath);db.exec('PRAGMA foreign_keys=ON');const domain=createDomain(db);
 storage={async request(method,input){return domain.execute(method,input);}};
 const get=(sql,...args)=>db.prepare(sql).get(...args),run=(sql,...args)=>db.prepare(sql).run(...args);
 const databasePath=join(root,'access.sqlite'),storeId=get('SELECT store_id FROM store_metadata').store_id;
 if(worker){db.prepare('VACUUM INTO ?').run(databasePath);storage=await openStorage({databasePath,storeId});}
 const policy={schemaVersion:'devmesh.preview-access-policy.v1',gatewayId:'preview.gateway.local',gatewayPrincipalId:'preview.gateway.service',configurationHash:hash('explicit gateway configuration fixture')};
 const gateway={principalId:policy.gatewayPrincipalId,gatewayId:policy.gatewayId,configurationHash:policy.configurationHash},target={subjectPrincipalId:'user_1',runId:p.runId,previewId:p.previewId};
 const call=(method,input)=>storage.request(method,input),readEffect=operationId=>call('getPreviewEffect',{principalId,operationId}),effect=await readEffect(d.operationId),data={principalId,datasetOperationId:d.operationId,datasetRequestHash:effect.requestHash};
 const runtime=async(preview,change={})=>{const e=await readEffect(preview.operationId),l=await call('getPreviewLifecycle',{principalId,previewId:preview.previewId});return call('recordPreviewRuntimeObservation',{principalId,operationId:e.operationId,requestHash:e.requestHash,expectedSequence:l.runtime.sequence,fact:{...l.runtime.fact,state:'HEALTHY',checkedAt:new Date().toISOString(),...change}});};
 // Refresh the same original instance in this isolated DB. Never extend the
 // immutable seed health or any upstream grant lifetime to make a test pass.
 await runtime(p);
 const register=()=>call('registerPreviewAccessPolicy',{principalId:'user_1',projectId:p.projectId,policy}),enroll=()=>call('enrollPreviewWriteGate',data);
 const prepare=(request={method:'POST',path:'/api/tasks',bodySha256:hash('fixture body')},overrides={})=>call('preparePreviewAccessRequest',{...gateway,...target,accessRequestId:randomUUID(),request,...overrides});
 const original=r=>({...gateway,accessRequestId:r.accessRequestId,requestHash:r.requestHash});
 const closeRequest=()=>({schemaVersion:'devmesh.preview-write-close.v1',operationId:'op_'+randomUUID().replaceAll('-',''),projectId:p.projectId,datasetId:d.datasetId,datasetOperationId:d.operationId,datasetRequestHash:effect.requestHash,expectedFence:0});
 const close=request=>call('closePreviewWriteGate',{principalId,request,requestHash:hash(canonical(request))});
 const restart=async({terminate=false}={})=>{if(!worker)throw Error('Worker fixture required');if(terminate)await storage.terminate();else await storage.close();storage=await openStorage({databasePath,storeId});};
 return {root,db,get,run,d,p,candidate,principalId,configured,readEffect,runtime,policy,gateway,target,data,call,register,enroll,prepare,original,closeRequest,close,restart};
}
