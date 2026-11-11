import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import express from '../../packages/platform-core/node_modules/express/index.js';
import { AgentCard,Message,SendMessageRequest } from '../../packages/a2a-adapter/node_modules/@a2a-js/sdk/dist/index.js';
import { ClientFactory,JsonRpcTransportFactory,DefaultAgentCardResolver } from '../../packages/a2a-adapter/node_modules/@a2a-js/sdk/dist/client/index.js';
import { AgentRegistry,createRoleCard,cardHash,mountInternalAgents } from '../../packages/a2a-adapter/dist/index.mjs';
import { contentFixture,meta } from './content-data.mjs';
import { plan,requirements,admission } from './storage-data.mjs';

export const serviceToken='devmesh-test-service-token-not-a-production-secret';
export const callerId='orchestrator';
export const credential=async ref=>ref==='test.service'?serviceToken:undefined;
// Only crash/restart fixtures: no heartbeat process is running in these tests.
// Preserve the real production 15s issuance; extend only this test DB row.
export function holdTestGrant(f,attemptId){
 const db=new DatabaseSync(join(f.local.dataRoot,'db/devmesh.sqlite'));
 try{const grant=db.prepare('SELECT * FROM execution_grants WHERE attempt_id=?').get(attemptId),permit=JSON.parse(grant.permit_json);permit.expiresAt=new Date(Date.now()+300000).toISOString();db.prepare('UPDATE execution_grants SET expires_at=?,permit_json=? WHERE grant_id=?').run(permit.expiresAt,JSON.stringify(permit),grant.grant_id);}finally{db.close();}
}
export function manifest(base='http://127.0.0.1:3210',revision='M1',endpointRevision=1){return {schemaVersion:'devmesh.agent-manifest.v1',manifestRevision:revision,endpoints:['product','architect','developer','tester'].map(role=>{
 const e={endpointId:'builtin.'+role,revision:endpointRevision,role,agentKey:'builtin.'+role,hosting:'local',implementationVersion:'1.0.0',address:base+'/internal/agents/'+role+'/a2a',cardUrl:base+'/internal/agents/'+role+'/agent-card.json',protocol:'1.0',sdkVersion:'1.3.0',supportedSkills:['devmesh.work.'+role],streaming:true,credentialRef:'test.service',allowedCallers:[callerId],enabled:true};return {...e,cardHash:cardHash(createRoleCard(e))};
})};}
export async function checks(storage,m){const checks=[];for(const endpoint of m.endpoints){const p=await storage.request('issueEndpointProbe',{endpoint});const time=new Date().toISOString();checks.push({checkId:p.checkId,status:'HEALTHY',observedCardHash:endpoint.cardHash,checkedAt:time,expiresAt:new Date(Date.now()+120000).toISOString(),errorCode:null});}return checks;}
export async function commit(storage,m){return storage.request('commitRegistry',{manifest:m,expectedProjectionRevision:(await storage.request('getRegistrySnapshot',{})).projectionRevision,checks:await checks(storage,m)});}
export async function prepareDispatch(f,registry,roleConfig={},options={}){
 const body=await f.content.putText(meta(),{kind:'content'},'实现任务看板');
  const receipt=await f.storage.request('createProjectWithRun',{meta:meta(),name:'A2A protocol tests',baseCommit:options.baseCommit??'b'.repeat(40),contentHash:body.expectedHash,clientMessageId:randomUUID()});
  const p=receipt.result,draft=plan(),req=requirements();
  if(options.writeScope)draft.works.find(w=>w.role==='developer').writeScope=[...options.writeScope];
  const content=await f.content.putJson(meta(),{kind:'content'},draft);
 const publication=await f.storage.request('publishPlan',{meta:meta(p.runId),runId:p.runId,ifMatch:'"r1"',requirementRevision:1,planRevision:1,requirements:req,plan:draft,planContentHash:content.expectedHash});
 await f.storage.request('confirmPlan',{meta:meta(p.runId),runId:p.runId,ifMatch:'"r2"',requirementRevision:1,planRevision:1,reviewHash:publication.result.reviewHash});
 const input=await admission(f.storage,{...p,draft,requirements:req}),target=await registry.resolveRole('developer');
  if(options.baseCommit)input.works[0].inputManifest.codeCommit=options.baseCommit;
  if(options.resources)input.works[0].resources=options.resources;
 input.works[0].endpoint={endpointId:target.config.endpointId,revision:target.config.revision,cardHash:target.config.cardHash,registryGenerationId:registry.version.generationId};
 Object.assign(input.works[0].roleSnapshot,roleConfig);
 const admitted=await f.storage.request('admitWorks',input),attemptId=admitted.result.attemptIds[0];
 const outbox=(await f.storage.request('claimOutbox',{workerId:'test.sender',limit:50})).find(o=>o.payload.attemptId===attemptId),d=outbox.payload;
 const delegation={schemaVersion:'devmesh.work.v1',operationId:d.operationId,runId:d.runId,workId:d.workId,workRevision:d.workRevision,attemptId,endpointId:d.endpoint.endpointId,endpointRevision:d.endpoint.revision,grantId:d.permit.grantId,activationId:d.permit.activationId,runEpoch:d.permit.runEpoch,workEpoch:d.permit.workEpoch,requirementRevision:1,planRevision:1,inputManifestId:d.inputManifestId,roleSnapshotId:d.roleSnapshotId,originRole:'architect',targetRole:'developer',requestedOutputSchema:input.works[0].roleSnapshot.outputSchemaId};
 const message=Message.fromJSON({messageId:randomUUID(),role:'ROLE_USER',parts:[{data:delegation}]});
 return {...p,attemptId,delegation,message,params:SendMessageRequest.fromJSON({message:Message.toJSON(message)}),request:{callerId,endpointId:delegation.endpointId,endpointRevision:delegation.endpointRevision,delegation,message:Message.toJSON(message),...registry.version}};
}
export async function registryFixture(t){const f=await contentFixture(t),m=manifest();await commit(f.storage,m);const registry=new AgentRegistry(f.storage);await registry.refresh();return Object.assign(f,{manifest:m,registry});}
export async function httpFixture(t,{preparation=false}={}){
 const f=await contentFixture(t),app=express(),server=createServer(app);let agents;
 t.after(async()=>{await agents?.stop();server.closeAllConnections();await new Promise(resolve=>server.close(()=>resolve()));});
 // Register routes before listening; select port first using Node's actual bind.
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port,m=manifest(base);
 if(preparation)for(const e of m.endpoints.filter(e=>['product','architect'].includes(e.role))){e.supportedSkills.push('devmesh.prepare.'+e.role);e.cardHash=cardHash(createRoleCard(e));}
 agents=mountInternalAgents(app,f.storage,{manifest:m,identities:[{principalId:callerId,credentialRef:'test.service'},{principalId:'other.service',credentialRef:'other.service'}],resolveCredential:async ref=>ref==='other.service'?'devmesh-other-service-test-token':credential(ref),healthIntervalMs:60000});
 const fetched=async(url,init)=>fetch(url,{...init,headers:{...Object.fromEntries(new Headers(init?.headers)),Authorization:'Bearer '+serviceToken}});
 const factory=new ClientFactory({transports:[new JsonRpcTransportFactory({fetchImpl:fetched})],cardResolver:new DefaultAgentCardResolver({fetchImpl:fetched})});
 await agents.activate();const client=await factory.createFromUrl(base,'/internal/agents/developer/agent-card.json');
 return Object.assign(f,{agents,registry:agents.registry,base,manifest:m,client,factory,server,app});
}
export { AgentCard,Message,SendMessageRequest };
