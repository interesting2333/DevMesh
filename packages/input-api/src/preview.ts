import {randomBytes} from 'node:crypto';
import type {Router,Request,Response,RequestHandler} from 'express';
import type {TLSSocket} from 'node:tls';
import {pipeline} from 'node:stream/promises';
import {z} from 'zod';
import {ids,opaqueKey,parseContract,previewEntryView,previewAccessTicket} from '@devmesh/contracts';
import {StorageError} from '@devmesh/storage-sqlite';
import type {LocalContentStore} from '@devmesh/blob-store';
import type {Identity} from './index.js';

type Subject={principalId:string;runId:string;previewId:string};
export interface PreviewAccessGateway {
  readonly config:{readonly platformOrigin:string};
  accessForMember(subject:Subject):Promise<{previewOrigin:string;canWrite:boolean;expiresAt:string}>;
  issueForMember(subject:Subject):Promise<{ticket:string;previewOrigin:string;expiresAt:string;sessionExpiresAt:string}>;
}
type Route=(handler:(request:Request,response:Response,identity:Identity)=>Promise<void>)=>RequestHandler;
const empty=z.strictObject({});
const missingConfiguration=new Set(['PREVIEW_ACCESS_NOT_CONFIGURED','PREVIEW_WRITE_GATE_NOT_CONFIGURED','PREVIEW_BACKEND_NOT_CONFIGURED']);
function fail(code:string,status:number):never{throw new StorageError(code,status,'Preview entry requires its current member, exact target and configured gateway');}
const subject=(request:Request,identity:Identity):Subject=>({principalId:identity.principalId,runId:parseContract(ids.run,request.params.runId),previewId:parseContract(ids.preview,request.params.previewId)});
const actualOrigin=(request:Request)=>`${(request.socket as TLSSocket).encrypted?'https':'http'}://${request.headers.host}`;
function configured(request:Request,gateway:PreviewAccessGateway|undefined):PreviewAccessGateway{
  if(!gateway||gateway.config.platformOrigin!==actualOrigin(request))fail('PREVIEW_ACCESS_NOT_CONFIGURED',503);
  return gateway;
}

