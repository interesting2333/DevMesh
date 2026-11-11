import {readFileSync} from 'node:fs';
import {openLocalStorage,LocalContentStore} from '../../packages/blob-store/dist/index.mjs';
import {PreparationRuntime} from '../../packages/agent-runtime/dist/index.mjs';
const c=JSON.parse(readFileSync(process.argv[2],'utf8'));
const local=await openLocalStorage(c.options),storage=local.storage,content=new LocalContentStore(storage,local.dataRoot,0);
const [claim]=await storage.request('claimPreparationTasks',{endpointId:'builtin.product',workerId:'prep.crash'});
const hold=stage=>{process.send({stage});return new Promise(()=>{setInterval(()=>{},30000);});};
const original=storage.request.bind(storage);
storage.request=async(method,input)=>{
  const result=await original(method,input);
  if(c.cut==='responded'&&method==='savePreparationResponse')await hold('responded');
  return result;
};
const runtime=new PreparationRuntime(content,null,async()=>undefined,{providers:{product:{config:c.config,complete:async()=>c.cut==='sent'?hold('sent'):c.result}}});
const result=await runtime.execute(claim,new AbortController().signal);
process.send({stage:'unexpected-result',result});await local.close();
