import { randomUUID } from 'node:crypto';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { parseContract } from '@devmesh/contracts';
import { StorageError } from './errors.js';
import { canonical } from './json.js';
import { digest, transaction } from './migrations.js';
import { sessionRequests } from './session-protocol.js';
import type { SessionMethod, SessionInput, ObjectWrite, ObjectTarget, SessionInfo, SessionMessage, ContentInfo, ModelStep, ContentReference } from './session-protocol.js';

type Row = Record<string, string | number | null>;
const uid = (prefix: string) => `${prefix}_${randomUUID().replaceAll('-', '')}`;
const now = () => new Date().toISOString();
const reject = (code: string, message: string, status = 409): never => { throw new StorageError(code, status, message); };

export function createSessionDomain(db: DatabaseSync) {
  const get = (sql: string, ...args: SQLInputValue[]) => db.prepare(sql).get(...args) as Row | undefined;
  const all = (sql: string, ...args: SQLInputValue[]) => db.prepare(sql).all(...args) as Row[];
  const exec = (sql: string, ...args: SQLInputValue[]) => db.prepare(sql).run(...args);
  const required = (row: Row | undefined): Row => row ?? reject('RESOURCE_NOT_FOUND', 'Requested storage record does not exist', 404);
  const session = (principalId: string, sessionId: string) => {
    const row = required(get('SELECT s.*,p.owner_id FROM agent_sessions s JOIN runs r ON r.run_id=s.run_id JOIN projects p ON p.project_id=r.project_id WHERE s.session_id=?', sessionId));
    if (row.owner_id !== principalId) reject('FORBIDDEN', 'Session belongs to another principal', 403);
    return row;
  };
  const sessionView = (r: Row): SessionInfo => ({ sessionId: String(r.session_id), runId: String(r.run_id), attemptId: String(r.attempt_id), roleSnapshotId: String(r.role_snapshot_id), lastMessageSeq: Number(r.last_message_seq), lastStepNo: Number(r.last_step_no), status: String(r.status) });
  const contentView = (r: Row): ContentInfo => ({ contentHash: String(r.content_hash), byteSize: Number(r.byte_size), storageKey: String(r.storage_key), mimeType: String(r.mime_type), state: String(r.state) });
  const messageView = (r: Row): SessionMessage => ({ messageId: String(r.message_id), seq: Number(r.message_seq), sessionId: String(r.session_id), activationId: String(r.activation_id), stepNo: r.step_no as number | null, kind: String(r.kind), contentHash: String(r.body_content_hash), toolCallId: r.tool_call_id as string | null, sourceRef: r.source_ref ? JSON.parse(String(r.source_ref)) : null, createdAt: String(r.created_at) });
  const stepView = (r: Row): ModelStep => ({ sessionId: String(r.session_id), stepNo: Number(r.step_no), state: String(r.state), requestHash: String(r.request_content_hash), responseHash: r.response_content_hash as string | null, contextSnapshotId: String(r.context_snapshot_id), usage: r.usage_json ? JSON.parse(String(r.usage_json)) : null, providerRequestId: r.provider_request_id as string | null });
  const ready = (hash: string) => {
    const row = required(get('SELECT * FROM content_objects WHERE content_hash=?', hash));
    if (row.state !== 'READY') reject('CONTENT_UNAVAILABLE', 'Content is missing or unavailable', 503);
    return row;
  };
  const write = (principalId: string, writeId: string) => {
    const row = required(get('SELECT w.*,o.result_json FROM object_write_operations w JOIN operations o ON o.operation_id=w.operation_id WHERE write_id=?', writeId));
    if (row.owner_id !== principalId) reject('FORBIDDEN', 'Write belongs to another principal', 403);
    return row;
  };
  const writeView = (r: Row): ObjectWrite => ({ writeId: String(r.write_id), operationId: String(r.operation_id), ownerId: String(r.owner_id), expectedHash: String(r.expected_hash), expectedSize: Number(r.expected_size), mimeType: String(r.mime_type), target: JSON.parse(String(r.target_json)), stagingKey: String(r.staging_key), state: String(r.state), result: r.result_json ? JSON.parse(String(r.result_json)) : null });
  function targetSession(principalId: string, target: ObjectTarget): Row | undefined {
    if (target.kind === 'content' || target.kind === 'attachment') return;
    return session(principalId, target.kind === 'context' ? target.manifest.sessionId : target.sessionId);
  }
  function appendMessage(s: Row, input: { clientMessageId: string; activationId: string; messageKind: string; stepNo?: number | undefined; toolCallId?: string | undefined; sourceRef?: { messageId: string } | undefined }, hash: string): Record<string, unknown> {
    const old = get('SELECT * FROM session_messages WHERE session_id=? AND client_message_id=?', s.session_id!, input.clientMessageId);
    if (old) {
      if (old.body_content_hash !== hash || old.kind !== input.messageKind || old.activation_id !== input.activationId || old.step_no !== (input.stepNo ?? null) || old.tool_call_id !== (input.toolCallId ?? null) || old.source_ref !== (input.sourceRef ? canonical(input.sourceRef) : null)) reject('MESSAGE_KEY_REUSED', 'Message key was used with another body or metadata');
      return { messageId: old.message_id, seq: old.message_seq, sessionId: s.session_id };
    }
    if (s.status !== 'OPEN') reject('SESSION_CLOSED', 'Cannot append to a closed session');
    const tool = input.messageKind === 'tool-call' || input.messageKind === 'tool-result';
    if (tool !== (input.toolCallId !== undefined)) reject('TOOL_CALL_ID_INVALID', 'Tool messages require a toolCallId', 422);
    if (tool && (!input.stepNo || !get('SELECT step_no FROM model_steps WHERE session_id=? AND step_no=? AND response_content_hash IS NOT NULL', s.session_id!, input.stepNo))) reject('MODEL_RESPONSE_REQUIRED', 'Persist the complete model response before tool messages');
    if (input.sourceRef && !get('SELECT message_id FROM session_messages WHERE session_id=? AND message_id=?', s.session_id!, input.sourceRef.messageId)) reject('SOURCE_SCOPE_INVALID', 'Source message must belong to the same session');
    const messageId = uid('message'), seq = Number(s.last_message_seq)+1;
    exec('INSERT INTO session_messages VALUES(?,?,?,?,?,?,?,?,?,?,?)', messageId, s.session_id!, seq, input.clientMessageId, input.activationId, input.stepNo ?? null, input.messageKind, hash, input.toolCallId ?? null, input.sourceRef ? canonical(input.sourceRef) : null, now());
    exec('UPDATE agent_sessions SET last_message_seq=? WHERE session_id=?', seq, s.session_id!);
    return { messageId, seq, sessionId: s.session_id };
  }
  function commitTarget(principalId: string, target: ObjectTarget, hash: string, row: Row): Record<string, unknown> {
    if (target.kind === 'content') return { contentHash: hash };
    if (target.kind === 'attachment') {
      const old = get('SELECT * FROM attachments WHERE owner_id=? AND client_attachment_id=?', principalId, target.clientAttachmentId);
      if (old) {
        if (old.content_hash !== hash || old.name !== target.name || old.state !== 'READY') reject('ATTACHMENT_KEY_REUSED', 'Attachment key belongs to different content');
        return { attachmentId: old.attachment_id, contentHash: hash };
      }
      const attachmentId = uid('attachment');
      exec("INSERT INTO attachments VALUES(?,?,?,?,?,?,?,'READY',?)", attachmentId, principalId, target.clientAttachmentId, row.operation_id!, target.name, row.expected_size!, hash, now());
      return { attachmentId, contentHash: hash };
    }
    const s = targetSession(principalId, target)!;
    if (s.status !== 'OPEN') reject('SESSION_CLOSED', 'Session is closed');
    if (target.kind === 'message') return appendMessage(s, { ...target, sourceRef: target.sourceRef }, hash);
    if (target.kind === 'context') {
      const m = target.manifest;
      if (digest(canonical(m)) !== hash) reject('CONTEXT_HASH_INVALID', 'Context bytes must equal the canonical manifest', 422);
      if (m.roleSnapshotId !== s.role_snapshot_id || m.throughMessageSeq > Number(s.last_message_seq)) reject('CONTEXT_BASIS_CHANGED', 'Context role or cursor does not belong to this session');
      let previous = 0;
      for (const ref of m.messages) {
        if (ref.seq <= previous || ref.seq > m.throughMessageSeq || !get('SELECT message_id FROM session_messages WHERE session_id=? AND message_id=? AND message_seq=? AND body_content_hash=?', s.session_id!, ref.messageId, ref.seq, ref.sha256)) reject('CONTEXT_BASIS_CHANGED', 'Context message order/hash differs from committed history');
        ready(ref.sha256); previous = ref.seq;
      }
      if (m.summaryContentHash) {
        if (!get("SELECT message_id FROM session_messages WHERE session_id=? AND body_content_hash=? AND kind='context-summary' AND message_seq<=?", s.session_id!, m.summaryContentHash, m.throughMessageSeq)) reject('CONTEXT_SUMMARY_UNAUTHORIZED', 'Summary must be a saved summary in this session');
        ready(m.summaryContentHash);
      } else if (m.messages.length !== m.throughMessageSeq) reject('CONTEXT_MESSAGES_MISSING', 'Uncompressed context must list all messages through its cursor');
      const id = uid('context');
      exec('INSERT INTO context_snapshots VALUES(?,?,?,?,?,?,?,?)', id, s.session_id!, m.throughMessageSeq, hash, m.summaryContentHash ?? null, m.configHash, canonical(m.messages), now());
      exec('UPDATE agent_sessions SET context_manifest_ref=? WHERE session_id=?', hash, s.session_id!);
      return { contextSnapshotId: id, sessionId: s.session_id, contentHash: hash, throughMessageSeq: m.throughMessageSeq };
    }
    if (target.kind === 'modelRequest') {
      const snapshot = required(get('SELECT * FROM context_snapshots WHERE workflow_session_id=? AND context_snapshot_id=?', s.session_id!, target.contextSnapshotId));
      if (snapshot.config_hash !== target.configHash) reject('CONTEXT_BASIS_CHANGED', 'Model request config differs from context');
      ready(String(snapshot.manifest_content_hash));
      if (target.stepNo !== Number(s.last_step_no)+1 || get("SELECT step_no FROM model_steps WHERE session_id=? AND state IN ('PREPARED','SENT')", s.session_id!)) reject('MODEL_STEP_ORDER_INVALID', 'Previous model step must be resolved and step numbers contiguous');
      exec("INSERT INTO model_steps(session_id,step_no,context_snapshot_id,request_content_hash,state,started_at) VALUES(?,?,?,?,'PREPARED',?)", s.session_id!, target.stepNo, target.contextSnapshotId, hash, now());
      exec('UPDATE agent_sessions SET last_step_no=? WHERE session_id=?', target.stepNo, s.session_id!);
      return { sessionId: s.session_id, stepNo: target.stepNo, state: 'PREPARED' };
    }
    const step = required(get('SELECT * FROM model_steps WHERE session_id=? AND step_no=?', s.session_id!, target.stepNo));
    if (step.response_content_hash !== null) reject('MODEL_RESPONSE_IMMUTABLE', 'A step response already exists');
    exec('UPDATE model_steps SET response_content_hash=?,usage_json=?,provider_request_id=?,state=?,ended_at=? WHERE session_id=? AND step_no=?', hash, target.usage ? canonical(target.usage) : null, target.providerRequestId ?? null, target.state, now(), s.session_id!, target.stepNo);
    const message = appendMessage(s, { clientMessageId: `model-response.${target.stepNo}`, activationId: target.activationId, stepNo: target.stepNo, messageKind: 'assistant' }, hash);
    return { ...message, stepNo: target.stepNo, state: target.state };
  }
  function resolveReference(principalId: string, ref: ContentReference): Row {
    let row: Row;
    if (ref.kind === 'attachment') {
      row = required(get("SELECT content_hash,owner_id FROM attachments WHERE attachment_id=? AND state='READY'", ref.attachmentId));
      if (row.owner_id !== principalId) reject('FORBIDDEN', 'Attachment belongs to another principal', 403);
    } else if (ref.kind === 'artifact') {
      row = required(get("SELECT a.content_hash,p.owner_id FROM artifacts a JOIN projects p ON p.project_id=a.project_id WHERE artifact_id=? AND a.state='READY'", ref.artifactId));
      if (row.owner_id !== principalId) reject('FORBIDDEN', 'Artifact belongs to another principal', 403);
    } else if (ref.kind === 'message') {
      row = required(get('SELECT session_id,body_content_hash AS content_hash FROM session_messages WHERE message_id=?', ref.messageId));
      session(principalId, String(row.session_id));
    } else if (ref.kind === 'context') {
      row = required(get('SELECT workflow_session_id AS session_id,manifest_content_hash AS content_hash FROM context_snapshots WHERE context_snapshot_id=?', ref.contextSnapshotId));
      session(principalId, String(row.session_id));
    } else {
      session(principalId, ref.sessionId);
      row = required(get(`SELECT ${ref.kind === 'modelRequest' ? 'request_content_hash' : 'response_content_hash'} AS content_hash FROM model_steps WHERE session_id=? AND step_no=?`, ref.sessionId, ref.stepNo));
      if (!row.content_hash) reject('CONTENT_UNAVAILABLE', 'Step has no complete response yet', 409);
    }
    return ready(String(row.content_hash));
  }
  function unreferenced(hash: string) {
    if (get("SELECT write_id FROM object_write_operations WHERE expected_hash=? AND state IN ('RECEIVING','SEALED')", hash) || get("SELECT pin_id FROM storage_pins WHERE content_hash=? AND state='ACTIVE'", hash)) reject('CONTENT_REFERENCED', 'Content has an active write or read pin');
    const quote = (s: string) => '"' + s.replaceAll('"', '""') + '"';
    for (const table of all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name<>'storage_pins'")) {
      for (const key of all(`PRAGMA foreign_key_list(${quote(String(table.name))})`)) {
        if (key.table === 'content_objects' && get(`SELECT 1 FROM ${quote(String(table.name))} WHERE ${quote(String(key.from))}=? LIMIT 1`, hash)) reject('CONTENT_REFERENCED', 'Content still has a business reference');
      }
    }
  }
  const handlers = {
    beginObjectWrite(input: SessionInput<'beginObjectWrite'>) {
      return transaction(db, () => {
        targetSession(input.meta.principalId, input.target);
        const { meta, ...payload } = input, requestHash = digest(canonical({ kind: 'WriteObject', payload }));
        const old = get('SELECT operation_id,request_hash FROM operations WHERE principal_id=? AND scope_id=? AND idempotency_key=?', meta.principalId, meta.scopeId, meta.idempotencyKey);
        if (old) {
          if (old.request_hash !== requestHash) reject('IDEMPOTENCY_KEY_REUSED', 'Original write key belongs to different bytes or target');
          return writeView(write(meta.principalId, String(required(get('SELECT write_id FROM object_write_operations WHERE operation_id=?', old.operation_id!)).write_id)));
        }
        const operationId = uid('op'), writeId = uid('write'), time = now();
        exec("INSERT INTO operations VALUES(?,?,?,?,?,?,'ACCEPTED',NULL,?,?)", operationId, meta.principalId, meta.scopeId, meta.idempotencyKey, requestHash, 'WriteObject', time, time);
        exec("INSERT INTO object_write_operations VALUES(?,?,?,?,?,?,?,?,?,?,?,'RECEIVING',NULL,?,?)", writeId, operationId, meta.principalId, meta.scopeId, input.target.kind, `objects/${writeId}.part`, input.expectedHash, input.expectedSize, input.mimeType, canonical(input.target), new Date(Date.now()+300000).toISOString(), time, time);
        exec('UPDATE operations SET result_json=? WHERE operation_id=?', canonical({ writeId }), operationId);
        return writeView(write(meta.principalId, writeId));
      });
    },
    getObjectWrite(input: SessionInput<'getObjectWrite'>) { return writeView(write(input.principalId, input.writeId)); },
    sealObjectWrite(input: SessionInput<'sealObjectWrite'>) {
      return transaction(db, () => {
        const row = write(input.principalId, input.writeId);
        if (row.state !== 'REGISTERED') exec("UPDATE object_write_operations SET state='SEALED',error_json=NULL,updated_at=? WHERE write_id=?", now(), input.writeId);
        return writeView(write(input.principalId, input.writeId));
      });
    },
    commitObjectWrite(input: SessionInput<'commitObjectWrite'>) {
      return transaction(db, () => {
        const row = write(input.principalId, input.writeId);
        if (row.state === 'REGISTERED') return writeView(row);
        if (row.state !== 'SEALED') reject('OBJECT_NOT_PUBLISHED', 'Verified publication must precede reference commit');
        const hash = String(row.expected_hash), key = `sha256/${hash.slice(0,2)}/${hash}`, time = now();
        const old = get('SELECT * FROM content_objects WHERE content_hash=?', hash);
        if (old && (old.byte_size !== row.expected_size || old.storage_key !== key || !['READY','MISSING'].includes(String(old.state)))) reject('CONTENT_CONFLICT', 'Content metadata or deletion state conflicts');
        if (old) exec("UPDATE content_objects SET state='READY',verified_at=?,last_error=NULL WHERE content_hash=?", time, hash);
        else exec("INSERT INTO content_objects(content_hash,byte_size,storage_key,mime_type,state,created_at,storage_provider,verified_at) VALUES(?,?,?,?,'READY',?,'local',?)", hash, row.expected_size!, key, row.mime_type!, time, time);
        const result = commitTarget(input.principalId, JSON.parse(String(row.target_json)), hash, row);
        exec("UPDATE object_write_operations SET state='REGISTERED',error_json=NULL,updated_at=? WHERE write_id=?", time, input.writeId);
        exec("UPDATE operations SET status='SUCCEEDED',result_json=?,updated_at=? WHERE operation_id=?", canonical({ ...result, writeId: input.writeId, contentHash: hash }), time, row.operation_id!);
        return writeView(write(input.principalId, input.writeId));
      });
    },
    failObjectWrite(input: SessionInput<'failObjectWrite'>) {
      return transaction(db, () => {
        const row = write(input.principalId, input.writeId);
        if (row.state !== 'REGISTERED') exec("UPDATE object_write_operations SET state='FAILED',error_json=?,updated_at=? WHERE write_id=?", canonical({ message: input.error }), now(), input.writeId);
        return writeView(write(input.principalId, input.writeId));
      });
    },
    scanObjectWrites(input: SessionInput<'scanObjectWrites'>) { return all("SELECT w.*,o.result_json FROM object_write_operations w JOIN operations o ON o.operation_id=w.operation_id WHERE write_id>? AND state<>'REGISTERED' ORDER BY write_id LIMIT ?", input.afterWriteId, input.limit).map(writeView); },
    ensureSession(input: SessionInput<'ensureSession'>) {
      return transaction(db, () => {
        const attempt = required(get('SELECT a.*,p.owner_id FROM attempts a JOIN runs r ON r.run_id=a.run_id JOIN projects p ON p.project_id=r.project_id WHERE a.attempt_id=? AND a.run_id=?', input.attemptId, input.runId));
        if (attempt.owner_id !== input.principalId) reject('FORBIDDEN', 'Attempt belongs to another principal', 403);
        const old = get('SELECT * FROM agent_sessions WHERE attempt_id=?', input.attemptId);
        if (old) return sessionView(old);
        if (attempt.ended_at !== null) reject('ATTEMPT_ENDED', 'Cannot start a session after the attempt ended');
        const role = required(get('SELECT snapshot_id FROM role_snapshots WHERE role=? AND content_hash=? ORDER BY created_at,snapshot_id LIMIT 1', attempt.role!, digest(String(attempt.role_snapshot_json))));
        const id = uid('session');
        exec('INSERT INTO agent_sessions(session_id,run_id,attempt_id,role_snapshot_id,created_at) VALUES(?,?,?,?,?)', id, input.runId, input.attemptId, role.snapshot_id!, now());
        return sessionView(required(get('SELECT * FROM agent_sessions WHERE session_id=?', id)));
      });
    },
    getSession(input: SessionInput<'getSession'>) { return sessionView(session(input.principalId, input.sessionId)); },
    closeSession(input: SessionInput<'closeSession'>) {
      return transaction(db, () => {
        const s = session(input.principalId, input.sessionId);
        if (get('SELECT attempt_id FROM attempts WHERE attempt_id=? AND ended_at IS NULL', s.attempt_id!)) reject('ACTIVE_ATTEMPT_EXISTS', 'End the attempt before closing its session');
        if (s.status !== 'CLOSED') exec("UPDATE agent_sessions SET status='CLOSED',closed_at=? WHERE session_id=?", now(), input.sessionId);
        return sessionView(session(input.principalId, input.sessionId));
      });
    },
    listSessionMessages(input: SessionInput<'listSessionMessages'>) {
      session(input.principalId, input.sessionId);
      const messages = all('SELECT * FROM session_messages WHERE session_id=? AND message_seq>? ORDER BY message_seq LIMIT ?', input.sessionId, input.afterSeq, input.limit).map(messageView);
      return { messages, nextCursor: messages.at(-1)?.seq ?? input.afterSeq };
    },
    getModelStep(input: SessionInput<'getModelStep'>) { session(input.principalId, input.sessionId); return stepView(required(get('SELECT * FROM model_steps WHERE session_id=? AND step_no=?', input.sessionId, input.stepNo))); },
    markModelStepSent(input: SessionInput<'markModelStepSent'>) {
      return transaction(db, () => {
        session(input.principalId, input.sessionId);
        const step = required(get('SELECT * FROM model_steps WHERE session_id=? AND step_no=?', input.sessionId, input.stepNo));
        if (step.state === 'PREPARED') exec("UPDATE model_steps SET state='SENT',sent_at=? WHERE session_id=? AND step_no=?", now(), input.sessionId, input.stepNo);
        else if (step.state !== 'SENT') reject('MODEL_STEP_IMMUTABLE', 'Model step has already ended');
        return stepView(required(get('SELECT * FROM model_steps WHERE session_id=? AND step_no=?', input.sessionId, input.stepNo)));
      });
    },
    resolveContentRead(input: SessionInput<'resolveContentRead'>) {
      return transaction(db, () => {
        const content = resolveReference(input.principalId, input.reference), pinId = uid('pin');
        exec("INSERT INTO storage_pins VALUES(?,?,'READ',?,?,?,'ACTIVE',?)", pinId, content.content_hash!, input.principalId, canonical(input.reference), new Date(Date.now()+60000).toISOString(), now());
        return { ...contentView(content), pinId };
      });
    },
    releaseContentRead(input: SessionInput<'releaseContentRead'>) {
      const result = exec("UPDATE storage_pins SET state='RELEASED' WHERE pin_id=? AND owner_id=? AND state='ACTIVE'", input.pinId, input.principalId);
      return { released: Number(result.changes) > 0 };
    },
    recoverContentReads() { return { released: Number(exec("UPDATE storage_pins SET state='RELEASED' WHERE owner_type='READ' AND state='ACTIVE'").changes) }; },
    listContentObjects(input: SessionInput<'listContentObjects'>) { return all('SELECT * FROM content_objects WHERE content_hash>? ORDER BY content_hash LIMIT ?', input.afterHash, input.limit).map(contentView); },
    markContentMissing(input: SessionInput<'markContentMissing'>) { exec("UPDATE content_objects SET state='MISSING',last_error=? WHERE content_hash=? AND state IN ('READY','MISSING')", input.error, input.contentHash); return { contentHash: input.contentHash, state: String(required(get('SELECT state FROM content_objects WHERE content_hash=?', input.contentHash)).state) }; },
    beginContentDeletion(input: SessionInput<'beginContentDeletion'>) {
      return transaction(db, () => { const c = required(get('SELECT * FROM content_objects WHERE content_hash=?', input.contentHash)); unreferenced(input.contentHash); exec("UPDATE content_objects SET state='DELETING' WHERE content_hash=?", input.contentHash); return contentView({ ...c, state: 'DELETING' }); });
    },
    finishContentDeletion(input: SessionInput<'finishContentDeletion'>) {
      return transaction(db, () => { const row = get('SELECT state FROM content_objects WHERE content_hash=?', input.contentHash); if (!row) return { contentHash: input.contentHash, deleted: true }; if (row.state !== 'DELETING') reject('DELETE_NOT_STARTED', 'Deletion must be reserved first'); unreferenced(input.contentHash); exec("DELETE FROM storage_pins WHERE content_hash=? AND state='RELEASED'", input.contentHash); exec('DELETE FROM content_objects WHERE content_hash=?', input.contentHash); return { contentHash: input.contentHash, deleted: true }; });
    },
  };
  return { execute(method: SessionMethod, input: unknown): unknown {
    const parsed = parseContract(sessionRequests[method], input);
    return (handlers[method] as (input: unknown) => unknown)(parsed);
  } };
}
