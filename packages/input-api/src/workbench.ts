import {readFile} from 'node:fs/promises';
import {z} from 'zod';
import {ids,parseContract} from '@devmesh/contracts';
import type {Router,Request,Response,RequestHandler} from 'express';
import type {LocalContentStore} from '@devmesh/blob-store';
import type {Identity} from './index.js';
import {workbenchBoot} from './web/workbench-context.js';
import {workbenchPage} from './workbench-page.js';
type Route=(handler:(request:Request,response:Response,identity:Identity)=>Promise<void>)=>RequestHandler;
const query=z.strictObject({projectId:ids.project.optional(),runId:ids.run.optional()}).refine(v=>!v.runId||!!v.projectId,'Run requires project');
export function mountWorkbenchRoutes(router:Router,content:LocalContentStore,route:Route){
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
