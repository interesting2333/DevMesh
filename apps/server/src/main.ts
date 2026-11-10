import { ConfigError, loadConfig, startPlatform } from '@devmesh/platform-core';
import type { FoundationServer } from '@devmesh/platform-core';

function log(event: string, fields: Record<string, unknown> = {}): void {
  process.stdout.write(`${JSON.stringify({ event, ...fields })}\n`);
}

function configArgument(args: string[]): string | undefined {
  if (args.length === 0) return undefined;
  if (args.length === 2 && args[0] === '--config' && args[1]) return args[1];
  throw new ConfigError('Usage: node apps/server/dist/main.mjs [--config <file.json>]');
}

async function main(): Promise<void> {
  if (process.argv.length === 3 && process.argv[2] === '--help') {
    process.stdout.write('Usage: node apps/server/dist/main.mjs [--config <file.json>]\n');
    return;
  }
  let platform: FoundationServer | undefined;
  let stopping: Promise<void> | undefined;
  let requested: string | undefined;
  const shutdown = (reason: string): Promise<void> => {
    requested ??= reason;
    const running = platform;
    if (!running) return Promise.resolve();
    stopping ??= (async () => {
      try {
        await running.stop();
        log('stopped', { reason: requested });
      } catch (error) {
        fatal(error);
      } finally {
        process.off('SIGINT', onInterrupt);
        process.off('SIGTERM', onTerminate);
        process.off('message', onMessage);
        process.off('disconnect', onDisconnect);
        if (process.connected) process.disconnect();
      }
    })();
    return stopping;
  };
  const onInterrupt = () => { void shutdown('SIGINT'); };
  const onTerminate = () => { void shutdown('SIGTERM'); };
  const onDisconnect = () => { void shutdown('parent-disconnected'); };
  const onMessage = (message: unknown) => {
    if (typeof message === 'object' && message !== null && 'type' in message && message.type === 'shutdown') void shutdown('ipc');
  };
  process.on('SIGINT', onInterrupt);
  process.on('SIGTERM', onTerminate);
  process.on('message', onMessage);
  process.on('disconnect', onDisconnect);
  try {
    const config = loadConfig(process.env, configArgument(process.argv.slice(2)));
    if(config.storage)log('storage-config',{dataRoot:config.storage.dataRoot,backupRoot:config.storage.backupRoot,sources:config.storageSources});
    platform = await startPlatform(config);
    if (requested) {
      await shutdown(requested);
      return;
    }
    log('ready', { host: platform.address.address, port: platform.address.port, pid: process.pid, scope: 'platform-foundation' });
  } catch (error) {
    process.off('SIGINT', onInterrupt);
    process.off('SIGTERM', onTerminate);
    process.off('message', onMessage);
    process.off('disconnect', onDisconnect);
    if (process.connected) process.disconnect();
    throw error;
  }
}

function fatal(error: unknown): void {
  const code = error instanceof Error && 'code' in error ? error.code : 'STARTUP_FAILED';
  process.stderr.write(`${JSON.stringify({ event: 'fatal', code, message: error instanceof Error ? error.message : 'Unknown error' })}\n`);
  process.exitCode = 1;
}

void main().catch(fatal);
