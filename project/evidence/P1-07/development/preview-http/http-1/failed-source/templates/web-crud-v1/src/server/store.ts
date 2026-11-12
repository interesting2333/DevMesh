import { Worker } from 'node:worker_threads';
import { AppError, type TaskList } from '../shared/task.js';
import type { Mutation, MutationResult } from './database.js';
export interface TaskStore { list(): Promise<TaskList>; mutate(operation: Mutation): Promise<MutationResult>; close(): Promise<void> }
export class WorkerStore implements TaskStore {
  private sequence = 0;
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  private readonly worker: Worker;
  private closing = false;
  private broken = false;
  private readonly ready: Promise<void>;
  constructor(root: string, readOnly = false, workerScript = new URL('./db-worker.js', import.meta.url)) {
    this.worker = new Worker(workerScript, { workerData: { root, readOnly } });
    this.ready = new Promise<void>((resolve, reject) => {
      this.worker.on('message', (message: { ready?: boolean; id: number; value: unknown; error?: { code: string; status: number } }) => {
        if (message.ready) { resolve(); return; }
        const request = this.pending.get(message.id);
        if (!request) return;
        this.pending.delete(message.id);
        if (message.error) request.reject(new AppError(message.error.code, message.error.status)); else request.resolve(message.value);
      });
      const fail = () => {
        this.broken = true;
        const error = new AppError('STORAGE_UNAVAILABLE', 503);
        reject(error);
        for (const request of this.pending.values()) request.reject(error);
        this.pending.clear();
      };
      this.worker.on('error', fail);
      this.worker.on('exit', () => { if (!this.closing) fail(); });
    });
  }
  async initialized(): Promise<void> { await this.ready; }
  async list(): Promise<TaskList> { return await this.request('list') as TaskList; }
  async mutate(mutation: Mutation): Promise<MutationResult> { return await this.request('mutate', mutation) as MutationResult; }
  async close(): Promise<void> {
    if (this.closing) return;
    if (!this.broken) await this.request('close');
    this.closing = true;
    await this.worker.terminate();
  }
  private async request(method: string, mutation?: Mutation): Promise<unknown> {
    await this.ready;
    if (this.closing || this.broken) throw new AppError('STORAGE_UNAVAILABLE', 503);
    const id = ++this.sequence;
    return await new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, method, mutation });
    });
  }
}
