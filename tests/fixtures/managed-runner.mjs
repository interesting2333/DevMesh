import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {LocalContentStore} from '../../packages/blob-store/dist/index.mjs';
import {startWorkflowMcpServices} from '../../packages/mcp-tools/dist/index.mjs';
import {LocalRunnerWorkspaceFencer,createLocalManagedRunnerAuthority,createLocalManagedBindingResolver,createLocalRepoAcquire} from '../../packages/code-workspaces/dist/index.mjs';
import {openRunnerStorage,RunnerPolicy,RunnerManager,RunnerMaterials,serveRunner,RunnerClient} from '../../packages/runner/dist/index.mjs';
import {ControlledBackend,image} from './runner.mjs';
import {sourceArchiveFixture,archiveOp} from './source-archive.mjs';

/** Real authenticated HTTP/SQLite management and filesystem/Git fencing.
 * ControlledBackend records container facts; it launches no actual container. */
export function managedRunnerFixture(t,options={}){
 return sourceArchiveFixture(t,{...options,async setup({f,cleanup}){
  const runnerId='runner.local',controllerId='controller.managed',credentialRef='fixture.managed',secret=randomUUID();
  const layout=await openRunnerStorage({dataRoot:f.options.runnerDataRoot,controlDataRoot:f.local.dataRoot,backupRoot:f.options.backupRoot,runnerId,initialize:true});cleanup.push(()=>layout.close());
  const policy=new RunnerPolicy({runnerId,dataRoot:layout.dataRoot,imageDigests:[image],commands:{build:['node','scripts/build.mjs']},maximumCpu:4,maximumMemoryMiB:1024,maximumTemporaryMiB:64,workspaces:{}});
  const authority=createLocalManagedRunnerAuthority({mode:'local-development',storage:f.storage,runnerId,controllerId}),backend=new ControlledBackend(),manager=new RunnerManager(layout.store,policy,backend,authority,new RunnerMaterials(layout.dataRoot),{pollIntervalMs:600000});await manager.start();cleanup.push(()=>manager.close());
  const http=await serveRunner(manager,{identities:[{controllerId,credentialRef}],credentials:async ref=>ref===credentialRef?secret:undefined});cleanup.push(()=>http.close());
  const client=new RunnerClient('http://127.0.0.1:'+http.address.port,credentialRef,async()=>secret),fencer=new LocalRunnerWorkspaceFencer({mode:'local-development',runner:client,controlDataRoot:f.local.dataRoot,runnerDataRoot:layout.dataRoot,backupRoot:f.options.backupRoot});
  // Host grants retain their original lower bound across renewal so an admitted
  // token stays valid. The Runner gets the same attenuated <=15s token as MCP.
  const job=permit=>({schemaVersion:'devmesh.runner-job.v1',operationId:archiveOp(),permit:{...structuredClone(permit),notBefore:new Date(Math.max(Date.parse(permit.notBefore),Date.parse(permit.expiresAt)-15000)).toISOString()},imageDigest:image,workspaceRef:'workspace_01',commandSpec:{kind:'build'},resourceLimits:{cpu:1,memoryMiB:128,pids:32,temporaryMiB:32,timeoutMs:60000},networkPolicyRef:'none',outputSpec:[]});
  const assertExecution=async permit=>{const input=job(permit),binding=await layout.store.request('workspaceBinding',{workspaceRef:input.workspaceRef});await policy.validate(input,binding??undefined);await authority.verify(controllerId,input,permit);};
  let mcp;if(options.mcp){
   const mcpKey=randomUUID(),content=new LocalContentStore(f.storage,f.local.dataRoot,0);mcp=await startWorkflowMcpServices(f.storage,content,{identities:{repo:{serviceId:'repo.managed.fixture',controllerId:'mcp.managed.fixture',credentialRef:'fixture.mcp.managed',timeoutMs:30000}},credentials:async ref=>ref==='fixture.mcp.managed'?mcpKey:undefined,repo:{snapshots:[],git:{bindings:[],resolveBinding:createLocalManagedBindingResolver({mode:'local-development',storage:f.storage,runnerId,runnerDataRoot:layout.dataRoot}),scratchRoot:join(f.root,'dynamic-git-scratch'),acquire:createLocalRepoAcquire(fencer)}}});cleanup.push(()=>mcp.close());
  }
  return {layout,policy,authority,backend,manager,http,client,fencer,job,assertExecution,mcp};
 }});
}
