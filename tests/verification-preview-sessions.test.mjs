import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {previewAccessFixture,emptyBody} from './fixtures/preview-access.mjs';
import {hash} from './fixtures/storage-data.mjs';
const platformOrigin='https://control.devmesh.test',previewOrigin='https://p-original.apps.devmesh-app.test';
const expires=ms=>new Date(Date.now()+ms).toISOString();
async function ready(t,options){const f=await previewAccessFixture(t,options);await f.register();await f.enroll();return f;}
function ticket(f,change={}){const raw='dmp_ticket.'+randomBytes(32).toString('base64url');return {raw,input:{...f.gateway,...f.target,ticketId:randomUUID(),tokenSha256:hash(raw),platformOrigin,previewOrigin,expiresAt:expires(60000),...change}};}
const issue=(f,ticket)=>f.call('issuePreviewTicket',ticket.input);
function exchange(f,ticket,change={}){const raw='dmp_session.'+randomBytes(32).toString('base64url');return {raw,input:{...f.gateway,ticketTokenSha256:ticket.input.tokenSha256,sessionId:randomUUID(),sessionTokenSha256:hash(raw),platformOrigin,previewOrigin,expiresAt:expires(300000),...change}};}
const consume=(f,exchange)=>f.call('exchangePreviewTicket',exchange.input);
const auth=(f,exchange,change={})=>f.call('authenticatePreviewSession',{...f.gateway,previewOrigin,tokenSha256:exchange.input.sessionTokenSha256,...change});
const revoke=(f,exchange,change={})=>f.call('revokePreviewSession',{...f.gateway,previewOrigin,tokenSha256:exchange.input.sessionTokenSha256,...change});
const rows=(f,sql,...args)=>{const db=new DatabaseSync(join(f.root,'access.sqlite'),{readOnly:true});try{return db.prepare(sql).all(...args);}finally{db.close();}};
test('private ticket issuance requires configured gateway, current member, separate host and bounded original preview lifetime',async t=>{
 const f=await ready(t),a=ticket(f);await issue(f,a);assert.equal(f.get('SELECT state FROM preview_tickets').state,'ISSUED');assert.equal(f.get('SELECT audience FROM preview_tickets').audience,'devmesh.preview.ticket.v1');
 for(const change of [{principalId:'user_1'},{configurationHash:hash('wrong')},{subjectPrincipalId:'missing.member'},{runId:'run_other'},{previewOrigin:platformOrigin},{previewOrigin:'https://control.devmesh.test:4434'},{previewOrigin:previewOrigin+'/path'},{expiresAt:expires(120000)},{expiresAt:expires(-1)}])await assert.rejects(issue(f,ticket(f,change)));
 assert.equal(f.get('SELECT count(*) n FROM preview_tickets').n,1);assert.deepEqual(await issue(f,a),await issue(f,a));assert.equal(f.get('SELECT count(*) n FROM preview_credential_events').n,1);
});
test('one ticket creates exactly one session under real Worker concurrent exchange, and a replay cannot select a second session',async t=>{
 const f=await ready(t,{worker:true}),a=ticket(f);await issue(f,a);const one=exchange(f,a),two=exchange(f,a),results=await Promise.allSettled([consume(f,one),consume(f,two)]);assert.equal(results[0].status,'fulfilled');assert.equal(results[1].status,'rejected');assert.equal(results[1].reason.code,'PREVIEW_TICKET_CONSUMED');assert.equal((await auth(f,one)).session.sessionId,one.input.sessionId);assert.equal(rows(f,'SELECT count(*) n FROM preview_sessions')[0].n,1);assert.equal(rows(f,'SELECT count(*) n FROM preview_credential_events')[0].n,3);
 await assert.rejects(auth(f,one,{tokenSha256:a.input.tokenSha256}),{code:'PREVIEW_CREDENTIAL_INVALID'});await assert.rejects(auth(f,two),{code:'PREVIEW_CREDENTIAL_INVALID'});assert.deepEqual(rows(f,'PRAGMA foreign_key_check'),[]);
});
test('lost committed exchange ACK and real Worker termination recover only the original session, never minting a replacement',async t=>{
 const f=await ready(t,{worker:true}),a=ticket(f);await issue(f,a);const s=exchange(f,a),call=f.call;let lost=true;f.call=async(method,input)=>{const result=await call(method,input);if(method==='exchangePreviewTicket'&&lost){lost=false;throw Error('explicit committed exchange ACK loss');}return result;};await assert.rejects(consume(f,s),/committed exchange ACK loss/);await f.restart({terminate:true});await f.runtime(f.p);const restored=await consume(f,s);assert.equal(restored.sessionId,s.input.sessionId);assert.equal((await auth(f,s)).session.sessionId,restored.sessionId);await assert.rejects(consume(f,exchange(f,a)),{code:'PREVIEW_TICKET_CONSUMED'});assert.equal(rows(f,'SELECT count(*) n FROM preview_sessions')[0].n,1);
});
test('session purpose, origin, gateway, membership and revocation are checked at every use without returning tokens',async t=>{
 const f=await ready(t),a=ticket(f);await issue(f,a);const s=exchange(f,a);await consume(f,s);const valid=await auth(f,s);assert.equal(valid.session.subjectPrincipalId,'user_1');assert.equal(valid.binding.canWrite,true);assert.equal(valid.session.target.instanceId,f.p.instanceId);
 for(const change of [{tokenSha256:a.input.tokenSha256},{previewOrigin:platformOrigin},{previewOrigin:'https://p-other.apps.devmesh-app.test'},{gatewayId:'other.gateway'},{principalId:'user_1'},{configurationHash:hash('wrong')}])await assert.rejects(auth(f,s,change),{code:'PREVIEW_CREDENTIAL_INVALID'});
 f.run('DELETE FROM project_members WHERE project_id=? AND principal_id=?',f.p.projectId,'user_1');await assert.rejects(auth(f,s),{code:'PREVIEW_NOT_FOUND'});f.run('INSERT INTO project_members VALUES(?,?,?,?)',f.p.projectId,'user_1','owner',new Date().toISOString());const revoked=await revoke(f,s);assert.equal(revoked.state,'REVOKED');assert.deepEqual(await revoke(f,s),revoked);await assert.rejects(auth(f,s),{code:'PREVIEW_SESSION_REVOKED'});await assert.rejects(consume(f,s),{code:'PREVIEW_SESSION_REVOKED'});
 const saved=JSON.stringify(f.db.prepare('SELECT * FROM preview_tickets').all())+JSON.stringify(f.db.prepare('SELECT * FROM preview_sessions').all())+JSON.stringify(f.db.prepare('SELECT * FROM preview_credential_events').all());assert.equal(saved.includes(a.raw),false);assert.equal(saved.includes(s.raw),false);assert.equal(JSON.stringify(valid).includes(s.input.sessionTokenSha256),false);
});
test('ticket and session expiry cannot be extended by replay, and a future credential after clock rollback is unavailable',async t=>{
 const f=await ready(t),a=ticket(f);await issue(f,a);const s=exchange(f,a);await consume(f,s);const time=Date.now();t.mock.timers.enable({apis:['Date'],now:time-60000});await assert.rejects(auth(f,s),{code:'PREVIEW_CREDENTIAL_EXPIRED'});t.mock.timers.setTime(time+60001);await assert.rejects(consume(f,s),{code:'PREVIEW_CREDENTIAL_EXPIRED'});t.mock.timers.setTime(time+300001);await assert.rejects(auth(f,s),{code:'PREVIEW_CREDENTIAL_EXPIRED'});assert.equal(f.get('SELECT count(*) n FROM preview_sessions').n,1);
});
test('wrong origins, invalid session lifetimes, stale health and removed membership cannot consume a ticket',async t=>{
 const f=await ready(t),a=ticket(f);await issue(f,a);for(const change of [{platformOrigin:'https://evil.test'},{previewOrigin:'https://p-other.apps.devmesh-app.test'},{expiresAt:expires(600000)},{expiresAt:expires(-1)},{sessionTokenSha256:a.input.tokenSha256}])await assert.rejects(consume(f,exchange(f,a,change)));
 await f.runtime(f.p,{state:'UNHEALTHY'});await assert.rejects(consume(f,exchange(f,a)),{code:'PREVIEW_UNAVAILABLE'});await f.runtime(f.p);f.run('DELETE FROM project_members WHERE principal_id=?','user_1');await assert.rejects(consume(f,exchange(f,a)),{code:'PREVIEW_NOT_FOUND'});assert.equal(f.get('SELECT state FROM preview_tickets').state,'ISSUED');assert.equal(f.get('SELECT count(*) n FROM preview_sessions').n,0);
});
test('consumption, session creation and immutable history roll back together; revocation failure leaves the original session active',async t=>{
 const f=await ready(t),a=ticket(f);await issue(f,a);const s=exchange(f,a);f.db.exec("CREATE TRIGGER cut_session BEFORE INSERT ON preview_credential_events WHEN NEW.kind='session' BEGIN SELECT RAISE(ABORT,'session-cut'); END");await assert.rejects(consume(f,s),/session-cut/);assert.equal(f.get('SELECT state FROM preview_tickets').state,'ISSUED');assert.equal(f.get('SELECT count(*) n FROM preview_sessions').n,0);assert.equal(f.get('SELECT count(*) n FROM preview_credential_events').n,1);f.db.exec('DROP TRIGGER cut_session');await consume(f,s);
 f.db.exec("CREATE TRIGGER cut_revoke BEFORE INSERT ON preview_credential_events WHEN NEW.kind='session' AND NEW.revision=1 BEGIN SELECT RAISE(ABORT,'revoke-cut'); END");await assert.rejects(revoke(f,s),/revoke-cut/);assert.equal((await auth(f,s)).session.state,'ACTIVE');f.db.exec('DROP TRIGGER cut_revoke');await revoke(f,s);
 assert.throws(()=>f.run('DELETE FROM preview_tickets'),/PREVIEW_TICKET_RETAINED/);assert.throws(()=>f.run("UPDATE preview_sessions SET state='ACTIVE'"),/PREVIEW_SESSION_IMMUTABLE/);assert.throws(()=>f.run("UPDATE preview_credential_events SET snapshot_json='{}'"),/PREVIEW_CREDENTIAL_EVENT_IMMUTABLE/);assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(),[]);
});
test('closing a dataset gate leaves read session authorization available, and logout never removes an uncertain write',async t=>{
 const f=await ready(t),a=ticket(f);await issue(f,a);const s=exchange(f,a);await consume(f,s);const r=await f.prepare();await f.call('beginPreviewAccessRequest',f.original(r));await f.close(f.closeRequest());const value=await auth(f,s);assert.equal(value.binding.canWrite,false);await f.prepare({method:'GET',path:'/api/tasks',bodySha256:emptyBody});await assert.rejects(f.prepare(),{code:'PREVIEW_WRITE_GATE_CLOSED'});await revoke(f,s);assert.equal((await f.call('getPreviewWriteGate',f.data)).pendingWrites,1);assert.equal(f.get('SELECT state FROM datasets').state,'READY');assert.equal(f.get('SELECT count(*) n FROM releases').n,0);
});
test('live credential capacity is bounded per original project and member',async t=>{
 const f=await ready(t),tickets=[];for(let i=0;i<20;i++){const a=ticket(f);await issue(f,a);tickets.push(a);}await assert.rejects(issue(f,ticket(f)),{code:'PREVIEW_TICKET_CAPACITY'});const sessions=[];for(const a of tickets){const s=exchange(f,a);await consume(f,s);sessions.push(s);}const next=ticket(f);await issue(f,next);await assert.rejects(consume(f,exchange(f,next)),{code:'PREVIEW_SESSION_CAPACITY'});await revoke(f,sessions[0]);await consume(f,exchange(f,next));assert.equal(f.get("SELECT count(*) n FROM preview_sessions WHERE state='ACTIVE'").n,20);
});
