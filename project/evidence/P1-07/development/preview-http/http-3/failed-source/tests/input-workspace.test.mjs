import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {inputFixture} from './fixtures/input-data.mjs';
import {requirements,plan,meta} from './fixtures/storage-data.mjs';

test('new tasks require current accepted code, exclusive admission and project CAS; old workspaces stay read only',{timeout:240000},async t=>{
  const f=await inputFixture(t),created=await f.create(),p=created.body.result;
  const body={kind:'ITERATION',title:'下一轮任务',goal:{text:'改进看板',attachmentIds:[]},baseAcceptedReleaseId:'release_seeded',clientDraftId:randomUUID()};
  const createTask=(key=randomUUID(),etag='"r1"',token='test_owner')=>f.call(`/projects/${p.projectId}/tasks`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json','idempotency-key':key,'if-match':etag},body:JSON.stringify(body)});
  const active=await createTask();assert.equal(active.response.status,409);assert.equal(active.body.error.code,'ACTIVE_RUN_EXISTS');
  const draft=plan(),content=await f.content.putJson(meta(),{kind:'content'},draft);
  await f.storage.request('publishPlan',{meta:meta(p.runId),runId:p.runId,ifMatch:'"r1"',requirementRevision:1,planRevision:1,requirements:requirements(),plan:draft,planContentHash:content.expectedHash});
  // Explicit fixture facts for an already accepted release. This test does not
  // exercise or claim the separate human acceptance workflow.
  const time=new Date().toISOString(),hash='a'.repeat(64),commit='c'.repeat(40);
  f.sql("INSERT INTO operations VALUES('op_seeded_accept','user_1',?,'seed',?,'SEED_ACCEPT','SUCCEEDED','{}',?,?)",p.projectId,hash,time,time);
  f.sql("INSERT INTO release_candidates VALUES('candidate_seeded',?,?,1,?,1,1,?,?,?,'{}','READY')",p.projectId,p.runId,commit,hash,hash,hash);
  f.sql("INSERT INTO releases VALUES('release_seeded',?,?,'candidate_seeded',1,'op_seeded_accept',?,'dataset_seeded','user_1',?)",p.projectId,p.runId,hash,time);
  f.sql("UPDATE runs SET terminal_outcome='COMPLETED',ended_at=? WHERE run_id=?",time,p.runId);
  f.sql("UPDATE projects SET accepted_release_id='release_seeded' WHERE project_id=?",p.projectId);
  const key=randomUUID(),[a,b]=await Promise.all([createTask(key),createTask(randomUUID())]);
  const winner=a.response.status===201?a:b,loser=winner===a?b:a;assert.equal(winner.response.status,201,JSON.stringify(winner.body));assert.equal(loser.response.status,412,JSON.stringify(loser.body));
  const next=winner.body.result,task=f.sql('SELECT base_commit FROM user_tasks WHERE task_id=?',next.taskId)[0];assert.equal(task.base_commit,commit);
  const history=await f.call(`/projects/${p.projectId}/workspace?runId=${p.runId}`);assert.equal(history.body.mode,'history');assert.deepEqual(history.body.allowedActions,[]);
  const current=await f.call(`/projects/${p.projectId}/workspace`);assert.equal(current.body.mode,'current');assert.equal(current.body.run.runId,next.runId);assert.deepEqual(current.body.allowedActions,['saveMessage']);
  const other=await f.create({name:'另一项目'}),wrong=await f.call(`/projects/${other.body.result.projectId}/runs/${next.runId}/events`);assert.equal(wrong.response.status,404);
  assert.equal(f.sql('SELECT count(*) AS n FROM runs WHERE project_id=? AND terminal_outcome IS NULL',p.projectId)[0].n,1);
});

test('workspace cursor and messages remain one snapshot under concurrent Worker submissions and pagination',{timeout:240000},async t=>{
  const f=await inputFixture(t),first=await f.create(),p=first.body.result;
  const body={text:'并发补充',attachmentIds:[],clientMessageId:randomUUID()};
  const [snapshot,saved]=await Promise.all([f.call(`/projects/${p.projectId}/workspace`),f.call(`/runs/${p.runId}/messages`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':randomUUID(),'if-match':'"r1"'},body:JSON.stringify(body)})]);
  assert.equal(saved.response.status,202,JSON.stringify(saved.body));assert.equal(snapshot.body.messages.length,snapshot.body.eventCursor);assert.equal(snapshot.body.run.resourceRevision,snapshot.body.eventCursor);
  const events=await f.call(`/projects/${p.projectId}/runs/${p.runId}/events?afterSeq=${snapshot.body.eventCursor}`);assert.equal(events.body.events.length,2-snapshot.body.eventCursor);
  const page=await f.call(`/projects/${p.projectId}/workspace?limit=1`);assert.equal(page.body.messages.length,1);assert.ok(page.body.nextMessageCursor);
  const next=await f.call(`/projects/${p.projectId}/workspace?limit=1&afterMessageId=${page.body.nextMessageCursor}`);assert.equal(next.body.messages[0].text,body.text);assert.equal(next.body.nextMessageCursor,null);
  await f.create({name:'分页另一个项目'});const projects=await f.call('/projects?limit=1');assert.equal(projects.body.projects.length,1);assert.ok(projects.body.nextCursor);
  const projects2=await f.call(`/projects?limit=1&cursor=${projects.body.nextCursor}`);assert.equal(projects2.body.projects.length,1);assert.notEqual(projects2.body.projects[0].projectId,projects.body.projects[0].projectId);
});
