export class StorageError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown>;
  constructor(code: string, status: number, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
export function failure(error: unknown) {
  if (error instanceof StorageError) return { code: error.code, status: error.status, message: error.message, details: error.details };
  const e = error as { code?: string; errcode?: number; message?: string; status?: number; details?: Record<string, unknown> };
  if (e.code === 'ERR_SQLITE_ERROR') {
    const primary = (e.errcode ?? 0) & 255;
    const busy = primary === 5 || primary === 6;
    return { code: busy ? 'STORAGE_BUSY' : primary === 19 ? 'STORAGE_CONSTRAINT' : 'STORAGE_FAILURE', status: busy ? 503 : primary === 19 ? 409 : 500, message: e.message ?? 'SQLite operation failed', details: { sqliteCode: e.errcode } };
  }
  return { code: e.code ?? 'STORAGE_FAILURE', status: e.status ?? 500, message: e.message ?? String(error), details: e.details ?? {} };
}
