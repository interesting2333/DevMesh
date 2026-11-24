import { createHash } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { canonical } from '@devmesh/storage-sqlite';
import { ToolError } from './protocol.js';

export const digest = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');
const maxBytes = 1024 * 1024;
const maxTools = 256;

export class ExternalMcpClient {
  private readonly client = new Client({ name: 'devmesh', version: '0.1.0' });
  private readonly transport: StreamableHTTPClientTransport;

  constructor(endpoint: string, private readonly secret: string, private readonly timeoutMs: number, auth: 'bearer' | 'api-key' = 'bearer') {
    this.transport = new StreamableHTTPClientTransport(new URL(endpoint), {
      reconnectionOptions: { maxRetries: 0, maxReconnectionDelay: 0, initialReconnectionDelay: 0, reconnectionDelayGrowFactor: 1 },
      fetch: async (input, init) => {
        const url = input instanceof Request ? input.url : String(input);
        if (url !== endpoint) throw new ToolError('MCP_ENDPOINT_INVALID', 'not-sent');
        const headers = new Headers(init?.headers);
        if (auth === 'api-key') headers.set('x-api-key', this.secret);
        else headers.set('Authorization', 'Bearer ' + this.secret);
        const deadline = AbortSignal.timeout(this.timeoutMs);
        const signal = init?.signal ? AbortSignal.any([init.signal, deadline]) : deadline;
        const response = await fetch(input, { ...init, headers, redirect: 'error', signal });
        if (response.status === 401 || response.status === 403) {
          await response.body?.cancel();
          throw new ToolError('MCP_AUTH_REQUIRED', 'known');
        }
        if (!response.body) return response;
        let size = 0;
        const body = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            size += chunk.byteLength;
            if (size > maxBytes) throw new ToolError('MCP_RESPONSE_TOO_LARGE', 'unknown');
            controller.enqueue(chunk);
          }
        }));
        return new Response(body, { status: response.status, headers: response.headers });
      }
    });
  }

  async discover() {
    const signal = AbortSignal.timeout(this.timeoutMs);
    await this.client.connect(this.transport, { signal, timeout: this.timeoutMs });
    const tools: Awaited<ReturnType<Client['listTools']>>['tools'] = [];
    const cursors = new Set<string>();
    let cursor: string | undefined;
    do {
      const page = await this.client.listTools(cursor ? { cursor } : {}, { signal, timeout: this.timeoutMs });
      tools.push(...page.tools);
      cursor = page.nextCursor;
      if (tools.length > maxTools || cursors.size >= 16 || (cursor && cursors.has(cursor))) {
        throw new ToolError('MCP_TOOL_CATALOG_TOO_LARGE', 'not-sent');
      }
      if (cursor) cursors.add(cursor);
    } while (cursor);
    if (new Set(tools.map(tool => tool.name)).size !== tools.length) {
      throw new ToolError('MCP_CATALOG_INVALID', 'not-sent');
    }
    const snapshot = {
      protocolVersion: this.transport.protocolVersion ?? '',
      serverVersion: this.client.getServerVersion()?.version ?? '',
      tools: tools.sort((a, b) => a.name.localeCompare(b.name))
    };
    if (!snapshot.protocolVersion || !snapshot.serverVersion || canonical(snapshot).includes(this.secret)) {
      throw new ToolError('MCP_CATALOG_INVALID', 'not-sent');
    }
    return { ...snapshot, sha256: digest(snapshot) };
  }

  async call(name: string, args: Record<string, unknown>, signal: AbortSignal) {
    const result = await this.client.callTool({ name, arguments: args }, undefined, { signal, timeout: this.timeoutMs });
    const content = Array.isArray(result.content)
      ? result.content.flatMap(block => block.type === 'text' && typeof block.text === 'string' ? [block.text] : [])
      : [];
    const rendered = JSON.stringify(result.structuredContent ?? content);
    return { failed: result.isError === true, output: rendered.split(this.secret).join('[redacted]').slice(0, 16000) };
  }

  async close() {
    await this.transport.terminateSession().catch(() => undefined);
    await this.client.close().catch(() => undefined);
  }
}

export type ExternalCatalog = Awaited<ReturnType<ExternalMcpClient['discover']>>;
