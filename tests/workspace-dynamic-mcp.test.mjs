import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,rename,mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {managedRunnerFixture} from './fixtures/managed-runner.mjs';
import {archiveOp,archiveGit} from './fixtures/source-archive.mjs';
import {meta} from './fixtures/storage-data.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function call(f,name,args,op=archiveOp()){
 const tool=f.mcp.tools.find(t=>t.name===name);assert.ok(tool);return tool.execute(op,args,{permit:structuredClone(f.permit)},new AbortController().signal);
}
test('a previously started MCP service resolves a later allocation and preserves its exact owner through real Git and Runner HTTP',async t=>{
 const f=await managedRunnerFixture(t,{mcp:true,allowedTools:['repo_workspaceRead','repo_writeFile','repo_commit','repo_by-operation','repo_fileByOperation']}),root=f.binding.root,args={workspaceRef:f.binding.workspaceRef,baseCommit:f.base};
 const read=await call(f,'repo_workspaceRead',{...args,path:'src/board.ts',offset:0,length:4096});assert.equal(read.state,'SUCCEEDED');assert.equal(read.value.result.text,'export const count = 0;\n');
 const editId=archiveOp(),edit=await call(f,'repo_writeFile',{...args,path:'src/board.ts',expectedSha256:read.value.result.sha256,text:'export const count = 3;\n'},editId);assert.equal(edit.state,'SUCCEEDED');assert.equal(await readFile(join(root,'src/board.ts'),'utf8'),'export const count = 3;\n');
 const replay=await call(f,'repo_fileByOperation',{operationId:editId});assert.equal(replay.state,'SUCCEEDED');assert.equal(replay.value.result.operationId,editId);
 const commitId=archiveOp(),commit=await call(f,'repo_commit',{...args,message:'Dynamic workspace from persisted allocation'},commitId);assert.equal(commit.state,'SUCCEEDED');const result=commit.value.result;assert.equal(await archiveGit(root,'show',result.commit+':src/board.ts'),'export const count = 3;');
 const saved=await f.service(f.storage).archive(f.input(commitId));assert.equal(saved.acknowledgement.commit,result.commit);
 const foreign=await call(f,'repo_workspaceRead',{...args,workspaceRef:'foreign_workspace',path:'src/board.ts',offset:0,length:4096});assert.equal(foreign.state,'FAILED');
 const run=await f.storage.request('getRun',{runId:f.p.runId});await f.storage.request('setControlIntent',{meta:meta(f.p.runId),runId:f.p.runId,ifMatch:'"r'+run.resourceRevision+'"',action:'pause'});await f.lease.stop();
 const original=await call(f,'repo_by-operation',{operationId:commitId});assert.equal(original.state,'SUCCEEDED');assert.equal(original.value.result.commit,result.commit);
 const denied=await call(f,'repo_writeFile',{...args,path:'src/board.ts',expectedSha256:sha('export const count = 3;\n'),text:'must not write'});assert.equal(denied.state,'FAILED');assert.equal(await readFile(join(root,'src/board.ts'),'utf8'),'export const count = 3;\n');assert.equal(f.backend.starts.length,0);
});

test('the first dynamic MCP call rejects a replacement directory using the original allocation ACK identity',async t=>{
 const f=await managedRunnerFixture(t,{mcp:true,allowedTools:['repo_writeFile','repo_workspaceRead']}),root=f.binding.root,moved=root+'-original';
 await rename(root,moved);try{
  await mkdir(root);await mkdir(join(root,'src'));await writeFile(join(root,'src/board.ts'),'replacement data\n');const before=f.sql('SELECT count(*) n FROM repo_file_operations')[0].n;
  const response=await call(f,'repo_workspaceRead',{workspaceRef:f.binding.workspaceRef,baseCommit:f.base,path:'src/board.ts',offset:0,length:4096});assert.equal(response.state,'FAILED');assert.equal(response.value.code,'MCP_WORKSPACE_CHANGED');assert.equal(await readFile(join(root,'src/board.ts'),'utf8'),'replacement data\n');assert.equal(f.sql('SELECT count(*) n FROM repo_file_operations')[0].n,before);
 }finally{await rm(root,{recursive:true,force:true});await rename(moved,root);}
});
