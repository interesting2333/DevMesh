import {existsSync,lstatSync,readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {z} from 'zod';
import {ids,opaqueKey} from '@devmesh/contracts';
import {assertSeparate,canonicalRoot,safePath} from '@devmesh/blob-store';
import {RunnerError} from './protocol.js';
const marker=z.strictObject({nodeKind:z.literal('runner'),layoutVersion:z.literal(1),runnerId:opaqueKey});
/** Trusted Runner configuration. No request may supply an absolute data path. */
export interface RunnerDatasetPathOptions {runnerRoot:string;controlDataRoot:string;backupRoot:string;runnerId:string}
export class RunnerDatasetPaths {
 readonly root:string;
 constructor(readonly options:RunnerDatasetPathOptions){
  const runnerRoot=canonicalRoot(options.runnerRoot);assertSeparate([runnerRoot,canonicalRoot(options.controlDataRoot),canonicalRoot(options.backupRoot)]);
  const identity=marker.parse(JSON.parse(readFileSync(safePath(runnerRoot,'runner-layout.json'),'utf8')));
  if(identity.runnerId!==options.runnerId)throw new RunnerError('RUNNER_STORE_IDENTITY_MISMATCH',409);
  this.root=canonicalRoot(join(runnerRoot,'datasets'));
  if(!existsSync(this.root))throw new RunnerError('RUNNER_ROOT_NOT_INITIALIZED',409);
 }
 resolve(input:{projectId:string;datasetId:string},createParents=false){
  const projectId=ids.project.parse(input.projectId),datasetId=ids.dataset.parse(input.datasetId),key=projectId+'/'+datasetId,storageKey=key+'/app.sqlite';
   const databasePath=safePath(this.root,storageKey,createParents),journalPath=safePath(this.root,key+'/operation.json'),receiptPath=safePath(this.root,key+'/receipt.json'),markerPath=safePath(this.root,key+'/dataset.json'),stagingPath=safePath(this.root,key+'/preparing.sqlite'),fencesPath=safePath(this.root,key+'/fences.json'),abortJournalPath=safePath(this.root,key+'/abort-operation.json'),abortReceiptPath=safePath(this.root,key+'/abort-receipt.json');
   for(const file of ['app.sqlite','app.sqlite-wal','app.sqlite-shm','app.sqlite-journal','operation.json','receipt.json','dataset.json','fences.json','abort-operation.json','abort-receipt.json','writer.lock','preparing.sqlite','preparing.sqlite-wal','preparing.sqlite-shm','preparing.sqlite-journal'].map(name=>key+'/'+name)){
   const checked=safePath(this.root,file);
   if(existsSync(checked)){const stat=lstatSync(checked);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1)throw new RunnerError('DATASET_FILE_UNSAFE',403);}
  }
   return {directory:dirname(databasePath),storageKey,databasePath,journalPath,receiptPath,markerPath,stagingPath,fencesPath,abortJournalPath,abortReceiptPath};
 }
}
