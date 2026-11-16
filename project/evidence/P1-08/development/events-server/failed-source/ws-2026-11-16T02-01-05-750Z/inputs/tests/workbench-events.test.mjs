import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setImmediate as turn} from 'node:timers/promises';
import {eventFixture} from './fixtures/workbench-events.mjs';
const options={timeout:120000};
const domain=peer=>peer.frames.filter(f=>f.kind==='domain-event').map(f=>f.event);
const windowArgs=scope=>({principalId:'user_1',projectId:scope.projectId,runId:scope.runId,afterSeq:0,limit:200});
async function append(f,scope,text){const result=await f.append(scope,text);assert.equal(result.response.status,202,JSON.stringify(result.body));return result.body;}

test('actual host replays the snapshot-subscription gap and streams committed events once in exact sequence',options,async t=>{
 const f=await eventFixture(t),scope=await f.create(),snapshot=await f.workspace(scope);
 await append(f,scope,'快照与连接之间');const second=await f.workspace(scope),peer=f.open(scope,snapshot.eventCursor);
 await peer.frame('caught-up',v=>v.throughSeq===second.eventCursor);
 assert.equal(peer.frames[0].kind,'subscribed');assert.equal(peer.frames[0].afterSeq,snapshot.eventCursor);
 await append(f,scope,'连接之后');const current=await f.workspace(scope);await peer.frame('caught-up',v=>v.throughSeq===current.eventCursor);
 const expected=await f.storage.request('getInputEventWindow',{...windowArgs(scope),afterSeq:snapshot.eventCursor});
 assert.deepEqual(domain(peer),expected.events);assert.deepEqual(domain(peer).map(v=>v.seq),Array.from({length:current.eventCursor-snapshot.eventCursor},(_,i)=>snapshot.eventCursor+i+1));
 const before=(await f.storage.request('inspect',{})).counts;peer.socket.send(JSON.stringify({command:'createProject'}));assert.equal((await peer.frame('resync-required')).reason,'PROTOCOL_INVALID');assert.equal((await peer.closed()).code,1008);assert.deepEqual((await f.storage.request('inspect',{})).counts,before);
});

test('subscribe-before-replay retains actual commits arriving after a held history read',options,async t=>{
 const f=await eventFixture(t),scope=await f.create(),snapshot=await f.workspace(scope),gate=f.gateWindow(),peer=f.open(scope,snapshot.eventCursor);
 await gate.reached;await append(f,scope,'历史读取中一');await append(f,scope,'历史读取中二');const current=await f.workspace(scope);gate.release();
 await peer.frame('caught-up',v=>v.throughSeq===current.eventCursor);const expected=await f.storage.request('getInputEventWindow',{...windowArgs(scope),afterSeq:snapshot.eventCursor});assert.deepEqual(domain(peer),expected.events);assert.equal(new Set(domain(peer).map(v=>v.eventId)).size,domain(peer).length);
});

test('upgrades require exact host/origin/trusted identity and authorized project/Run; query cannot carry credentials',options,async t=>{
 const f=await eventFixture(t),scope=await f.create(),other=await f.create(),before=(await f.storage.request('inspect',{})).counts;
 for(const [headers,status] of [[{origin:undefined},403],[{origin:'http://other.invalid'},403],[{authorization:undefined},401],[{authorization:'Bearer other'},401],[{host:'localhost'},403],[{cookie:'session=x'},401],[{'x-devmesh-principal':'user_2'},403],[{'sec-fetch-site':'cross-site'},403],[{'sec-websocket-protocol':'unknown'},422]])assert.equal(await f.refusal(scope,{headers}),status,JSON.stringify(headers));
 assert.equal(await f.refusal({...scope,runId:other.runId}),404);
 for(const suffix of ['&afterSeq=0','&token=secret','&unknown=1'])assert.equal(await f.refusal(scope,{target:f.url(scope)+suffix}),422);
 assert.equal(await f.refusal(scope,{afterSeq:-1}),422);assert.equal(await f.refusal(scope,{target:f.url(scope).replace('principalId=user_1','principalId=user_2')}),403);
 assert.equal((await fetch(f.origin+'/events',{headers:{authorization:'Bearer events-owner'}})).status,404);
 assert.deepEqual((await f.storage.request('inspect',{})).counts,before);
});

