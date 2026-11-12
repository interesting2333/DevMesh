import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,mkdir,writeFile,readFile,rename} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {ControlledGit} from '../packages/code-workspaces/dist/index.mjs';
const exec=promisify(execFile),nullFile=process.platform==='win32'?'NUL':'/dev/null';
const git=async(root,...args)=>(await exec('git',['-c','core.fsmonitor=false','-c','core.hooksPath='+nullFile,...args],{cwd:root,windowsHide:true,encoding:'utf8',env:{...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:nullFile}})).stdout.trim();
async function fixture(t){
  const root=await mkdtemp(join(tmpdir(),'devmesh-workspace-git-'));t.diagnostic('Temporary evidence root: '+root);
  const source=join(root,'source');await mkdir(source);await git(source,'init','--quiet');await git(source,'config','user.name','Workspace fixture');await git(source,'config','user.email','fixture@localhost');await git(source,'config','core.autocrlf','false');
  await mkdir(join(source,'src'));await writeFile(join(source,'src/code.ts'),'export const value = "固定版本";\n');await writeFile(join(source,'README.md'),'Source basis\n');await git(source,'add','.');await git(source,'commit','--quiet','--no-gpg-sign','-m','Source');
  const commit=await git(source,'rev-parse','HEAD');return {root,source,commit,provider:await ControlledGit.open(source,'checkout')};
}
test('controlled Git transfers exact objects into separate repositories and checks out an immutable source manifest',async t=>{
  const f=await fixture(t),manifest=await f.provider.manifest(f.commit);assert.equal(manifest.commit,f.commit);assert.equal(manifest.files.length,2);assert.equal(manifest.files.find(v=>v.path==='src/code.ts').sha256,createHash('sha256').update(await readFile(join(f.source,'src/code.ts'))).digest('hex'));
  const pack=await f.provider.exportCommit(f.commit),project=await ControlledGit.initialize(join(f.root,'project.git'),'bare');assert.deepEqual(await project.importCommit(pack,f.commit),manifest);
  assert.equal(await project.updateRefs([{ref:'refs/devmesh/retained/original',commit:f.commit,expected:null}]),true);assert.equal(await project.updateRefs([{ref:'refs/devmesh/retained/original',commit:f.commit,expected:null}]),false);assert.equal(await project.readRef('refs/devmesh/retained/original'),f.commit);
  const checkout=await ControlledGit.initialize(join(f.root,'verify'),'checkout');await checkout.importCommit(pack,f.commit);assert.deepEqual(await checkout.checkout(f.commit),manifest);assert.equal(await git(checkout.identity.root,'rev-parse','HEAD'),f.commit);
  await writeFile(join(f.source,'src/code.ts'),'later changes\n');assert.match(await readFile(join(checkout.identity.root,'src/code.ts'),'utf8'),/固定版本/);assert.deepEqual(await checkout.manifest(f.commit),manifest);
  await writeFile(join(checkout.identity.root,'src/code.ts'),'tampered checkout\n');await assert.rejects(checkout.verifyCheckout(manifest),{code:'GIT_WORKTREE_SOURCE_CHANGED'});
  await assert.rejects(project.readRef('refs/heads/main'),{code:'GIT_REF_DENIED'});await assert.rejects(project.importCommit(Buffer.from('not a pack'),f.commit),{code:'GIT_PACK_DENIED'});await assert.rejects(project.commit('f'.repeat(40)));
});
test('configured external Git helpers are refused before source operations',async t=>{
  const f=await fixture(t);await git(f.source,'config','filter.attack.clean','unconfigured-external-helper');await assert.rejects(f.provider.manifest(f.commit),{code:'GIT_HELPER_DENIED'});await git(f.source,'config','--remove-section','filter.attack');
  await git(f.source,'config','merge.attack.driver','unconfigured-external-helper');await assert.rejects(f.provider.validate(),{code:'GIT_HELPER_DENIED'});
});
test('replacement of a directory at the same path is rejected using its frozen filesystem identity',async t=>{
  const f=await fixture(t);await rename(f.source,join(f.root,'original-source'));await mkdir(f.source);await git(f.source,'init','--quiet');await assert.rejects(f.provider.validate(),{code:'GIT_DIRECTORY_CHANGED'});assert.equal(await git(join(f.root,'original-source'),'rev-parse','HEAD'),f.commit);
});
test('sensitive paths and Git symbolic link entries cannot enter source manifests',async t=>{
  const f=await fixture(t);await writeFile(join(f.source,'.env'),'fixture-only=not-a-secret\n');await git(f.source,'add','.env');await git(f.source,'commit','--quiet','--no-gpg-sign','-m','Forbidden source path');await assert.rejects(f.provider.manifest(await git(f.source,'rev-parse','HEAD')),{code:'GIT_SOURCE_PATH_DENIED'});
  await git(f.source,'reset','--hard',f.commit);const object=await git(f.source,'rev-parse',f.commit+':README.md');await git(f.source,'update-index','--add','--cacheinfo','120000,'+object+',src/link');await git(f.source,'commit','--quiet','--no-gpg-sign','-m','Forbidden link mode');await assert.rejects(f.provider.manifest(await git(f.source,'rev-parse','HEAD')),{code:'GIT_SOURCE_PATH_DENIED'});
});

