import assert from 'node:assert/strict';import {backup} from 'node:sqlite';
import {mkdtemp,cp,mkdir,writeFile,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {openLocalStorage,LocalContentStore} from '../../packages/blob-store/dist/index.mjs';
import {loadConfig,startPlatform} from '../../packages/platform-core/dist/index.mjs';
import {previewConsumerFixture} from './preview-consumer.mjs';import {hash,canonical} from './storage-data.mjs';
// Real private control layout/CAS. No default identity, Input API or Runner.
export async function previewHostFixture(t,fixtureOptions){
 const f=await previewConsumerFixture(t,fixtureOptions),root=await mkdtemp(join(tmpdir(),'devmesh-preview-host-'));let server;
 t.after(async()=>{await server?.stop();await rm(root,{recursive:true,force:true});});
 const options={dataRoot:join(root,'control'),backupRoot:join(root,'backup'),runnerDataRoot:join(root,'runner'),storeId:f.get('SELECT store_id FROM store_metadata').store_id,minimumFreeBytes:0},empty=await openLocalStorage({...options,initialize:true});await empty.close();await backup(f.db,join(options.dataRoot,'db','devmesh.sqlite'));await cp(join(f.content.dataRoot,'artifacts'),join(options.dataRoot,'artifacts'),{recursive:true});
 for(const value of ['用户需求原文',canonical(f.draft)]){const bytes=Buffer.from(value),digest=hash(bytes),dir=join(options.dataRoot,'artifacts','sha256',digest.slice(0,2));await mkdir(dir,{recursive:true});await writeFile(join(dir,digest),bytes);}
 const local=await openLocalStorage(options);try{assert.deepEqual((await new LocalContentStore(local.storage,local.dataRoot,0).verifyAll()).failures,[]);}finally{await local.close();}
 const file=join(root,'config.json');await writeFile(file,JSON.stringify({host:'127.0.0.1',port:0,storage:options}));return {f,options,config:loadConfig({},file),async start(extra){server=await startPlatform(loadConfig({},file),extra);return server;}};
}
