import {canonical,sha256,qualityPolicyHash,freezeQualitySourceScope} from '../../packages/result-verifier/dist/index.mjs';
export {canonical,sha256};
export const loc=line=>({start:{line,column:0},end:{line,column:1}});
export function qualityFixture(options={}){
 const producer=id=>({producerId:id,command:['node','scripts/'+id+'.mjs'],imageDigest:'local/test@sha256:'+'a'.repeat(64),pathPrefixes:['/workspace/repo']});
 const ids=options.shared?['front','back']:['front'];
 const policy={schemaVersion:'devmesh.quality-policy.v1',templateVersion:'web-crud-v1',producers:ids.map(producer),reports:[...ids.map(id=>({reportId:'coverage.'+id,producerId:id,format:'istanbul-v1',path:'.artifacts/'+id+'/coverage-final.json',sourceInclude:['src/**/*.ts']})),{reportId:'tests.front',producerId:'front',format:'vitest-json-v1',path:'.artifacts/unit-results.json',sourceInclude:[]}],
  checks:[{checkId:'command',kind:'command',producerIds:ids,reportIds:[],requiredTests:[]},{checkId:'tests',kind:'tests',producerIds:['front'],reportIds:['tests.front'],requiredTests:[{path:'tests/board.test.ts',fullName:'works',requirementIds:['requirement_01']}]},{checkId:'coverage',kind:'coverage',producerIds:ids,reportIds:ids.map(id=>'coverage.'+id),requiredTests:[]},...(options.human?[{checkId:'review',kind:'human',producerIds:[],reportIds:[],requiredTests:[]}]:[])],
  business:{include:['src/**/*.ts'],exclude:[]},thresholds:{lines:80,branches:70},zeroBranches:options.zeroBranches??'complete-map-proves-none'};
 const statements=Array.from({length:options.lines??100},(_,i)=>loc(i+1)),branches=Array.from({length:options.branchGroups??50},(_,i)=>({type:'if',loc:loc(i+1),locations:[loc(i+1),null]}));
  const gitManifest=[{path:'src/app.ts',sha256:options.sourceManifest?.files.find(f=>f.path==='src/app.ts').sha256??'b'.repeat(64),lineLengths:Array(100).fill(80)}],businessFiles=options.empty?[]:[{path:'src/app.ts',statements,branches}];
 if(options.empty)gitManifest.splice(0);
 const scope=freezeQualitySourceScope({policy,targetCommit:options.targetCommit??'c'.repeat(40),gitManifest,businessFiles});
 const executions=policy.producers.map((p,i)=>({producerId:p.producerId,attemptId:'attempt_01',runnerId:'runner.local',jobId:'job_'+i,operationId:'op_'+i,requestHash:sha256('job'+i),targetCommit:scope.targetCommit,checkConfigHash:qualityPolicyHash(policy),commandHash:sha256(canonical(p.command)),imageDigest:p.imageDigest,state:'EXITED',exitCode:0,errorCode:null,stopRequested:false,startedAt:'2026-11-12T00:00:00.000Z',finishedAt:'2026-11-12T00:00:01.000Z',log:{sha256:sha256(''),size:0}}));
 const coverage=(lineHits=80,branchHits=70)=>({'/workspace/repo/src/app.ts':{path:'/workspace/repo/src/app.ts',statementMap:Object.fromEntries(statements.map((s,i)=>[i,s])),s:Object.fromEntries(statements.map((_,i)=>[i,i<lineHits?1:0])),branchMap:Object.fromEntries(branches.map((b,i)=>[i,{...b,locations:b.locations.map(l=>l??{start:{},end:{}})}])),b:Object.fromEntries(branches.map((_,i)=>[i,[i*2<branchHits?1:0,i*2+1<branchHits?1:0]])),fnMap:{},f:{}}});
 const tests={success:true,testResults:[{name:'/workspace/repo/tests/board.test.ts',status:'passed',message:'',assertionResults:[{fullName:'works',status:'passed',failureMessages:[]}]}]};
 const pack=(reportId,raw)=>{const definition=policy.reports.find(r=>r.reportId===reportId),bytes=Buffer.from(JSON.stringify(raw));return {report:{reportId,execution:structuredClone(executions.find(e=>e.producerId===definition.producerId)),outputPath:definition.path,sha256:sha256(bytes),size:bytes.length},bytes};};
 const reports=[...ids.map(id=>pack('coverage.'+id,options.empty?{}:coverage())),pack('tests.front',tests)];
 const input={policy,scope,executions,reports};
 const replace=(id,raw)=>{const index=reports.findIndex(r=>r.report.reportId===id);reports[index]=pack(id,raw);};
 return {input,policy,scope,executions,reports,coverage,tests,pack,replace,reseal(){input.scope=freezeQualitySourceScope({policy,targetCommit:scope.targetCommit,gitManifest,businessFiles});for(const e of executions)e.checkConfigHash=input.scope.checkConfigHash;for(const r of reports)r.report.execution=structuredClone(executions.find(e=>e.producerId===r.report.execution.producerId));return input;}};
}
