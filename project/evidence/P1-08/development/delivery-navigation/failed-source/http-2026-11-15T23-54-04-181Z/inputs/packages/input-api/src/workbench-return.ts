import {ids,opaqueKey,parseContract} from '@devmesh/contracts';
import type {LocalContentStore} from '@devmesh/blob-store';

export const workbenchReturnStyle='.workbench-return{max-width:1050px;margin:0 auto;padding:18px 24px 0;font-family:system-ui,sans-serif}.workbench-return a{color:#205a4d;display:inline-flex;min-height:44px;align-items:center;text-underline-offset:3px}.workbench-return a:focus-visible{outline:3px solid #d99127;outline-offset:3px}@media(max-width:600px){.workbench-return{padding:12px 16px 0}}';

export type WorkbenchReturnContext={principalId:string;projectId:string;targetRunId:string};
/** Derive the return target from this authenticated Run, never a return URL. */
export async function getWorkbenchReturnContext(content:LocalContentStore,principalId:string,runId:string):Promise<WorkbenchReturnContext>{
 const exactRun=parseContract(ids.run,runId),access=await content.storage.request('checkInputAccess',{principalId,runId:exactRun}),projectId=parseContract(ids.project,access.projectId);
 return {principalId:parseContract(opaqueKey,principalId),projectId,targetRunId:exactRun};
}
export function workbenchReturnNav(context:WorkbenchReturnContext,nonce:string):string{
 const {projectId,targetRunId:exactRun}=context;
 const href='/api/v1/workbench/view?projectId='+encodeURIComponent(projectId)+'&amp;runId='+encodeURIComponent(exactRun);
 const boot=JSON.stringify(context).replaceAll('<','\\u003c').replaceAll('>','\\u003e').replaceAll('&','\\u0026');
 return '<nav class="workbench-return" aria-label="工作台返回导航"><a id="workbench-return" href="'+href+'">返回工作台</a></nav><script id="workbench-return-data" type="application/json" nonce="'+nonce+'">'+boot+'</script><script defer nonce="'+nonce+'" src="/api/v1/workbench/return-client.js"></script>';
}
