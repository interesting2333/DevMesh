import { readFileSync } from 'node:fs';
import { openLocalStorage } from '../../packages/blob-store/dist/index.mjs';
const input=JSON.parse(readFileSync(process.argv[2],'utf8'));
const local=await openLocalStorage(input.options);
const receipt=await local.storage.request('acceptA2AWork',input.request);
if(input.mode==='after-claim')await local.storage.request('claimAcceptedWork',{endpointId:input.request.endpointId,workerId:'runtime.killed'});
process.send({stage:input.mode,taskId:receipt.taskId});
// Actual Worker and writer locks remain live until SIGKILL.
