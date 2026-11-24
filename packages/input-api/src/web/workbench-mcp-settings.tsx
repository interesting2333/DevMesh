import { useEffect, useState } from 'react';
import { WorkbenchApiError } from './workbench-api.js';

type Api = (path: string, init?: RequestInit) => Promise<unknown>;
type Draft = {
  endpointId: string; displayName: string; endpoint: string; credentialRef: string;
  timeoutMs: number; projectId: string | null; repository: string | null;
  enabled: boolean; allowedTools: string[]; expectedSnapshotHash: string | null;
};
type Catalog = {
  protocolVersion: string; serverVersion: string; snapshotHash: string;
  tools: { name: string; runtimeName: string; description: string; eligible: boolean; properties: string[] }[];
};
type Status = { state: string; checkedAt?: string; errorCode?: string; probeErrorCode?: string; catalog?: Catalog };
type Entry = Draft & { status: Status };
type Settings = { connections: Entry[]; policies: Pick<Draft, 'endpoint' | 'credentialRef'>[] };
const browsers = { msedge: 'Microsoft Edge', chrome: 'Google Chrome', chromium: 'Chromium' };
type PlaywrightDraft = { displayName: string; browser: keyof typeof browsers; headless: boolean };
type PlaywrightService = {
  config: (PlaywrightDraft & { enabled: boolean }) | null;
  running: boolean; busy: boolean; toolCount: number; error: string | null;
};

const endpoint = '/api/v1/settings/mcp';
const playwrightServiceEndpoint = endpoint + '/playwright/service';
const playwrightDefaults: PlaywrightDraft = { displayName: 'Playwright MCP', browser: 'msedge', headless: true };
const playwrightErrors: Record<string, string> = {
  START_FAILED: '启动失败，请检查所选浏览器与 Playwright MCP 依赖，然后重试。',
  PROCESS_EXITED: 'Playwright MCP 进程已退出。',
  BUSY: 'Playwright MCP 正在处理另一项操作，请稍后重试。',
  NOT_CONFIGURED: '请先添加 Playwright MCP。'
};
const empty: Draft = { endpointId: '', displayName: '', endpoint: '', credentialRef: '', timeoutMs: 10000,
  projectId: null, repository: null, enabled: false, allowedTools: [], expectedSnapshotHash: null };
const labels: Record<string, string> = {
  DISABLED: '已停用', PENDING_RESTART: '待重启', CONNECTED: '已连接', FAILED: '连接失败',
  REVIEW_REQUIRED: '待重新确认', RUNTIME_UNAVAILABLE: '工作流未配置',
  MCP_AUTH_REQUIRED: '服务拒绝了凭据', MCP_CREDENTIAL_UNAVAILABLE: '请检查启动环境中的凭据',
  MCP_ENDPOINT_NOT_APPROVED: 'Endpoint 与部署配置中的凭据引用不匹配',
  MCP_TOOL_APPROVAL_REQUIRED: '请重新测试、勾选工具并检查项目范围',
  MCP_SCHEMA_CHANGED: '工具目录已变化，请重新测试并确认',
  MCP_CONNECT_FAILED: 'MCP 初始化或工具发现失败', MCP_CONNECTION_EXISTS: '服务 ID 已存在',
  FORBIDDEN: '需要 MCP 设置管理员权限', SCHEMA_INVALID: '请检查服务 ID、Endpoint、凭据引用和超时'
};
const label = (code: string) => labels[code] ?? code;
const errorMessage = (error: unknown, fallback: string) =>
  error instanceof WorkbenchApiError ? labels[error.code] ?? fallback : fallback;
const connectionInput = ({ endpointId, displayName, endpoint, credentialRef, timeoutMs, projectId, repository }: Draft) =>
  ({ endpointId, displayName, endpoint, credentialRef, timeoutMs, projectId, repository });

