import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {qualityPolicy,qualityPath,qualityExecution} from '../packages/contracts/dist/index.js';
import {evaluateQuality,parseReportJson,parseIstanbulReport,parseVitestReport,freezeQualitySourceScope,normalizeReportPath,qualityPolicyHash} from '../packages/result-verifier/dist/index.mjs';
import {qualityFixture,loc,sha256} from './fixtures/quality.mjs';
const check=(r,id)=>r.checks.find(c=>c.checkId===id);
const coverage=f=>check(evaluateQuality(f.input),'coverage');
const code=c=>e=>e.code===c;

test('frozen quality policy rejects lower thresholds, missing producers and ambiguous identities',()=>{
 const f=qualityFixture();assert.equal(qualityPolicy.safeParse(f.policy).success,true);
 for(const patch of [{lines:79,branches:70},{lines:80,branches:69}])assert.equal(qualityPolicy.safeParse({...f.policy,thresholds:patch}).success,false);
 const unknown=structuredClone(f.policy);unknown.reports[0].producerId='unknown';assert.equal(qualityPolicy.safeParse(unknown).success,false);
 const duplicate=structuredClone(f.policy);duplicate.checks.push(duplicate.checks[0]);assert.equal(qualityPolicy.safeParse(duplicate).success,false);
 const omitted=qualityFixture({shared:true}).policy;omitted.checks.find(c=>c.kind==='coverage').reportIds.pop();assert.equal(qualityPolicy.safeParse(omitted).success,false);
 for(const path of ['../src/app.ts','/src/app.ts','src/../app.ts','src\\app.ts','src/app.ts.','src/\0app.ts','src//app.ts','src/e\u0301.ts'])assert.equal(qualityPath.safeParse(path).success,false,path);
 assert.notEqual(qualityPolicyHash(f.policy),qualityPolicyHash({...f.policy,thresholds:{lines:81,branches:70}}));
});
test('raw JSON rejects duplicate keys, invalid UTF-8, excessive depth and byte bounds',()=>{
 assert.throws(()=>parseReportJson(Buffer.from('{"s":{},"s":{"0":1}}')),code('REPORT_DUPLICATE_KEY'));
 assert.throws(()=>parseReportJson(Buffer.from([0xff])),code('REPORT_UTF8_INVALID'));
 assert.throws(()=>parseReportJson(Buffer.from('['.repeat(50)+'0'+']'.repeat(50))),code('REPORT_COMPLEXITY_LIMIT'));
 assert.throws(()=>parseReportJson(Buffer.alloc(8*1024*1024+1,32)),code('REPORT_TOO_LARGE'));
 for(const value of ['{"x":1,}','[0,]','01','{"x":"\n"}','true false','{"x":NaN}'])assert.throws(()=>parseReportJson(Buffer.from(value)));
 assert.deepEqual(parseReportJson(Buffer.from('{"quoted\\\"key":[0,true,null,"\\u4e2d"]}')),{'quoted"key':[0,true,null,'中']});
});
test('coverage thresholds compare exact integer counts at 79/80 and 69/70',async t=>{
 for(const [lines,branches,expected] of [[79,70,'FAIL'],[80,70,'PASS'],[80,69,'FAIL'],[100,100,'PASS']])await t.test(lines+'/'+branches,()=>{const f=qualityFixture();f.replace('coverage.front',f.coverage(lines,branches));const r=coverage(f);assert.equal(r.status,expected);assert.deepEqual([r.coverage.lines.covered,r.coverage.lines.total,r.coverage.branches.covered,r.coverage.branches.total],[lines,100,branches,100]);});
});
test('a fraction that displays as 80 percent remains below the actual minimum',()=>{
 const f=qualityFixture(),source={path:'src/small.ts',sha256:sha256('x'),lineLengths:[10]},topology={path:source.path,statements:[loc(1)],branches:[]};
 f.input.scope=freezeQualitySourceScope({policy:f.policy,targetCommit:f.scope.targetCommit,gitManifest:[...f.scope.gitManifest,source],businessFiles:[...f.scope.businessFiles,topology]});
 const raw=f.coverage(80,70);raw['src/small.ts']={path:'src/small.ts',statementMap:{0:loc(1)},s:{0:0},branchMap:{},b:{},fnMap:{},f:{}};f.replace('coverage.front',raw);
 const r=coverage(f);assert.equal(Math.round(r.coverage.lines.covered/r.coverage.lines.total*100),79);assert.equal(r.coverage.lines.total,101);assert.equal(r.status,'FAIL');
 // 199/249 = 79.919... rounds to 80, but cannot pass either.
 const many=qualityFixture({lines:100});const business=many.scope.businessFiles[0];business.statements=Array.from({length:249},(_,i)=>loc(i+1));many.scope.gitManifest[0].lineLengths=Array(249).fill(80);
 many.input.scope=freezeQualitySourceScope({policy:many.policy,targetCommit:many.scope.targetCommit,gitManifest:many.scope.gitManifest,businessFiles:[business]});
 const extended=many.coverage(100,70),file=Object.values(extended)[0];file.statementMap=Object.fromEntries(business.statements.map((l,i)=>[i,l]));file.s=Object.fromEntries(business.statements.map((_,i)=>[i,i<199?1:0]));many.replace('coverage.front',extended);
 const result=coverage(many);assert.equal(Math.round(199/249*100),80);assert.equal(result.status,'FAIL');
});
test('shared files use a union of source positions and accept producer-local numeric IDs',()=>{
 const f=qualityFixture({shared:true}),front=f.coverage(50,50),back=f.coverage(0,0),b=Object.values(back)[0];
 b.s=Object.fromEntries(Object.keys(b.s).map((_,i)=>[i+1000,i>=50?1:0]));b.statementMap=Object.fromEntries(Object.values(b.statementMap).map((v,i)=>[i+1000,v]));
 b.b=Object.fromEntries(Object.keys(b.b).map((_,i)=>[i+1000,[i*2>=50?1:0,i*2+1>=50?1:0]]));b.branchMap=Object.fromEntries(Object.values(b.branchMap).map((v,i)=>[i+1000,v]));
 f.replace('coverage.front',front);f.replace('coverage.back',back);const r=coverage(f);assert.equal(r.status,'PASS');assert.deepEqual([r.coverage.lines.covered,r.coverage.lines.total,r.coverage.branches.covered,r.coverage.branches.total],[100,100,100,100]);
});
test('several statements on one line produce one coverable line',()=>{
 const f=qualityFixture(),extra={start:{line:1,column:3},end:{line:1,column:4}};
 f.scope.businessFiles[0].statements.push(extra);f.input.scope=freezeQualitySourceScope({policy:f.policy,targetCommit:f.scope.targetCommit,gitManifest:f.scope.gitManifest,businessFiles:f.scope.businessFiles});
 const raw=f.coverage(79,70),file=Object.values(raw)[0];file.s[0]=0;file.statementMap[100]=extra;file.s[100]=1;file.s[79]=1;f.replace('coverage.front',raw);
 const r=coverage(f);assert.equal(r.coverage.lines.total,100);assert.equal(r.coverage.lines.covered,80);assert.equal(r.status,'PASS');
});
test('empty business scope fails and zero branches need a frozen complete-map rule',()=>{
 assert.deepEqual(coverage(qualityFixture({empty:true})).codes,['COVERAGE_SCOPE_EMPTY']);
 const allowed=coverage(qualityFixture({branchGroups:0}));assert.equal(allowed.status,'PASS');assert.equal(allowed.coverage.branches.status,'NOT_APPLICABLE');assert.equal(allowed.coverage.branches.total,0);
 const denied=coverage(qualityFixture({branchGroups:0,zeroBranches:'reject'}));assert.equal(denied.status,'FAIL');assert.ok(denied.codes.includes('COVERAGE_BRANCHES_UNPROVEN'));
 const noLines=coverage(qualityFixture({lines:0,branchGroups:0}));assert.equal(noLines.status,'FAIL');assert.ok(noLines.codes.includes('COVERAGE_LINES_EMPTY'));
});
test('full frozen business manifest detects omitted unexecuted files and producer reports',()=>{
 const f=qualityFixture({shared:true});f.reports.splice(f.reports.findIndex(r=>r.report.reportId==='coverage.back'),1);const missing=coverage(f);assert.equal(missing.status,'MISSING');assert.ok(missing.codes.includes('REPORT_MISSING'));
 const omitted=qualityFixture();omitted.replace('coverage.front',{});assert.equal(coverage(omitted).status,'MISSING');assert.ok(coverage(omitted).codes.includes('COVERAGE_FILE_MISSING'));
 const added=qualityFixture();assert.throws(()=>freezeQualitySourceScope({policy:added.policy,targetCommit:added.scope.targetCommit,gitManifest:[...added.scope.gitManifest,{path:'src/not-tested.ts',sha256:sha256('new'),lineLengths:[4]}],businessFiles:added.scope.businessFiles}),code('SOURCE_SCOPE_INCOMPLETE'));
 const uncovered=qualityFixture();uncovered.policy.reports[0].sourceInclude=['src/elsewhere/**'];assert.throws(()=>uncovered.reseal(),code('SOURCE_PRODUCER_MISSING'));
});
test('omitted or contradictory instrumentation is stale rather than a smaller denominator',()=>{
 for(const mutate of [f=>{delete f.statementMap[99];delete f.s[99];},f=>{f.statementMap[99].end.column=2;},f=>{delete f.branchMap[49];delete f.b[49];}]){const f=qualityFixture(),raw=f.coverage(100,100);mutate(Object.values(raw)[0]);f.replace('coverage.front',raw);const r=coverage(f);assert.equal(r.status,'STALE');assert.ok(r.codes.includes('COVERAGE_TOPOLOGY_STALE'));}
 const f=qualityFixture(),raw=f.coverage();Object.values(raw)[0].b[0]=[1];f.replace('coverage.front',raw);assert.equal(coverage(f).status,'FAIL');
});
test('a model success flag and self-reported totals cannot hide failed, skipped or missing cases',async t=>{
 for(const status of ['failed','pending','skipped','todo'])await t.test(status,()=>{const f=qualityFixture(),raw=structuredClone(f.tests);raw.numPassedTests=1;raw.numFailedTests=0;raw.success=true;raw.testResults[0].assertionResults[0].status=status;f.replace('tests.front',raw);assert.equal(check(evaluateQuality(f.input),'tests').status,'FAIL');});
 const missing=qualityFixture(),raw=structuredClone(missing.tests);raw.testResults[0].assertionResults=[];missing.replace('tests.front',raw);assert.equal(check(evaluateQuality(missing.input),'tests').status,'MISSING');
 const runtimeError=qualityFixture(),broken=structuredClone(runtimeError.tests);broken.numRuntimeErrorTestSuites=1;runtimeError.replace('tests.front',broken);assert.equal(check(evaluateQuality(runtimeError.input),'tests').status,'FAIL');
});
test('unknown or duplicated test identity and malformed status fail closed',()=>{
 for(const mutate of [r=>r.testResults[0].assertionResults.push(r.testResults[0].assertionResults[0]),r=>{r.testResults[0].assertionResults[0].status='success';},r=>{r.testResults[0].assertionResults[0].failureMessages=['hidden'];}]){const f=qualityFixture(),raw=structuredClone(f.tests);mutate(raw);f.replace('tests.front',raw);assert.equal(check(evaluateQuality(f.input),'tests').status,'FAIL');}
});
test('wrong SHA, policy, image or command is stale and unknown/failed execution never passes',()=>{
 for(const [field,value] of [['targetCommit','d'.repeat(40)],['checkConfigHash','e'.repeat(64)],['commandHash','e'.repeat(64)],['imageDigest','other/test@sha256:'+'e'.repeat(64)]]){const f=qualityFixture();f.executions[0][field]=value;for(const r of f.reports)r.report.execution=structuredClone(f.executions[0]);assert.equal(evaluateQuality(f.input).automaticStatus,'STALE',field);}
 for(const [field,value,expected] of [['state','OUTCOME_UNKNOWN','MISSING'],['exitCode',null,'MISSING'],['exitCode',1,'FAIL'],['stopRequested',true,'FAIL'],['errorCode','RUNNER_ERROR','FAIL'],['finishedAt',null,'MISSING']]){const f=qualityFixture();f.executions[0][field]=value;for(const r of f.reports)r.report.execution=structuredClone(f.executions[0]);assert.equal(evaluateQuality(f.input).automaticStatus,expected,field);}
 assert.equal(qualityExecution.safeParse({...qualityFixture().executions[0],exitCode:0.5}).success,false);
});
test('report identity and byte hashes reject copied provenance, changed bytes and output path',()=>{
 for(const mutate of [r=>{r.bytes=Buffer.from('{}');},r=>{r.report.sha256='f'.repeat(64);},r=>{r.report.execution.jobId='job_foreign';},r=>{r.report.outputPath='coverage-final.json';}]){const f=qualityFixture();mutate(f.reports[0]);assert.equal(coverage(f).status,'FAIL');}
 const f=qualityFixture();f.reports.push(f.reports[0]);assert.throws(()=>evaluateQuality(f.input),code('REPORT_ID_AMBIGUOUS'));
});
test('known failed jobs retain original test and coverage counts without converting failure to pass',()=>{
 const f=qualityFixture(),raw=structuredClone(f.tests);raw.testResults[0].assertionResults[0].status='failed';f.replace('tests.front',raw);f.executions[0].exitCode=1;for(const r of f.reports)r.report.execution=structuredClone(f.executions[0]);
 const result=evaluateQuality(f.input);assert.equal(result.automaticStatus,'FAIL');assert.equal(check(result,'tests').tests.failed,1);assert.equal(check(result,'coverage').coverage.lines.covered,80);assert.equal(check(result,'coverage').status,'FAIL');assert.ok(check(result,'coverage').codes.includes('EXECUTION_FAILED'));
 const reused=qualityFixture({shared:true});reused.executions[1].jobId=reused.executions[0].jobId;assert.throws(()=>evaluateQuality(reused.input),code('EXECUTION_JOB_REUSED'));
});
test('fixed path mapping rejects traversal, unrelated absolute roots, case aliases and unknown files',()=>{
 assert.equal(normalizeReportPath('C:\\fixed\\repo\\src\\app.ts',['C:/fixed/repo']),'src/app.ts');
 for(const path of ['/elsewhere/src/app.ts','/workspace/repo/../app.ts','/workspace/repo/src//app.ts','file:///repo/src/app.ts'])assert.throws(()=>normalizeReportPath(path,['/workspace/repo']));
 const f=qualityFixture(),raw=f.coverage();raw['src/App.ts']={...Object.values(raw)[0],path:'src/App.ts'};f.replace('coverage.front',raw);assert.equal(coverage(f).status,'FAIL');
 assert.throws(()=>freezeQualitySourceScope({policy:f.policy,targetCommit:f.scope.targetCommit,gitManifest:[...f.scope.gitManifest,{...f.scope.gitManifest[0],path:'src/App.ts'}],businessFiles:f.scope.businessFiles}),code('SOURCE_PATH_AMBIGUOUS'));
 const invalid=structuredClone(f.scope);invalid.sourceManifestSha256='a'.repeat(64);f.input.scope=invalid;assert.throws(()=>evaluateQuality(f.input),code('SOURCE_PROOF_HASH_MISMATCH'));
});
test('automatic PASS preserves pending human review separately',()=>{
 const f=qualityFixture({human:true}),r=evaluateQuality(f.input);assert.equal(r.automaticStatus,'PASS');assert.equal(r.reviewStatus,'PENDING');assert.equal(check(r,'review').status,'PENDING');
});
test('archived real template Vitest/V8 reports parse with exact historical Git source, including null end columns and implicit else',()=>{
 const root='project/evidence/P0-09/windows-dd7f972',original=JSON.parse(readFileSync(root+'/report.json','utf8')),targetCommit=original.sourceCommit;
 const coverageBytes=readFileSync(root+'/coverage-final.json'),testBytes=readFileSync(root+'/unit-results.json'),rawCoverage=JSON.parse(coverageBytes),rawTests=JSON.parse(testBytes);
 const prefix='D:/yms/AI/DevMesh/.cache/p0-09/windows-clean-876aea7/templates/web-crud-v1';
 const files=execFileSync('git',['ls-tree','-r','--name-only',targetCommit+':templates/web-crud-v1'],{encoding:'utf8',windowsHide:true}).trim().split('\n');
 const gitManifest=files.filter(p=>/\.(?:ts|tsx)$/.test(p)).map(path=>{const bytes=execFileSync('git',['show',targetCommit+':templates/web-crud-v1/'+path],{windowsHide:true});return {path,sha256:sha256(bytes),lineLengths:bytes.toString('utf8').split(/\r?\n/).map(l=>l.length)};});
 const parsed=parseIstanbulReport(coverageBytes,[prefix],gitManifest);assert.equal(parsed.size,12);assert.ok([...parsed.values()].some(f=>[...f.branches.values()].some(b=>b.branch.locations.includes(null))));
 const tests=parseVitestReport(testBytes,[prefix]);assert.equal(tests.cases.size,19);assert.equal(tests.runFailed,false);
 const f=qualityFixture();f.policy.producers[0].pathPrefixes=[prefix];f.policy.business.include=['src/**/*.{ts,tsx}'];f.policy.reports[0].sourceInclude=['src/**/*.{ts,tsx}'];f.policy.checks.find(c=>c.kind==='tests').requiredTests=rawTests.testResults.flatMap(s=>s.assertionResults.map(a=>({path:normalizeReportPath(s.name,[prefix]),fullName:a.fullName,requirementIds:['requirement_01']})));
 // Archived topology is a parser regression reference only. It is NOT evidence
 // of independently trusted pre-execution instrumentation or a live Runner job.
 const businessFiles=[...parsed.values()].map(v=>({path:v.path,statements:[...v.statements.values()].map(s=>s.loc),branches:[...v.branches.values()].map(b=>b.branch)}));
 const scope=freezeQualitySourceScope({policy:f.policy,targetCommit,gitManifest,businessFiles});f.input.scope=scope;
 f.executions[0].targetCommit=targetCommit;f.executions[0].checkConfigHash=scope.checkConfigHash;
 f.replace('coverage.front',rawCoverage);f.replace('tests.front',rawTests);const result=evaluateQuality(f.input);assert.equal(result.automaticStatus,'PASS',JSON.stringify(result));assert.equal(check(result,'tests').tests.passed,19);assert.equal(check(result,'coverage').coverage.branches.total,265);
});
