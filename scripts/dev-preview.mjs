import { loadConfig } from '../packages/platform-core/dist/config.mjs';

const args = process.argv.slice(2);
const index = args.indexOf('--config');
const configPath = index >= 0 ? args[index + 1] : undefined;
if (index >= 0 && (!configPath || args.length !== 2)) {
  process.stderr.write('Usage: node scripts/dev-preview.mjs --config <file.json>\n');
  process.exit(2);
}

const config = loadConfig(process.env, configPath);
const { startPlatform } = await import('../packages/platform-core/dist/index.mjs');
const platform = await startPlatform(config, {
  identityResolver: async () => ({ principalId: 'user_1' })
});

const address = `http://${platform.address.address}:${platform.address.port}`;
process.stdout.write(JSON.stringify({ event: 'preview-ready', url: address + '/api/v1/workbench/view', base: address }) + '\n');

const stop = async () => {
  try { await platform.stop(); } finally { process.exit(0); }
};
process.on('SIGINT', () => { void stop(); });
process.on('SIGTERM', () => { void stop(); });