import { fileURLToPath } from 'node:url';

export async function main(args: string[], environment: NodeJS.ProcessEnv = process.env): Promise<void> {
  const root = environment.APP_DATA_ROOT;
  if (!root) throw new Error('APP_DATA_ROOT_REQUIRED');
  if (args.length !== 1) throw new Error('USE_INIT_OR_SERVE');
  if (args[0] === 'init') { const { TaskDatabase } = await import('./database.js'); TaskDatabase.initialize(root); console.log('DATASET_INITIALIZED'); return; }
  if (args[0] !== 'serve') throw new Error('USE_INIT_OR_SERVE');
  if (environment.APP_READ_ONLY && !['true', 'false'].includes(environment.APP_READ_ONLY)) throw new Error('INVALID_READ_ONLY');
  const host = environment.APP_HOST ?? '127.0.0.1';
  if (host !== '127.0.0.1' && host !== '0.0.0.0') throw new Error('INVALID_HOST');
  const port = Number(environment.APP_PORT ?? '4317');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('INVALID_PORT');
  const { startService } = await import('./service.js');
  const service = await startService({ root, port, host, readOnly: environment.APP_READ_ONLY === 'true', ...(environment.APP_RUNTIME_ROOT === undefined ? {} : { runtimeRoot: environment.APP_RUNTIME_ROOT }), webRoot: fileURLToPath(new URL('../web/', import.meta.url)) });
  console.log(`APP_READY ${service.url}`);
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    void service.close().then(() => { console.log('APP_STOPPED'); process.exitCode = 0; }).catch(() => { console.error('APP_STOP_FAILED'); process.exitCode = 1; }).finally(() => { if (process.connected) process.disconnect(); });
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  // A trusted Node parent can drain on Windows, where kill('SIGTERM') is forced termination.
  if (process.send) process.on('message', message => { if (typeof message === 'object' && message !== null && 'type' in message && message.type === 'shutdown') stop(); });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void main(process.argv.slice(2)).catch(() => { console.error('APP_START_FAILED'); process.exitCode = 1; });
}
