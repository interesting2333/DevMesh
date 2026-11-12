import {z} from 'zod';
import {gitCommit,ids,opaqueKey,sha256,timestamp} from './primitives.js';
import {qualityPath,unsafeQualityPath} from './source-path.js';
import {releaseDeliveryProfile} from './delivery.js';
export {qualityPath} from './source-path.js';

export const qualityLimits={reportBytes:8*1024*1024,files:2048,positions:200_000,tests:20_000,jsonDepth:48,jsonNodes:500_000} as const;
const pattern=z.string().min(1).max(512).refine(v=>!unsafeQualityPath(v)&&!v.startsWith('/')&&!v.split('/').some(p=>p==='..'||p==='.'||!p),'Relative bounded glob required');
const count=z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const qualityLocation=z.strictObject({start:z.strictObject({line:count.min(1),column:count}),end:z.strictObject({line:count.min(1),column:count})}).refine(v=>v.start.line<v.end.line||v.start.line===v.end.line&&v.start.column<=v.end.column,'Location must be ordered');
export const qualityBranch=z.strictObject({type:opaqueKey,loc:qualityLocation,locations:z.array(qualityLocation.nullable()).min(1).max(128)});
const image=z.string().regex(/^[a-z0-9][a-z0-9._/:~-]*@sha256:[a-f0-9]{64}$/);
export const qualityTestIdentity=z.strictObject({path:qualityPath,fullName:z.string().min(1).max(4096),requirementIds:z.array(ids.requirement).min(1).max(128)});
export const qualityProducer=z.strictObject({producerId:opaqueKey,command:z.array(z.string().min(1).max(1024)).min(1).max(32),imageDigest:image,
  pathPrefixes:z.array(z.string().min(1).max(1024).refine(v=>!v.includes('\\')&&!v.endsWith('/')&&!v.includes('/../')&&!v.includes('/./')&&(/^[A-Za-z]:\//.test(v)||v.startsWith('/')),'Fixed absolute normalized prefix required')).max(8)});
export const qualityPolicy=z.strictObject({schemaVersion:z.literal('devmesh.quality-policy.v1'),templateVersion:opaqueKey,
   delivery:releaseDeliveryProfile.optional(),
  producers:z.array(qualityProducer).min(1).max(16),
  reports:z.array(z.strictObject({reportId:opaqueKey,producerId:opaqueKey,format:z.enum(['istanbul-v1','vitest-json-v1']),path:qualityPath,sourceInclude:z.array(pattern).max(32)})).min(1).max(32),
  checks:z.array(z.strictObject({checkId:opaqueKey,kind:z.enum(['command','tests','coverage','human']),producerIds:z.array(opaqueKey).max(16),reportIds:z.array(opaqueKey).max(32),requiredTests:z.array(qualityTestIdentity).max(qualityLimits.tests)})).min(1).max(64),
  business:z.strictObject({include:z.array(pattern).min(1).max(32),exclude:z.array(z.strictObject({glob:pattern,reason:z.string().min(1).max(1024)})).max(32)}),
  thresholds:z.strictObject({lines:z.number().int().min(80).max(100),branches:z.number().int().min(70).max(100)}),
  zeroBranches:z.enum(['reject','complete-map-proves-none'])
}).superRefine((v,c)=>{
  const fail=(message:string)=>c.addIssue({code:'custom',message});
  for(const [label,values] of [['producer',v.producers.map(x=>x.producerId)],['report',v.reports.map(x=>x.reportId)],['check',v.checks.map(x=>x.checkId)]] as const)if(new Set(values).size!==values.length)fail('Duplicate '+label);
  const producers=new Set(v.producers.map(x=>x.producerId)),reports=new Map(v.reports.map(x=>[x.reportId,x]));
  for(const r of v.reports){if(!producers.has(r.producerId))fail('Unknown report producer');if((r.format==='istanbul-v1')!==Boolean(r.sourceInclude.length))fail('Coverage source scope is required; tests cannot define coverage');}
  for(const check of v.checks){
    if(new Set(check.producerIds).size!==check.producerIds.length||new Set(check.reportIds).size!==check.reportIds.length)fail('Duplicate check input');
    if(check.producerIds.some(p=>!producers.has(p))||check.reportIds.some(r=>!reports.has(r)))fail('Unknown check input');
    if(check.reportIds.some(r=>!check.producerIds.includes(reports.get(r)!.producerId)))fail('Report outside check producer scope');
    if(check.kind==='human'&&(check.producerIds.length||check.reportIds.length||check.requiredTests.length))fail('Human check cannot claim automatic evidence');
    if(check.kind!=='human'&&!check.producerIds.length)fail('Automatic check requires original producer');
    if(check.kind==='tests'&&(!check.requiredTests.length||!check.reportIds.length||check.reportIds.some(r=>reports.get(r)?.format!=='vitest-json-v1')))fail('Test check needs explicit test identities and raw test reports');
    if(check.kind==='coverage'&&(!check.reportIds.length||check.reportIds.some(r=>reports.get(r)?.format!=='istanbul-v1')))fail('Coverage check needs raw coverage reports');
    if(check.kind==='coverage'&&v.reports.some(r=>r.format==='istanbul-v1'&&!check.reportIds.includes(r.reportId)))fail('Overall coverage requires all configured producers');
    if(check.kind!=='tests'&&check.requiredTests.length)fail('Unexpected test identities');
    if(check.kind==='command'&&check.reportIds.length)fail('Command check uses execution facts only');
    const tests=check.requiredTests.map(t=>t.path+'\0'+t.fullName);if(new Set(tests).size!==tests.length)fail('Duplicate required test');
  }
  if(!v.checks.some(x=>x.kind==='coverage')||!v.checks.some(x=>x.kind==='tests'))fail('Policy requires independent test and coverage checks');
  for(const r of v.reports)if(!v.checks.some(x=>x.reportIds.includes(r.reportId)))fail('Unused required report');
  for(const p of v.producers)if(!v.checks.some(x=>x.producerIds.includes(p.producerId)))fail('Unused producer');
   if(v.delivery&&(!producers.has(v.delivery.producerId)||!v.checks.some(x=>x.kind==='command'&&x.producerIds.includes(v.delivery!.producerId))))fail('Delivery requires an original approved command check producer');
});
export type QualityPolicy=z.output<typeof qualityPolicy>;
export const qualitySourceFile=z.strictObject({path:qualityPath,sha256,lineLengths:z.array(count.max(1024*1024)).min(1).max(100_000)});
export const qualitySourceScope=z.strictObject({schemaVersion:z.literal('devmesh.quality-source.v1'),targetCommit:gitCommit,checkConfigHash:sha256,
  sourceManifestSha256:sha256,topologySha256:sha256,
  // The full original Git manifest is trusted input, including unexecuted files.
  gitManifest:z.array(qualitySourceFile).max(qualityLimits.files),
  // Complete pre-execution instrumentation, never inferred from submitted hits.
  businessFiles:z.array(z.strictObject({path:qualityPath,statements:z.array(qualityLocation).max(qualityLimits.positions),branches:z.array(qualityBranch).max(qualityLimits.positions)})).max(qualityLimits.files)
});
export type QualitySourceScope=z.output<typeof qualitySourceScope>;
export const qualityExecution=z.strictObject({producerId:opaqueKey,attemptId:ids.attempt,runnerId:opaqueKey,jobId:ids.job,operationId:ids.operation,requestHash:sha256,
  targetCommit:gitCommit,checkConfigHash:sha256,commandHash:sha256,imageDigest:image,
  state:z.enum(['QUEUED','STARTING','RUNNING','STOPPING','EXITED','OUTCOME_UNKNOWN']),exitCode:z.number().int().min(-2147483648).max(2147483647).nullable(),
  errorCode:z.string().min(1).max(128).nullable(),stopRequested:z.boolean(),startedAt:timestamp.nullable(),finishedAt:timestamp.nullable(),
  log:z.strictObject({sha256,size:count.max(16*1024*1024)})});
export type QualityExecution=z.output<typeof qualityExecution>;
export const qualityReport=z.strictObject({reportId:opaqueKey,execution:qualityExecution,outputPath:qualityPath,sha256,size:count.max(qualityLimits.reportBytes)});
export type QualityReport=z.output<typeof qualityReport>;
export const qualityCheckStatus=z.enum(['PASS','FAIL','MISSING','STALE','NOT_APPLICABLE','PENDING']);
const metric=z.strictObject({covered:count,total:count,minimum:z.number().int().min(0).max(100),status:qualityCheckStatus}).refine(v=>v.covered<=v.total,'Covered cannot exceed total');
export const qualityEvaluation=z.strictObject({schemaVersion:z.literal('devmesh.quality-evaluation.v1'),targetCommit:gitCommit,checkConfigHash:sha256,sourceManifestSha256:sha256,topologySha256:sha256,
  automaticStatus:z.enum(['PASS','FAIL','MISSING','STALE']),reviewStatus:z.enum(['PENDING','NOT_REQUIRED']),
  checks:z.array(z.strictObject({checkId:opaqueKey,status:qualityCheckStatus,codes:z.array(opaqueKey).max(128),reportIds:z.array(opaqueKey).max(32),
    tests:z.strictObject({passed:count,failed:count,skipped:count,missing:count}).optional(),coverage:z.strictObject({lines:metric,branches:metric}).optional()})).max(64)
});
export type QualityEvaluation=z.output<typeof qualityEvaluation>;
