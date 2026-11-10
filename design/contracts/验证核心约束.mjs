// 只验证设计 DDL；不启动应用、不访问网络、不写用户数据库。
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

const schema = readFileSync(new URL('./核心数据模型.sql', import.meta.url), 'utf8');
const now = '2026-11-10T08:00:00.000Z';

function database(t) {
  const db = new DatabaseSync(':memory:');
  db.exec(schema);
  t.after(() => db.close());
  return db;
}

function insert(db, table, row) {
  const keys = Object.keys(row);
  return db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...Object.values(row));
}

function operation(db, id, overrides = {}) {
  insert(db, 'operations', {operation_id:id, principal_id:'user-1', scope_id:'p1', idempotency_key:id,
    request_hash:'hash-'+id, kind:'TEST', status:'ACCEPTED', created_at:now, updated_at:now, ...overrides});
}

function project(db, id = 'p1') {
  insert(db, 'projects', {project_id:id, owner_id:'user-1', name:id, created_at:now});
  insert(db, 'user_tasks', {task_id:'task-'+id, project_id:id, kind:'NEW', base_commit:'sha-base', request_artifact_id:'input-ref', created_at:now});
}

function run(db, id = 'r1', projectId = 'p1', overrides = {}) {
  insert(db, 'runs', {run_id:id, project_id:projectId, task_id:'task-'+projectId, phase:'PREPARING', created_at:now, ...overrides});
}

function revisions(db, runId = 'r1') {
  insert(db, 'requirement_revisions', {run_id:runId, revision:1, content_hash:'reqhash', content_json:'{}', created_at:now});
  insert(db, 'plan_revisions', {run_id:runId, revision:1, requirement_revision:1, content_hash:'planhash', content_json:'{}', created_at:now});
}

function work(db, id = 'w1', role = 'developer', runId = 'r1') {
  insert(db, 'works', {run_id:runId, work_id:id});
  insert(db, 'work_revisions', {run_id:runId, work_id:id, revision:1, role, definition_json:'{}', definition_hash:'whash'});
}

function attempt(db, id = 'a1', workId = 'w1', overrides = {}) {
  operation(db, 'dispatch-'+id);
  insert(db, 'attempts', {attempt_id:id, run_id:'r1', work_id:workId, work_revision:1, role:'developer', attempt_no:1,
    state:'RESERVED', admitted_run_epoch:1, admitted_work_epoch:1, input_manifest_json:'{}', input_fingerprint:'inputhash',
    role_snapshot_json:'{}', dispatch_operation_id:'dispatch-'+id, created_at:now, ...overrides});
}

function fixture(t) {
  const db=database(t); project(db); run(db); revisions(db); work(db); return db;
}

function atomic(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {const value=fn(); db.exec('COMMIT'); return value;}
  catch(error) {db.exec('ROLLBACK'); throw error;}
}

