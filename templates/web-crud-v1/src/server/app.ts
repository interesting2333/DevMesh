import express from 'express';
import type { ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { AppError, TaskInput } from '../shared/task.js';
import type { Mutation } from './database.js';
import type { TaskStore } from './store.js';

export function application(store: TaskStore, webRoot?: string): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use((request, response, next) => {
    const host = request.get('host') ?? '';
    if (!/^(127\.0\.0\.1|localhost|\[::1\])(?::\d{1,5})?$/.test(host)) { response.status(403).json({ error: 'HOST_DENIED' }); return; }
    const origin = request.get('origin');
    if (origin && origin !== `http://${host}`) { response.status(403).json({ error: 'ORIGIN_DENIED' }); return; }
    response.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'", 'Cache-Control': 'no-store' });
    next();
  });
  app.use('/api', express.json({ limit: '32kb', strict: true }));
  app.get('/api/health', async (_request, response) => { await store.list(); response.json({ status: 'ready' }); });
  app.get('/api/tasks', async (_request, response) => { response.json(await store.list()); });
  app.post('/api/tasks', async (request, response) => {
    const key = request.get('idempotency-key') ?? '';
    const result = await store.mutate({ kind: 'create', key, input: TaskInput.parse(request.body) });
    response.status(result.status).json({ task: result.task });
  });
  const revision = (header: string | undefined) => {
    if (!header || !/^"[1-9]\d{0,8}"$/.test(header)) throw new AppError('REVISION_REQUIRED', 428);
    return Number(header.slice(1, -1));
  };
  app.put('/api/tasks/:id', async (request, response) => {
    const operation: Mutation = { kind: 'update', key: request.get('idempotency-key') ?? '', id: z.uuid().parse(request.params.id), revision: revision(request.get('if-match')), input: TaskInput.parse(request.body) };
    const result = await store.mutate(operation);
    response.status(result.status).json({ task: result.task });
  });
  app.delete('/api/tasks/:id', async (request, response) => {
    const result = await store.mutate({ kind: 'delete', key: request.get('idempotency-key') ?? '', id: z.uuid().parse(request.params.id), revision: revision(request.get('if-match')) });
    response.status(result.status).json({ task: result.task });
  });
  app.use('/api', (_request, response) => { response.status(404).json({ error: 'NOT_FOUND' }); });
  if (webRoot) {
    app.use(express.static(webRoot, { index: false, dotfiles: 'deny', fallthrough: true }));
    app.get('/', (_request, response) => { response.sendFile('index.html', { root: webRoot, dotfiles: 'deny' }); });
  }
  const errors: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
    const bodyError = error as { type?: string };
    if (error instanceof AppError) response.status(error.status).json({ error: error.code });
    else if (error instanceof z.ZodError || bodyError?.type === 'entity.parse.failed') response.status(400).json({ error: 'INVALID_INPUT' });
    else if (bodyError?.type === 'entity.too.large') response.status(413).json({ error: 'BODY_TOO_LARGE' });
    else response.status(500).json({ error: 'INTERNAL_ERROR' });
  };
  app.use(errors);
  return app;
}
