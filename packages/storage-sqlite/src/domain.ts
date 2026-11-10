import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { assertResourceVersion, domainEvent, executionPermit, parseContract } from '@devmesh/contracts';
import { requests } from './protocol.js';
import type { Meta, Method, Parsed, RunView, AttemptView, OutboxView } from './protocol.js';
import { StorageError } from './errors.js';
import { digest, transaction } from './migrations.js';
import { canonical } from './json.js';
import { createRegistryDomain } from './registry-domain.js';
import { registryRequests } from './registry-protocol.js';
import type { RegistryMethod } from './registry-protocol.js';
import { createRuntimeDomain } from './runtime-domain.js';
import { runtimeRequests } from './runtime-protocol.js';
import type { RuntimeMethod } from './runtime-protocol.js';
import { createSessionDomain } from './session-domain.js';
import { sessionRequests } from './session-protocol.js';
import type { SessionMethod } from './session-protocol.js';
export { canonical } from './json.js';

type Row = Record<string, string | number | null>;
const uid = (prefix: string) => `${prefix}_${randomUUID().replaceAll('-', '')}`;
const now = () => new Date().toISOString();
export function createDomain(db: DatabaseSync) {
  const registry = createRegistryDomain(db);
  const runtime = createRuntimeDomain(db);
  const sessions = createSessionDomain(db);
  const get = (sql: string, ...args: (string | number | null)[]) => db.prepare(sql).get(...args) as Row | undefined;
  const all = (sql: string, ...args: (string | number | null)[]) => db.prepare(sql).all(...args) as Row[];
  const exec = (sql: string, ...args: (string | number | null)[]) => db.prepare(sql).run(...args);
  const insert = (table: string, row: Row) => {
    const keys = Object.keys(row);
    exec(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`, ...Object.values(row));
  };
  const required = (row: Row | undefined): Row => { if (!row) throw new StorageError('RESOURCE_NOT_FOUND', 404, 'Requested storage record does not exist'); return row; };
  const run = (id: string) => required(get('SELECT * FROM runs WHERE run_id=?', id));
  const runView = (row: Row): RunView => ({ runId: String(row.run_id), projectId: String(row.project_id), taskId: String(row.task_id), resourceRevision: Number(row.resource_revision), runEpoch: Number(row.run_epoch), controlRevision: Number(row.control_revision), phase: String(row.phase), controlGate: String(row.control_gate), terminalOutcome: row.terminal_outcome as string | null, currentPlanRevision: row.current_plan_revision as number | null, currentRequirementRevision: row.current_requirement_revision as number | null, eventSeq: Number(row.event_seq) });
  const attemptView = (row: Row): AttemptView => ({ attemptId: String(row.attempt_id), runId: String(row.run_id), workId: String(row.work_id), role: String(row.role), state: String(row.state), attemptNo: Number(row.attempt_no), dispatchOperationId: String(row.dispatch_operation_id), endedAt: row.ended_at as string | null });
  const outboxView = (row: Row): OutboxView => ({ outboxId: String(row.outbox_id), operationId: String(row.operation_id), destination: String(row.destination), payload: JSON.parse(String(row.payload_json)), status: String(row.status), deliveryAttempt: Number(row.delivery_attempts), leaseOwner: row.lease_owner as string | null, leaseUntil: row.lease_until as string | null });
  const operationView = (row: Row) => ({ operationId: String(row.operation_id), status: String(row.status), result: row.result_json === null ? null : JSON.parse(String(row.result_json)) as Record<string, unknown> });
  const lookup = (meta: Meta) => get('SELECT * FROM operations WHERE principal_id=? AND scope_id=? AND idempotency_key=?', meta.principalId, meta.scopeId, meta.idempotencyKey);
  function operation(meta: Meta, kind: string, payload: unknown, action: (operationId: string) => Record<string, unknown>) {
    return transaction(db, () => {
      const requestHash = digest(canonical({ kind, payload }));
      const previous = lookup(meta);
      if (previous) {
        if (previous.request_hash !== requestHash) throw new StorageError('IDEMPOTENCY_KEY_REUSED', 409, 'The original key belongs to a different request');
        return operationView(previous);
      }
      const operationId = uid('op'), time = now();
      insert('operations', { operation_id: operationId, principal_id: meta.principalId, scope_id: meta.scopeId, idempotency_key: meta.idempotencyKey, request_hash: requestHash, kind, status: 'ACCEPTED', result_json: null, created_at: time, updated_at: time });
      const result = action(operationId);
      exec("UPDATE operations SET status='SUCCEEDED',result_json=?,updated_at=? WHERE operation_id=?", canonical(result), now(), operationId);
      return operationView(required(get('SELECT * FROM operations WHERE operation_id=?', operationId)));
    });
  }
  function writable(input: { runId: string; ifMatch?: string | undefined }) {
    const row = run(input.runId);
    assertResourceVersion(input.ifMatch, Number(row.resource_revision));
    if (row.terminal_outcome !== null) throw new StorageError('RUN_TERMINAL', 409, 'Terminal Run cannot change');
    return row;
  }
  const bump = (runId: string) => exec('UPDATE runs SET resource_revision=resource_revision+1 WHERE run_id=?', runId);
  function event(runId: string, operationId: string, type: string, payload: unknown, owner: { workId?: string; attemptId?: string } = {}) {
    exec('UPDATE runs SET event_seq=event_seq+1 WHERE run_id=?', runId);
    const row = run(runId), time = now();
    const data = parseContract(domainEvent, { schemaVersion: 1, eventId: uid('evt'), projectId: row.project_id, runId, seq: row.event_seq, type, occurredAt: time, observedAt: time, timeSource: 'observed', resourceRevision: row.resource_revision, requirementRevision: row.current_requirement_revision, planRevision: row.current_plan_revision, operationId, ...owner, payload });
    insert('events', { event_id: data.eventId, project_id: data.projectId, run_id: runId, work_id: owner.workId ?? null, attempt_id: owner.attemptId ?? null, seq: data.seq, operation_id: operationId, type, schema_version: 1, payload_json: canonical(payload), occurred_at: time, observed_at: time, time_source: 'observed', resource_revision: data.resourceRevision, requirement_revision: data.requirementRevision, plan_revision: data.planRevision });
  }
  function outbox(operationId: string, destination: string, payload: unknown) {
    insert('outbox', { outbox_id: uid('outbox'), operation_id: operationId, message_no: Number(get('SELECT count(*) n FROM outbox WHERE operation_id=?', operationId)?.n ?? 0), destination, payload_json: canonical(payload), status: 'PENDING', delivery_attempts: 0, lease_owner: null, lease_until: null, next_attempt_at: now() });
  }
  function readyContent(hash: string) { return required(get("SELECT * FROM content_objects WHERE content_hash=? AND state='READY'", hash)); }
  function knownEffects(attemptId: string) {
    return !get("SELECT o.operation_id FROM tool_operations t JOIN operations o ON o.operation_id=t.operation_id WHERE t.attempt_id=? AND o.status NOT IN ('SUCCEEDED','FAILED')", attemptId)
      && !get("SELECT j.job_id FROM runner_jobs j JOIN tool_operations t ON t.operation_id=j.operation_id WHERE t.attempt_id=? AND j.state<>'EXITED'", attemptId);
  }
  function evidence(ref: { artifactId: string; sha256: string } | undefined, runId: string) {
    if (!ref || !get("SELECT artifact_id FROM artifacts WHERE artifact_id=? AND run_id=? AND content_hash=? AND state='READY'", ref.artifactId, runId, ref.sha256)) throw new StorageError('RECONCILIATION_EVIDENCE_REQUIRED', 409, 'A persisted evidence artifact belonging to the Run is required');
  }

  const handlers = {
    registerContent(input: Parsed<'registerContent'>) {
      return transaction(db, () => {
        const storageKey = `sha256/${input.contentHash.slice(0,2)}/${input.contentHash}`;
        const previous = get('SELECT * FROM content_objects WHERE content_hash=?', input.contentHash);
        if (previous && (previous.byte_size !== input.byteSize || previous.state !== 'READY')) throw new StorageError('CONTENT_CONFLICT', 409, 'Content size/state differs');
        if (!previous) insert('content_objects', { content_hash: input.contentHash, byte_size: input.byteSize, storage_key: storageKey, mime_type: input.mimeType, state: 'READY', created_at: now() });
        return { contentHash: input.contentHash, storageKey };
      });
    },
    createProjectWithRun(input: Parsed<'createProjectWithRun'>) {
      const { meta, ...payload } = input;
      return operation(meta, 'CreateProjectWithRun', payload, operationId => {
        const content = readyContent(input.contentHash), time = now();
        const projectId = input.projectId ?? uid('prj'), taskId = uid('task'), runId = uid('run'), artifactId = uid('artifact'), messageId = uid('message');
        if (input.projectId) {
          const project = required(get('SELECT * FROM projects WHERE project_id=?', projectId));
          if (project.owner_id !== meta.principalId) throw new StorageError('FORBIDDEN', 403, 'Caller is not the project owner');
        } else insert('projects', { project_id: projectId, owner_id: meta.principalId, name: input.name, revision: 1, accepted_release_id: null, created_at: time });
        insert('user_tasks', { task_id: taskId, project_id: projectId, kind: input.kind, base_commit: input.baseCommit, request_artifact_id: artifactId, created_at: time });
        insert('runs', { run_id: runId, project_id: projectId, task_id: taskId, phase: 'UNDERSTANDING', created_at: time });
        insert('artifacts', { artifact_id: artifactId, project_id: projectId, run_id: runId, attempt_id: null, kind: 'USER_INPUT', content_hash: input.contentHash, byte_size: Number(content.byte_size), storage_key: String(content.storage_key), state: 'READY', created_at: time });
        insert('input_messages', { message_id: messageId, project_id: projectId, run_id: runId, author: meta.principalId, body_artifact_id: artifactId, client_message_id: input.clientMessageId, created_at: time });
        event(runId, operationId, 'InputSaved', { messageId });
        outbox(operationId, 'understanding', { schemaVersion: 1, projectId, runId, messageId });
        return { projectId, taskId, runId, artifactId, messageId, revision: 1 };
      });
    },
    publishPlan(input: Parsed<'publishPlan'>) {
      const { meta, ...payload } = input;
      return operation(meta, 'PublishPlan', payload, operationId => {
        const current = writable(input);
        if (get('SELECT attempt_id FROM attempts WHERE run_id=? AND ended_at IS NULL', input.runId)) throw new StorageError('ACTIVE_ATTEMPT_EXISTS', 409, 'Cannot replace a live execution plan');
        if (input.plan.requirementRevision !== input.requirementRevision || input.planRevision <= Number(current.current_plan_revision ?? 0) || input.requirementRevision <= Number(current.current_requirement_revision ?? 0)) throw new StorageError('PLAN_SUPERSEDED', 409, 'Plan/requirement revisions must advance together');
        const time = now(), requirementHash = digest(canonical(input.requirements)), planHash = digest(canonical(input.plan));
        if (planHash !== input.planContentHash) throw new StorageError('PLAN_CONTENT_MISMATCH', 422, 'Published plan content must match its canonical JSON hash');
        const planContent = readyContent(planHash), planArtifactId = uid('artifact');
        insert('requirement_revisions', { run_id: input.runId, revision: input.requirementRevision, content_hash: requirementHash, content_json: canonical(input.requirements), created_at: time });
        insert('plan_revisions', { run_id: input.runId, revision: input.planRevision, requirement_revision: input.requirementRevision, content_hash: planHash, content_json: canonical(input.plan), created_at: time });
        for (const work of input.plan.works) {
          exec('INSERT OR IGNORE INTO works(run_id,work_id) VALUES(?,?)', input.runId, work.workId);
          const previous = get('SELECT definition_hash FROM work_revisions WHERE run_id=? AND work_id=? AND revision=?', input.runId, work.workId, work.workRevision);
          const hash = digest(canonical(work));
          if (previous && previous.definition_hash !== hash) throw new StorageError('WORK_REVISION_IMMUTABLE', 409, 'Published work definition cannot change');
          if (!previous) insert('work_revisions', { run_id: input.runId, work_id: work.workId, revision: work.workRevision, role: work.role, definition_json: canonical(work), definition_hash: hash });
          insert('plan_works', { run_id: input.runId, plan_revision: input.planRevision, work_id: work.workId, work_revision: work.workRevision });
        }
        for (const work of input.plan.works) for (const dependency of work.dependencies) insert('plan_edges', { run_id: input.runId, plan_revision: input.planRevision, predecessor: dependency.workId, successor: work.workId, required_outcome: dependency.requiredOutcome });
        exec("UPDATE runs SET phase='PLANNING',current_requirement_revision=?,current_plan_revision=? WHERE run_id=?", input.requirementRevision, input.planRevision, input.runId);
        bump(input.runId);
        insert('artifacts', { artifact_id: planArtifactId, project_id: String(current.project_id), run_id: input.runId, attempt_id: null, kind: 'PLAN', content_hash: planHash, byte_size: Number(planContent.byte_size), storage_key: String(planContent.storage_key), state: 'READY', created_at: time });
        event(input.runId, operationId, 'PlanPublished', { planRevision: input.planRevision, planRef: { artifactId: planArtifactId, sha256: planHash } });
        return { runId: input.runId, planRevision: input.planRevision, requirementRevision: input.requirementRevision, reviewHash: planHash, revision: Number(run(input.runId).resource_revision) };
      });
    },
    confirmPlan(input: Parsed<'confirmPlan'>) {
      const { meta, ...payload } = input;
      return operation(meta, 'ConfirmPlan', payload, operationId => {
        const current = writable(input);
        const plan = required(get('SELECT * FROM plan_revisions WHERE run_id=? AND revision=?', input.runId, input.planRevision));
        if (current.current_plan_revision !== input.planRevision || current.current_requirement_revision !== input.requirementRevision || plan.content_hash !== input.reviewHash || plan.requirement_revision !== input.requirementRevision) throw new StorageError('PLAN_SUPERSEDED', 409, 'The reviewed plan is no longer current');
        insert('plan_confirmations', { run_id: input.runId, plan_revision: input.planRevision, requirement_revision: input.requirementRevision, review_hash: input.reviewHash, actor: meta.principalId, operation_id: operationId, created_at: now() });
        const decisionId = uid('decision');
        insert('decisions', { decision_id: decisionId, run_id: input.runId, subject_id: String(input.planRevision), subject_kind: 'PLAN', basis_hash: input.reviewHash, choice_json: '{"confirmed":true}', operation_id: operationId, actor_id: meta.principalId, created_at: now() });
        bump(input.runId);
        event(input.runId, operationId, 'PlanConfirmed', { planRevision: input.planRevision, decisionId });
        outbox(operationId, 'scheduler', { schemaVersion: 1, runId: input.runId, planRevision: input.planRevision });
        return { runId: input.runId, planRevision: input.planRevision, revision: Number(run(input.runId).resource_revision) };
      });
    },
    admitWorks(input: Parsed<'admitWorks'>) {
      const { meta, ...payload } = input;
      return operation(meta, 'AdmitWorks', payload, operationId => {
        const current = writable(input);
        if (current.control_gate !== 'OPEN' || current.run_epoch !== input.runEpoch) throw new StorageError('ADMISSION_CLOSED', 409, 'Run gate or epoch changed');
        if (current.current_plan_revision !== input.planRevision || !get('SELECT run_id FROM plan_confirmations WHERE run_id=? AND plan_revision=?', input.runId, input.planRevision)) throw new StorageError('PLAN_NOT_CONFIRMED', 409, 'Current plan must be explicitly confirmed');
        const attemptIds: string[] = [];
        for (const requested of input.works) {
          const work = required(get('SELECT w.work_epoch,w.blocked_reason,r.role,r.definition_json FROM plan_works p JOIN works w ON w.run_id=p.run_id AND w.work_id=p.work_id JOIN work_revisions r ON r.run_id=p.run_id AND r.work_id=p.work_id AND r.revision=p.work_revision WHERE p.run_id=? AND p.plan_revision=? AND p.work_id=? AND p.work_revision=?', input.runId, input.planRevision, requested.workId, requested.workRevision));
          if (work.work_epoch !== requested.workEpoch || work.blocked_reason !== null || work.role !== requested.roleSnapshot.role) throw new StorageError('WORK_BASIS_CHANGED', 409, 'Work epoch, role or freeze changed');
          if (get('SELECT attempt_id FROM attempts WHERE run_id=? AND work_id=? AND ended_at IS NULL', input.runId, requested.workId)) throw new StorageError('ACTIVE_ATTEMPT_EXISTS', 409, 'Original attempt must be reconciled/ended before retry');
          for (const edge of all('SELECT predecessor,required_outcome FROM plan_edges WHERE run_id=? AND plan_revision=? AND successor=?', input.runId, input.planRevision, requested.workId)) {
            const previous = get('SELECT state FROM attempts WHERE run_id=? AND work_id=? ORDER BY attempt_no DESC LIMIT 1', input.runId, String(edge.predecessor));
            if (!previous || (previous.state !== 'SUCCEEDED' && !(edge.required_outcome === 'completed-with-findings' && previous.state === 'FAILED'))) throw new StorageError('DEPENDENCY_UNSATISFIED', 409, 'Predecessor has no required verified outcome');
          }
          const attemptId = uid('attempt'), activationId = uid('activation'), grantId = uid('grant'), dispatchId = uid('op'), time = now();
          const number = Number(get('SELECT max(attempt_no) n FROM attempts WHERE run_id=? AND work_id=?', input.runId, requested.workId)?.n ?? 0) + 1;
          const fingerprint = digest(canonical(requested.inputManifest));
          if (requested.inputManifest.requirements.length === 0) throw new StorageError('INPUT_MANIFEST_EMPTY', 422, 'Implementation work must reference requirements');
          const requirementData = JSON.parse(String(required(get('SELECT content_json FROM requirement_revisions WHERE run_id=? AND revision=?', input.runId, Number(current.current_requirement_revision))).content_json)) as { requirements: { id: string }[] };
          const hashes = new Map(requirementData.requirements.map(requirement => [requirement.id, digest(canonical(requirement))]));
          if (requested.inputManifest.requirements.some(ref => hashes.get(ref.requirementId) !== ref.sha256)) throw new StorageError('INPUT_BASIS_CHANGED', 409, 'Input requirement fingerprints differ from the current snapshot');
          const definition = JSON.parse(String(work.definition_json)) as { requirementIds: string[] };
          const included = new Set<string>(requested.inputManifest.requirements.map(ref => ref.requirementId));
          if (definition.requirementIds.some(id => !included.has(id))) throw new StorageError('INPUT_REQUIREMENTS_MISSING', 409, 'Input manifest omits requirements assigned to this work');
          insert('operations', { operation_id: dispatchId, principal_id: meta.principalId, scope_id: input.runId, idempotency_key: uid('dispatch'), request_hash: digest(canonical(requested)), kind: 'DISPATCH', status: 'ACCEPTED', result_json: null, created_at: time, updated_at: time });
          insert('attempts', { attempt_id: attemptId, run_id: input.runId, work_id: requested.workId, work_revision: requested.workRevision, role: String(work.role), attempt_no: number, state: 'RESERVED', admitted_run_epoch: input.runEpoch, admitted_work_epoch: requested.workEpoch, input_manifest_json: canonical(requested.inputManifest), input_fingerprint: fingerprint, role_snapshot_json: canonical(requested.roleSnapshot), dispatch_operation_id: dispatchId, created_at: time });
          const snapshotId = uid('role');
          insert('role_snapshots', { snapshot_id: snapshotId, role: String(work.role), revision: requested.roleSnapshot.revision, snapshot_json: canonical(requested.roleSnapshot), content_hash: digest(canonical(requested.roleSnapshot)), created_at: time });
          const permit = parseContract(executionPermit, { schemaVersion: 'devmesh.permit.v1', ownerKind: 'workflowAttempt', runId: input.runId, runEpoch: input.runEpoch, workId: requested.workId, workEpoch: requested.workEpoch, attemptId, grantId, activationId, notBefore: time, expiresAt: new Date(Date.parse(time)+15000).toISOString(), resources: requested.resources });
          insert('execution_grants', { grant_id: grantId, run_id: input.runId, attempt_id: attemptId, activation_id: activationId, permit_json: canonical(permit), status: 'ACTIVE', created_at: time, expires_at: permit.expiresAt });
          insert('role_slots', { run_id: input.runId, role: String(work.role), attempt_id: attemptId, activation_id: activationId });
          const inputManifestId=registry.freezeDispatch(attemptId,String(work.role),requested.endpoint,fingerprint,snapshotId);
          outbox(dispatchId, requested.endpoint.endpointId, { schemaVersion: 'devmesh.dispatch-intent.v1', operationId: dispatchId, runId: input.runId, attemptId, workId: requested.workId, workRevision: requested.workRevision, endpoint: requested.endpoint, roleSnapshotId: snapshotId, permit, inputFingerprint: fingerprint, ...(inputManifestId?{inputManifestId}:{}) });
          bump(input.runId);
          event(input.runId, operationId, 'WorkAdmitted', { workId: requested.workId, attemptId, activationId }, { workId: requested.workId, attemptId });
          attemptIds.push(attemptId);
        }
        exec("UPDATE runs SET phase='EXECUTING' WHERE run_id=?", input.runId);
        return { runId: input.runId, attemptIds, revision: Number(run(input.runId).resource_revision) };
      });
    },
    transitionAttempt(input: Parsed<'transitionAttempt'>) {
      const { meta, ...payload } = input;
      return operation(meta, 'TransitionAttempt', payload, operationId => {
        const attempt = required(get('SELECT * FROM attempts WHERE attempt_id=? AND run_id=?', input.attemptId, input.runId));
        const current = run(input.runId);
        if (attempt.ended_at !== null || current.terminal_outcome !== null || attempt.state !== input.expectedState) throw new StorageError('ATTEMPT_STATE_CONFLICT', 409, 'Attempt ended or expected state changed');
        const transitions: Record<string, string[]> = { RESERVED: ['SUBMITTED','STOPPING','OUTCOME_UNKNOWN','FAILED'], SUBMITTED: ['WORKING','STOPPING','OUTCOME_UNKNOWN','FAILED'], WORKING: ['INPUT_REQUIRED','VERIFYING','STOPPING','OUTCOME_UNKNOWN','FAILED'], INPUT_REQUIRED: ['WORKING','STOPPING','OUTCOME_UNKNOWN'], VERIFYING: ['SUCCEEDED','FAILED','STOPPING','OUTCOME_UNKNOWN'], OUTCOME_UNKNOWN: ['SUBMITTED','WORKING','INPUT_REQUIRED','VERIFYING','STOPPING','FAILED','INTERRUPTED','CANCELLED'], STOPPING: ['INTERRUPTED','CANCELLED','OUTCOME_UNKNOWN'] };
        if (!transitions[String(attempt.state)]?.includes(input.state)) throw new StorageError('ATTEMPT_TRANSITION_INVALID', 409, 'Illegal state transition');
        if (input.state === 'WORKING' && (current.control_gate !== 'OPEN' || current.run_epoch !== attempt.admitted_run_epoch || get('SELECT work_epoch FROM works WHERE run_id=? AND work_id=?', input.runId, String(attempt.work_id))?.work_epoch !== attempt.admitted_work_epoch || !get("SELECT grant_id FROM execution_grants WHERE attempt_id=? AND status='ACTIVE' AND expires_at>?", input.attemptId, now()))) throw new StorageError('ADMISSION_CLOSED', 409, 'Cannot resume work under a revoked or expired grant/epoch');
        const terminal = ['SUCCEEDED','FAILED','INTERRUPTED','CANCELLED'].includes(input.state);
        if (attempt.state === 'OUTCOME_UNKNOWN' || input.state === 'SUCCEEDED') evidence(input.evidenceRef, input.runId);
        if (terminal && !knownEffects(input.attemptId)) throw new StorageError('EFFECT_OUTCOME_UNKNOWN', 409, 'Original tool/job effects must be reconciled');
        exec('UPDATE attempts SET state=?,ended_at=? WHERE attempt_id=?', input.state, terminal ? now() : null, input.attemptId);
        if (terminal) {
          exec('DELETE FROM role_slots WHERE attempt_id=?', input.attemptId);
          exec("UPDATE execution_grants SET status='REVOKED' WHERE attempt_id=?", input.attemptId);
        }
        bump(input.runId);
        event(input.runId, operationId, 'AttemptStateChanged', { attemptId: input.attemptId, state: input.state }, { workId: String(attempt.work_id), attemptId: input.attemptId });
        return { attemptId: input.attemptId, state: input.state, revision: Number(run(input.runId).resource_revision) };
      });
    },
    setControlIntent(input: Parsed<'setControlIntent'>) {
      const { meta, ...payload } = input;
      return operation(meta, 'SetControlIntent', payload, operationId => {
        const current = writable(input);
        if (current.control_gate === 'CANCELLING' && input.action === 'pause') throw new StorageError('CANCEL_INTENT_SAVED', 409, 'Pause cannot overwrite cancellation');
        const gate = input.action === 'cancel' ? 'CANCELLING' : get('SELECT attempt_id FROM attempts WHERE run_id=? AND ended_at IS NULL', input.runId) ? 'PAUSING' : 'PAUSED';
        if (current.control_gate !== gate) exec('UPDATE runs SET control_gate=?,run_epoch=run_epoch+1,control_revision=control_revision+1,resource_revision=resource_revision+1 WHERE run_id=?', gate, input.runId);
        exec("UPDATE execution_grants SET status='REVOKED' WHERE run_id=? AND status='ACTIVE'", input.runId);
        const updated = run(input.runId);
        event(input.runId, operationId, 'ControlProgress', { state: { phase: updated.phase, controlGate: updated.control_gate, terminalOutcome: updated.terminal_outcome }, controlRevision: updated.control_revision, runEpoch: updated.run_epoch });
        outbox(operationId, 'control-stop', { schemaVersion: 1, runId: input.runId, action: input.action });
        return { ...runView(updated) };
      });
    },
    finishRun(input: Parsed<'finishRun'>) {
      const { meta, ...payload } = input;
      return operation(meta, 'FinishRun', payload, operationId => {
        const current = writable(input);
        if (get('SELECT attempt_id FROM attempts WHERE run_id=? AND ended_at IS NULL', input.runId)) throw new StorageError('ACTIVE_ATTEMPT_EXISTS', 409, 'All attempts must be known and ended');
        if (input.outcome === 'CANCELLED' && current.control_gate !== 'CANCELLING') throw new StorageError('CANCEL_INTENT_REQUIRED', 409, 'Cancellation must have a saved control intent');
        exec('UPDATE runs SET terminal_outcome=?,ended_at=?,resource_revision=resource_revision+1 WHERE run_id=?', input.outcome, now(), input.runId);
        const updated = run(input.runId);
        event(input.runId, operationId, 'ControlProgress', { state: { phase: current.phase, controlGate: current.control_gate, terminalOutcome: input.outcome }, controlRevision: current.control_revision, runEpoch: current.run_epoch });
        return { ...runView(updated), reason: input.reason };
      });
    },
    lookupOperation(input: Parsed<'lookupOperation'>) { const row = lookup(input); return row ? operationView(row) : null; },
    getOperation(input: Parsed<'getOperation'>) { return operationView(required(get('SELECT * FROM operations WHERE operation_id=?', input.operationId))); },
    getRun(input: Parsed<'getRun'>) { return runView(run(input.runId)); },
    getAttempt(input: Parsed<'getAttempt'>) { return attemptView(required(get('SELECT * FROM attempts WHERE attempt_id=?', input.attemptId))); },
    listEvents(input: Parsed<'listEvents'>) {
      run(input.runId);
      const events = all('SELECT * FROM events WHERE run_id=? AND seq>? ORDER BY seq LIMIT ?', input.runId, input.afterSeq, input.limit).map(row => parseContract(domainEvent, { schemaVersion: row.schema_version, eventId: row.event_id, projectId: row.project_id, runId: row.run_id, seq: row.seq, type: row.type, occurredAt: row.occurred_at, observedAt: row.observed_at, timeSource: row.time_source, resourceRevision: row.resource_revision, requirementRevision: row.requirement_revision, planRevision: row.plan_revision, operationId: row.operation_id, ...(row.work_id ? { workId: row.work_id } : {}), ...(row.attempt_id ? { attemptId: row.attempt_id } : {}), payload: JSON.parse(String(row.payload_json)) }));
      return { events, nextCursor: events.at(-1)?.seq ?? input.afterSeq };
    },
    claimOutbox(input: Parsed<'claimOutbox'>) {
      return transaction(db, () => {
        const time = now();
        exec("UPDATE outbox SET status='RECONCILE' WHERE status='LEASED' AND lease_until<=?", time);
        const rows = all("SELECT * FROM outbox WHERE status='PENDING' AND next_attempt_at<=? ORDER BY next_attempt_at,outbox_id LIMIT ?", time, input.limit);
        for (const row of rows) exec("UPDATE outbox SET status='LEASED',lease_owner=?,lease_until=?,delivery_attempts=delivery_attempts+1 WHERE outbox_id=?", input.workerId, new Date(Date.now()+input.leaseMs).toISOString(), String(row.outbox_id));
        return rows.map(row => outboxView(required(get('SELECT * FROM outbox WHERE outbox_id=?', String(row.outbox_id)))));
      });
    },
    settleOutbox(input: Parsed<'settleOutbox'>) {
      return transaction(db, () => {
        const row = required(get('SELECT * FROM outbox WHERE outbox_id=?', input.outboxId));
        if (row.lease_owner !== input.workerId || row.delivery_attempts !== input.deliveryAttempt || (row.status !== input.outcome && (row.status !== 'LEASED' || String(row.lease_until) <= now()))) throw new StorageError('OUTBOX_LEASE_CHANGED', 409, 'Lease owner, token or validity changed');
        if (row.status !== input.outcome) exec('UPDATE outbox SET status=? WHERE outbox_id=?', input.outcome, input.outboxId);
        return outboxView(required(get('SELECT * FROM outbox WHERE outbox_id=?', input.outboxId)));
      });
    },
  };
  return { execute(method: Method, input: unknown): unknown {
    if (Object.hasOwn(runtimeRequests, method)) return runtime.execute(method as RuntimeMethod, input);
    if (Object.hasOwn(registryRequests, method)) return registry.execute(method as RegistryMethod, input);
    if (Object.hasOwn(sessionRequests, method)) return sessions.execute(method as SessionMethod, input);
    if (method === 'inspect' || !Object.hasOwn(handlers, method)) throw new StorageError('METHOD_NOT_ALLOWED', 422, 'Unsupported storage command');
    const parsed = parseContract(requests[method], input);
    return (handlers[method as keyof typeof handlers] as (input: unknown) => unknown)(parsed);
  } };
}
