// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, configure, render, screen, within, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { TaskDatabase } from '../src/server/database.js';
import { startService } from '../src/server/service.js';
import { Board } from '../src/web/Board.js';
import { BoardApi } from '../src/web/api.js';
const workerScript = pathToFileURL(resolve('dist/server/db-worker.js'));
// These DOM tests cross actual HTTP and a SQLite Worker; the library's 1s default is too short.
configure({ asyncUtilTimeout: 10000 });
const roots: string[] = [];
const services: Awaited<ReturnType<typeof startService>>[] = [];
async function fixture(readOnly = false, transport?: (original: typeof fetch) => typeof fetch) {
  const parent = mkdtempSync(join(tmpdir(), 'devmesh-template-board-')); roots.push(parent);
  const root = join(parent, 'dataset'); TaskDatabase.initialize(root);
  const service = await startService({ root, port: 0, readOnly, workerScript }); services.push(service);
  const direct: typeof fetch = (path, init) => fetch(service.url + String(path), init);
  const api = new BoardApi(transport ? transport(direct) : direct, window.sessionStorage);
  render(<Board api={api} />);
  await waitFor(() => expect(screen.queryByText('正在加载任务…')).toBeNull());
  return { api, service, user: userEvent.setup() };
}
afterEach(async () => { cleanup(); vi.restoreAllMocks(); window.sessionStorage.clear(); for (const service of services.splice(0)) await service.close(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
it('creates, edits, moves and deletes through the DOM and real backend; refresh retains saved text', async () => {
  const { api, user } = await fixture();
  expect(screen.getAllByRole('region')).toHaveLength(3);
  await user.click(screen.getByRole('button', { name: '＋ 新建任务' }));
  await user.type(screen.getByLabelText('标题'), '准备第一版');
  await user.type(screen.getByLabelText('说明'), '<script>文本内容</script>');
  await user.click(screen.getByRole('button', { name: '保存任务' }));
  await screen.findByRole('heading', { name: '准备第一版' });
  expect(document.querySelector('script')).toBeNull();
  expect(screen.getByText('<script>文本内容</script>')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: '编辑 准备第一版' }));
  await user.clear(screen.getByLabelText('标题')); await user.type(screen.getByLabelText('标题'), '完成第一版');
  await user.selectOptions(screen.getByLabelText('状态'), 'doing');
  await user.click(screen.getByRole('button', { name: '保存任务' }));
  await waitFor(() => expect(within(screen.getByRole('region', { name: '进行中' })).getByRole('heading', { name: '完成第一版' })).toBeTruthy());
  await user.click(screen.getByRole('button', { name: '刷新' }));
  expect(await screen.findByRole('heading', { name: '完成第一版' })).toBeTruthy();
  cleanup(); render(<Board api={api} />);
  await screen.findByRole('heading', { name: '完成第一版' });
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  await user.click(screen.getByRole('button', { name: '删除 完成第一版' }));
  expect(screen.getByRole('heading', { name: '完成第一版' })).toBeTruthy();
  confirm.mockReturnValue(true);
  await user.click(screen.getByRole('button', { name: '删除 完成第一版' }));
  await waitFor(() => expect(screen.queryByRole('heading', { name: '完成第一版' })).toBeNull());
}, 120000);
it('validates empty titles, permits cancel, and starts new tasks in the selected column', async () => {
  const { user } = await fixture();
  await user.click(within(screen.getByRole('region', { name: '已完成' })).getByRole('button', { name: '＋ 添加任务' }));
  expect((screen.getByLabelText('状态') as HTMLSelectElement).value).toBe('done');
  await user.click(screen.getByRole('button', { name: '保存任务' }));
  expect(screen.getByRole('alert').textContent).toContain('标题不能为空');
  await user.click(screen.getByRole('button', { name: '取消' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  await user.click(screen.getByRole('button', { name: '＋ 新建任务' }));
  await user.click(screen.getByRole('button', { name: '关闭编辑' }));
  expect(screen.queryByRole('dialog')).toBeNull();
}, 60000);
it('keeps an unknown save in the browser outbox and manually reuses its original key without duplication', async () => {
  let writes = 0;
  const { api, user, service } = await fixture(false, original => async (path, init) => {
    const response = await original(path, init);
    if (init?.method === 'POST' && ++writes === 1) throw new TypeError('Controlled lost response after commit');
    return response;
  });
  await user.click(screen.getByRole('button', { name: '＋ 新建任务' }));
  await user.type(screen.getByLabelText('标题'), '只创建一次');
  await user.click(screen.getByRole('button', { name: '保存任务' }));
  await screen.findByText('有一次保存结果尚未确认。');
  expect(api.hasPending()).toBe(true);
  expect((screen.getByRole('button', { name: '保存任务' }) as HTMLButtonElement).disabled).toBe(true);
  expect(writes).toBe(1);
  cleanup(); render(<Board api={api} />);
  await user.click(await screen.findByRole('button', { name: '核对上次保存' }));
  await waitFor(() => expect(api.hasPending()).toBe(false));
  expect(writes).toBe(2);
  expect((await (await fetch(service.url + '/api/tasks')).json()).tasks).toHaveLength(1);
  expect(await screen.findByRole('heading', { name: '只创建一次' })).toBeTruthy();
}, 60000);
it('shows initial load failures and can refresh; read-only views disable writes', async () => {
  let fails = true;
  const { user } = await fixture(true, original => (path, init) => fails ? Promise.reject(new TypeError('offline')) : original(path, init));
  expect(screen.getByRole('alert').textContent).toContain('结果尚未确认');
  fails = false;
  await user.click(screen.getByRole('button', { name: '刷新' }));
  await screen.findByText('当前看板为只读。');
  expect((screen.getByRole('button', { name: '＋ 新建任务' }) as HTMLButtonElement).disabled).toBe(true);
}, 60000);