export function mountPreviewRoutes(router:Router,content:LocalContentStore,gateway:PreviewAccessGateway|undefined,route:Route){
  const guarded:Route=handler=>route(async(request,response,identity)=>{
    try{await handler(request,response,identity);}
    catch(error){
      if(error instanceof StorageError&&error.status===404)fail('RESOURCE_NOT_FOUND',404);
      const {code,status}=error as {code?:unknown;status?:unknown};
      if(typeof code==='string'&&missingConfiguration.has(code))fail('PREVIEW_ACCESS_NOT_CONFIGURED',503);
      if(typeof code==='string'&&code.startsWith('PREVIEW_')){
        if(status===429)fail('LIMIT_EXCEEDED',429);
        fail('PREVIEW_UNAVAILABLE',status===409?409:503);
      }
      throw error;
    }
  });
  const base='/runs/:runId/previews/:previewId';
  async function snapshot(request:Request,identity:Identity){
    empty.parse(request.query);
    const who=subject(request,identity),preview=await content.storage.request('getPreview',who);
    let state:string=Date.parse(preview.expiresAt)<=Date.now()?'EXPIRED':preview.state==='READY'?'RECOVERING':preview.state;
    let access:{previewOrigin:string;canWrite:boolean;expiresAt:string}|null=null;
    if(state!=='EXPIRED'&&preview.state==='READY'){
      if(!gateway||gateway.config.platformOrigin!==actualOrigin(request))state='NOT_CONFIGURED';
      else try{access=await gateway.accessForMember(who);state='AVAILABLE';}
      catch(error){if(missingConfiguration.has((error as {code?:string}).code??''))state='NOT_CONFIGURED';}
    }
    await content.storage.request('getPreview',who);
    return parseContract(previewEntryView,{preview:{previewId:preview.previewId,runId:preview.runId,candidateId:preview.candidateId,datasetId:preview.datasetId,revision:preview.revision,state:preview.state,expiresAt:preview.expiresAt,healthState:preview.healthState,healthCheckedAt:preview.healthCheckedAt},access:{state,canWrite:access?.canWrite??false,previewOrigin:access?.previewOrigin??null}});
  }
  router.get(base,guarded(async(request,response,identity)=>{response.json(await snapshot(request,identity));}));
  router.post(base+'/access',guarded(async(request,response,identity)=>{
    empty.parse(request.query);
    if(!request.is('application/json'))fail('CONTENT_TYPE_INVALID',415);
    empty.parse(request.body);
    const current=configured(request,gateway);
    if(request.headers.origin!==current.config.platformOrigin)fail('REQUEST_ORIGIN_INVALID',403);
    response.json(parseContract(previewAccessTicket,await current.issueForMember(subject(request,identity))));
  }));
  router.get(base+'/view',guarded(async(request,response,identity)=>{
    const view=await snapshot(request,identity),nonce=randomBytes(18).toString('base64url'),origin=view.access.previewOrigin;
    response.setHeader('Referrer-Policy','no-referrer');
    response.setHeader('Content-Security-Policy',`default-src 'none'; script-src 'nonce-${nonce}'; connect-src 'self'${origin?' '+origin:''}; frame-src ${origin??"'none'"}; frame-ancestors 'self'; base-uri 'none'; object-src 'none'; worker-src 'none'; form-action 'none'`);
    response.type('text/html; charset=utf-8').send(previewPage(view,nonce));
  }));
  router.get('/runs/:runId/candidates/:candidateId/materials/:materialKey/download',guarded(async(request,response,identity)=>{
    empty.parse(request.query);
    if(request.headers.range!==undefined)fail('RANGE_NOT_SUPPORTED',416);
    const runId=parseContract(ids.run,request.params.runId),candidateId=parseContract(ids.candidate,request.params.candidateId),materialKey=parseContract(opaqueKey,request.params.materialKey),principalId=identity.principalId;
    const candidate=await content.storage.request('getReleaseCandidate',{principalId,runId,candidateId});
    const material=candidate.manifest.delivery.materials.find(m=>m.materialKey===materialKey);
    if(!material||material.contentHash!==material.expectedHash)fail('RESOURCE_NOT_FOUND',404);
    const opened=await content.openRead(principalId,{kind:'releaseDelivery',operationId:candidate.manifest.delivery.record.operationId,materialKey});
    try{
      if(opened.content.contentHash!==material.expectedHash||opened.content.byteSize!==material.byteSize)fail('CONTENT_UNAVAILABLE',503);
      await content.storage.request('getReleaseCandidate',{principalId,runId,candidateId});
      const filename=encodeURIComponent(material.path.split('/').at(-1)??'download').replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
      response.setHeader('Content-Type','application/octet-stream');response.setHeader('Content-Length',material.byteSize);
      response.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${filename}`);response.setHeader('Accept-Ranges','none');
      response.setHeader('Content-Security-Policy',"default-src 'none'; sandbox; frame-ancestors 'none'");
      await pipeline(opened.stream,response);
    }finally{opened.stream.destroy();await opened.release();}
  }));
}

function previewPage(view:{preview:{runId:string;previewId:string;candidateId:string};access:{state:string;canWrite:boolean;previewOrigin:string|null}},nonce:string){
  const labels:Record<string,string>={AVAILABLE:view.access.canWrite?'预览可用':'预览可用（只读）',NOT_CONFIGURED:'预览访问尚未配置',RECOVERING:'预览恢复中，请稍后重试',STARTING:'预览启动中',STOPPING:'预览停止中',STOPPED:'预览已停止',EXPIRED:'预览已到期',UNKNOWN:'预览状态正在核实'};
  const settings=JSON.stringify({origin:view.access.previewOrigin,accessPath:`/api/v1/runs/${encodeURIComponent(view.preview.runId)}/previews/${encodeURIComponent(view.preview.previewId)}/access`}).replaceAll('<','\\u003c');
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>应用预览</title><body><main><h1>应用预览</h1><p id="status" role="status">${labels[view.access.state]??'预览暂不可用'}</p><button id="open"${view.access.state==='AVAILABLE'?'':' disabled'}>打开预览</button><p>打开预览不会接受或发布此版本。</p><p><a href="/api/v1/runs/${encodeURIComponent(view.preview.runId)}/candidates/${encodeURIComponent(view.preview.candidateId)}/review/view">逐项审查此候选</a></p><iframe id="preview" title="生成应用预览" sandbox="allow-scripts allow-forms allow-same-origin" referrerpolicy="no-referrer" hidden width="100%" height="640"></iframe></main><script nonce="${nonce}">
const settings=${settings},button=document.getElementById('open'),status=document.getElementById('status'),frame=document.getElementById('preview');
button.addEventListener('click',async()=>{
  button.disabled=true;status.textContent='正在连接预览…';
  const signal=AbortSignal.timeout(15000);
  try{
    const issued=await fetch(settings.accessPath,{method:'POST',credentials:'same-origin',redirect:'error',cache:'no-store',headers:{'content-type':'application/json'},body:'{}',signal});
    if(!issued.ok)throw Error('ACCESS');
    const ticket=await issued.json();if(ticket.previewOrigin!==settings.origin)throw Error('ACCESS');
    const exchanged=await fetch(settings.origin+'/__devmesh/preview/session',{method:'POST',credentials:'include',redirect:'error',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify({ticket:ticket.ticket,expiresAt:ticket.sessionExpiresAt}),signal});
    if(!exchanged.ok)throw Error('ACCESS');
    const session=await fetch(settings.origin+'/__devmesh/preview/session',{credentials:'include',redirect:'error',cache:'no-store',signal});
    if(!session.ok)throw Error('COOKIE');
    frame.src=settings.origin+'/';frame.hidden=false;status.textContent='访问权限已确认，正在加载预览。';
  }catch(error){frame.hidden=true;frame.removeAttribute('src');status.textContent=error.message==='COOKIE'?'浏览器未保留预览访问权限，请检查跨站 Cookie 设置后重试。':'预览连接失败或权限已失效，请刷新页面后重试。';}
  finally{button.disabled=false;}
});
</script></body></html>`;
}
