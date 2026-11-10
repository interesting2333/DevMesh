import {createServer} from 'node:http';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {contentFixture} from './content-data.mjs';
import {mountInputApi} from '../../packages/input-api/dist/index.mjs';
const express=createRequire(new URL('../../packages/input-api/package.json',import.meta.url))('express');
export async function inputFixture(t,options={}){
  const f=await contentFixture(t),app=express(),diagnostics=[];
  const api=mountInputApi(app,f.content,{enabled:true,baseline:{version:'1.0.0',baseCommit:'b'.repeat(40)},identityResolver:request=>{
    const tokens={test_owner:'user_1',test_other:'user_2',test_viewer:'viewer_1'};
    const principalId=tokens[(request.headers.authorization??'').replace(/^Bearer /,'')];return principalId?{principalId}:null;
  },diagnostic:detail=>diagnostics.push(detail),...options});
  app.use((_req,res)=>res.status(404).json({error:'NOT_FOUND'}));
  const server=createServer({requestTimeout:35000},app);server.listen(0,'127.0.0.1');await once(server,'listening');
  const origin=`http://127.0.0.1:${server.address().port}`;
  t.after(async()=>{await api.stop();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
  const call=async(path,init={})=>{const response=await fetch(origin+'/api/v1'+path,{...init,headers:{authorization:'Bearer test_owner',...init.headers},signal:AbortSignal.timeout(120000)});const body=await response.json();return {response,body};};
  const create=async(extra={},key=randomUUID())=>call('/projects',{method:'POST',headers:{'content-type':'application/json','idempotency-key':key},body:JSON.stringify({initialRequest:{text:'  原始需求 🧪\n',attachmentIds:[]},clientDraftId:randomUUID(),...extra})});
  const sql=(query,...args)=>{const db=new DatabaseSync(join(f.local.dataRoot,'db/devmesh.sqlite'));try{db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');return db.prepare(query).all(...args);}finally{db.close();}};
  const upload=async(bytes=Buffer.from('材料内容\n'),name='需求.md',extra={})=>{
    const form=new FormData();form.append('clientAttachmentId',extra.clientAttachmentId??randomUUID());form.append('file',new Blob([bytes],{type:extra.mime??'text/markdown'}),name);
    return call('/attachments',{method:'POST',headers:{'idempotency-key':extra.key??randomUUID(),...(extra.token?{authorization:`Bearer ${extra.token}`}:{})},body:form});
  };
  return Object.assign(f,{app,server,api,origin,call,create,upload,sql,diagnostics});
}
