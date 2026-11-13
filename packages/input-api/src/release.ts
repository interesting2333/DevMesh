import {randomBytes} from 'node:crypto';
import type {Router,Request,Response,RequestHandler} from 'express';
import type {TLSSocket} from 'node:tls';
import {z} from 'zod';
import {ids,parseContract,releaseEntryView,releaseAccessTicket} from '@devmesh/contracts';
import {canonical,StorageError} from '@devmesh/storage-sqlite';
import type {LocalContentStore} from '@devmesh/blob-store';
import type {Identity} from './index.js';

type Subject={principalId:string;runId:string;releaseId:string};
export interface ReleaseAccessGateway {
  readonly config:{readonly platformOrigin:string};
  accessForMember(subject:Subject):Promise<{releaseOrigin:string;canWrite:boolean;checkedAt:string}>;
  issueForMember(subject:Subject):Promise<{ticket:string;releaseOrigin:string;expiresAt:string;sessionExpiresAt:string}>;
}
type Route=(handler:(request:Request,response:Response,identity:Identity)=>Promise<void>)=>RequestHandler;
const empty=z.strictObject({});
const missingConfiguration=new Set(['RELEASE_ACCESS_NOT_CONFIGURED','RELEASE_ACCESS_GATE_MISSING','RELEASE_SERVICE_NOT_CONFIGURED']);
function fail(code:string,status:number):never{throw new StorageError(code,status,'Release entry requires its current member, exact target and configured gateway');}
const subject=(request:Request,identity:Identity):Subject=>({principalId:identity.principalId,runId:parseContract(ids.run,request.params.runId),releaseId:parseContract(ids.release,request.params.releaseId)});
const actualOrigin=(request:Request)=>`${(request.socket as TLSSocket).encrypted?'https':'http'}://${request.headers.host}`;
function configured(request:Request,gateway:ReleaseAccessGateway|undefined):ReleaseAccessGateway{
  if(!gateway||gateway.config.platformOrigin!==actualOrigin(request))fail('RELEASE_ACCESS_NOT_CONFIGURED',503);
  return gateway;
}

export function mountReleaseRoutes(router:Router,content:LocalContentStore,gateway:ReleaseAccessGateway|undefined,route:Route){
  const guarded:Route=handler=>route(async(request,response,identity)=>{
    try{await handler(request,response,identity);}
    catch(error){
      if(error instanceof StorageError&&error.status===404)fail('RESOURCE_NOT_FOUND',404);
      const {code,status}=error as {code?:unknown;status?:unknown};
      if(typeof code==='string'&&missingConfiguration.has(code))fail('RELEASE_ACCESS_NOT_CONFIGURED',503);
      if(typeof code==='string'&&code.startsWith('RELEASE_')){
        if(status===429)fail('LIMIT_EXCEEDED',429);
        fail('RELEASE_UNAVAILABLE',status===409?409:503);
      }
      throw error;
    }
  });
  const base='/runs/:runId/releases/:releaseId';
  async function snapshot(request:Request,identity:Identity){
    empty.parse(request.query);
    const who=subject(request,identity),read=()=>content.storage.request('getReleasePublication',{principalId:who.principalId,releaseId:who.releaseId}),publication=await read();
    if(publication.runId!==who.runId)fail('RESOURCE_NOT_FOUND',404);
    let state:string=!publication.isCurrentAccepted?'NOT_CURRENT':'RECOVERING';
    let access:{releaseOrigin:string;canWrite:boolean;checkedAt:string}|null=null;
    if(publication.isCurrentAccepted&&publication.state==='PUBLISHED'){
      if(!gateway||gateway.config.platformOrigin!==actualOrigin(request))state='NOT_CONFIGURED';
      else try{access=await gateway.accessForMember(who);state='AVAILABLE';}
      catch(error){if(missingConfiguration.has((error as {code?:string}).code??''))state='NOT_CONFIGURED';}
    }
    const latest=await read();
    if(latest.runId!==who.runId)fail('RESOURCE_NOT_FOUND',404);
    if(canonical(latest)!==canonical(publication)){access=null;state=latest.isCurrentAccepted?'RECOVERING':'NOT_CURRENT';}
    return parseContract(releaseEntryView,{release:{releaseId:latest.releaseId,runId:latest.runId,candidateId:latest.request.preparation.candidateId,datasetId:latest.request.preparation.target.datasetId,revision:latest.revision,state:latest.state,isCurrentAccepted:latest.isCurrentAccepted,publishedAt:latest.proof?.publishedAt??null},access:{state,canWrite:access?.canWrite??false,releaseOrigin:access?.releaseOrigin??null,checkedAt:access?.checkedAt??null}});
  }

  router.get(base,guarded(async(request,response,identity)=>{response.json(await snapshot(request,identity));}));
  router.post(base+'/access',guarded(async(request,response,identity)=>{
    empty.parse(request.query);
    if(!request.is('application/json'))fail('CONTENT_TYPE_INVALID',415);
    empty.parse(request.body);
    const current=configured(request,gateway);
    if(request.headers.origin!==current.config.platformOrigin)fail('REQUEST_ORIGIN_INVALID',403);
    response.json(parseContract(releaseAccessTicket,await current.issueForMember(subject(request,identity))));
  }));
  router.get(base+'/view',guarded(async(request,response,identity)=>{
    const view=await snapshot(request,identity),nonce=randomBytes(18).toString('base64url'),origin=view.access.releaseOrigin;
    response.setHeader('Referrer-Policy','no-referrer');
    response.setHeader('Content-Security-Policy',`default-src 'none'; script-src 'nonce-${nonce}'; connect-src 'self'${origin?' '+origin:''}; frame-src ${origin??"'none'"}; frame-ancestors 'self'; base-uri 'none'; object-src 'none'; worker-src 'none'; form-action 'none'`);
    response.type('text/html; charset=utf-8').send(releasePage(view,nonce));
  }));
}