test('idle subscription reauthorizes actual membership and changed trusted identity',options,async t=>{
 const f=await eventFixture(t,{limits:{reauthorizeMs:50}}),scope=await f.create(),snapshot=await f.workspace(scope),peer=f.open(scope,snapshot.eventCursor);
 await peer.frame('caught-up');f.sql('DELETE FROM project_members WHERE project_id=? AND principal_id=?',scope.projectId,'user_1');await peer.frame('authorization-lost');assert.equal((await peer.closed()).code,1008);assert.equal(domain(peer).length,0);
 const next=await f.create(),view=await f.workspace(next),second=f.open(next,view.eventCursor);await second.frame('caught-up');f.state.principalId='user_2';await second.frame('authorization-lost');assert.equal((await second.closed()).code,1008);assert.equal(domain(second).length,0);
});

test('membership lost while replay is pending prevents facts from the previously authorized read',options,async t=>{
 const f=await eventFixture(t),scope=await f.create(),gate=f.gateWindow(),peer=f.open(scope,0);
 const read=await gate.reached;assert(read.events.length>0);f.sql('DELETE FROM project_members WHERE project_id=? AND principal_id=?',scope.projectId,'user_1');gate.release();await peer.frame('authorization-lost');assert.equal((await peer.closed()).code,1008);assert.equal(domain(peer).length,0);
});

test('future cursor, retained gap and missing entire history explicitly require resnapshot',options,async t=>{
 const f=await eventFixture(t),scope=await f.create();await append(f,scope,'第二条');await append(f,scope,'第三条');const snapshot=await f.workspace(scope);
 const ahead=f.open(scope,snapshot.eventCursor+1);assert.equal((await ahead.frame('resync-required')).reason,'CURSOR_AHEAD');await ahead.closed();assert.equal(domain(ahead).length,0);
 const existing=await f.storage.request('getInputEventWindow',windowArgs(scope));assert(existing.events.length>=3);const missing=existing.events[1].seq;f.sql('DELETE FROM events WHERE run_id=? AND seq=?',scope.runId,missing);
 const gap=f.open(scope,0);assert.equal((await gap.frame('resync-required')).reason,'RETAINED_GAP');await gap.closed();assert(!domain(gap).some(v=>v.seq>missing));assert(!gap.frames.some(v=>v.kind==='caught-up'));
 f.sql('DELETE FROM events WHERE run_id=?',scope.runId);const empty=f.open(scope,0);assert.equal((await empty.frame('resync-required')).reason,'RETAINED_GAP');await empty.closed();assert.equal(domain(empty).length,0);
});

test('bounded replay buffer and initial catchup limits close explicitly instead of reporting complete',options,async t=>{
 const f=await eventFixture(t,{limits:{maximumPendingWakeups:1}}),scope=await f.create(),view=await f.workspace(scope),gate=f.gateWindow(),peer=f.open(scope,view.eventCursor);
 await gate.reached;await append(f,scope,'缓冲一');await append(f,scope,'缓冲二');assert.equal((await peer.frame('resync-required')).reason,'BUFFER_OVERFLOW');await peer.closed();gate.restore();assert.equal(domain(peer).length,0);
 const bounded=await eventFixture(t,{limits:{pageSize:1,maximumCatchupEvents:1}}),second=await bounded.create();await append(bounded,second,'超过补发限额');const history=bounded.open(second,0);assert.equal((await history.frame('resync-required')).reason,'CATCHUP_LIMIT');await history.closed();assert.equal(domain(history).length,1);assert(!history.frames.some(v=>v.kind==='caught-up'));
});

