import {parentPort,workerData,isMainThread,Worker} from 'node:worker_threads';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,openSync,writeFileSync,fsyncSync,closeSync} from 'node:fs';
import {createDomain} from '../../packages/storage-sqlite/dist/domain.mjs';
import {openStorage} from '../../packages/storage-sqlite/dist/index.mjs';
if(!isMainThread){
  const config=workerData,db=new DatabaseSync(config.options.databasePath);db.exec('PRAGMA foreign_keys=ON;PRAGMA journal_mode=WAL;PRAGMA synchronous=FULL');
  db.function('input_fault_barrier',()=>{
    const file=openSync(config.marker,'w');writeFileSync(file,'late-before-commit');fsyncSync(file);closeSync(file);parentPort.postMessage({stage:'before-commit'});
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);return 1;
  });
  db.exec('CREATE TRIGGER test_input_fault AFTER INSERT ON input_processing BEGIN SELECT input_fault_barrier(); END');
  createDomain(db).execute('createInputProject',config.request);
}else{
  const config=JSON.parse(readFileSync(process.argv[2],'utf8'));
  if(config.mode==='before-commit'){
    const worker=new Worker(new URL(import.meta.url),{workerData:config});worker.on('message',message=>process.send(message));worker.on('error',error=>{console.error(error);process.exitCode=1;});
  }else{
    const storage=await openStorage(config.options);await storage.request('createInputProject',config.request);
    writeFileSync(config.marker,'committed-without-user-acknowledgement');process.send({stage:'after-commit'});
  }
}
