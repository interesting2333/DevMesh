// Control-plane protocol facts are explicitly controlled; this is not physical
// Runner/fencing/HTTP evidence or an end-to-end acceptance test.
import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptanceFixture} from './fixtures/acceptance.mjs';
import {binding,preparedObservation} from './fixtures/acceptance-readiness.mjs';
import {hash,canonical} from './fixtures/storage-data.mjs';
test('control readiness accepts independent ACCEPTANCE service claims and binds reservation, profile, project and review', {timeout:180000},async t=>{
 const f=await acceptanceFixture(t),pending=await f.call('beginAcceptancePreparation',await f.request()),p=(await f.call('markAcceptancePreparationSent',f.bound(pending))).preparation,o=preparedObservation(p),r=p.request,s=o.proof.service;
 const claim={schemaVersion:'devmesh.acceptance-service-claim.v1',purpose:'ACCEPTANCE',operationId:p.operationId,acceptanceRequestHash:p.requestHash,releaseId:r.releaseId,projectId:r.projectId,runId:r.runId,candidateId:r.candidateId,manifestHash:r.manifestHash,reviewHash:r.reviewHash,dataPlanHash:r.dataPlanHash,datasetId:r.target.datasetId,imageDigest:r.image.imageDigest,reservationId:s.reservationId,profileHash:s.profileHash,serviceRequestHash:hash('explicit original service request'),instanceId:s.claim.instanceId};
 const set=(ob,c)=>{ob.proof.service.claim=c;ob.proof.service.claimHash=hash(canonical(c));ob.health.claimHash=ob.proof.service.claimHash;};set(o,claim);
 const record=ob=>f.call('recordAcceptancePreparationObservation',{...binding(f,p),expectedPreparationRevision:p.revision,expectedSequence:0,observation:ob});
 for(const patch of [{projectId:'prj_other'},{runId:'run_other'},{reviewHash:hash('other review')},{dataPlanHash:hash('other data plan')},{reservationId:'acceptance.other.reservation'},{profileHash:hash('other profile')}]){const bad=structuredClone(o);set(bad,{...claim,...patch});await assert.rejects(record(bad),{code:'ACCEPTANCE_SERVICE_PROOF_CHANGED'});assert.equal((await f.call('getAcceptanceReadiness',binding(f,p))).sequence,0);}
 const ready=await record(o);assert.equal(ready.state,'READY');assert.equal(ready.proof.service.claim.purpose,'ACCEPTANCE');await f.reopen();assert.deepEqual(await f.call('getAcceptanceReadiness',binding(f,p)),ready);assert.equal(f.get('SELECT count(*) n FROM releases').n,0);assert.equal((await f.call('getRun',{runId:p.runId})).terminalOutcome,null);
});
