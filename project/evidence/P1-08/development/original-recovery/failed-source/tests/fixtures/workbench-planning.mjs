import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {PreparationRuntime,providerConfigSchema} from '../../packages/agent-runtime/dist/index.mjs';
import {mountInputApi} from '../../packages/input-api/dist/index.mjs';
import {httpFixture,callerId,credential} from './a2a-data.mjs';
import {plan} from './storage-data.mjs';

export async function workbenchPlanningFixture(t,{questions=false,invalidGraph=false}={}){
 const f=await httpFixture(t,{preparation:true}),repositoryRoot=fileURLToPath(new URL('../../',import.meta.url)),baseCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:repositoryRoot,encoding:'utf8',windowsHide:true}).trim(),outputs=[],calls=[];
 const config=providerConfigSchema.parse({providerId:'controlled',endpoint:'http://127.0.0.1:1',model:'fixture-model',credentialRef:'test.model',capabilities:{revision:'v1',contextTokens:128000,maxOutputTokens:4096,toolCalls:false,structuredOutput:'json-object',tokenCounting:'utf8-conservative-v1',reasoningMode:'disabled',verification:'DECLARED'}});
 const provider={config,async complete(request){assert.deepEqual(request.tools,[]);calls.push(request);const output=outputs.shift();assert(output,'Unexpected controlled model call');return {content:JSON.stringify(output),toolCalls:[],finishReason:'stop',requestId:'fixture-'+randomUUID(),usage:{inputTokens:50,outputTokens:60,source:'provider'},model:config.model,cost:null};}};
 const runtime=new PreparationRuntime(f.content,f.registry,credential,{callerId,workerId:'workbench.planning.tests',tokenLimit:100000,maxInputBytes:256*1024,maxOutputTokens:4096,providers:{product:provider,architect:provider},bootstrap:{repositoryRoot,paths:['templates/web-crud-v1/template.json']}});
 const api=mountInputApi(f.app,f.content,{enabled:true,baseline:{version:'1.0.0',baseCommit},identityResolver:r=>{const principalId=r.headers.authorization?.split(' ')[1];return ['user_1','viewer_1','user_other'].includes(principalId)?{principalId}:null;}});t.after(()=>api.stop());
 const call=async(path,body,headers={})=>{let response;try{response=await fetch(f.base+'/api/v1'+path,{...(body===undefined?{}:{method:'POST',body:JSON.stringify(body)}),headers:{authorization:'Bearer user_1',...(body===undefined?{}:{'content-type':'application/json','idempotency-key':randomUUID()}),...headers},signal:AbortSignal.timeout(90000)});}catch(error){t.diagnostic(JSON.stringify({path,error:error.message,cause:{name:error.cause?.name,code:error.cause?.code,message:error.cause?.message}}));throw error;}return {response,body:await response.json()};};
 const created=await call('/projects',{name:'可追溯计划',initialRequest:{text:'实现工作台，原始来源 <script>window.untrusted=1</script> 🧪',attachmentIds:[]},clientDraftId:randomUUID()});assert.equal(created.response.status,201,JSON.stringify(created.body));const p=created.body.result,ref={kind:'message',messageId:p.messageId};
 const sql=(query,...args)=>{const db=new DatabaseSync(join(f.local.dataRoot,'db/devmesh.sqlite'));try{db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');return db.prepare(query).all(...args);}finally{db.close();}};
 const signal=AbortSignal.timeout(90000);
 async function dispatch(purpose){const jobs=await f.storage.request('listPreparationJobs',{}),job=jobs.find(j=>j.runId===p.runId&&j.purpose===purpose&&['WAITING','READY'].includes(j.state));assert(job,JSON.stringify(jobs));const task=await runtime.dispatch(job,signal);assert(task);return job;}
 async function execute(role,output){outputs.push(output);const [claim]=await f.storage.request('claimPreparationTasks',{endpointId:'builtin.'+role,workerId:'workbench.planning.tests'});assert(claim);return runtime.execute(claim,signal);}
 const productJob=await dispatch('UNDERSTAND'),context=await f.storage.request('getPreparationContext',{principalId:'user_1',jobId:productJob.jobId}),gitRef=context.sources.find(s=>s.label==='git:templates/web-crud-v1/template.json').ref;
 const product={schemaVersion:'devmesh.understanding.v1',role:'product',requirements:[{id:'requirement_1',statement:'来源可追溯的任务看板',sourceRefs:[ref,gitRef],acceptance:['需求和计划均能打开原来源']}],assumptions:['由用户明确审阅计划'],questions:questions?[{id:'question_confirm',required:true,prompt:'请选择部署目标',reason:'明确交付边界',sourceRefs:[ref],blockingScope:[],options:[{id:'local',label:'本地部署'},{id:'cloud',label:'云部署'}],defaultOption:'local'}]:[],conflicts:[]};
 const understood=await execute('product',product);assert.equal(understood.requirementRevision,1,JSON.stringify(understood));
 const planJob=await dispatch('PLAN'),planContext=await f.storage.request('getPreparationContext',{principalId:'user_1',jobId:planJob.jobId}),planGitRef=planContext.sources.find(s=>s.label==='git:templates/web-crud-v1/template.json').ref;
 // Each preparation job freezes its own bootstrap artifact identity, even when bytes match.
 const draft=plan(['developer','tester']),[dev,tester]=draft.works;Object.assign(dev,{goal:'实现来源导航',requirementIds:['requirement_1'],inputRefs:[planGitRef],dependencies:[]});Object.assign(tester,{goal:'验证来源与权限',requirementIds:['requirement_1'],inputRefs:[{kind:'output',workId:dev.workId,outputSlot:dev.outputSpec[0].slot}],dependencies:[{workId:dev.workId,requiredOutcome:'success'}],outputSpec:[{slot:'verification.report',schemaId:'devmesh.test-result.v1'}],completionChecks:[{kind:'required-tests-pass',checkId:'check_required'}]});if(invalidGraph)dev.dependencies=[{workId:tester.workId,requiredOutcome:'success'}];
 const published=await execute('architect',{schemaVersion:'devmesh.architecture.v1',role:'architect',interfaces:[],planDraft:draft,risks:[],capabilityFit:{supported:true,gaps:[]}});assert.equal(published.planRevision,1,JSON.stringify(published));
 const workspace=await call('/projects/'+p.projectId+'/workspace'),review=await call('/runs/'+p.runId+'/plans');assert.equal(review.response.status,200,JSON.stringify(review.body));
 return {...f,...p,ref,gitRef,product,draft,published,workspace:workspace.body,review:review.body,call,sql,calls,api};
}
