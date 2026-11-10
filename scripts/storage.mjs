import { readFileSync } from 'node:fs';
import { LocalContentStore, openLocalStorage, parseStorageConfig } from '../packages/blob-store/dist/index.mjs';

let local;
try{
  const [command,...args]=process.argv.slice(2);
  if(!['init','verify'].includes(command) || (args.length!==0 && !(args.length===2 && args[0]==='--config')))throw new Error('Usage: node scripts/storage.mjs init|verify [--config file.json]');
  const path=args[1],file=path?JSON.parse(readFileSync(path,'utf8')):{};
  const config=parseStorageConfig(file.storage??{},path);
  local=await openLocalStorage({...config,initialize:command==='init'});
  const content=new LocalContentStore(local.storage,local.dataRoot,local.minimumFreeBytes);
  const recovery=await content.recoverPublished(),integrity=await content.verifyAll();
  const report={status:integrity.failures.length?'FAILED':'PASSED',command,dataRoot:local.dataRoot,storeId:local.marker.storeId,layoutVersion:local.marker.layoutVersion,directorySync:local.directorySync,recovery,integrity,database:await local.storage.request('inspect',{})};
  console.log(JSON.stringify(report,null,2));
  if(integrity.failures.length)process.exitCode=1;
}catch(error){console.error(JSON.stringify({code:error.code??'STORAGE_FAILED',message:error.message}));process.exitCode=1;}
finally{try{await local?.close();}catch(error){console.error(JSON.stringify({code:'STORAGE_CLOSE_FAILED',message:error.message}));process.exitCode=1;}}
