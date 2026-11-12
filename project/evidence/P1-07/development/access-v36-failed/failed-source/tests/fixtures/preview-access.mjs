import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {openStorage} from '../../packages/storage-sqlite/dist/index.mjs';
import {previewIntentFixture} from './preview-intents.mjs';
import {hash,canonical} from './storage-data.mjs';
export const emptyBody=hash('');
// Original preview/dataset health is explicit fixture input. No HTTP is sent.
export async function previewAccessFixture(t,{worker=false}={}){
 let storage;
 // Register before the nested fixtures' filesystem cleanup. Windows cannot
 // unlink an open SQLite WAL; a failing early hook skips later cleanup hooks.
 if(worker)t.after(async()=>{await storage?.close();});
 const f=await previewIntentFixture(t),d=await f.readyDataset(await f.createDataset()),p=await f.readyPreview(await f.createPreview(d));
 storage=f.storage;
 const databasePath=join(f.root,'access.sqlite'),storeId=f.get('SELECT store_id FROM store_metadata').store_id;
 if(worker){f.db.prepare('VACUUM INTO ?').run(databasePath);storage=await openStorage({databasePath,storeId});}
 const policy={schemaVersion:'devmesh.preview-access-policy.v1',gatewayId:'preview.gateway.local',gatewayPrincipalId:'preview.gateway.service',configurationHash:hash('explicit gateway configuration fixture')};
 const gateway={principalId:policy.gatewayPrincipalId,gatewayId:policy.gatewayId,configurationHash:policy.configurationHash},target={subjectPrincipalId:'user_1',runId:p.runId,previewId:p.previewId},effect=await f.readEffect(d.operationId),data={principalId:f.principalId,datasetOperationId:d.operationId,datasetRequestHash:effect.requestHash};
 const call=(method,input)=>storage.request(method,input);
 const register=()=>call('registerPreviewAccessPolicy',{principalId:'user_1',projectId:p.projectId,policy}),enroll=()=>call('enrollPreviewWriteGate',data);
 const prepare=(request={method:'POST',path:'/api/tasks',bodySha256:hash('fixture body')},overrides={})=>call('preparePreviewAccessRequest',{...gateway,...target,accessRequestId:randomUUID(),request,...overrides});
 const original=r=>({...gateway,accessRequestId:r.accessRequestId,requestHash:r.requestHash});
 const closeRequest=()=>({schemaVersion:'devmesh.preview-write-close.v1',operationId:'op_'+randomUUID().replaceAll('-',''),projectId:p.projectId,datasetId:d.datasetId,datasetOperationId:d.operationId,datasetRequestHash:effect.requestHash,expectedFence:0});
 const close=request=>call('closePreviewWriteGate',{principalId:f.principalId,request,requestHash:hash(canonical(request))});
 const restart=async({terminate=false}={})=>{if(!worker)throw Error('Worker fixture required');if(terminate)await storage.terminate();else await storage.close();storage=await openStorage({databasePath,storeId});};
 return {...f,d,p,policy,gateway,target,data,call,register,enroll,prepare,original,closeRequest,close,restart};
}
