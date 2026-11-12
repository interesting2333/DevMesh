import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ControlledGit} from '../packages/code-workspaces/dist/index.mjs';
const exec=promisify(execFile),nil=process.platform==='win32'?'NUL':'/dev/null';
const git=async(root,...args)=>(await exec('git',['-c','core.fsmonitor=false','-c','core.hooksPath='+nil,...args],{cwd:root,windowsHide:true,encoding:'utf8',env:{...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:nil}})).stdout.trim();
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'devmesh-git-integration-'));t.diagnostic('Temporary evidence root: '+root);const source=join(root,'source');await mkdir(source);await git(source,'init','--quiet');await git(source,'config','user.name','Integration fixture');await git(source,'config','user.email','fixture@localhost');await git(source,'config','core.autocrlf','false');await mkdir(join(source,'src'));await writeFile(join(source,'src/code.ts'),'export const answer = 0;\n');await git(source,'add','.');await git(source,'commit','--quiet','--no-gpg-sign','-m','Base');
 const base=await git(source,'rev-parse','HEAD'),checkout=await ControlledGit.open(source,'checkout'),project=await ControlledGit.initialize(join(root,'project.git'),'bare');await project.importCommit(await checkout.exportCommit(base),base);await project.updateRefs([{ref:'refs/devmesh/candidates/run_fixture',commit:base,expected:null}]);
 async function branch(change,message){await git(source,'checkout','--quiet','--detach',base);await change(source);await git(source,'add','-A');await git(source,'commit','--quiet','--no-gpg-sign','-m',message);const commit=await git(source,'rev-parse','HEAD');await project.importCommit(await checkout.exportCommit(commit),commit);return commit;}
 return {root,source,base,checkout,project,branch};
}
function body(tree,ours,theirs){const who='DevMesh <devmesh@localhost> 946684800 +0000';return `tree ${tree}\nparent ${ours}\nparent ${theirs}\nauthor ${who}\ncommitter ${who}\n\nDevMesh integration\nDevMesh-Operation: op_fixture\n`;}
test('fixed three-way Git integration retains both sibling changes, exact parents and immutable verification checkout',async t=>{
 const f=await fixture(t),ours=await f.branch(root=>writeFile(join(root,'src/left.ts'),'export const left = true;\n'),'Left'),theirs=await f.branch(root=>writeFile(join(root,'src/right.ts'),'export const right = true;\n'),'Right'),merged=await f.project.mergeTree(f.base,ours,theirs);
 assert.equal(merged.clean,true);assert.deepEqual(merged.stages,[]);assert.equal(await f.project.readRef('refs/devmesh/candidates/run_fixture'),f.base);
 const commit=await f.project.writeCommit(body(merged.tree,ours,theirs));assert.deepEqual((await f.project.commit(commit)).parents,[ours,theirs]);assert.equal(await f.project.writeCommit(body(merged.tree,ours,theirs)),commit);
 assert.equal(await f.project.updateRefs([{ref:'refs/devmesh/candidates/run_fixture',commit,expected:f.base},{ref:'refs/devmesh/integrations/op_fixture',commit,expected:null}]),true);
 const manifest=await f.project.manifest(commit);assert.deepEqual(manifest.files.map(v=>v.path),['src/code.ts','src/left.ts','src/right.ts']);assert.equal(await git(f.project.identity.root,'show',commit+':src/left.ts'),'export const left = true;');assert.equal(await git(f.project.identity.root,'show',commit+':src/right.ts'),'export const right = true;');
 assert.equal(await f.project.updateRefs([{ref:'refs/devmesh/candidates/run_fixture',commit:ours,expected:f.base},{ref:'refs/devmesh/integrations/op_stale',commit:ours,expected:null}]),false);assert.equal(await f.project.readRef('refs/devmesh/integrations/op_stale'),null);assert.equal(await f.project.readRef('refs/devmesh/candidates/run_fixture'),commit);
 const verify=await ControlledGit.initialize(join(f.root,'verify'),'checkout');await verify.importCommit(await f.project.exportCommit(commit),commit);await verify.checkout(commit);await writeFile(join(f.source,'src/right.ts'),'later developer modification\n');assert.equal(await readFile(join(verify.identity.root,'src/right.ts'),'utf8'),'export const right = true;\n');assert.deepEqual(await verify.verifyCheckout(manifest),manifest);
});
test('same-file Git conflicts preserve original three stages and leave candidate and checkout unchanged',async t=>{
 const f=await fixture(t),ours=await f.branch(root=>writeFile(join(root,'src/code.ts'),'export const answer = 1;\n'),'Ours'),theirs=await f.branch(root=>writeFile(join(root,'src/code.ts'),'export const answer = 2;\n'),'Theirs'),before=await readFile(join(f.source,'src/code.ts'),'utf8'),merged=await f.project.mergeTree(f.base,ours,theirs);
 assert.equal(merged.clean,false);assert.deepEqual(merged.stages.map(s=>[s.path,s.stage]),[['src/code.ts',1],['src/code.ts',2],['src/code.ts',3]]);const expected=['export const answer = 0;\n','export const answer = 1;\n','export const answer = 2;\n'];for(const stage of merged.stages)assert.equal((await f.project.readBlob(stage.objectId)).toString(),expected[stage.stage-1]);
 assert.ok(merged.messages.some(m=>m.kind.includes('CONFLICT')));assert.equal(await f.project.readRef('refs/devmesh/candidates/run_fixture'),f.base);assert.equal(await f.project.readRef('refs/devmesh/integrations/op_fixture'),null);assert.equal(await readFile(join(f.source,'src/code.ts'),'utf8'),before);assert.equal(await f.checkout.head(),theirs);assert.deepEqual(await f.project.mergeTree(f.base,ours,theirs),merged);
});
test('merge refuses a substituted base and configured external merge helpers before integration',async t=>{
 const f=await fixture(t),ours=await f.branch(root=>writeFile(join(root,'src/left.ts'),'left\n'),'Left'),theirs=await f.branch(root=>writeFile(join(root,'src/right.ts'),'right\n'),'Right');
 await assert.rejects(f.project.mergeTree(ours,ours,theirs),{code:'GIT_MERGE_BASE_CHANGED'});await git(f.project.identity.root,'config','merge.attack.driver','unconfigured-helper');await assert.rejects(f.project.mergeTree(f.base,ours,theirs),{code:'GIT_HELPER_DENIED'});assert.equal(await git(f.project.identity.root,'rev-parse','refs/devmesh/candidates/run_fixture'),f.base);
});
test('modify-delete Git conflict retains missing ours stage explicitly without creating a replacement file',async t=>{
 const f=await fixture(t),ours=await f.branch(root=>git(root,'rm','--quiet','src/code.ts'),'Delete'),theirs=await f.branch(root=>writeFile(join(root,'src/code.ts'),'export const answer = 7;\n'),'Modify'),merged=await f.project.mergeTree(f.base,ours,theirs);
 assert.equal(merged.clean,false);assert.deepEqual(merged.stages.map(s=>[s.path,s.stage]),[['src/code.ts',1],['src/code.ts',3]]);assert.equal(merged.stages.some(s=>s.stage===2),false);assert.equal((await f.project.readBlob(merged.stages.find(s=>s.stage===1).objectId)).toString(),'export const answer = 0;\n');assert.equal((await f.project.readBlob(merged.stages.find(s=>s.stage===3).objectId)).toString(),'export const answer = 7;\n');assert.ok(merged.messages.some(m=>m.kind.includes('modify/delete')));assert.equal(await f.project.readRef('refs/devmesh/candidates/run_fixture'),f.base);assert.equal(await readFile(join(f.source,'src/code.ts'),'utf8'),'export const answer = 7;\n');
});
test('criss-cross histories freeze every best merge base and preserve both later changes through the virtual base',async t=>{
 const f=await fixture(t),left=await f.branch(root=>writeFile(join(root,'src/left.ts'),'export const left = 1;\n'),'Left'),right=await f.branch(root=>writeFile(join(root,'src/right.ts'),'export const right = 1;\n'),'Right'),together=await f.project.mergeTree(f.base,left,right);
 const first=await f.project.writeCommit(body(together.tree,left,right)),second=await f.project.writeCommit(body(together.tree,right,left));
 async function child(parent,path,text,message){await f.checkout.importCommit(await f.project.exportCommit(parent),parent);await git(f.source,'checkout','--quiet','--detach',parent);await writeFile(join(f.source,path),text);await git(f.source,'add','-A');await git(f.source,'commit','--quiet','--no-gpg-sign','-m',message);const commit=await git(f.source,'rev-parse','HEAD');await f.project.importCommit(await f.checkout.exportCommit(commit),commit);return commit;}
 const ours=await child(first,'src/left.ts','export const left = 2;\n','Later left'),theirs=await child(second,'src/right.ts','export const right = 2;\n','Later right'),bases=[left,right].sort();
 assert.deepEqual(await f.project.mergeBases(ours,theirs),bases);await assert.rejects(f.project.mergeTree(left,ours,theirs),{code:'GIT_MERGE_BASE_CHANGED'});
 const merged=await f.project.mergeTree(bases,ours,theirs);assert.equal(merged.clean,true);assert.equal(merged.base,null);assert.deepEqual(merged.bases,bases);const commit=await f.project.writeCommit(body(merged.tree,ours,theirs));
 assert.equal(await git(f.project.identity.root,'show',commit+':src/left.ts'),'export const left = 2;');assert.equal(await git(f.project.identity.root,'show',commit+':src/right.ts'),'export const right = 2;');assert.equal(await f.project.readRef('refs/devmesh/candidates/run_fixture'),f.base);
});
