import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import express from 'express';
import { parsePublicPrototypeConfig, mountPublicPrototype } from '../dist/public-prototype.mjs';

async function main() {
  if (process.argv.length !== 4 || process.argv[2] !== '--config') throw new Error('Explicit --config is required');
  const config = parsePublicPrototypeConfig(JSON.parse(readFileSync(process.argv[3], 'utf8')));
  if (!config.enabled) { console.log(JSON.stringify({ event: 'prototype-disabled' })); return; }
  const app = express(); app.disable('x-powered-by'); app.disable('etag');
  await mountPublicPrototype(app, config, async ref => process.env['DEVMESH_PROTOTYPE_' + ref.toUpperCase()]);
  const server = createServer({ headersTimeout: 5000, requestTimeout: 10000 }, app), base = new URL(config.publicBaseUrl);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(Number(base.port), base.hostname === '[::1]' ? '::1' : base.hostname, resolve); });
  let stopping;
  const stop = () => stopping ??= (async () => {
    const timer = setTimeout(() => server.closeAllConnections(), 10000); timer.unref();
    try { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
    finally { clearTimeout(timer); if (process.connected) process.disconnect(); }
  })().catch(() => { process.exitCode = 1; });
  process.once('SIGINT', stop); process.once('SIGTERM', stop); process.once('disconnect', stop);
  process.on('message', message => { if (message?.type === 'shutdown') void stop(); });
  const ready = { event: 'prototype-ready', mode: config.mode, publicBaseUrl: base.origin, enterpriseAuthentication: 'NOT_CONFIGURED', businessExecution: 'DISABLED' };
  console.log(JSON.stringify(ready)); if (process.connected) process.send(ready);
}
main().catch(() => { console.error('Prototype startup failed; check explicit configuration and test credentials'); process.exitCode = 1; if (process.connected) process.disconnect(); });
