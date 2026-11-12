import { openStorage } from '../packages/storage-sqlite/dist/index.mjs';
const options = {};
try {
  for (let i = 2; i < process.argv.length; i++) {
    const flag = process.argv[i];
    if (flag === '--create') { if (options.create) throw new Error('Duplicate --create'); options.create = true; continue; }
    const name = { '--db': 'databasePath', '--store-id': 'storeId', '--backup-dir': 'backupDirectory', '--recover-lock': 'recoveryToken', '--target': 'targetVersion' }[flag];
    if (!name || options[name] !== undefined || !process.argv[i+1]) throw new Error('Usage: pnpm db:migrate --db <absolute-path> --store-id <uuid> [--create] [--backup-dir <absolute-path>] [--recover-lock <token>] [--target <version>]');
    options[name] = name === 'targetVersion' ? Number(process.argv[++i]) : process.argv[++i];
  }
  if (!options.databasePath || !options.storeId) throw new Error('--db and --store-id are required; no default database is created');
  const storage = await openStorage(options);
  try { console.log(JSON.stringify(await storage.request('inspect', {}), null, 2)); }
  finally { await storage.close(); }
} catch (error) {
  console.error(JSON.stringify({ code: error.code ?? 'MIGRATION_FAILED', message: error.message, details: error.details ?? {} }));
  process.exitCode = 1;
}
