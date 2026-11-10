import { readFileSync,openSync,writeFileSync,fsyncSync,closeSync } from 'node:fs';
import { openLocalStorage,LocalContentStore } from '../../packages/blob-store/dist/index.mjs';

const config=JSON.parse(readFileSync(process.argv[2],'utf8'));
const local=await openLocalStorage(config.options),content=new LocalContentStore(local.storage,local.dataRoot,0),bytes=Buffer.from(config.body,'base64');
if(config.mode==='after-commit')await content.put(config.input,bytes);
else {
  const write=await local.storage.request('beginObjectWrite',config.input);
  await content.provider.stage(write,bytes);
  if(config.mode==='after-publish')await content.provider.publish(write);
}
const marker=openSync(config.marker,'w');try{writeFileSync(marker,config.mode);fsyncSync(marker);}finally{closeSync(marker);}
process.send({stage:config.mode});
// Keep the actual database Worker, node lock and DB lock alive until the parent kills us.
