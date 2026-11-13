import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {ids,parseContract,sourceRef,workbenchSourceView} from '@devmesh/contracts';
import {StorageError} from '@devmesh/storage-sqlite';
import type {Router,Request,Response,RequestHandler} from 'express';
import type {LocalContentStore} from '@devmesh/blob-store';
import type {Identity} from './index.js';
import {workbenchBoot} from './web/workbench-context.js';
import {workbenchPage} from './workbench-page.js';
type Route=(handler:(request:Request,response:Response,identity:Identity)=>Promise<void>)=>RequestHandler;
const query=z.strictObject({projectId:ids.project.optional(),runId:ids.run.optional()}).refine(v=>!v.runId||!!v.projectId,'Run requires project');
export function mountWorkbenchRoutes(router:Router,content:LocalContentStore,route:Route){
 router.get('/runs/:runId/sources',route(async(request,response,identity)=>{
  const runId=parseContract(ids.run,request.params.runId),q=parseContract(z.strictObject({ref:z.string().min(1).max(4096)}),request.query);
  let decoded:unknown;try{decoded=JSON.parse(q.ref);}catch{throw new StorageError('SCHEMA_INVALID',422,'Source reference must be JSON');}
  const ref=parseContract(sourceRef,decoded),principalId=identity.principalId,record=await content.storage.request('getWorkbenchSource',{principalId,runId,ref});
  let body;
  if(record.requirement!==null)body={kind:'requirement' as const,requirement:record.requirement};
  else{
   const bytes=await content.readBytes(principalId,{kind:'artifact',artifactId:record.artifactId},2*1024*1024);
   if(createHash('sha256').update(bytes).digest('hex')!==record.contentHash)throw new StorageError('CONTENT_CORRUPT',409,'Original source bytes differ');
   let text:string;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new StorageError('CONTENT_TYPE_INVALID',415,'Source is not UTF-8 text');}
   body={kind:'text' as const,text};
  }
  // A file read may outlive membership or source availability. Recheck both.
  await content.storage.request('getWorkbenchSource',{principalId,runId,ref});
  response.json(parseContract(workbenchSourceView,{runId,ref,label:record.label,body}));
 }));
 router.get('/workbench/view',route(async(request,response,identity)=>{
  const selected=parseContract(query,request.query),principalId=identity.principalId;
  if(selected.projectId)await content.storage.request('getInputWorkspace',{principalId,projectId:selected.projectId,...(selected.runId?{runId:selected.runId}:{}),limit:1});
  const rendered=workbenchPage(workbenchBoot.parse({principalId,selection:selected.projectId?selected:null}));
  if(selected.projectId)await content.storage.request('checkInputAccess',{principalId,projectId:selected.projectId});
  response.setHeader('Referrer-Policy','no-referrer');response.setHeader('Content-Security-Policy',rendered.policy);response.type('text/html; charset=utf-8').send(rendered.html);
 }));
 router.get('/workbench/client.js',route(async(request,response)=>{
  z.strictObject({}).parse(request.query);
  const bytes=await readFile(new URL('./web/workbench/workbench-client.js',import.meta.url));
  response.type('application/javascript; charset=utf-8').send(bytes);
 }));
}