test('actual transport write backpressure closes within its deadline and reconnect replays the durable event',options,async t=>{
 const f=await eventFixture(t,{limits:{sendTimeoutMs:50,closeTimeoutMs:50}}),scope=await f.create(),view=await f.workspace(scope),peer=f.open(scope,view.eventCursor);await peer.frame('caught-up');
 // Fault injection holds the actual server TCP write callbacks; no WebSocket/send mock.
 const transport=f.state.upgradeSockets.at(-1);transport.cork();t.after(()=>{if(!transport.destroyed)transport.uncork();});
 const start=performance.now();await append(f,scope,'背压期间的持久输入');assert.equal((await peer.closed()).code,1006);assert(performance.now()-start<5000);assert.equal(domain(peer).length,0);
 const current=await f.workspace(scope),reconnected=f.open(scope,view.eventCursor);await reconnected.frame('caught-up',v=>v.throughSeq===current.eventCursor);assert.deepEqual(domain(reconnected),(await f.storage.request('getInputEventWindow',{...windowArgs(scope),afterSeq:view.eventCursor})).events);
});

test('host stop aborts pending authentication, drains upgraded peers and releases the writer lock',options,async t=>{
 const f=await eventFixture(t,{shutdownTimeoutMs:100}),scope=await f.create(),view=await f.workspace(scope),peer=f.open(scope,view.eventCursor);await peer.frame('caught-up');
 const entered=Promise.withResolvers(),aborted=Promise.withResolvers();f.state.resolver=(_request,{signal})=>{entered.resolve();signal.addEventListener('abort',()=>aborted.resolve(),{once:true});return new Promise(()=>{});};
 const pending=f.refusal(scope);await entered.promise;const start=performance.now();await f.platform.stop();await aborted.promise;assert.equal(await pending,503);await peer.frame('service-stopping');assert.equal((await peer.closed()).code,1001);assert(performance.now()-start<5000);
 f.state.resolver=undefined;await f.reopen();assert.equal((await f.workspace(scope)).eventCursor,view.eventCursor);const again=f.open(scope,view.eventCursor);await again.frame('caught-up');
});

test('Worker commit notifications contain no facts, skip pure reads/rolled-back input, and unsubscribe',options,async t=>{
 const f=await eventFixture(t),scope=await f.create();await turn();let hints=0;const args=[],off=f.storage.subscribeEventCommits((...values)=>{hints++;args.push(values);});t.after(off);
 const before=await f.storage.request('getInputEventWindow',windowArgs(scope));await turn();assert.equal(hints,0);assert(before.headSeq>0);assert.equal(before.retainedFromSeq,1);assert.equal(before.nextCursor,before.headSeq);
 const stale=await f.append(scope,'不应提交',{headers:{'if-match':'"r99999"'}});assert.equal(stale.response.status,412);await f.storage.request('inspect',{});await turn();assert.equal(hints,0);
 await append(f,scope,'应提交');await f.storage.request('inspect',{});await turn();assert.equal(hints,1);assert.deepEqual(args,[[]]);const current=await f.storage.request('getInputEventWindow',windowArgs(scope));assert(current.headSeq>before.headSeq);assert.deepEqual(await f.storage.request('listInputEvents',windowArgs(scope)),{events:current.events,nextCursor:current.nextCursor});
 off();await append(f,scope,'取消订阅后');await f.storage.request('inspect',{});await turn();assert.equal(hints,1);await assert.rejects(f.storage.request('getInputEventWindow',{...windowArgs(scope),principalId:'user_2'}),{status:404});
 const beforeFacts=(await f.storage.request('inspect',{})).counts;await assert.rejects(f.storage.request('appendInputMessage',{meta:{principalId:'user_1',scopeId:scope.runId,idempotencyKey:randomUUID()},runId:scope.runId,ifMatch:'"r99999"',bodyHash:'0'.repeat(64),body:{text:'回滚',attachmentIds:[],clientMessageId:randomUUID(),intentHint:'unsure'}}));assert.deepEqual((await f.storage.request('inspect',{})).counts,beforeFacts);
});
