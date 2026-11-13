import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {ReleaseAcceptor,ReleasePublisher} from '../packages/platform-core/dist/index.mjs';
import {successorPublicationFixture} from './fixtures/successor-publication.mjs';
import {canonical} from './fixtures/storage-data.mjs';

const counts=list=>Object.fromEntries([...new Set(list)].sort().map(k=>[k,list.filter(v=>v===k).length]));
const mutationCounts=f=>Object.fromEntries(Object.entries(f.mutations()).map(([k,v])=>[k,counts(v)]));
const gate=(f,id)=>f.control.get('SELECT state FROM preview_write_gates WHERE dataset_id=?',id).state;
const write=(f,key=randomUUID())=>fetch(f.first.origin+'/api/tasks',{method:'POST',headers:{'content-type':'application/json','idempotency-key':key},body:JSON.stringify({title:'After second publication',description:'Only the new accepted dataset',status:'todo'}),signal:AbortSignal.timeout(120000)});
async function assertPublished(f,value){
 const p=f.preparation,q=p.request,j=await f.journal();assert.equal(value.state,'PUBLISHED',JSON.stringify(value));assert.equal(value.proof.route.generation,2);assert.equal(value.proof.route.previousReleaseId,f.sourceReleaseId);assert.equal(value.proof.source.fenceId,f.accepted.ready.proof.sourceFence.physical.fenceId);assert(value.proof.source.generation>f.accepted.ready.proof.sourceFence.physical.generation);
 assert.equal(gate(f,q.source.datasetId),'CLOSED');assert.equal(gate(f,q.target.datasetId),'OPEN');assert.equal(f.control.get('SELECT state FROM datasets WHERE dataset_id=?',q.source.datasetId).state,'RETIRED');assert.equal(f.control.get('SELECT state FROM datasets WHERE dataset_id=?',q.target.datasetId).state,'READY');assert.equal(f.control.get('SELECT count(*) n FROM releases').n,2);assert.equal(f.control.get('SELECT count(*) n FROM acceptance_commits').n,2);assert.equal(f.control.get('SELECT count(*) n FROM release_promotion_outbox').n,2);assert.equal(f.control.get('SELECT count(*) n FROM release_route_bindings').n,1);assert.equal(f.control.get('SELECT generation FROM release_route_bindings').generation,2);assert.equal(f.control.get('SELECT accepted_release_id FROM projects WHERE project_id=?',f.p.projectId).accepted_release_id,p.releaseId);
 assert.equal(j.source.reservation.state,'REMOVED');assert(j.source.reservation.releasedAt);assert.equal((await f.first.store.request('capacityUsage',{})).usage.releaseServiceSlots,1);assert.equal(f.first.driver.containers.has(f.firstJournal.profile.containerName),false);assert.equal(f.first.driver.networks.has(f.firstJournal.profile.networkName),false);assert.equal(f.first.activeRoutes.get(f.p.projectId),p.releaseId);assert.equal(await f.first.routes.inspect(f.firstJournal),null);
 assert.equal(canonical((await f.client.request('getReleasePublication',{principalId:f.principalId,releaseId:f.sourceReleaseId})).proof),f.firstProof);assert.deepEqual(f.first.data.appFor(f.sourcePreparation,true).list().tasks,[f.sourceTask]);assert.deepEqual(mutationCounts(f),{service:{ARM_FENCES:1,CREATE:1,GUARD_ENFORCE:1,NETWORK_CREATE:1,PREPARE:1,ROUTE_BIND:1,SOURCE_CONTAINER_REMOVE:1,SOURCE_NETWORK_REMOVE:1,SOURCE_STOP:1,START:1},readonly:{CONTAINER_REMOVE:1,NETWORK_REMOVE:1,STOP:1},revocation:{REVOKE_PREPARATION:1}});assert.equal(f.first.data.authority.acquisitions,f.acquisitions);assert.deepEqual(f.control.db.prepare('PRAGMA foreign_key_check').all(),[]);
}

