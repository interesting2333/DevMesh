// Explicit local Bearer identity; actual platform, TLS, Workers and business data.
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {LocalContentStore} from '../../packages/blob-store/dist/index.mjs';
import {mountInputApi} from '../../packages/input-api/dist/index.mjs';
import {releaseHttpFixture} from './release-http.mjs';
const express=createRequire(new URL('../../packages/input-api/package.json',import.meta.url))('express');
export async function releaseEntryFixture(t,{webRoot}={}){
 const app=express(),server=createServer(app);let api;await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;t.after(async()=>{await api?.stop();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
 const f=await releaseHttpFixture(t,{gatewayOptions:{platformOrigin:origin},webRoot});api=mountInputApi(app,new LocalContentStore(f.control.storage,f.data.root,0),{enabled:true,baseline:{version:'1.0.0',baseCommit:'b'.repeat(40)},identityResolver:req=>req.headers.authorization==='Bearer fixture_release_owner'?{principalId:'user_1'}:null,releaseGateway:f.gateway});
 const q=f.publication.request.preparation,path=`/runs/${q.runId}/releases/${q.releaseId}`,accepted=()=>({project:f.control.get('SELECT accepted_release_id FROM projects WHERE project_id=?',q.projectId),run:f.control.get('SELECT phase,control_gate,terminal_outcome,resource_revision FROM runs WHERE run_id=?',q.runId),commit:f.control.get('SELECT * FROM acceptance_commits WHERE release_id=?',q.releaseId)});
 return {...f,origin,path,accepted};
}