test('DDL 可加载且外键检查通过', t => {
  const db=fixture(t);
  assert.equal(db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table'").get().n,24);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
});

test('已暂停的 run 仍占用项目唯一活动名额', t => {
  const db=fixture(t); db.exec("UPDATE runs SET control_gate='PAUSED' WHERE run_id='r1'");
  assert.throws(()=>run(db,'r2'),/UNIQUE constraint failed: runs.project_id/);
});

test('旧 run 终结后同事务可建立唯一的关联重做', t => {
  const db=fixture(t);
  atomic(db,()=>{db.prepare("UPDATE runs SET terminal_outcome='CANCELLED',ended_at=? WHERE run_id='r1'").run(now); run(db,'r2','p1',{origin_run_id:'r1'});});
  assert.equal(db.prepare("SELECT origin_run_id FROM runs WHERE run_id='r2'").get().origin_run_id,'r1');
  assert.throws(()=>run(db,'r3'),/UNIQUE/);
});

test('重做新建失败回滚旧 run 的终态修改', t => {
  const db=fixture(t);
  assert.throws(()=>atomic(db,()=>{db.prepare("UPDATE runs SET terminal_outcome='CANCELLED',ended_at=? WHERE run_id='r1'").run(now); run(db,'r2','p1',{task_id:'missing'});}),/FOREIGN KEY/);
  assert.equal(db.prepare("SELECT terminal_outcome FROM runs WHERE run_id='r1'").get().terminal_outcome,null);
});

test('项目不能引用另一项目的任务和来源执行', t => {
  const db=fixture(t); project(db,'p2');
  assert.throws(()=>run(db,'r2','p2',{task_id:'task-p1'}),/FOREIGN KEY/);
  assert.throws(()=>run(db,'r2','p2',{origin_run_id:'r1'}),/FOREIGN KEY/);
});

test('未知结果 attempt 阻止同工作重复启动', t => {
  const db=fixture(t); attempt(db,'a1','w1',{state:'OUTCOME_UNKNOWN'});
  assert.throws(()=>attempt(db,'a2','w1',{attempt_no:2}),/UNIQUE constraint failed: attempts.run_id, attempts.work_id/);
});

test('确定终结后允许新 attempt，原尝试不可复活', t => {
  const db=fixture(t); attempt(db);
  db.prepare("UPDATE attempts SET state='INTERRUPTED',ended_at=? WHERE attempt_id='a1'").run(now);
  attempt(db,'a2','w1',{attempt_no:2});
  assert.throws(()=>db.exec("UPDATE attempts SET state='WORKING',ended_at=NULL WHERE attempt_id='a1'"),/TERMINAL_ATTEMPT_IMMUTABLE/);
});

test('attempt 终态必须带结束时间，工作角色不可冒充', t => {
  const db=fixture(t);
  assert.throws(()=>attempt(db,'bad1','w1',{state:'FAILED'}),/CHECK/);
  assert.throws(()=>attempt(db,'bad2','w1',{role:'tester'}),/FOREIGN KEY/);
});

test('同 run 同角色不能同时占两个槽位', t => {
  const db=fixture(t); work(db,'w2'); attempt(db); attempt(db,'a2','w2');
  insert(db,'role_slots',{run_id:'r1',role:'developer',attempt_id:'a1',activation_id:'activation1'});
  assert.throws(()=>insert(db,'role_slots',{run_id:'r1',role:'developer',attempt_id:'a2',activation_id:'activation2'}),/UNIQUE/);
});

test('幂等键按主体和作用域唯一', t => {
  const db=fixture(t); operation(db,'op1',{idempotency_key:'click'});
  assert.throws(()=>operation(db,'op2',{idempotency_key:'click'}),/UNIQUE/);
  operation(db,'op3',{idempotency_key:'click',principal_id:'user-2'});
});

test('业务状态、事件和 Outbox 在失败时一起回滚', t => {
  const db=fixture(t); operation(db,'op1');
  assert.throws(()=>atomic(db,()=>{
    db.exec("UPDATE runs SET control_gate='PAUSING',event_seq=1 WHERE run_id='r1'");
    insert(db,'events',{event_id:'e1',run_id:'r1',seq:1,operation_id:'op1',type:'PauseRequested',schema_version:1,payload_json:'{}',occurred_at:now,observed_at:now,time_source:'observed',resource_revision:1});
    insert(db,'outbox',{outbox_id:'o1',operation_id:'op1',message_no:0,destination:'runner',payload_json:'{}',status:'PENDING',next_attempt_at:now});
    throw new Error('injected-crash-before-commit');
  }),/injected-crash/);
  assert.equal(db.prepare('SELECT count(*) n FROM events').get().n,0);
  assert.equal(db.prepare('SELECT count(*) n FROM outbox').get().n,0);
  assert.equal(db.prepare("SELECT control_gate FROM runs WHERE run_id='r1'").get().control_gate,'OPEN');
});

test('接收端去重冲突回滚新 Task 与待运行记录', t => {
  const db=fixture(t); attempt(db);
  function receive(taskId) {
    atomic(db,()=>{
      insert(db,'a2a_tasks',{endpoint_id:'developer',task_id:taskId,context_id:'ctx1',run_id:'r1',attempt_id:'a1',protocol_state:'submitted',snapshot_json:'{}'});
      insert(db,'accepted_work',{endpoint_id:'developer',task_id:taskId,state:'PENDING'});
      insert(db,'delegation_inbox',{caller_id:'orchestrator',operation_id:'dispatch-a1',request_hash:'fixed',endpoint_id:'developer',task_id:taskId,received_at:now});
    });
  }
  receive('t1'); assert.throws(()=>receive('t2'),/UNIQUE/);
  assert.equal(db.prepare('SELECT count(*) n FROM a2a_tasks').get().n,1);
  assert.equal(db.prepare('SELECT count(*) n FROM accepted_work').get().n,1);
});

test('同模型步骤同 toolCall 不重复创建工具操作', t => {
  const db=fixture(t); attempt(db); operation(db,'tool1'); operation(db,'tool2');
  const row={run_id:'r1',attempt_id:'a1',step_id:'s1',tool_call_id:'call1',endpoint_id:'repo',tool_name:'commit',effect_class:'IDEMPOTENT_WRITE',request_hash:'h',permit_json:'{}'};
  insert(db,'tool_operations',{operation_id:'tool1',...row});
  assert.throws(()=>insert(db,'tool_operations',{operation_id:'tool2',...row}),/UNIQUE/);
});

test('计划边只能引用当前计划成员，并拒绝自环', t => {
  const db=fixture(t);
  insert(db,'plan_works',{run_id:'r1',plan_revision:1,work_id:'w1',work_revision:1});
  assert.throws(()=>insert(db,'plan_edges',{run_id:'r1',plan_revision:1,predecessor:'w1',successor:'missing',required_outcome:'success'}),/FOREIGN KEY/);
  assert.throws(()=>insert(db,'plan_edges',{run_id:'r1',plan_revision:1,predecessor:'w1',successor:'w1',required_outcome:'success'}),/CHECK/);
});

test('相同依据不能保存两个互相矛盾的决定', t => {
  const db=fixture(t); operation(db,'d1'); operation(db,'d2');
  const row={run_id:'r1',subject_id:'conflict1',subject_kind:'CONFLICT',basis_hash:'b1',actor_id:'user-1',created_at:now};
  insert(db,'decisions',{decision_id:'d1',operation_id:'d1',choice_json:'{"option":"A"}',...row});
  assert.throws(()=>insert(db,'decisions',{decision_id:'d2',operation_id:'d2',choice_json:'{"option":"B"}',...row}),/UNIQUE/);
});

test('已发布需求内容不能原地修改', t => {
  const db=fixture(t);
  assert.throws(()=>db.exec("UPDATE requirement_revisions SET content_json='[]' WHERE run_id='r1'"),/REQUIREMENT_REVISION_IMMUTABLE/);
});

test('终态 run 可追加历史序号，但不能重新打开', t => {
  const db=fixture(t); db.prepare("UPDATE runs SET terminal_outcome='FAILED',ended_at=? WHERE run_id='r1'").run(now);
  db.exec("UPDATE runs SET event_seq=event_seq+1 WHERE run_id='r1'");
  assert.throws(()=>db.exec("UPDATE runs SET terminal_outcome=NULL,ended_at=NULL WHERE run_id='r1'"),/TERMINAL_RUN_IMMUTABLE/);
});

test('接受指针只能引用同项目的真实 Release', t => {
  const db=fixture(t); project(db,'p2'); operation(db,'accept1');
  insert(db,'release_candidates',{candidate_id:'c1',project_id:'p1',run_id:'r1',revision:1,code_commit:'sha1',requirement_revision:1,plan_revision:1,manifest_hash:'m1',check_config_hash:'check1',data_plan_hash:'data1',manifest_json:'{}',state:'READY'});
  insert(db,'releases',{release_id:'rel1',project_id:'p1',run_id:'r1',candidate_id:'c1',candidate_revision:1,acceptance_operation_id:'accept1',manifest_hash:'m1',prepared_data_ref:'data-ready',accepted_by:'user-1',accepted_at:now});
  atomic(db,()=>db.exec("UPDATE projects SET accepted_release_id='rel1' WHERE project_id='p1'"));
  assert.throws(()=>atomic(db,()=>db.exec("UPDATE projects SET accepted_release_id='rel1' WHERE project_id='p2'")),/FOREIGN KEY/);
  assert.equal(db.prepare("SELECT accepted_release_id FROM projects WHERE project_id='p2'").get().accepted_release_id,null);
});

test('事件保留发生与观察时间、当时版本，不随当前版本漂移', t => {
  const db=fixture(t);
  const row={event_id:'e1',run_id:'r1',seq:1,type:'AttemptStateChanged',schema_version:1,payload_json:'{}',occurred_at:now,
    observed_at:'2026-11-10T08:00:00.120Z',time_source:'producer',resource_revision:1,requirement_revision:1,plan_revision:1};
  insert(db,'events',row);
  insert(db,'requirement_revisions',{run_id:'r1',revision:2,content_hash:'req2',content_json:'{}',created_at:now});
  insert(db,'plan_revisions',{run_id:'r1',revision:2,requirement_revision:2,content_hash:'plan2',content_json:'{}',created_at:now});
  db.exec("UPDATE runs SET current_requirement_revision=2,current_plan_revision=2 WHERE run_id='r1'");
  const saved=db.prepare("SELECT * FROM events WHERE event_id='e1'").get();
  assert.equal(saved.requirement_revision,1); assert.equal(saved.plan_revision,1);
  assert.equal(saved.occurred_at,now); assert.equal(saved.observed_at,row.observed_at);
  assert.throws(()=>insert(db,'events',{...row,event_id:'e2',seq:2,observed_at:null}),/NOT NULL/);
  assert.throws(()=>insert(db,'events',{...row,event_id:'e2',seq:2,requirement_revision:99}),/FOREIGN KEY/);
});
