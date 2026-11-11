import { Worker } from 'node:worker_threads';
import { StorageError } from './errors.js';
import { acquireWriterLock } from './lock.js';
import type { Method, Request, Results } from './protocol.js';
export { StorageError } from './errors.js';
export type { Method, Request, Results, OperationResult, RunView, AttemptView, OutboxView, ScheduledCandidate, ScheduledDispatch } from './protocol.js';
export type { ContentInfo, ObjectWrite, ObjectTarget, ContentReference, SessionInfo, SessionMessage, ModelStep, ContextManifest } from './session-protocol.js';
export { canonical } from './json.js';
export {issueCreateArgs,issueLinkArgs,issueVerifyArgs} from './tool-protocol.js';
export type {IssueView,IssueOperation} from './tool-protocol.js';
export type {PipelineView,PipelineStageView,PipelineDispatch} from './pipeline-protocol.js';
export {repoCommitArgs,repoIntegrateArgs,repoBinding} from './repo-protocol.js';
export type {RepoOperation} from './repo-protocol.js';
export {repoFileReadArgs,repoWriteFileArgs,repoDeleteFileArgs,repoFileProof} from './repo-file-protocol.js';
export type {RepoFileOperation} from './repo-file-protocol.js';
export {sourceManifest,gitDirectoryIdentity,managedSourcePath} from './workspace-protocol.js';
export type {ManagedRepository,WorkspaceAllocation,SourceManifest,GitDirectoryIdentity} from './workspace-protocol.js';
export { agentManifest, endpointConfig } from './registry-protocol.js';
export type { EndpointConfig, AgentManifest, EndpointView, RegistrySnapshot, A2ATaskRecord } from './registry-protocol.js';
export type { ExecutionHostView,RuntimeActivationView,RuntimeToolView } from './runtime-protocol.js';
export type { AttachmentView, UploadIntake, WorkspaceView } from './input-protocol.js';
export type {PreparationJob,UnderstandingView,PreparationContext,PreparationAttempt,PreparationTask,PreparationClaim,PreparationHost} from './preparation-protocol.js';
export { acquireWriterLock } from './lock.js';

export interface StorageOptions {
  databasePath: string;
  storeId: string;
  layoutVersion?: 1;
  create?: boolean;
  backupDirectory?: string;
  recoveryToken?: string;
  targetVersion?: number;
  queueCapacity?: number;
}
type Reply = { id: number; value?: unknown; error?: { code: string; status: number; message: string; details: Record<string, unknown> } };
export class SqliteStorage {
  readonly #worker: Worker;
  readonly #capacity: number;
  readonly #pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  readonly #exited: Promise<void>;
  #nextId = 1;
  #closed = false;
  #closing: Promise<void> | undefined;
  #closeError: Error | undefined;
  readonly ready: Promise<void>;
  constructor(options: StorageOptions) {
    this.#capacity = options.queueCapacity ?? 128;
    if (!Number.isSafeInteger(this.#capacity) || this.#capacity < 1 || this.#capacity > 10000) throw new StorageError('QUEUE_CAPACITY_INVALID', 422, 'queueCapacity must be 1..10000');
    const lock = acquireWriterLock(options.databasePath, options.recoveryToken);
    try { this.#worker = new Worker(new URL('./worker.mjs', import.meta.url), { workerData: { ...options, databasePath: lock.path }, execArgv: [] }); }
    catch (error) { lock.release(); throw error; }
    let readyResolve!: () => void, readyReject!: (error: Error) => void;
    this.ready = new Promise<void>((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
    this.#exited = new Promise<void>(resolve => this.#worker.once('exit', () => {
      this.#closed = true;
      const error = new StorageError('OUTCOME_UNKNOWN', 503, 'Database Worker exited before acknowledgement; query the original operation key');
      readyReject(error);
      for (const pending of this.#pending.values()) pending.reject(error);
      this.#pending.clear();
      try { lock.release(); }
      catch (releaseError) { this.#closeError = releaseError as Error; }
      finally { resolve(); }
    }));
    this.#worker.on('message', (message: Reply | { type: string }) => {
      if ('type' in message) { if (message.type === 'ready') readyResolve(); return; }
      const error = message.error ? new StorageError(message.error.code, message.error.status, message.error.message, message.error.details) : undefined;
      if (message.id === 0) { if (error) readyReject(error); return; }
      if (message.id === -1) { if (error) this.#closeError = error; return; }
      const pending = this.#pending.get(message.id);
      if (!pending) return;
      this.#pending.delete(message.id);
      if (error) pending.reject(error); else pending.resolve(message.value);
    });
    this.#worker.on('error', error => readyReject(error));
  }
  request<M extends Method>(method: M, payload: Request<M>): Promise<Results[M]> {
    return this.#send(method, payload) as Promise<Results[M]>;
  }
  #send(method: string, payload: unknown): Promise<unknown> {
    if (this.#closed) return Promise.reject(new StorageError('STORAGE_CLOSED', 503, 'Storage is closing or closed'));
    if (this.#pending.size >= this.#capacity) return Promise.reject(new StorageError('STORAGE_OVERLOADED', 503, 'Database queue is full; request was not sent'));
    try {
      const json = JSON.stringify(payload);
      if (json === undefined) return Promise.reject(new StorageError('SCHEMA_INVALID', 422, 'A JSON payload is required'));
      if (Buffer.byteLength(json, 'utf8') > 256*1024) return Promise.reject(new StorageError('REQUEST_TOO_LARGE', 413, 'Storage RPC is limited to 256 KiB; request was not sent'));
    } catch { return Promise.reject(new StorageError('SCHEMA_INVALID', 422, 'Payload must be serializable JSON')); }
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      try { this.#worker.postMessage({ id, method, payload }); }
      catch (error) { this.#pending.delete(id); reject(error as Error); }
    });
  }
  close(): Promise<void> {
    this.#closing ??= (async () => {
      if (!this.#closed) {
        // Shutdown is queued after already accepted requests and bypasses capacity.
        this.#closed = true;
        this.#worker.postMessage({ id: -1, method: 'close', payload: {} });
      }
      await this.#exited;
      if (this.#closeError) throw this.#closeError;
    })();
    return this.#closing;
  }
  /** Deliberate emergency shutdown. In-flight writes remain OUTCOME_UNKNOWN. */
  async terminate(): Promise<void> { this.#closed = true; await this.#worker.terminate(); await this.#exited; }
}
export async function openStorage(options: StorageOptions): Promise<SqliteStorage> {
  const storage = new SqliteStorage(options);
  try { await storage.ready; return storage; }
  catch (error) { await storage.terminate(); throw error; }
}
