import {mkdtemp,mkdir,rm,readFile,writeFile,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire,stripTypeScriptTypes} from 'node:module';
import {randomUUID} from 'node:crypto';
import {openRunnerStorage,RunnerDatasetPaths,LocalSqliteDatasetBackend,webCrudDatasetProfile} from '../../packages/runner/dist/index.mjs';
import {canonical,hash} from './storage-data.mjs';
export function datasetEffect(overrides={}){
 const operationId='op_'+randomUUID().replaceAll('-',''),datasetId='dataset_'+randomUUID().replaceAll('-',''),request={schemaVersion:'devmesh.dataset-prepare.v1',operationId,projectId:'prj_dataset',runId:'run_dataset',candidateId:'candidate_dataset',manifestHash:hash('explicit backend subject fixture'),policyHash:hash('explicit backend policy fixture'),backendRef:'sqlite.local-development.v1',runnerId:'runner.preview.local',datasetId,storageKey:'prj_dataset/'+datasetId+'/app.sqlite',...webCrudDatasetProfile,sourceDatasetId:null,sourceStorageKey:null,sourceReleaseId:null,initialData:'EMPTY',...overrides};
 return {operationId:request.operationId,projectId:request.projectId,runId:request.runId,candidateId:request.candidateId,datasetId:request.datasetId,previewId:null,policyHash:request.policyHash,kind:'DATASET_PREPARE',remoteKey:request.datasetId,requestHash:hash(canonical(request)),request,state:'SENT',revision:2,receipt:null,errorCode:null,createdAt:new Date().toISOString()};
}
export async function datasetFixture(t){
 const root=await mkdtemp(join(tmpdir(),'devmesh-real-dataset-')),cleanup=[];let layout;
 t.after(async()=>{try{for(const action of cleanup.toReversed())await action();}finally{try{await layout?.close();}finally{await rm(root,{recursive:true,force:true});}}});
 const options={dataRoot:join(root,'runner'),controlDataRoot:join(root,'control'),backupRoot:join(root,'backup'),runnerId:'runner.preview.local',initialize:true};layout=await openRunnerStorage(options);
 const backendOptions={mode:'local-development',runnerRoot:layout.dataRoot,controlDataRoot:options.controlDataRoot,backupRoot:options.backupRoot,runnerId:options.runnerId,backendRef:'sqlite.local-development.v1'},backend=new LocalSqliteDatasetBackend(backendOptions),paths=new RunnerDatasetPaths(backendOptions);
 // Execute the unchanged baseline template's own database/marker/Task validators.
 // Native TS transformation and a link to the locked real Zod dependency avoid
 // depending on an earlier template build or changing the shipped template.
 const compat=join(root,'compat'),moduleRoot=new URL('../../templates/web-crud-v1/src/',import.meta.url);await mkdir(join(compat,'server'),{recursive:true});await mkdir(join(compat,'shared'));await mkdir(join(compat,'node_modules'));await writeFile(join(compat,'package.json'),'{"type":"module"}\n');
 const resolveDependency=createRequire(new URL('../../packages/storage-sqlite/package.json',import.meta.url));await symlink(dirname(resolveDependency.resolve('zod/package.json')),join(compat,'node_modules','zod'),process.platform==='win32'?'junction':'dir');
 for(const file of ['server/database','server/dataset','shared/task']){const source=await readFile(new URL(file+'.ts',moduleRoot),'utf8');await writeFile(join(compat,file+'.js'),stripTypeScriptTypes(source,{mode:'transform'}));}
 const {TaskDatabase}=await import(pathToFileURL(join(compat,'server/database.js')).href);
 const app=(effect,readOnly=false)=>{const instance=new TaskDatabase(paths.resolve(effect.request).directory,readOnly);cleanup.push(()=>instance.close());return instance;};
 return {root,layout,options,backendOptions,backend,paths,cleanup,app,async prepare(effect){await backend.preflight(effect);return backend.prepare(effect);},async restart(){await layout.close();layout=await openRunnerStorage({...options,initialize:false});return new LocalSqliteDatasetBackend(backendOptions);}};
}
