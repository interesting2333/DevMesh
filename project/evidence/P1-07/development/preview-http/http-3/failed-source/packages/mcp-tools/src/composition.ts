import {opaqueKey} from '@devmesh/contracts';
import type {PipelineDefinition} from '@devmesh/contracts';
import type {LocalContentStore} from '@devmesh/blob-store';
import type {SqliteStorage} from '@devmesh/storage-sqlite';
import type {RunnerClient} from '@devmesh/runner';
import type {RuntimeTool} from '@devmesh/agent-runtime';
import {serveMcp} from './server.js';
import {McpToolClient} from './client.js';
import {workflowToolAuthority} from './authority.js';
import {runtimeMcpTools} from './bridge.js';
import {repoTools} from './repo.js';
import type {RepoSnapshot} from './repo.js';
import {repoGitTools} from './repo-git.js';
import type {RepoGitOptions} from './repo-git.js';
import {docsTools} from './docs.js';
import type {DocumentBinding} from './docs.js';
import {testTools} from './tests.js';
import type {CheckDefinition} from './tests.js';
import {issueTools} from './issues.js';
import {pipelineTools,PipelineCoordinator} from './pipeline.js';
import {ToolError} from './protocol.js';
import type {ToolDefinition} from './protocol.js';
export type McpServiceKind='repo'|'docs'|'tests'|'issues'|'pipeline';
export interface WorkflowMcpIdentity {serviceId:string;controllerId:string;credentialRef:string;timeoutMs?:number}
export interface WorkflowMcpOptions {
  identities:Partial<Record<McpServiceKind,WorkflowMcpIdentity>>;
  credentials:(ref:string)=>Promise<string|undefined>;
  repo?:{snapshots:readonly RepoSnapshot[];git?:Omit<RepoGitOptions,'storage'>};
  docs?:readonly DocumentBinding[];
  tests?:{runner:RunnerClient;checks:readonly CheckDefinition[]};
  issues?:boolean;
  pipeline?:{runner:RunnerClient;definitions:readonly PipelineDefinition[]};
}
/** Explicit composition: no backend, identity or credential is inferred from a model. */
export async function startWorkflowMcpServices(storage:SqliteStorage,content:LocalContentStore,options:WorkflowMcpOptions){
  const definitions=new Map<McpServiceKind,ToolDefinition[]>();
  if(options.repo)definitions.set('repo',[...repoTools(options.repo.snapshots),...(options.repo.git?repoGitTools({...options.repo.git,storage}):[])]);
  if(options.docs)definitions.set('docs',docsTools(content,options.docs));
  if(options.tests)definitions.set('tests',testTools(options.tests.runner,options.tests.checks));
  if(options.issues)definitions.set('issues',issueTools(storage));
  if(options.pipeline)definitions.set('pipeline',pipelineTools(storage,options.pipeline.runner,options.pipeline.definitions));
  const ids=[...definitions.keys()].map(kind=>{
    const identity=options.identities[kind];if(!identity)throw new ToolError('MCP_SERVICE_IDENTITY_REQUIRED','not-sent');
    for(const field of ['serviceId','controllerId','credentialRef'] as const)opaqueKey.parse(identity[field]);return {kind,...identity};
  });
  for(const field of ['serviceId','controllerId','credentialRef'] as const)if(new Set(ids.map(i=>i[field])).size!==ids.length)throw new ToolError('MCP_SERVICE_IDENTITIES_MUST_DIFFER','not-sent');
  const secrets:string[]=[];for(const i of ids){const secret=await options.credentials(i.credentialRef);if(!secret||secret.length<16)throw new ToolError('MCP_NOT_CONFIGURED','not-sent');secrets.push(secret);}
  if(new Set(secrets).size!==secrets.length)throw new ToolError('MCP_SERVICE_CREDENTIALS_MUST_DIFFER','not-sent');
  const servers:Awaited<ReturnType<typeof serveMcp>>[]=[],clients:McpToolClient[]=[],tools:RuntimeTool[]=[],active=new Set<Promise<unknown>>();let closing=false,closed:Promise<void>|undefined;
  const coordinator=options.pipeline?new PipelineCoordinator(storage,options.pipeline.runner):undefined;
  const stopAdmission=()=>{closing=true;};
  const close=()=>closed??=(async()=>{stopAdmission();const results=[...await Promise.allSettled([coordinator?.stop()]),...await Promise.allSettled(clients.map(c=>c.close())),...await Promise.allSettled(servers.map(s=>s.close()))];await Promise.allSettled(active);if(results.some(r=>r.status==='rejected'))throw new ToolError('MCP_RELEASE_FAILED','unknown');})();
  try{
    for(const identity of ids){
      const defs=definitions.get(identity.kind)!,names=defs.map(t=>t.name),authority=workflowToolAuthority(storage,new Map([[identity.controllerId,new Set(names)]]));
      const wrapped=defs.map(d=>({...d,execute(i:Parameters<ToolDefinition['execute']>[0]){
        if(closing&&d.action==='write')throw new ToolError('MCP_STOPPING','not-sent');
        const pending=Promise.resolve().then(()=>d.execute(i));active.add(pending);void pending.finally(()=>active.delete(pending)).catch(()=>{});return pending;
      }}));
      const server=await serveMcp({serviceId:identity.serviceId,version:'1.0.0',identities:[{controllerId:identity.controllerId,credentialRef:identity.credentialRef,allowedTools:names}],credentials:options.credentials,authority,tools:wrapped});servers.push(server);
      const client=new McpToolClient({endpointId:identity.serviceId,endpoint:server.endpoint,credentialRef:identity.credentialRef,credentials:options.credentials,...(identity.timeoutMs!==undefined?{timeoutMs:identity.timeoutMs}:{})});clients.push(client);await client.connect();tools.push(...runtimeMcpTools(client,defs));
    }
    coordinator?.start();
    return {tools:Object.freeze(tools),connections:Object.freeze(clients.map(c=>c.snapshot)),stopAdmission,close,coordinator};
  }catch(error){await close().catch(()=>{});throw error;}
}
export type WorkflowMcpServices=Awaited<ReturnType<typeof startWorkflowMcpServices>>;
