// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { BoardApi, ApiError, errorMessage } from '../src/web/api.js';
const input = { title: '任务', description: '', status: 'todo' as const };
afterEach(() => window.sessionStorage.clear());
it('retains only uncertain writes and blocks changed intent until explicit recovery', async () => {
  const calls: RequestInit[] = [];
  let lost = true;
  const api = new BoardApi(async (_path, init) => { calls.push(init!); if (lost) throw new TypeError('lost'); return Response.json({ task: null }); }, window.sessionStorage);
  await expect(api.save(input)).rejects.toBeInstanceOf(ApiError);
  expect(api.hasPending()).toBe(true);
  await expect(api.save({ ...input, title: 'different' })).rejects.toMatchObject({ code: 'PENDING_WRITE_UNCONFIRMED' });
  expect(calls).toHaveLength(1);
  lost = false; await api.recover();
  expect(calls[0]?.headers).toEqual(calls[1]?.headers);
  expect(api.hasPending()).toBe(false);
  await api.recover(); expect(calls).toHaveLength(2);
});
it('clears a known rejected write, preserves a server error, validates returned data and reports public errors', async () => {
  const api = new BoardApi(async () => Response.json({ error: 'READ_ONLY' }, { status: 403 }), window.sessionStorage);
  await expect(api.save(input)).rejects.toMatchObject({ code: 'READ_ONLY', unknown: false });
  expect(api.hasPending()).toBe(false);
  const failed = new BoardApi(async () => Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 }), window.sessionStorage);
  await expect(failed.save(input)).rejects.toMatchObject({ unknown: true });
  expect(failed.hasPending()).toBe(true);
  window.sessionStorage.clear();
  const invalid = new BoardApi(async () => Response.json({ invalid: true }), window.sessionStorage);
  await expect(invalid.list()).rejects.toThrow();
  const generic = new BoardApi(async () => Response.json({}, { status: 400 }), window.sessionStorage);
  await expect(generic.save(input)).rejects.toMatchObject({ code: 'REQUEST_FAILED' });
  expect(errorMessage(new ApiError('READ_ONLY'))).toContain('只读');
  expect(errorMessage(new ApiError('REVISION_CONFLICT'))).toContain('其他页面');
  expect(errorMessage(new ApiError('unrecognized'))).toContain('请求失败');
  expect(errorMessage(new Error('private detail'))).not.toContain('private');
});
it('fails closed for a corrupt outbox and unavailable session storage', async () => {
  window.sessionStorage.setItem('web-crud-v1.pending-write.v1', '{');
  const api = new BoardApi(async () => { throw new Error('must not call'); }, window.sessionStorage);
  expect(() => api.hasPending()).toThrow('PENDING_WRITE_INVALID');
  await expect(api.save(input)).rejects.toThrow('PENDING_WRITE_INVALID');
  window.sessionStorage.clear();
  const failingStorage = { getItem: () => null, setItem: () => { throw new Error('Storage disabled'); } } as unknown as Storage;
  await expect(new BoardApi(async () => { throw new Error('must not call'); }, failingStorage).save(input)).rejects.toThrow('Storage disabled');
});
it.each(['PREVIEW_REQUEST_ALREADY_RECORDED', 'PREVIEW_ACCESS_REQUEST_CHANGED'])('retains the original key for gateway %s', async code => {
  const calls: RequestInit[] = [];
  const api = new BoardApi(async (_path, init) => {
    calls.push(init!);
    return Response.json({ error: code, state: 'UNKNOWN' }, { status: 409 });
  }, window.sessionStorage);
  await expect(api.save(input)).rejects.toMatchObject({ code, unknown: true });
  expect(api.hasPending()).toBe(true);
  await expect(api.recover()).rejects.toMatchObject({ unknown: true });
  expect(calls[0]?.headers).toEqual(calls[1]?.headers);
  await expect(api.save({ ...input, title: 'replacement' })).rejects.toMatchObject({ code: 'PENDING_WRITE_UNCONFIRMED' });
  expect(calls).toHaveLength(2);
});
it('retains an uncertain write across reload and authentication or membership rejection during recovery', async () => {
  const calls: RequestInit[] = [];
  const first = new BoardApi(async (_path, init) => { calls.push(init!); throw new TypeError('response lost'); }, window.sessionStorage);
  await expect(first.save(input)).rejects.toMatchObject({ unknown: true });
  for (const status of [401, 403]) {
    const restored = new BoardApi(async (_path, init) => {
      calls.push(init!);
      return Response.json({ error: 'ACCESS_REVOKED' }, { status });
    }, window.sessionStorage);
    await expect(restored.recover()).rejects.toMatchObject({ code: 'ACCESS_REVOKED', unknown: true });
    expect(restored.hasPending()).toBe(true);
    await expect(restored.save({ ...input, title: 'replacement' })).rejects.toMatchObject({ code: 'PENDING_WRITE_UNCONFIRMED' });
  }
  expect(calls).toHaveLength(3);
  expect(calls[1]?.headers).toEqual(calls[0]?.headers);
  expect(calls[2]?.headers).toEqual(calls[0]?.headers);
});
