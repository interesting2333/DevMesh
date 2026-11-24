import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Validator } from '@cfworker/json-schema';
import type { Schema } from '@cfworker/json-schema';
import { opaqueKey, executionPermit } from '@devmesh/contracts';
import type { RuntimeTool } from '@devmesh/agent-runtime';
import { StorageError } from '@devmesh/storage-sqlite';
import type { SqliteStorage } from '@devmesh/storage-sqlite';
import { z } from 'zod';
import { ExternalMcpClient, digest } from './external-client.js';
import type { ExternalCatalog } from './external-client.js';
import { ToolError } from './protocol.js';

const toolName = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const endpointId = z.string().max(32).regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);
const credentialRef = z.string().regex(/^mcp\.[a-z][a-z0-9_]{0,47}$/);
const snapshotHash = z.string().regex(/^[a-f0-9]{64}$/);
const atlassianEndpoint = 'https://mcp.atlassian.com/v2/mcp?tools=all';
const exaEndpoint = 'https://mcp.exa.ai/mcp';
const endpoint = z.string().trim().max(500).transform((value, ctx) => {
  try {
    const url = new URL(value);
    if (!url.username && !url.password && (!url.search || url.href === atlassianEndpoint) && !url.hash &&
      (url.protocol === 'https:' || (url.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(url.hostname)))) return url.href;
  } catch { /* report the same validation error for invalid URLs */ }
  ctx.addIssue({ code: 'custom', message: 'Use HTTPS or an explicitly trusted loopback endpoint' });
  return z.NEVER;
});
const connection = z.strictObject({
  endpointId,
  displayName: z.string().trim().min(1).max(80),
  endpoint,
  credentialRef,
  timeoutMs: z.number().int().min(1000).max(15000),
  projectId: opaqueKey.nullable(),
  repository: z.string().trim().max(180).regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/).nullable()
});
const update = connection.extend({
  enabled: z.boolean(),
  allowedTools: z.array(toolName).max(64).refine(tools => new Set(tools).size === tools.length),
  expectedSnapshotHash: snapshotHash.nullable()
});
const stored = update.extend({ updatedAt: z.string(), updatedBy: opaqueKey });
const auditEntry = z.strictObject({
  endpointId, actor: opaqueKey, at: z.string(), action: z.enum(['ADD', 'UPDATE', 'REMOVE']),
  enabled: z.boolean(), allowedTools: z.array(toolName).max(64), snapshotHash: snapshotHash.nullable()
});
const settingsFile = z.strictObject({ connections: z.array(stored).max(12), audit: z.array(auditEntry).max(200).default([]) });
const policySchema = z.strictObject({
  endpoint,
  credentialRef,
  readTools: z.array(toolName).max(64)
});
export type McpEndpointPolicy = z.input<typeof policySchema>;
export const githubEndpoint = 'https://api.githubcopilot.com/mcp/';
export const context7Endpoint = 'https://mcp.context7.com/mcp';
const builtinPolicies: McpEndpointPolicy[] = [
  { endpoint: githubEndpoint, credentialRef: 'mcp.github', readTools: ['get_file_contents', 'issue_read', 'pull_request_read', 'actions_list'] },
  { endpoint: context7Endpoint, credentialRef: 'mcp.context7', readTools: ['resolve-library-id', 'query-docs'] },
  { endpoint: atlassianEndpoint, credentialRef: 'mcp.atlassian', readTools: ['getJiraIssue', 'searchJiraIssuesUsingJql'] },
  { endpoint: 'https://mcp.linear.app/mcp/readonly', credentialRef: 'mcp.linear', readTools: ['get_issue', 'list_issues', 'get_project', 'list_projects'] },
  { endpoint: exaEndpoint, credentialRef: 'mcp.exa', readTools: ['web_search_exa'] }
];
type Connection = z.output<typeof connection>;
type Stored = z.output<typeof stored>;
type Policy = z.output<typeof policySchema>;
const runtimeName = (id: string, name: string) => `mcp_${id.replaceAll('-', '_')}__${name}`;
const githubMethods: Record<string, readonly string[]> = {
  issue_read: ['get', 'get_comments', 'get_sub_issues', 'get_labels'],
  pull_request_read: ['get', 'get_diff', 'get_files', 'get_reviews', 'get_comments', 'get_status'],
  actions_list: ['list_workflows', 'list_workflow_runs', 'list_workflow_jobs', 'list_workflow_run_artifacts']
};
const executionHash = (item: Stored) => digest({
  endpoint: item.endpoint, credentialRef: item.credentialRef, timeoutMs: item.timeoutMs,
  projectId: item.projectId, repository: item.repository, allowedTools: [...item.allowedTools].sort(), expectedSnapshotHash: item.expectedSnapshotHash
});
const fail = (code: string, status: number): never => { throw new StorageError(code, status, code); };

