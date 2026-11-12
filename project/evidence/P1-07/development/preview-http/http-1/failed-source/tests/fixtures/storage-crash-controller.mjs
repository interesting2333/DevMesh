import { parentPort, workerData, isMainThread, Worker } from 'node:worker_threads';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, openSync, closeSync, fsyncSync } from 'node:fs';
import { createDomain } from '../../packages/storage-sqlite/dist/domain.mjs';
import { openStorage } from '../../packages/storage-sqlite/dist/index.mjs';

if (!isMainThread) {
  // Test-only SQLite function/trigger: blocks INSIDE the production domain transaction.
  // No fault switch, SQL execution RPC or arbitrary callback is added to the application.
  const config=workerData;
  const db=new DatabaseSync(config.options.databasePath);
  db.exec('PRAGMA foreign_keys=ON;PRAGMA journal_mode=WAL;PRAGMA synchronous=FULL');
  db.function('fault_barrier',()=>{
    const fd=openSync(config.marker,'w');writeFileSync(fd,'before-commit');fsyncSync(fd);closeSync(fd);
    parentPort.postMessage({stage:'before-commit'});
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);
    return 1;
  });
  db.exec('CREATE TRIGGER test_fault_before_event AFTER INSERT ON events BEGIN SELECT fault_barrier(); END;');
  createDomain(db).execute('createProjectWithRun',config.request);
} else {
  const config=JSON.parse(readFileSync(process.argv[2],'utf8'));
  if(config.mode==='before-commit') {
    const worker=new Worker(new URL(import.meta.url),{workerData:config});
    worker.on('message',message=>process.send(message));
    worker.on('error',error=>{console.error(error);process.exitCode=1;});
  } else {
    const storage=await openStorage(config.options);
    await storage.request('createProjectWithRun',config.request);
    if(config.mode==='after-unknown') {
      const admitted=await storage.request('admitWorks',config.admission);
      await storage.request('transitionAttempt',{meta:config.controlMeta,runId:config.admission.runId,attemptId:admitted.result.attemptIds[0],expectedState:'RESERVED',state:'OUTCOME_UNKNOWN'});
    }
    if(config.mode==='after-pause') {
      const p=(await storage.request('lookupOperation',config.request.meta)).result;
      await storage.request('setControlIntent',{meta:config.controlMeta,runId:p.runId,ifMatch:'"r1"',action:'pause'});
    }
    writeFileSync(config.marker,'committed-without-user-response');
    process.send({stage:'after-commit'});
    // Intentionally keep the real Worker and writer lock alive until killed.
  }
}
