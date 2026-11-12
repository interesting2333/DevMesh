import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const absolute=(file)=>readFileSync(file,'utf8').replace(/from '([^']+)'/g,(_all,spec)=>`from '${spec.startsWith('.')?pathToFileURL(resolve('tests/fixtures',spec)).href:spec}'`);
let q=absolute('tests/fixtures/quality-runner.mjs');
q=q.replace('async function runJob(){','async function runJob(){const trace=globalThis.acceptanceTiming=[];const stamp=async(label,jobId)=>trace.push({label,at:new Date().toISOString(),job:jobId?await runner.get(jobId):null});await stamp("begin");');
q=q.replace('await coordinator.process(dispatch);await manager.tick();','await stamp("submitted",job.jobId);await coordinator.process(dispatch);await stamp("coordinator-sent",job.jobId);await manager.tick();await stamp("tick-start",job.jobId);');
q=q.replace("state==='RUNNING');const fact", "state==='RUNNING');await stamp(\"running\",job.jobId);const fact");
q=q.replace("state==='EXITED');await coordinator", "state==='EXITED');await stamp(\"exited\",job.jobId);await coordinator");
q=q.replace('return runner.get(job.jobId);','await stamp("coordinator-acked",job.jobId);return runner.get(job.jobId);');
writeFileSync('.cache/p109-instrumented-quality.mjs',q);
let f=absolute('tests/fixtures/release-freeze.mjs').replace(pathToFileURL(resolve('tests/fixtures/quality-runner.mjs')).href,pathToFileURL(resolve('.cache/p109-instrumented-quality.mjs')).href);
writeFileSync('.cache/p109-timed-release.mjs',f);
const {releaseFreezeFixture}=await import(pathToFileURL(resolve('.cache/p109-timed-release.mjs')).href),cleanups=[],startedAt=new Date().toISOString();
let outcome;try{await releaseFreezeFixture({after:fn=>cleanups.push(fn)});outcome={passed:true};}catch(e){outcome={passed:false,code:e.code,message:e.message};}
const trace=(globalThis.acceptanceTiming??[]).map(({label,at,job})=>({label,at,job:job?{jobId:job.jobId,state:job.state,createdAt:job.createdAt,startedAt:job.startedAt,endedAt:job.endedAt,stopRequested:job.stopRequested,timeoutMs:job.request.resourceLimits.timeoutMs,notBefore:job.request.permit.notBefore,expiresAt:job.request.permit.expiresAt}:null}));
const record={scope:'Diagnostic instrumentation in ignored copies only; no acceptance validation or production change.',startedAt,finishedAt:new Date().toISOString(),outcome,trace};writeFileSync('.cache/p1-07/acceptance-upstream-timing-3.json',JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify(record));
for(const cleanup of cleanups)await cleanup();if(!outcome.passed)process.exitCode=1;
