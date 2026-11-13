import { createServer } from 'node:http';
import { application } from './app.js';
import { WorkerStore } from './store.js';
export async function startService(options: { root: string; port?: number; host?: '127.0.0.1' | '0.0.0.0'; readOnly?: boolean; runtimeRoot?: string; webRoot?: string; workerScript?: URL }) {
  const host = options.host ?? '127.0.0.1';
  if (!['127.0.0.1', '0.0.0.0'].includes(host)) throw new Error('INVALID_HOST');
  const store = new WorkerStore(options.root, options.readOnly, options.workerScript, options.runtimeRoot);
  try { await store.initialized(); } catch (error) { await store.close(); throw error; }
  const server = createServer(application(store, options.webRoot));
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  try {
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(options.port ?? 4317, host, () => { server.off('error', reject); resolve(); }); });
  } catch (error) { await store.close(); throw error; }
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('LISTEN_FAILED');
  let closed = false;
  return {
    host,
    url: `http://127.0.0.1:${address.port}`,
    async close() {
      if (closed) return;
      closed = true;
      const timeout = setTimeout(() => server.closeAllConnections(), 10000).unref();
      try { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
      finally { clearTimeout(timeout); await store.close(); }
    }
  };
}