export function WorkbenchMcpSettings({ api }: { api: Api }) {
  const [settings, setSettings] = useState<Settings>();
  const [playwright, setPlaywright] = useState<PlaywrightService | null>();
  const [playwrightForm, setPlaywrightForm] = useState<PlaywrightDraft>();
  const [playwrightProgress, setPlaywrightProgress] = useState('');
  const [form, setForm] = useState<Draft>();
  const [editing, setEditing] = useState<string>();
  const [catalog, setCatalog] = useState<Catalog>();
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void api(endpoint, { signal: controller.signal }).then(value => setSettings(value as Settings))
      .catch(error => { if (!controller.signal.aborted) setMessage(errorMessage(error, 'MCP 设置未启用或暂时无法加载。')); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (busy) return;
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const value = await api(playwrightServiceEndpoint, { signal: controller.signal });
        if (!controller.signal.aborted) setPlaywright(value as PlaywrightService | null);
      } catch { /* Keep the last status until the next refresh. */ }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 3000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [busy]);

  function editPlaywright(config?: PlaywrightDraft) {
    setPlaywrightForm(config ? { displayName: config.displayName, browser: config.browser, headless: config.headless } : playwrightDefaults);
    setMessage('');
    setDeleting(false);
  }

  async function updatePlaywright(method: 'PUT' | 'PATCH' | 'DELETE', progress: string, body?: unknown) {
    setPlaywrightProgress(progress);
    await perform(async () => {
      const value = await api(playwrightServiceEndpoint, {
        method, ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      }) as PlaywrightService;
      setPlaywright(value);
      if (value.error) {
        setMessage(playwrightErrors[value.error] ?? 'Playwright MCP 操作失败。');
        if (value.error === 'START_FAILED' && method === 'PUT') setPlaywrightForm(undefined);
        return;
      }
      if (method === 'PUT' || method === 'DELETE') setPlaywrightForm(undefined);
    }, 'Playwright MCP 操作失败。');
    setPlaywrightProgress('');
  }

  function open(entry?: Entry) {
    setEditing(entry?.endpointId);
    setForm(entry ? {
      ...connectionInput(entry),
      enabled: entry.enabled, allowedTools: entry.allowedTools, expectedSnapshotHash: entry.expectedSnapshotHash
    } : empty);
    setCatalog(entry?.status.catalog);
    setMessage('');
    setDeleting(false);
  }

  function change(patch: Partial<Draft>, connectionChanged = false) {
    if (connectionChanged) setCatalog(undefined);
    setForm(current => current && { ...current, ...(connectionChanged ? { allowedTools: [], expectedSnapshotHash: null } : {}), ...patch });
  }

  async function perform(operation: () => Promise<void>, fallback: string) {
    setBusy(true);
    setMessage('');
    try { await operation(); }
    catch (error) { setMessage(errorMessage(error, fallback)); }
    finally { setBusy(false); }
  }

  async function probe(draft: Draft) {
    return await api(endpoint + '/discover', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(connectionInput(draft))
    }) as { ok: boolean; catalog?: Catalog; errorCode?: string };
  }

  function discover(draft: Draft) {
    return perform(async () => {
      const { allowedTools, expectedSnapshotHash } = draft;
      const result = await probe(draft);
      setCatalog(result.catalog);
      if (!result.ok || !result.catalog) {
        setMessage(label(result.errorCode ?? 'MCP_CONNECT_FAILED'));
        return;
      }
      const found = result.catalog;
      change({
        expectedSnapshotHash: found.snapshotHash,
        allowedTools: expectedSnapshotHash === found.snapshotHash ? allowedTools : []
      });
      setMessage('连接成功，已发现 ' + found.tools.length + ' 个工具。');
    }, '测试连接失败。');
  }

  function toggle(entry: Entry) {
    const enabled = !entry.enabled;
    if (enabled && (!entry.expectedSnapshotHash || !entry.allowedTools.length)) {
      setMessage('请点击「编辑」，测试连接并保存工具授权后再启用。');
      return;
    }
    return perform(async () => {
      if (enabled) {
        const result = await probe(entry);
        if (!result.ok || !result.catalog) {
          setMessage(label(result.errorCode ?? 'MCP_CONNECT_FAILED'));
          return;
        }
        if (result.catalog.snapshotHash !== entry.expectedSnapshotHash) {
          setMessage('工具目录已变化，请点击「编辑」重新测试并保存工具授权。');
          return;
        }
      }
      const result = await api(endpoint + '/' + entry.endpointId, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled })
      }) as Settings;
      setSettings(result);
      setMessage(enabled ? '已启用，重启服务后生效。' : '已停用，新的调用会被拦截。');
    }, enabled ? '启用 MCP 服务失败。' : '停用 MCP 服务失败。');
  }

  function save(draft: Draft) {
    return perform(async () => {
      const result = await api(editing ? endpoint + '/' + editing : endpoint, {
        method: editing ? 'PUT' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(draft)
      }) as Settings;
      setSettings(result);
      setForm(undefined);
      setMessage(draft.enabled ? '配置已保存。请查看当前连接状态。' : '配置已保存，服务已停用。');
    }, '保存 MCP 服务失败。');
  }

  return <section aria-label="MCP 服务">
    <div className="modal-head"><h3>MCP 服务</h3>{settings && !playwrightForm && <button disabled={busy} onClick={() => open()}>新增服务</button>}</div>
    {busy && !settings && <p className="muted">正在加载…</p>}
    {settings && !form && !playwrightForm && <ul className="mcp-settings-list">
      {playwright && <li className="mcp-playwright-service"><div><strong>{playwright.config?.displayName ?? 'Playwright MCP'}</strong>
        <div className="muted">本地服务 · stdio{playwright.config && ' · ' + browsers[playwright.config.browser]}</div>
        <div>{playwrightProgress || (playwright.busy ? '正在处理…' : playwright.running
          ? '运行中 · 已发现 ' + playwright.toolCount + ' 个工具' : playwright.error ? '运行异常' : playwright.config ? '已停用' : '未添加')}</div>
        {playwright.error && !playwrightProgress && <small>{playwrightErrors[playwright.error]}</small>}
      </div>
        <div className="actions mcp-service-actions">
          {playwright.config ? <>
            <button type="button" role="switch" className="mcp-service-switch" disabled={busy || playwright.busy}
              aria-label={playwright.config.displayName + ' 启用状态'} aria-checked={playwright.running}
              onClick={() => void updatePlaywright('PATCH', playwright.running ? '正在停用…' : '正在启动…', { enabled: !playwright.running })} />
            <button type="button" disabled={busy || playwright.busy} aria-label={'编辑 ' + playwright.config.displayName}
              onClick={() => editPlaywright(playwright.config ?? undefined)}>编辑</button>
          </> : <button type="button" disabled={busy} onClick={() => editPlaywright()}>添加 Playwright MCP</button>}
        </div>
      </li>}
      {settings.connections.map(item => <li key={item.endpointId}>
        <div><strong>{item.displayName}</strong><div className="muted">{item.endpoint}</div>
        <div>{label(item.status.state)} · 已授权 {item.allowedTools.length} 项</div>
        {item.status.checkedAt && <small className="muted">最后检查 {new Date(item.status.checkedAt).toLocaleString()}</small>}
        {item.status.errorCode && <div>{label(item.status.errorCode)}</div>}
        {item.status.probeErrorCode && item.status.probeErrorCode !== item.status.errorCode && <div>{label(item.status.probeErrorCode)}</div>}</div>
        <div className="actions mcp-service-actions">
          <button type="button" role="switch" className="mcp-service-switch" disabled={busy}
            aria-label={item.displayName + ' 启用状态'} aria-checked={item.enabled}
            onClick={() => void toggle(item)} />
          <button type="button" disabled={busy} aria-label={'编辑 ' + item.displayName} onClick={() => open(item)}>编辑</button>
        </div>
      </li>)}
    </ul>}
    {settings && !form && !playwrightForm && !settings.connections.length && <p className="muted">尚未添加远程 MCP 服务。</p>}
    {playwrightForm && <form onSubmit={event => {
      event.preventDefault();
      void updatePlaywright('PUT', '正在保存…', playwrightForm);
    }}>
      <fieldset disabled={busy} className="mcp-settings-fields">
        <label>服务名称<input required maxLength={80} value={playwrightForm.displayName}
          onChange={event => setPlaywrightForm({ ...playwrightForm, displayName: event.target.value })} /></label>
        <label>浏览器<select value={playwrightForm.browser}
          onChange={event => setPlaywrightForm({ ...playwrightForm, browser: event.target.value as PlaywrightDraft['browser'] })}>
          {Object.entries(browsers).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select></label>
        <label className="mcp-check"><input type="checkbox" checked={playwrightForm.headless}
          onChange={event => setPlaywrightForm({ ...playwrightForm, headless: event.target.checked })} />无头运行</label>
        <div className="actions">
          {playwright?.config && <button type="button" onClick={() => setDeleting(current => !current)}>删除</button>}
          <button type="button" onClick={() => { setPlaywrightForm(undefined); setMessage(''); }}>取消</button>
          <button className="primary" type="submit" disabled={!playwrightForm.displayName.trim()}>保存服务</button>
        </div>
        {deleting && <div className="actions"><span>删除时会停止服务。</span>
          <button type="button" onClick={() => void updatePlaywright('DELETE', '正在删除…')}>确认删除</button></div>}
      </fieldset>
    </form>}
    {form && <form onSubmit={event => { event.preventDefault(); void save(form); }}>
      <fieldset disabled={busy} className="mcp-settings-fields">
        <label>服务 ID<input required maxLength={32} value={form.endpointId} readOnly={!!editing} placeholder="github" onChange={event => change({ endpointId: event.target.value }, true)} /></label>
        <label>服务名称<input required maxLength={80} value={form.displayName} onChange={event => change({ displayName: event.target.value })} /></label>
        <label>MCP Endpoint<input type="url" required list="mcp-endpoints" maxLength={500} value={form.endpoint} onChange={event => {
          const newEndpoint = event.target.value;
          const policy = settings?.policies.find(item => item.endpoint === newEndpoint);
          change({ endpoint: newEndpoint, ...(policy ? { credentialRef: policy.credentialRef } : {}) }, true);
        }} /></label>
        <datalist id="mcp-endpoints">{settings?.policies.map(item => <option key={item.credentialRef} value={item.endpoint} />)}</datalist>
        <label>凭据引用<input required maxLength={52} placeholder="mcp.github" value={form.credentialRef} onChange={event => change({ credentialRef: event.target.value }, true)} /></label>
        <label>请求超时（毫秒）<input type="number" required min={1000} max={15000} value={form.timeoutMs || ''} onChange={event => change({ timeoutMs: Number(event.target.value) }, true)} /></label>
        <label>项目 ID<input maxLength={128} value={form.projectId ?? ''} required={form.enabled && form.endpoint !== 'https://mcp.context7.com/mcp'} onChange={event => change({ projectId: event.target.value || null })} /></label>
        {/api\.githubcopilot\.com/.test(form.endpoint) && <label>GitHub 仓库<input required={form.enabled} maxLength={180} placeholder="owner/repository" value={form.repository ?? ''} onChange={event => change({ repository: event.target.value || null })} /></label>}
        <button type="button" disabled={!form.endpointId || !form.displayName || !form.endpoint || !form.credentialRef || !form.timeoutMs} onClick={() => void discover(form)}>测试连接并发现工具</button>
        {catalog && <div className="mcp-catalog">
          <p className="muted">协议 {catalog.protocolVersion} · 服务版本 {catalog.serverVersion}</p>
          <details><summary>Schema 哈希</summary><code>{catalog.snapshotHash}</code></details>
          <ul className="mcp-settings-list">{catalog.tools.map(tool => <li key={tool.name}>
            <label className="mcp-check"><input type="checkbox" disabled={!tool.eligible || form.expectedSnapshotHash !== catalog.snapshotHash}
              checked={form.allowedTools.includes(tool.name)}
              onChange={event => change({ allowedTools: event.target.checked ? [...form.allowedTools, tool.name] : form.allowedTools.filter(name => name !== tool.name) })} />
              <span><strong>{tool.name}</strong><small className="muted">{tool.eligible ? tool.runtimeName : '未批准用于工作流'}</small>
              {tool.description && <small>{tool.description}</small>}{tool.properties.length > 0 && <small className="muted">参数 {tool.properties.join('、')}</small>}</span>
            </label>
          </li>)}</ul>
        </div>}
        <div className="actions">
          {editing && <button type="button" onClick={() => setDeleting(current => !current)}>删除</button>}
          <button type="button" onClick={() => { setForm(undefined); setMessage(''); }}>取消</button>
          <button className="primary" type="submit" disabled={form.enabled && (!form.expectedSnapshotHash || !form.allowedTools.length)}>保存服务</button>
        </div>
        {deleting && editing && <div className="actions"><span>删除后立即停止新调用。</span>
          <button type="button" onClick={() => void perform(async () => {
            setSettings(await api(endpoint + '/' + editing, { method: 'DELETE' }) as Settings);
            setForm(undefined);
            setMessage('服务已删除。');
          }, '删除 MCP 服务失败。')}>确认删除</button></div>}
      </fieldset>
    </form>}
    {message && <p role="status" className="settings-message">{message}</p>}
  </section>;
}
