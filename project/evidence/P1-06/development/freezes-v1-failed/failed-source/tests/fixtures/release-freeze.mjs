import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {LocalContentStore,LocalBlobProvider} from '../../packages/blob-store/dist/index.mjs';
import {WorkVerifier,DeliveryCollector,qualityPolicyHash} from '../../packages/result-verifier/dist/index.mjs';
import {candidateFixture} from './candidate-data.mjs';
import {qualityRunnerFixture} from './quality-runner.mjs';
import {qualityFixture} from './quality.mjs';
import {workVerificationFixture,workOp} from './work-verification.mjs';
import {seedDeveloperCandidate} from './verified-repair.mjs';
import {deliveryOptions} from './delivery.mjs';
import {canonical,hash,meta,requirements} from './storage-data.mjs';

// Actual migrated SQLite, three formal Work assessments/content transactions,
// authenticated Runner HTTP and original report/delivery collection. Source Git
// integration/admission and Runtime candidate publication are explicit DB fixtures.
// Full actual Git/Runtime composition remains a separate task 5.1 obligation.
export async function releaseFreezeFixture(t,options={}){
 const delivery=deliveryOptions(),q=qualityFixture({human:options.human});q.policy.checks.find(c=>c.kind==='tests').checkId='check_required';q.policy.checks.find(c=>c.kind==='tests').requiredTests[0].requirementIds=requirements().requirements.map(r=>r.id);delivery.configureQuality(q);q.reseal();
 const base=await candidateFixture(t,{configureDraft(d){for(const work of d.works.filter(w=>w.role==='developer')){work.outputSpec=[{slot:'implementation.commit',schemaId:'devmesh.development-result.v1'}];work.completionChecks=[{kind:'commit-resolved',outputSlot:'implementation.commit'}];}}}),root=await mkdtemp(join(tmpdir(),'devmesh-freeze-'));t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(join(root,'artifacts'),{recursive:true});await mkdir(join(root,'staging','objects'),{recursive:true});
 const provider=new LocalBlobProvider(root,0),content=new LocalContentStore(base.storage,root,0,provider);Object.assign(base,{root,provider,content});const developers=[];
 for(let index=0;index<2;index++){const source=await base.complete(index,{formal:!options.historicalDeveloper,manifestOverrides:{checkConfigHash:qualityPolicyHash(q.policy),templateVersion:q.policy.templateVersion}});if(!options.historicalDeveloper)developers.push(await seedDeveloperCandidate(base,source));}
 const inputArtifacts=options.historicalDeveloper?[{artifactId:base.p.artifactId,sha256:base.get('SELECT content_hash FROM artifacts WHERE artifact_id=?',base.p.artifactId).content_hash}]:developers.flatMap(r=>r.verification.evaluation.outputs.map(o=>o.ref));
 const f=await qualityRunnerFixture(t,{baseFixture:base,...delivery,human:options.human,inputArtifacts,roleSchema:'devmesh.test-result.v1'});await f.prepare();await f.runJob();await f.collector.collect(f.subject);f.bytes.set('result',Buffer.from(await f.content.readBytes('user_1',{kind:'qualityMaterial',operationId:f.bound.operationId,materialKey:'result'})));
 const tester=await workVerificationFixture(t,{completedQuality:f}),proof=await new WorkVerifier(f.storage,f.content).verify(tester.subject),policy=await f.storage.request('registerReleaseDeliveryPolicy',{principalId:'user_1',projectId:f.p.projectId,policy:{schemaVersion:'devmesh.delivery-policy.v1',templateVersion:f.q.policy.templateVersion,checkConfigHash:f.policy.configHash,...f.q.policy.delivery}}),deliveryInput={principalId:'user_1',operationId:workOp(),runId:f.p.runId,qualityOperationId:f.bound.operationId,policyHash:policy.policyHash};
 if(!options.noDelivery)await new DeliveryCollector(f.storage,f.content,f.runner).collect(deliveryInput);
 async function sourceSnapshot(){
  // Explicit ACKed source journal fixture. Real Git promotion has its own suite.
  const basis=await f.storage.request('getCandidateSourceBasis',{principalId:'user_1',runId:f.p.runId,purpose:'run-candidate'}),operationId=workOp(),now=new Date().toISOString();
  f.insert('candidate_integrations',{operation_id:operationId,project_id:f.p.projectId,run_id:f.p.runId,principal_id:'user_1',purpose:'run-candidate',work_id:null,origin_operation_id:f.record.basis.sourceIntegrationOperationId,request_hash:hash('explicit-final-source-fixture'),basis_sha256:basis.sha256,basis_json:canonical(basis),expected_head_json:null,state:'BUILDING',manifest_json:canonical(f.manifest),acknowledgement_json:null,failure_json:null,error_code:null,created_at:now,acknowledged_at:null});
  for(const [ordinal,s] of basis.sources.entries())f.insert('candidate_integration_sources',{operation_id:operationId,ordinal,archive_operation_id:s.archiveOperationId});f.run("UPDATE candidate_integrations SET state='ACKNOWLEDGED',acknowledgement_json='{}',acknowledged_at=? WHERE operation_id=?",now,operationId);f.run('INSERT INTO managed_candidate_heads VALUES(?,?,?,?) ON CONFLICT(run_id) DO UPDATE SET operation_id=excluded.operation_id,commit_sha=excluded.commit_sha',f.p.runId,f.p.projectId,operationId,f.manifest.commit);return operationId;
 }
 const integrationOperationId=await sourceSnapshot(),request=async(overrides={})=>{const r=await f.storage.request('getRun',{runId:f.p.runId});return {meta:meta(f.p.runId),runId:f.p.runId,ifMatch:'"r'+r.resourceRevision+'"',integrationOperationId,deliveryOperationId:deliveryInput.operationId,...overrides};};
 return {...f,tester,proof,developers,deliveryInput,integrationOperationId,sourceSnapshot,request,freeze:async(input)=>f.storage.request('freezeReleaseCandidate',input??await request())};
}