function releasePage(view:{release:{runId:string;releaseId:string};access:{state:string;canWrite:boolean;releaseOrigin:string|null}},nonce:string){
  const labels:Record<string,string>={AVAILABLE:view.access.canWrite?'已发布应用可用':'已发布应用可用（只读）',NOT_CONFIGURED:'已发布应用访问尚未配置',RECOVERING:'发布服务恢复中，请稍后重试',NOT_CURRENT:'此版本已不再是当前接受版本'};
  const settings=JSON.stringify({origin:view.access.releaseOrigin,accessPath:`/api/v1/runs/${encodeURIComponent(view.release.runId)}/releases/${encodeURIComponent(view.release.releaseId)}/access`}).replaceAll('<','\\u003c');
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>已发布应用</title><body><main><h1>已发布应用</h1><p id="status" role="status">${labels[view.access.state]??'应用暂不可用'}</p><button id="open"${view.access.state==='AVAILABLE'?'':' disabled'}>打开应用</button><p>当前入口绑定已接受版本。</p><p><a href="/api/v1/releases/${encodeURIComponent(view.release.releaseId)}/exports/view">查看交付包</a></p><iframe id="release" title="生成已发布应用" sandbox="allow-scripts allow-forms allow-same-origin" referrerpolicy="no-referrer" hidden width="100%" height="640"></iframe></main><script nonce="${nonce}">
const settings=${settings},button=document.getElementById('open'),status=document.getElementById('status'),frame=document.getElementById('release');
button.addEventListener('click',async()=>{
  button.disabled=true;status.textContent='正在连接应用…';
  const signal=AbortSignal.timeout(15000);
  try{
    const issued=await fetch(settings.accessPath,{method:'POST',credentials:'same-origin',redirect:'error',cache:'no-store',headers:{'content-type':'application/json'},body:'{}',signal});
    if(!issued.ok)throw Error('ACCESS');
    const ticket=await issued.json();if(ticket.releaseOrigin!==settings.origin)throw Error('ACCESS');
    const exchanged=await fetch(settings.origin+'/__devmesh/release/session',{method:'POST',credentials:'include',redirect:'error',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify({ticket:ticket.ticket,expiresAt:ticket.sessionExpiresAt}),signal});
    if(!exchanged.ok)throw Error('ACCESS');
    const session=await fetch(settings.origin+'/__devmesh/release/session',{credentials:'include',redirect:'error',cache:'no-store',signal});
    if(!session.ok)throw Error('COOKIE');
    frame.src=settings.origin+'/';frame.hidden=false;status.textContent='访问权限已确认，正在加载应用。';
  }catch(error){frame.hidden=true;frame.removeAttribute('src');status.textContent=error.message==='COOKIE'?'浏览器未保留应用访问权限，请检查跨站 Cookie 设置后重试。':'应用连接失败或权限已失效，请刷新页面后重试。';}
  finally{button.disabled=false;}
});
</script></body></html>`;
}
