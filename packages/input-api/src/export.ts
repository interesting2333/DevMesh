import type {Router,Request,Response,RequestHandler} from 'express';
import {pipeline} from 'node:stream/promises';
import {z} from 'zod';
import {parseContract,opaqueKey,idempotencyKey,createReleaseExportInput,retryReleaseExportInput,releaseExportView,releaseExportListView} from '@devmesh/contracts';
import {StorageError} from '@devmesh/storage-sqlite';
import type {LocalContentStore} from '@devmesh/blob-store';
import type {Identity} from './index.js';
import {mountExportPages} from './export-page.js';
type Route=(handler:(request:Request,response:Response,identity:Identity)=>Promise<void>)=>RequestHandler;
const empty=z.strictObject({});
const fail=(code:string,status:number):never=>{throw new StorageError(code,status,'Export requires current membership and its original frozen job');};
export function mountExportRoutes(router:Router,content:LocalContentStore,route:Route){
 mountExportPages(router,content,route);
 const subject=(request:Request,identity:Identity)=>({principalId:identity.principalId,exportId:parseContract(opaqueKey,request.params.exportId)});
 const guarded:Route=handler=>route(async(request,response,identity)=>{try{empty.parse(request.query);await handler(request,response,identity);}catch(error){const {code,status}=error as {code?:string;status?:number};if(code?.startsWith('EXPORT_'))fail(code==='EXPORT_LIMIT_EXCEEDED'?'LIMIT_EXCEEDED':'EXPORT_UNAVAILABLE',status===413?413:409);throw error;}});
 const body=(request:Request)=>{if(!request.is('application/json'))fail('CONTENT_TYPE_INVALID',415);return request.body as unknown;};
 router.post('/releases/:releaseId/exports',guarded(async(request,response,identity)=>{
  const releaseId=parseContract(opaqueKey,request.params.releaseId),value=parseContract(createReleaseExportInput,body(request));
  const job=await content.storage.request('createReleaseExport',{meta:{principalId:identity.principalId,scopeId:releaseId,idempotencyKey:parseContract(idempotencyKey,request.headers['idempotency-key'])},releaseId,...value});
  response.status(202).json(parseContract(releaseExportView,job));
 }));
 router.get('/releases/:releaseId/exports',route(async(request,response,identity)=>{
  const query=parseContract(z.strictObject({afterExportId:opaqueKey.optional(),limit:z.string().regex(/^[1-9][0-9]{0,2}$/).transform(Number).pipe(z.number().max(200)).optional()}),request.query),releaseId=parseContract(opaqueKey,request.params.releaseId);
  response.json(parseContract(releaseExportListView,await content.storage.request('listReleaseExports',{principalId:identity.principalId,releaseId,...query})));
 }));
 router.get('/exports/:exportId',guarded(async(request,response,identity)=>{response.json(parseContract(releaseExportView,await content.storage.request('getReleaseExport',subject(request,identity))));}));
 router.post('/exports/:exportId/retry',guarded(async(request,response,identity)=>{const value=parseContract(retryReleaseExportInput,body(request));response.status(202).json(parseContract(releaseExportView,await content.storage.request('retryReleaseExport',{...subject(request,identity),...value})));}));
 router.get('/exports/:exportId/download',guarded(async(request,response,identity)=>{
  if(request.headers.range!==undefined)fail('RANGE_NOT_SUPPORTED',416);
  const who=subject(request,identity),job=await content.storage.request('getReleaseExport',who);if(job.state!=='READY')fail('EXPORT_NOT_READY',409);
  const opened=await content.openRead(identity.principalId,{kind:'releaseExport',exportId:who.exportId});
  try{
   if(opened.content.contentHash!==job.archiveHash||opened.content.byteSize!==job.archiveSize)fail('CONTENT_UNAVAILABLE',503);
   await content.storage.request('getReleaseExport',who);
   response.setHeader('Content-Type','application/zip');response.setHeader('Content-Length',job.archiveSize!);
   response.setHeader('Content-Disposition',`attachment; filename="${who.exportId}.zip"`);response.setHeader('Accept-Ranges','none');
   response.setHeader('Content-Security-Policy',"default-src 'none'; sandbox; frame-ancestors 'none'");response.setHeader('Referrer-Policy','no-referrer');
   await pipeline(opened.stream,response);
  }finally{opened.stream.destroy();await opened.release();}
 }));
}
