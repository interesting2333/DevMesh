import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile,symlink,link,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,relative} from 'node:path';
import {openRunnerStorage,RunnerDatasetPaths} from '../packages/runner/dist/index.mjs';
async function fixture(t){const root=await mkdtemp(join(tmpdir(),'devmesh-dataset-path-'));let layout;t.after(async()=>{try{await layout?.close();}finally{await rm(root,{recursive:true,force:true});}});const options={dataRoot:join(root,'runner'),controlDataRoot:join(root,'control'),backupRoot:join(root,'backup'),runnerId:'runner.dataset.paths',initialize:true};layout=await openRunnerStorage(options);const paths=new RunnerDatasetPaths({runnerRoot:layout.dataRoot,controlDataRoot:options.controlDataRoot,backupRoot:options.backupRoot,runnerId:options.runnerId});return {root,options,layout,paths};}
const input={projectId:'prj_local',datasetId:'dataset_original'};
test('dataset path is stable under the initialized Runner root and independent of workspace deletion',async t=>{
 const f=await fixture(t),p=f.paths.resolve(input,true);assert.equal(p.storageKey,'prj_local/dataset_original/app.sqlite');assert.equal(relative(f.layout.dataRoot,p.databasePath).replaceAll('\\','/'),'datasets/prj_local/dataset_original/app.sqlite');await writeFile(p.databasePath,'retained dataset bytes');await writeFile(p.journalPath,'original operation');await mkdir(join(f.layout.dataRoot,'workspaces','old'),{recursive:true});await writeFile(join(f.layout.dataRoot,'workspaces','old','file'),'workspace');await rm(join(f.layout.dataRoot,'workspaces','old'),{recursive:true});assert.equal(await readFile(f.paths.resolve(input).databasePath,'utf8'),'retained dataset bytes');assert.equal(await readFile(f.paths.resolve(input).journalPath,'utf8'),'original operation');
});
test('dataset resolver refuses request paths, foreign Runner identity and overlapping roots',async t=>{
 const f=await fixture(t);for(const datasetId of ['../control','dataset_x/../../control','C:\\control','dataset_x:stream','dataset_x\\..\\control'])assert.throws(()=>f.paths.resolve({...input,datasetId},true));assert.throws(()=>f.paths.resolve({...input,projectId:'prj_x/../other'},true));assert.throws(()=>new RunnerDatasetPaths({...f.paths.options,runnerId:'runner.foreign'}),{code:'RUNNER_STORE_IDENTITY_MISMATCH'});assert.throws(()=>new RunnerDatasetPaths({...f.paths.options,controlDataRoot:join(f.layout.dataRoot,'control')}),{code:'STORAGE_ROOTS_OVERLAP'});
});
test('linked dataset directories and hard-linked files cannot become Runner data',async t=>{
 const f=await fixture(t),outside=join(f.root,'outside');await mkdir(outside);await mkdir(join(f.paths.root,'prj_link'));await symlink(outside,join(f.paths.root,'prj_link','dataset_link'),process.platform==='win32'?'junction':'dir');assert.throws(()=>f.paths.resolve({projectId:'prj_link',datasetId:'dataset_link'},true));const p=f.paths.resolve(input,true),secret=join(outside,'private.sqlite');await writeFile(secret,'private');await link(secret,p.databasePath);assert.throws(()=>f.paths.resolve(input),{code:'DATASET_FILE_UNSAFE'});assert.equal(await readFile(secret,'utf8'),'private');
});
test('data sidecars and original-operation journals receive the same link boundary checks',async t=>{
 const f=await fixture(t),p=f.paths.resolve(input,true),outside=join(f.root,'private');await writeFile(outside,'private');await link(outside,p.journalPath);assert.throws(()=>f.paths.resolve(input),{code:'DATASET_FILE_UNSAFE'});await rm(p.journalPath);await link(outside,p.databasePath+'-wal');assert.throws(()=>f.paths.resolve(input),{code:'DATASET_FILE_UNSAFE'});assert.equal(await readFile(outside,'utf8'),'private');
});
