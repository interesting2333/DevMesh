// Real file-backed control Worker, frozen candidates and HTTP. Source admission,
// model, OCI bytes, manual observations and physical container facts are explicit
// upstream fixtures; this fixture provides no production identity or Runner.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {mountInputApi} from '../../packages/input-api/dist/index.mjs';
import {LocalContentStore} from '../../packages/blob-store/dist/index.mjs';
import {CandidateFreezer} from '../../packages/result-verifier/dist/index.mjs';
import {acceptanceFixture} from './acceptance.mjs';
import {committedPublicationFixture} from './release-publication.mjs';
import {meta,canonical} from './storage-data.mjs';
const express=createRequire(new URL('../../packages/input-api/package.json',import.meta.url))('express');
export async function workbenchDeliveryFixture(t,{accepted=false}={}){
 const f=accepted?await committedPublicationFixture(t):await acceptanceFixture(t,{register:false,reviewed:false,human:true,humanWork:true});
 const fault={after:null,action:null},storage={async request(method,input){const value=await f.storage.request(method,input);if(fault.after===method){fault.after=null;await fault.action?.(value);}return value;}},content=new LocalContentStore(storage,f.content.dataRoot,0,f.provider),app=express();
 const api=mountInputApi(app,content,{enabled:true,baseline:{version:'workbench.delivery.fixture',baseCommit:'b'.repeat(40)},identityResolver:req=>{const principalId={fixture_owner:'user_1',fixture_viewer:'delivery.viewer',fixture_other:'delivery.other'}[req.headers.authorization?.replace(/^Bearer /,'')];return principalId?{principalId}:null;}}),server=app.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(async()=>{await api.stop();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
 const origin='http://127.0.0.1:'+server.address().port,headers={authorization:'Bearer fixture_owner'},path='/api/v1/projects/'+f.p.projectId+'/runs/'+f.p.runId+'/delivery';
 async function get(target=path,extra={}){return fetch(origin+target,{headers:{...headers,...extra},signal:AbortSignal.timeout(120000)});}
 async function delivery(target=path){const response=await get(target),value=await response.json();assert.equal(response.status,200,JSON.stringify(value));return value;}
 const snapshot=()=>canonical(Object.fromEntries(['operations','events','runs','projects','user_tasks','input_messages','candidate_freezes','release_candidates','candidate_review_results','candidate_rejection_results','previews','datasets','releases','release_exports','acceptance_preparations','access_tickets'].filter(name=>f.get("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",name)).map(name=>[name,f.db.prepare('SELECT * FROM '+name+' ORDER BY rowid').all()])));
 async function freeze(){const run=await storage.request('getRun',{runId:f.p.runId});return new CandidateFreezer(storage,content).freeze({meta:meta(f.p.runId),runId:f.p.runId,ifMatch:'"r'+run.resourceRevision+'"',integrationOperationId:f.integrationOperationId,deliveryOperationId:f.deliveryInput.operationId});}
 async function nextTask(){assert(accepted);const project=f.get('SELECT revision FROM projects WHERE project_id=?',f.p.projectId),goal={text:'Explicit successor input; no live model.',attachmentIds:[]},bodyHash=(await content.putBytes(meta(),{kind:'content'},Buffer.from(goal.text),'text/plain; charset=utf-8')).expectedHash,receipt=await storage.request('createInputTask',{meta:meta(f.p.projectId),projectId:f.p.projectId,ifMatch:'"r'+project.revision+'"',bodyHash,body:{kind:'ITERATION',title:'继续迭代',goal,baseAcceptedReleaseId:f.publication.releaseId,clientDraftId:crypto.randomUUID()}});return receipt.result;}
 return {...f,storage,content,api,server,origin,headers,path,fault,get,delivery,snapshot,freeze,nextTask};
}