function catalogView(catalog: ExternalCatalog, id: string, policy: Policy) {
  return {
    protocolVersion: catalog.protocolVersion.slice(0, 80),
    serverVersion: catalog.serverVersion.slice(0, 80),
    snapshotHash: catalog.sha256,
    tools: catalog.tools.filter(tool => toolName.safeParse(tool.name).success).map(tool => ({
      name: tool.name,
      runtimeName: runtimeName(id, tool.name),
      description: tool.description?.slice(0, 400) ?? '',
      eligible: policy.readTools.includes(tool.name) && tool.annotations?.readOnlyHint !== false,
      properties: Object.keys(tool.inputSchema.properties ?? {}).slice(0, 20).map(name => name.slice(0, 80))
    }))
  };
}
type CatalogView = ReturnType<typeof catalogView>;
type Status = {
  state: 'CONNECTED' | 'FAILED' | 'REVIEW_REQUIRED' | 'RUNTIME_UNAVAILABLE';
  checkedAt: string;
  errorCode?: string;
  catalog?: CatalogView;
};
const errorCode = (error: unknown) => error instanceof ToolError ? error.code
  : error instanceof StorageError ? error.code : 'MCP_CONNECT_FAILED';

export function createMcpSettings(root: string, storage: SqliteStorage, customPolicies: readonly McpEndpointPolicy[] = [],
  credentials = async (ref: string): Promise<string | undefined> => process.env['DEVMESH_CREDENTIAL_' + ref.toUpperCase().replace('.', '_')],
  playwrightMcpCheckIds: () => readonly string[] = () => []) {
  const policies = z.array(policySchema).parse([...builtinPolicies, ...customPolicies]);
  if (new Set(policies.map(policy => policy.credentialRef)).size !== policies.length) {
    throw new Error('MCP credential references must each bind to a single endpoint');
  }
  const path = join(root, 'mcp.json');
  const active = new Map<string, { hash: string; status: Status }>();
  const discovery = new Map<string, { expires: number; view: CatalogView }>();
  const lastProbe = new Map<string, { connection: string; checkedAt: string; errorCode?: string }>();
  const clients = new Set<ExternalMcpClient>();
  let stopping = false;
  let probes = 0;

  function read(): z.output<typeof settingsFile> {
    if (!existsSync(path)) return { connections: [], audit: [] };
    try {
      const file = settingsFile.parse(JSON.parse(readFileSync(path, 'utf8')));
      if (new Set(file.connections.map(item => item.endpointId)).size === file.connections.length) return file;
    } catch { /* replace with a redacted settings error */ }
    return fail('MCP_SETTINGS_CORRUPT', 500);
  }

  function write(connections: Stored[], audit: z.output<typeof auditEntry>[], item: Stored, actor: string, action: 'ADD' | 'UPDATE' | 'REMOVE') {
    mkdirSync(root, { recursive: true, mode: 0o700 });
    const temporary = join(root, `.${randomUUID()}.tmp`);
    try {
      const entry = { endpointId: item.endpointId, actor, at: new Date().toISOString(), action,
        enabled: action !== 'REMOVE' && item.enabled, allowedTools: item.allowedTools, snapshotHash: item.expectedSnapshotHash };
      writeFileSync(temporary, JSON.stringify({ connections, audit: [...audit.slice(-199), entry] }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
      renameSync(temporary, path);
    } finally { rmSync(temporary, { force: true }); }
  }

  function policyFor(item: Connection) {
    return policies.find(policy => policy.credentialRef === item.credentialRef && policy.endpoint === item.endpoint)
      ?? fail('MCP_ENDPOINT_NOT_APPROVED', 422);
  }

  function connectionKey(item: Connection) {
    return digest([item.endpointId, item.endpoint, item.credentialRef, item.timeoutMs]);
  }

  function recordProbe(item: Connection, checkedAt: string, error?: string) {
    lastProbe.delete(item.endpointId);
    if (lastProbe.size >= 40) lastProbe.delete(lastProbe.keys().next().value!);
    lastProbe.set(item.endpointId, { connection: connectionKey(item), checkedAt, ...(error ? { errorCode: error } : {}) });
  }

  async function connect(item: Connection) {
    const policy = policyFor(item);
    const secret = await credentials(item.credentialRef);
    if (stopping) return fail('SERVICE_STOPPING', 503);
    if (!secret || !/^[A-Za-z0-9._~+/-]{8,4096}={0,2}$/.test(secret)) return fail('MCP_CREDENTIAL_UNAVAILABLE', 422);
    const client = new ExternalMcpClient(item.endpoint, secret, item.timeoutMs, policy.endpoint === exaEndpoint ? 'api-key' : 'bearer');
    clients.add(client);
    try {
      const catalog = await client.discover();
      return { client, catalog, view: catalogView(catalog, item.endpointId, policy) };
    } catch (error) {
      await closeClient(client);
      throw error;
    }
  }

  async function closeClient(client: ExternalMcpClient) {
    clients.delete(client);
    await client.close();
  }

  function view() {
    return {
      connections: read().connections.map(item => {
        const current = active.get(item.endpointId);
        const recent = lastProbe.get(item.endpointId);
        const probe = recent?.connection === connectionKey(item) ? { checkedAt: recent.checkedAt, probeErrorCode: recent.errorCode } : {};
        const status = !item.enabled ? { state: 'DISABLED' }
          : current?.hash === executionHash(item) ? current.status : { state: 'PENDING_RESTART' };
        return { ...item, status: { ...probe, ...status } };
      }),
      policies: policies.map(({ endpoint, credentialRef }) => ({ endpoint, credentialRef })),
      playwrightMcpCheckIds: playwrightMcpCheckIds()
    };
  }

  const settings = {
    view,
    async discover(principalId: string, input: unknown) {
      const item = connection.parse(input);
      if (probes >= 4) return fail('LIMIT_EXCEEDED', 429);
      probes++;
      try {
        const found = await connect(item);
        try {
          const key = digest([principalId, connectionKey(item)]);
          discovery.delete(key);
          if (discovery.size >= 40) discovery.delete(discovery.keys().next().value!);
          discovery.set(key, { view: found.view, expires: Date.now() + 10 * 60 * 1000 });
          const checkedAt = new Date().toISOString();
          recordProbe(item, checkedAt);
          return { ok: true as const, checkedAt, catalog: found.view };
        } finally { await closeClient(found.client); }
      } catch (error) {
        const checkedAt = new Date().toISOString();
        const code = errorCode(error);
        recordProbe(item, checkedAt, code);
        return { ok: false as const, checkedAt, errorCode: code };
      } finally { probes--; }
    },
    save(principalId: string, input: unknown, id?: string) {
      const item = update.parse(input);
      policyFor(item);
      const { connections: items, audit } = read();
      const previous = items.find(value => value.endpointId === item.endpointId);
      if (id !== undefined && (id !== item.endpointId || !previous)) return fail('RESOURCE_NOT_FOUND', 404);
      if (id === undefined && previous) return fail('MCP_CONNECTION_EXISTS', 409);
      if (!previous && items.length >= 12) return fail('LIMIT_EXCEEDED', 422);
      if (item.enabled && (!item.allowedTools.length || !item.expectedSnapshotHash ||
        (item.endpoint !== context7Endpoint && !item.projectId) || (item.endpoint === githubEndpoint && !item.repository))) {
        return fail('MCP_TOOL_APPROVAL_REQUIRED', 422);
      }
      const next = { ...item, updatedAt: new Date().toISOString(), updatedBy: principalId };
      if (item.expectedSnapshotHash || item.allowedTools.length) {
        const proof = discovery.get(digest([principalId, connectionKey(item)]));
        if ((!previous || executionHash(next) !== executionHash(previous) || !previous.enabled && item.enabled)
          && (!proof || proof.expires < Date.now() || proof.view.snapshotHash !== item.expectedSnapshotHash
            || item.allowedTools.some(name => !proof.view.tools.some(tool => tool.name === name && tool.eligible)))) {
          return fail('MCP_TOOL_APPROVAL_REQUIRED', 422);
        }
      }
      write(previous ? items.map(value => value.endpointId === item.endpointId ? next : value) : [...items, next], audit, next, principalId, previous ? 'UPDATE' : 'ADD');
      if (!previous || previous.enabled !== next.enabled || executionHash(previous) !== executionHash(next)) active.delete(item.endpointId);
      return view();
    },
    setEnabled(principalId: string, id: string, enabled: boolean) {
      const item = read().connections.find(value => value.endpointId === id);
      if (!item) return fail('RESOURCE_NOT_FOUND', 404);
      if (item.enabled === enabled) return view();
      const { updatedAt: _updatedAt, updatedBy: _updatedBy, ...config } = item;
      return settings.save(principalId, { ...config, enabled }, id);
    },
    remove(principalId: string, id: string) {
      const { connections, audit } = read();
      const item = connections.find(value => value.endpointId === id);
      if (!item) return fail('RESOURCE_NOT_FOUND', 404);
      write(connections.filter(value => value.endpointId !== id), audit, item, principalId, 'REMOVE');
      active.delete(id);
      lastProbe.delete(id);
      return view();
    },
    async start(runtimeAvailable: boolean): Promise<RuntimeTool[]> {
      const tools: RuntimeTool[] = [];
      await Promise.all(read().connections.filter(item => item.enabled).map(async item => {
        const hash = executionHash(item);
        const checkedAt = new Date().toISOString();
        const setStatus = (status: Omit<Status, 'checkedAt'>) => active.set(item.endpointId, { hash, status: { ...status, checkedAt } });
        let client: ExternalMcpClient | undefined;
        try {
          const found = await connect(item);
          client = found.client;
          if (item.expectedSnapshotHash !== found.catalog.sha256) {
            setStatus({ state: 'REVIEW_REQUIRED', errorCode: 'MCP_SCHEMA_CHANGED', catalog: found.view });
            return;
          }
          const approved = found.catalog.tools.filter(tool => item.allowedTools.includes(tool.name) &&
            found.view.tools.some(entry => entry.name === tool.name && entry.eligible));
          if (!approved.length || approved.length !== item.allowedTools.length ||
            (item.endpoint !== context7Endpoint && !item.projectId) || (item.endpoint === githubEndpoint && !item.repository)) {
            setStatus({ state: 'REVIEW_REQUIRED', errorCode: 'MCP_TOOL_APPROVAL_REQUIRED', catalog: found.view });
            return;
          }
          if (!runtimeAvailable) {
            setStatus({ state: 'RUNTIME_UNAVAILABLE', catalog: found.view });
            return;
          }
          const registered = approved.map((tool): RuntimeTool => {
            const name = runtimeName(item.endpointId, tool.name);
            const metadata = { source: 'mcp', endpointId: item.endpointId, toolName: tool.name, snapshotHash: found.catalog.sha256 };
            const validate = new Validator(tool.inputSchema as Schema, '7', true);
            return {
              name,
              description: tool.description?.slice(0, 1000) || tool.name,
              schema: z.record(z.string(), z.json()),
              inputSchema: tool.inputSchema,
              effectClass: 'READ',
              connection: { ...metadata, endpoint: item.endpoint, protocolVersion: found.catalog.protocolVersion, serverVersion: found.catalog.serverVersion },
              async execute(_operationId, input, host, signal) {
                const failure = (code: string) => ({ state: 'FAILED' as const, value: { ...metadata, code } });
                const current = read().connections.find(value => value.endpointId === item.endpointId);
                if (stopping || !current?.enabled || executionHash(current) !== hash || active.get(item.endpointId)?.hash !== hash) {
                  return failure('MCP_CONNECTION_DISABLED');
                }
                const args = z.record(z.string(), z.json()).parse(input);
                try {
                  if (!validate.validate(args).valid) return failure('MCP_TOOL_ARGUMENTS_INVALID');
                } catch { return failure('MCP_TOOL_ARGUMENTS_INVALID'); }
                try {
                  const authority = await storage.request('authorizeMcpAction', { permit: executionPermit.parse(host.permit), toolName: name, action: 'read' });
                  if (item.projectId && item.projectId !== authority.projectId) return failure('MCP_AUTHORITY_DENIED');
                } catch { return failure('MCP_AUTHORITY_DENIED'); }
                if (item.repository && (typeof args.owner !== 'string' || typeof args.repo !== 'string' ||
                  `${args.owner}/${args.repo}`.toLowerCase() !== item.repository.toLowerCase())) return failure('MCP_AUTHORITY_DENIED');
                const methods = item.endpoint === githubEndpoint ? githubMethods[tool.name] : undefined;
                if (methods && (typeof args.method !== 'string' || !methods.includes(args.method))) return failure('MCP_AUTHORITY_DENIED');
                let session: ExternalMcpClient | undefined;
                try {
                  const latest = await connect(item);
                  session = latest.client;
                  if (latest.catalog.sha256 !== found.catalog.sha256) {
                    if (active.get(item.endpointId)?.hash === hash) {
                      setStatus({ state: 'REVIEW_REQUIRED', errorCode: 'MCP_SCHEMA_CHANGED', catalog: latest.view });
                    }
                    return failure('MCP_SCHEMA_CHANGED');
                  }
                  const currentStatus = active.get(item.endpointId);
                  const saved = read().connections.find(value => value.endpointId === item.endpointId);
                  if (stopping || signal.aborted || currentStatus?.hash !== hash || currentStatus.status.state !== 'CONNECTED'
                    || !saved?.enabled || executionHash(saved) !== hash) return failure('MCP_CONNECTION_DISABLED');
                  await storage.request('authorizeMcpAction', { permit: executionPermit.parse(host.permit), toolName: name, action: 'read' });
                  if (stopping || signal.aborted || active.get(item.endpointId) !== currentStatus) return failure('MCP_CONNECTION_DISABLED');
                  const result = await session.call(tool.name, args, signal);
                  return result.failed ? failure('MCP_REMOTE_TOOL_ERROR') : { state: 'SUCCEEDED', value: { ...metadata, result: result.output } };
                } catch { return failure('MCP_REMOTE_CALL_FAILED'); }
                finally { if (session) await closeClient(session); }
              },
              async query() { return { state: 'OUTCOME_UNKNOWN' }; }
            };
          });
          tools.push(...registered);
          setStatus({ state: 'CONNECTED', catalog: found.view });
        } catch (error) {
          setStatus({ state: 'FAILED', errorCode: errorCode(error) });
        } finally { if (client) await closeClient(client); }
      }));
      return tools.sort((a, b) => a.name.localeCompare(b.name));
    },
    stopAdmission() { stopping = true; },
    async close() {
      stopping = true;
      await Promise.all([...clients].map(closeClient));
    }
  };
  return settings;
}

export type McpSettings = ReturnType<typeof createMcpSettings>;
