import type { NextFunction, Request, Response, Router } from 'express';
import { lstat, open, realpath } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { StorageError } from '@devmesh/storage-sqlite';
import { z } from 'zod';
import type { Identity } from './input-auth.js';

const playwrightConfig = z.strictObject({
  displayName: z.string().trim().min(1).max(80),
  browser: z.enum(['msedge', 'chrome', 'chromium']),
  headless: z.boolean()
});
export interface LocalPlaywrightAccess {
  view(): unknown;
  save(input: z.infer<typeof playwrightConfig>): Promise<unknown>;
  setEnabled(enabled: boolean): Promise<unknown>;
  check(): Promise<unknown>;
  remove(): Promise<unknown>;
}

export interface McpSettingsAccess {
  administrator: string;
  playwrightPreviewResultsDir?: string | undefined;
  localPlaywright?: LocalPlaywrightAccess | undefined;
  view(): unknown;
  discover(principalId: string, input: unknown): Promise<unknown>;
  save(principalId: string, input: unknown, id?: string): unknown;
  setEnabled(principalId: string, id: string, enabled: boolean): unknown;
  remove(principalId: string, id: string): unknown;
}

type Route = (handler: (request: Request, response: Response, identity: Identity) => Promise<void>) =>
  (request: Request, response: Response, next: NextFunction) => void;

const evidenceTypes = new Map([
  ['board.png', 'image/png'], ['board-snapshot.txt', 'text/plain'], ['report.json', 'application/json']
]);
const previewReport = z.object({
  status: z.literal('PASSED'), scenario: z.literal('task-board-create-and-reload'),
  transport: z.literal('stdio'), packageVersion: z.string().regex(/^\d+\.\d+\.\d+$/)
});

async function readEvidence(directory: string, name: string, maxBytes: number) {
  const path = join(resolve(directory), name);
  try {
    if (await realpath(path) !== path) return undefined;
    const original = await lstat(path);
    if (!original.isFile() || original.size > maxBytes) return undefined;
    const file = await open(path, 'r');
    try {
      const info = await file.stat();
      if (info.dev !== original.dev || info.ino !== original.ino || info.size !== original.size) return undefined;
      const bytes = Buffer.alloc(info.size);
      if ((await file.read(bytes, { position: 0 })).bytesRead !== info.size) return undefined;
      return { bytes, checkedAt: info.mtime.toISOString() };
    } finally { await file.close(); }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

export function mountMcpSettingsRoutes(router: Router, settings: McpSettingsAccess, route: Route, json: (request: Request) => unknown) {
  const adminRoute = (handler: Parameters<Route>[0]) => route(async (request, response, identity) => {
    if (identity.principalId !== settings.administrator) throw new StorageError('FORBIDDEN', 403, 'MCP settings require deployment administrator access');
    await handler(request, response, identity);
  });
  const authorized = (handler: (request: Request, identity: Identity) => unknown) => adminRoute(async (request, response, identity) => {
    response.json(await handler(request, identity));
  });
  router.get('/settings/mcp', authorized(() => settings.view()));
  const local = settings.localPlaywright;
  router.get('/settings/mcp/playwright/service', authorized(() => local?.view() ?? null));
  if (local) {
    router.put('/settings/mcp/playwright/service', authorized(request => local.save(playwrightConfig.parse(json(request)))));
    router.patch('/settings/mcp/playwright/service', authorized(request => {
      const { enabled } = z.strictObject({ enabled: z.boolean() }).parse(json(request));
      return local.setEnabled(enabled);
    }));
    router.delete('/settings/mcp/playwright/service', authorized(() => local.remove()));
    router.post('/settings/mcp/playwright/check', authorized(() => local.check()));
  }
  const directory = settings.playwrightPreviewResultsDir;
  router.get('/settings/mcp/playwright/result', authorized(async () => {
    if (!directory) return null;
    const result = await readEvidence(directory, 'report.json', 16 * 1024);
    if (!result) return null;
    let data: unknown;
    try { data = JSON.parse(result.bytes.toString('utf8')); }
    catch { return null; }
    const report = previewReport.safeParse(data);
    if (!report.success) return null;
    const evidence = await Promise.all([
      readEvidence(directory, 'board.png', 8 * 1024 * 1024),
      readEvidence(directory, 'board-snapshot.txt', 8 * 1024 * 1024)
    ]);
    return evidence.every(file => file?.bytes.length && file.checkedAt <= result.checkedAt)
      ? { ...report.data, checkedAt: result.checkedAt } : null;
  }));
  router.get('/settings/mcp/playwright/evidence/:name', adminRoute(async (request, response) => {
    const name = String(request.params.name);
    const type = evidenceTypes.get(name);
    if (!directory || !type) throw new StorageError('RESOURCE_NOT_FOUND', 404, 'Playwright evidence is unavailable');
    const result = await readEvidence(directory, name, 8 * 1024 * 1024);
    if (!result) throw new StorageError('RESOURCE_NOT_FOUND', 404, 'Playwright evidence is unavailable');
    response.set('Cache-Control', 'no-store');
    response.set('X-Content-Type-Options', 'nosniff');
    response.attachment(name).type(type).send(result.bytes);
  }));
  router.post('/settings/mcp', authorized((request, identity) => settings.save(identity.principalId, json(request))));
  router.post('/settings/mcp/discover', authorized((request, identity) => settings.discover(identity.principalId, json(request))));
  router.put('/settings/mcp/:id', authorized((request, identity) => settings.save(identity.principalId, json(request), String(request.params.id))));
  router.patch('/settings/mcp/:id', authorized((request, identity) => {
    const { enabled } = z.strictObject({ enabled: z.boolean() }).parse(json(request));
    return settings.setEnabled(identity.principalId, String(request.params.id), enabled);
  }));
  router.delete('/settings/mcp/:id', authorized((request, identity) => settings.remove(identity.principalId, String(request.params.id))));
}
