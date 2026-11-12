// Trusted local identity fixture, real platform HTTP, gateway HTTPS, Workers,
// template HTTP and business SQLite. No enterprise identity or OCI execution.
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {LocalContentStore} from '../../packages/blob-store/dist/index.mjs';
import {mountInputApi} from '../../packages/input-api/dist/index.mjs';
import {previewHttpFixture} from './preview-http.mjs';
const express=createRequire(new URL('../../packages/input-api/package.json',import.meta.url))('express');
export const previewFixtureIdentity=request=>{
  const principalId={'Bearer fixture_preview_owner':'user_1','Bearer fixture_preview_outsider':'outside.preview.fixture'}[request.headers.authorization];
  return principalId?{principalId}:null;
};
export async function previewEntryFixture(t,{configured=true,gateConfigured=true,identityResolver=previewFixtureIdentity,webRoot}={}){
  const app=express(),server=createServer({headersTimeout:10000,requestTimeout:35000},app);let api;
  t.after(async()=>{await api?.stop();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const f=await previewHttpFixture(t,{gatewayOptions:{platformOrigin:origin},webRoot,enrollGate:gateConfigured});
  const storage={request:(method,input)=>f.f.call(method,input)},content=new LocalContentStore(storage,f.data.root,0);
  api=mountInputApi(app,content,{enabled:true,baseline:{version:'1.0.0',baseCommit:'b'.repeat(40)},identityResolver,previewGateway:configured?f.gateway:undefined});
  app.use((_req,res)=>res.status(404).json({error:'NOT_FOUND'}));
  const path=`/runs/${f.f.p.runId}/previews/${f.f.p.previewId}`;
  const call=async(target=path,options={})=>{
    const response=await fetch(origin+'/api/v1'+target,{...options,headers:{authorization:'Bearer fixture_preview_owner',...options.headers},signal:AbortSignal.timeout(30000)}),text=await response.text();
    return {response,status:response.status,text,body:response.headers.get('content-type')?.includes('application/json')?JSON.parse(text):null};
  };
  const sql=(statement,...args)=>{const db=new DatabaseSync(join(f.f.root,'access.sqlite'));try{db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');return db.prepare(statement).all(...args);}finally{db.close();}};
  const accepted=()=>({project:sql('SELECT accepted_release_id FROM projects WHERE project_id=?',f.f.p.projectId),run:sql('SELECT phase,control_gate,terminal_outcome,resource_revision FROM runs WHERE run_id=?',f.f.p.runId),releases:sql('SELECT release_id FROM releases')});
  return {...f,app,server,api,content,origin,path,call,sql,accepted};
}