test('second publication preserves or explicitly replaces data, retires the original service and writes only to the new dataset',{timeout:300000},async t=>{
 for(const strategy of ['PRESERVE_MIGRATE','REPLACE'])await t.test(strategy,async t=>{
  const f=await successorPublicationFixture(t,{strategy});assert.equal((await f.publication()).state,'PENDING');assert.equal((await write(f)).status,503);assert.equal(gate(f,f.preparation.request.target.datasetId),'CLOSED');
  const receipt=await f.receiptBytes(),published=await f.advance();await assertPublished(f,published);const response=await fetch(f.first.origin+'/api/tasks');assert.equal(response.status,200);assert.deepEqual((await response.json()).tasks,strategy==='PRESERVE_MIGRATE'?[f.sourceTask]:[]);
  const key=randomUUID(),saved=await write(f,key);assert.equal(saved.status,201,await saved.clone().text());assert.equal((await write(f,key)).status,201);assert.equal(f.first.data.appFor(f.preparation,true).list().tasks.length,strategy==='PRESERVE_MIGRATE'?2:1);assert.deepEqual(f.first.data.appFor(f.sourcePreparation,true).list().tasks,[f.sourceTask]);assert.deepEqual(await f.receiptBytes(),receipt);
  const before=mutationCounts(f),proof=canonical(published.proof);await f.reopen();assert.deepEqual(await new ReleaseAcceptor(f.client,f.candidateSource.content).accept(f.accepted.input),f.accepted.receipt);assert.equal((await f.advance()).state,'PUBLISHED');assert.deepEqual(mutationCounts(f),before);assert.equal(canonical((await f.publication()).proof),proof);assert.equal(f.accepted.receipt.result.publicationState,'PENDING');
 });
});

test('source-stage and route acknowledgement loss recover the same successor after both Workers reopen',{timeout:480000},async t=>{
 for(const stage of ['SOURCE_STOP','SOURCE_CONTAINER_REMOVE','SOURCE_NETWORK_REMOVE','ROUTE_BIND'])await t.test(stage,async t=>{
  const f=await successorPublicationFixture(t),receipt=await f.receiptBytes();f.first.faults.failAfter=stage;const unknown=await f.advance();assert.equal(unknown.state,'UNKNOWN',JSON.stringify(unknown));assert.equal(gate(f,f.preparation.request.source.datasetId),'CLOSED');assert.equal(gate(f,f.preparation.request.target.datasetId),'CLOSED');assert.equal(f.control.get('SELECT count(*) n FROM acceptance_commits').n,2);
  const before=mutationCounts(f),j=await f.journal(),id=j.reservation?.reservationId;await f.reopen();await f.makeBackend().inspect(await f.publication());assert.deepEqual(mutationCounts(f),before);const published=await f.advance();await assertPublished(f,published);if(id)assert.equal((await f.journal()).reservation.reservationId,id);assert.deepEqual(await f.receiptBytes(),receipt);assert.equal((await write(f)).status,201);
 });
});

test('a lost successor publication commit ACK recovers the original accepted route without physical work',{timeout:180000},async t=>{
 const f=await successorPublicationFixture(t,{strategy:'REPLACE'}),original=f.client.request;let cut=true;f.client.request=async(m,i)=>{const v=await original(m,i);if(cut&&m==='recordReleasePublicationObservation'&&i.observation.state==='PUBLISHED'){cut=false;throw Error('explicit successor control commit ACK loss');}return v;};await assert.rejects(f.advance(),/explicit successor control commit ACK loss/);await assertPublished(f,await f.publication());const before=mutationCounts(f);await f.reopen();const published=await new ReleasePublisher(f.client,f.principalId).advance(f.preparation.releaseId);assert.equal(published.state,'PUBLISHED');assert.deepEqual(mutationCounts(f),before);assert.equal((await write(f)).status,201);
});

test('successor route commit failure preserves T5 and closed gates, then adopts the original physical proof',{timeout:180000},async t=>{
 const f=await successorPublicationFixture(t);f.control.db.exec("CREATE TRIGGER cut_successor_route BEFORE UPDATE ON release_route_bindings BEGIN SELECT RAISE(ABORT,'explicit-successor-route-cut'); END");await assert.rejects(f.advance(),/explicit-successor-route-cut/);assert.equal((await f.publication()).state,'SENT');assert.equal(f.control.get('SELECT generation FROM release_route_bindings').generation,1);assert.equal(f.control.get('SELECT count(*) n FROM acceptance_commits').n,2);assert.equal(gate(f,f.preparation.request.source.datasetId),'CLOSED');assert.equal(gate(f,f.preparation.request.target.datasetId),'CLOSED');assert.equal((await write(f)).status,503);
 const before=mutationCounts(f),proof=canonical((await f.journal()).proof),receipt=await f.receiptBytes();f.control.db.exec('DROP TRIGGER cut_successor_route');await f.reopen();const published=await f.advance();await assertPublished(f,published);assert.deepEqual(mutationCounts(f),before);assert.equal(canonical(published.proof),proof);assert.deepEqual(await f.receiptBytes(),receipt);assert.equal((await write(f)).status,201);
});
