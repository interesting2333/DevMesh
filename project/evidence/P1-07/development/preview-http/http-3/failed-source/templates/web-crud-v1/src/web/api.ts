import { z } from 'zod';
import { Task, TaskList, type TaskInput } from '../shared/task.js';
const Receipt = z.object({ task: Task.nullable() }).strict();
const Pending = z.object({ key: z.string(), method: z.enum(['POST', 'PUT', 'DELETE']), id: z.string().nullable(), revision: z.number().nullable(), input: z.unknown() }).strict();
type Pending = z.infer<typeof Pending>;
export class ApiError extends Error {
  constructor(public readonly code: string, public readonly unknown = false) { super(code); }
}
export class BoardApi {
  private readonly storageKey = 'web-crud-v1.pending-write.v1';
  constructor(private readonly transport: typeof fetch = fetch.bind(globalThis), private readonly storage: Storage | undefined = globalThis.sessionStorage) {}
  hasPending(): boolean { return this.readPending() !== null; }
  async list(): Promise<TaskList> {
    return TaskList.parse(await this.request('/api/tasks'));
  }
  async save(input: TaskInput, current?: Task): Promise<void> {
    await this.write({ key: '', method: current ? 'PUT' : 'POST', id: current?.id ?? null, revision: current?.revision ?? null, input });
  }
  async remove(task: Task): Promise<void> { await this.write({ key: '', method: 'DELETE', id: task.id, revision: task.revision, input: null }); }
  async recover(): Promise<void> {
    const pending = this.readPending();
    if (!pending) return;
    await this.sendPending(pending);
  }
  private readPending(): Pending | null {
    const value = this.storage?.getItem(this.storageKey);
    if (!value) return null;
    try { return Pending.parse(JSON.parse(value)); } catch { throw new ApiError('PENDING_WRITE_INVALID'); }
  }
  private async write(intent: Pending): Promise<void> {
    const pending = this.readPending();
    if (pending) throw new ApiError('PENDING_WRITE_UNCONFIRMED', true);
    const operation = { ...intent, key: crypto.randomUUID() };
    if (!this.storage) throw new ApiError('SESSION_STORAGE_REQUIRED');
    this.storage.setItem(this.storageKey, JSON.stringify(operation));
    await this.sendPending(operation);
  }
  private async sendPending(operation: Pending): Promise<void> {
    try {
      Receipt.parse(await this.request(`/api/tasks${operation.id ? '/' + encodeURIComponent(operation.id) : ''}`, {
        method: operation.method,
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': operation.key, ...(operation.revision === null ? {} : { 'If-Match': `"${operation.revision}"` }) },
        ...(operation.method === 'DELETE' ? {} : { body: JSON.stringify(operation.input) })
      }));
      this.storage!.removeItem(this.storageKey);
    } catch (error) {
      if (error instanceof ApiError && !error.unknown) this.storage!.removeItem(this.storageKey);
      throw error;
    }
  }
  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    try {
      const response = await this.transport(path, { ...init, credentials: 'same-origin', redirect: 'error', signal: AbortSignal.timeout(10000) });
      const body = await response.json() as unknown;
      if (!response.ok) {
        const error = z.object({ error: z.string() }).safeParse(body);
        const code = error.success ? error.data.error : 'REQUEST_FAILED';
        throw new ApiError(code, response.status >= 500 || code === 'PREVIEW_REQUEST_ALREADY_RECORDED');
      }
      return body;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('CONNECTION_UNCONFIRMED', true);
    }
  }
}
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.unknown) return '请求结果尚未确认，请核对上次保存后再继续。';
    const messages: Record<string, string> = { READ_ONLY: '当前看板为只读，无法保存。', REVISION_CONFLICT: '任务已被其他页面修改，请刷新后重试。', TASK_NOT_FOUND: '任务已被删除，请刷新看板。', INVALID_INPUT: '请检查标题、说明和状态。', TASK_CAPACITY: '任务数量已达上限。', SESSION_STORAGE_REQUIRED: '浏览器会话存储不可用，无法安全保存。', PENDING_WRITE_INVALID: '上次保存记录无法读取，请保留当前页面并联系管理员。' };
    return messages[error.code] ?? '请求失败，请稍后重试。';
  }
  return '操作失败，请检查数据后重试。';
}
