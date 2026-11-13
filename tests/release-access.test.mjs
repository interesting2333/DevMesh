// Actual file-backed control Worker. Publication/physical claims are explicit fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {releaseTargetForPublication,releaseAccessRequestHash} from '../packages/storage-sqlite/dist/index.mjs';
import {committedPublicationFixture,copyPublication,dispatchPublication,publicationRecord,publishedObservation,seedSourcePublication} from './fixtures/release-publication.mjs';
import {hash,canonical} from './fixtures/storage-data.mjs';
const gateway={principalId:'release.gateway.service',gatewayId:'release.gateway',configurationHash:hash('release gateway configuration')};
async function configured(t,base,{publish=true}={}){
 const f=await copyPublication(t,base),q=f.publication.request.preparation;
 await f.call('registerReleaseAccessPolicy',{principalId:'user_1',projectId:q.projectId,policy:{schemaVersion:'devmesh.release-access-policy.v1',gatewayId:gateway.gatewayId,gatewayPrincipalId:gateway.principalId,configurationHash:gateway.configurationHash}});
 let publication=f.publication;if(publish){publication=(await dispatchPublication(f)).publication;publication=await f.call('recordReleasePublicationObservation',publicationRecord(publication,publishedObservation(publication)));}
 const who={...gateway,subjectPrincipalId:'user_1',runId:q.runId,releaseId:q.releaseId},original=r=>({...gateway,accessRequestId:r.accessRequestId,requestHash:r.requestHash});
 const prepare=(method='POST',accessRequestId=randomUUID())=>f.call('prepareReleaseAccessRequest',{...who,accessRequestId,request:{method,path:'/api/tasks',bodySha256:hash(method==='GET'?'':'{}'),headersSha256:hash(canonical({}))}});
 const issue=()=>f.call('issueReleaseTicket',{...who,platformOrigin:'https://control.devmesh.test',releaseOrigin:'https://r-fixture.apps.devmesh-app.test',ticketId:randomUUID(),tokenSha256:hash(randomBytes(32)),expiresAt:new Date(Date.now()+55000).toISOString()});
 return {...f,q,publication,who,original,prepare,issue};
}
test('Release access preserves exact identity, one-send grants, current membership and shared write barriers',{timeout:480000},async t=>{
 const base=await committedPublicationFixture(t);
 await t.test('PENDING is recovering and Preview policies cannot authorize RELEASE',async t=>{
  const f=await configured(t,base,{publish:false});await assert.rejects(f.call('resolveReleaseAccess',f.who),{code:'RELEASE_ACCESS_RECOVERING'});assert.throws(()=>releaseTargetForPublication(f.publication),{code:'RELEASE_ACCESS_RECOVERING'});
  await assert.rejects(f.call('registerReleaseAccessPolicy',{principalId:'other',projectId:f.q.projectId,policy:{schemaVersion:'devmesh.preview-access-policy.v1',gatewayId:'x',gatewayPrincipalId:'x',configurationHash:gateway.configurationHash}}),{code:'SCHEMA_INVALID'});
  await assert.rejects(f.call('resolveReleaseAccess',{...f.who,principalId:'other'}),{code:'FORBIDDEN'});
 });
 await t.test('dispatch grant is unique across concurrency/restart and request hashes bind the gateway/member/gate',async t=>{
  const f=await configured(t,base),b=await f.call('resolveReleaseAccess',f.who);assert.equal(b.target.purpose,'RELEASE');assert.equal(b.canWrite,true);assert.equal(b.gate.fence,1);
  const r=await f.prepare();assert.equal(r.requestHash,releaseAccessRequestHash(r));assert.notEqual(r.requestHash,releaseAccessRequestHash({...r,subjectPrincipalId:'other'}));
  const grants=await Promise.all([f.call('beginReleaseAccessRequest',f.original(r)),f.call('beginReleaseAccessRequest',f.original(r))]);assert.equal(grants.filter(g=>g.dispatch).length,1);await f.reopen();assert.equal((await f.call('beginReleaseAccessRequest',f.original(r))).dispatch,false);
  assert.equal((await f.call('getReleaseWriteGate',{principalId:'user_1',releaseId:f.q.releaseId})).pendingWrites,1);
  const unknown={state:'UNKNOWN',errorCode:'RELEASE_HTTP_OUTCOME_UNKNOWN',checkedAt:new Date().toISOString()};await f.call('recordReleaseAccessObservation',{...f.original(r),observation:unknown});
  assert.equal((await f.call('releaseAccessRequestAuthorized',f.original(r))).allowed,false);assert.equal(f.get('SELECT count(*) n FROM business_pending_writes').n,1);
  await assert.rejects(seedSourcePublication(f),/ACCEPTANCE_WRITES_UNRESOLVED/);assert.equal(f.get('SELECT state FROM preview_write_gates WHERE dataset_id=?',f.q.target.datasetId).state,'OPEN');
  await assert.rejects(f.call('recordReleaseAccessObservation',{...f.original(r),observation:{state:'NOT_SENT',errorCode:'LATE_NOT_SENT',checkedAt:new Date().toISOString()}}),{code:'RELEASE_ACCESS_OBSERVATION_CONFLICT'});
  assert.throws(()=>f.run('DELETE FROM release_access_requests'),/RELEASE_ACCESS_REQUEST_RETAINED/);assert.throws(()=>f.run('UPDATE release_access_requests SET request_hash=?',hash('changed')),/RELEASE_ACCESS_REQUEST_IMMUTABLE/);
  const done=await f.call('recordReleaseAccessObservation',{...f.original(r),observation:{state:'FINISHED',httpStatus:201,responseSha256:hash('response'),checkedAt:new Date().toISOString()}});assert.equal(done.state,'FINISHED');assert.equal(f.get('SELECT count(*) n FROM business_pending_writes').n,0);assert.equal(f.get('SELECT count(*) n FROM release_access_request_events').n,4);
 });
 await t.test('viewer reads only; removal revokes dispatch while private accounting still finishes',async t=>{
  const f=await configured(t,base),r=await f.prepare();await f.call('beginReleaseAccessRequest',f.original(r));f.run("UPDATE project_members SET role='viewer' WHERE principal_id='user_1'");assert.equal((await f.call('resolveReleaseAccess',f.who)).canWrite,false);await assert.rejects(f.prepare(),{code:'FORBIDDEN'});const read=await f.prepare('GET');assert.equal((await f.call('beginReleaseAccessRequest',f.original(read))).dispatch,true);
  f.run("DELETE FROM project_members WHERE principal_id='user_1'");await assert.rejects(f.issue(),{code:'RELEASE_NOT_FOUND'});assert.equal((await f.call('releaseAccessRequestAuthorized',f.original(r))).allowed,false);assert.equal((await f.call('recordReleaseAccessObservation',{...f.original(r),observation:{state:'FINISHED',httpStatus:201,responseSha256:hash('accounted after revocation'),checkedAt:new Date().toISOString()}})).state,'FINISHED');
 });
 await t.test('tickets are single-use, hash-only, audience-bound and recheck current membership',async t=>{
  const f=await configured(t,base),ticket=await f.issue(),tokenHash=f.get('SELECT token_sha256 FROM release_tickets').token_sha256,input={...gateway,platformOrigin:ticket.platformOrigin,releaseOrigin:ticket.releaseOrigin,ticketTokenSha256:tokenHash,sessionId:randomUUID(),sessionTokenSha256:hash(randomBytes(32)),expiresAt:new Date(Date.now()+240000).toISOString()};
  const s=await f.call('exchangeReleaseTicket',input);assert.equal(s.target.purpose,'RELEASE');assert.deepEqual(await f.call('exchangeReleaseTicket',input),s);await assert.rejects(f.call('exchangeReleaseTicket',{...input,sessionId:randomUUID()}),{code:'RELEASE_TICKET_CONSUMED'});await assert.rejects(f.call('authenticatePreviewSession',{...gateway,previewOrigin:ticket.releaseOrigin,tokenSha256:input.sessionTokenSha256}),{code:'PREVIEW_CREDENTIAL_INVALID'});
  const auth={...gateway,releaseOrigin:ticket.releaseOrigin,tokenSha256:input.sessionTokenSha256};assert.equal((await f.call('authenticateReleaseSession',auth)).binding.canWrite,true);f.run("DELETE FROM project_members WHERE principal_id='user_1'");await assert.rejects(f.call('authenticateReleaseSession',auth),{code:'RELEASE_NOT_FOUND'});assert.equal((await f.call('revokeReleaseSession',auth)).state,'REVOKED');
  assert.equal(f.get('SELECT audience FROM release_sessions').audience,'devmesh.release.session.v1');assert.throws(()=>f.run("UPDATE release_sessions SET target_json='{}'"),/RELEASE_SESSION_IMMUTABLE/);assert.equal(f.get('SELECT count(*) n FROM release_credential_events').n,4);
 });
 await t.test('ticket consumption rolls back with session/event failure, and admission expires at its original TTL',async t=>{
  const f=await configured(t,base),ticket=await f.issue(),input={...gateway,platformOrigin:ticket.platformOrigin,releaseOrigin:ticket.releaseOrigin,ticketTokenSha256:f.get('SELECT token_sha256 FROM release_tickets').token_sha256,sessionId:randomUUID(),sessionTokenSha256:hash(randomBytes(32)),expiresAt:new Date(Date.now()+240000).toISOString()};
  f.db.exec("CREATE TRIGGER explicit_credential_cut BEFORE INSERT ON release_credential_events WHEN NEW.kind='session' BEGIN SELECT RAISE(ABORT,'EXPLICIT_CREDENTIAL_CUT'); END");await assert.rejects(f.call('exchangeReleaseTicket',input),/EXPLICIT_CREDENTIAL_CUT/);assert.equal(f.get('SELECT state FROM release_tickets').state,'ISSUED');assert.equal(f.get('SELECT count(*) n FROM release_sessions').n,0);assert.equal(f.get('SELECT count(*) n FROM release_credential_events').n,1);f.db.exec('DROP TRIGGER explicit_credential_cut');await f.call('exchangeReleaseTicket',input);
  await assert.rejects(f.call('issueReleaseTicket',{...f.who,platformOrigin:ticket.platformOrigin,releaseOrigin:ticket.releaseOrigin,ticketId:randomUUID(),tokenSha256:hash(randomBytes(32)),expiresAt:new Date(Date.now()+61000).toISOString()}),{code:'RELEASE_CREDENTIAL_EXPIRY_INVALID'});
 });
 await t.test('old sessions and prepared requests cannot follow the next accepted pointer',async t=>{
  const f=await configured(t,base),r=await f.prepare('GET');
  // The successor fixture creates real immutable metadata, not a second formal T5 run.
  await seedSourcePublication(f);await assert.rejects(f.call('beginReleaseAccessRequest',f.original(r)),{code:'RELEASE_ACCESS_RECOVERING'});assert.equal(f.get('SELECT count(*) n FROM business_pending_writes').n,0);
 });
});