test('a fixed approved template subtree creates a distinct initial application commit without platform objects',async t=>{
  const f=await fixture(t),prefix='templates/application';await mkdir(join(f.source,prefix,'src'),{recursive:true});
  await writeFile(join(f.source,prefix,'src/app.ts'),'export const application = true;\n');await writeFile(join(f.source,prefix,'template.json'),'{"revision":"template.v1"}\n');await writeFile(join(f.source,prefix,'.node-version'),'24.13.1\n');await writeFile(join(f.source,prefix,'.gitignore'),'node_modules/\n');await writeFile(join(f.source,'control-only.txt'),'This belongs to the platform\n');await git(f.source,'add','.');await git(f.source,'commit','--quiet','--no-gpg-sign','-m','Template source');
  const sourceCommit=await git(f.source,'rev-parse','HEAD'),project=await ControlledGit.initialize(join(f.root,'template.git'),'bare'),basis=await project.createTemplateBaseline(f.provider,sourceCommit,prefix,'template.v1');
  assert.notEqual(basis.baseCommit,sourceCommit);assert.equal(basis.sourceCommit,sourceCommit);assert.equal(basis.sourcePath,prefix);assert.deepEqual(basis.manifest.files.map(v=>v.path),['.gitignore','.node-version','src/app.ts','template.json']);assert.deepEqual((await project.commit(basis.baseCommit)).parents,[]);await assert.rejects(project.commit(sourceCommit));assert.deepEqual(await project.createTemplateBaseline(f.provider,sourceCommit,prefix,'template.v1'),basis);
  const checkout=await ControlledGit.initialize(join(f.root,'application'),'checkout');await checkout.importCommit(await project.exportCommit(basis.baseCommit),basis.baseCommit);await checkout.checkout(basis.baseCommit);assert.equal(await readFile(join(checkout.identity.root,'.node-version'),'utf8'),'24.13.1\n');await assert.rejects(readFile(join(checkout.identity.root,'control-only.txt')),{code:'ENOENT'});
  await writeFile(join(f.source,prefix,'src/app.ts'),'export const application = false;\n');await git(f.source,'add','.');await git(f.source,'commit','--quiet','--no-gpg-sign','-m','Changed template source');await assert.rejects(project.createTemplateBaseline(f.provider,await git(f.source,'rev-parse','HEAD'),prefix,'template.v1'),{code:'GIT_TEMPLATE_VERSION_CHANGED'});assert.equal(await project.readRef('refs/devmesh/templates/template.v1'),basis.baseCommit);
});
