// Real HTTPS, HTTP, template SQLite and Runner/control Workers. Container,
// candidate, image and upstream quality facts remain explicit fixture inputs.
import {createServer} from 'node:http';
import {createServer as createHttpsServer, request as httpsRequest} from 'node:https';
import {readFile, writeFile, symlink} from 'node:fs/promises';
import {join, dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire, stripTypeScriptTypes} from 'node:module';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {datasetFixture} from './datasets.mjs';
import {previewAccessFixture} from './preview-access.mjs';
import {ControlledContainerDriver} from './preview-container.mjs';
import {hash, canonical} from './storage-data.mjs';
import {RunnerPreviewBackend, RunnerPreviewHttpTransport, previewContainerProfile, previewContainerNames} from '../../packages/runner/dist/index.mjs';
import {PreviewGateway} from '../../packages/preview-gateway/dist/index.mjs';

const listen = server => new Promise((resolve, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', resolve);});
const close = server => new Promise((resolve, reject) => {server.closeAllConnections(); server.close(error => error ? reject(error) : resolve());});
let certificate;
async function tls(root) {
  if (certificate) return certificate;
  const key = join(root, 'preview-tls.key'), cert = join(root, 'preview-tls.crt');
  const executable = process.platform === 'win32' ? 'D:\\Git\\usr\\bin\\openssl.exe' : 'openssl';
  const result = spawnSync(executable, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=*.apps.devmesh-app.test', '-addext', 'subjectAltName=DNS:*.apps.devmesh-app.test', '-keyout', key, '-out', cert], {encoding: 'utf8', windowsHide: true});
  if (result.status !== 0) throw Error('Test certificate generation failed: ' + (result.error?.message ?? result.stderr));
  certificate = {key: await readFile(key), cert: await readFile(cert)};
  return certificate;
}
export async function previewHttpFixture(t, {gatewayOptions = {}, transportWrap, storageWrap, webRoot} = {}) {
  const data = await datasetFixture(t), received = [];
  let application, gateway, revokedResponse, releaseResponse;
  const waitForResponse = new Promise(resolve => {revokedResponse = resolve;});
  const release = new Promise(resolve => {releaseResponse = resolve;});
  const upstream = createServer(async (req, res) => {
    if (req.url === '/__test/echo') {received.push({headers: req.headers, path: req.url}); res.setHeader('set-cookie', ['platform=escape; Domain=devmesh.test; Secure', '__Host-devmesh-preview=replace; Path=/; Secure; HttpOnly']); res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(received.at(-1))); return;}
    if (req.url === '/__test/redirect') {received.push({path: req.url}); res.writeHead(302, {location: 'http://127.0.0.1:1/private'}); res.end('redirect body'); return;}
    if (req.url === '/__test/revoke-in-flight') {revokedResponse(); await release; res.end('private in-flight body'); return;}
    if (req.url === '/__test/drop-after-write') {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const result = await appStore.mutate({kind: 'create', key: req.headers['idempotency-key'], input: JSON.parse(Buffer.concat(chunks).toString())});
      received.push({path: req.url, result}); req.socket.destroy(); return;
    }
    application(req, res);
  });
  await listen(upstream); data.cleanup.push(() => close(upstream));
  const port = upstream.address().port, instanceId = hash('explicit original HTTP fixture instance');
  const f = await previewAccessFixture(t, {worker: true, seedOptions: {endpoint: {host: '127.0.0.1', port}, instanceId}});
  const dataset = await f.readEffect(f.d.operationId), effect = await f.readEffect(f.p.operationId);
  await data.prepare({...dataset, remoteKey: dataset.datasetId, state: 'SENT', receipt: null});
  const database = data.app(dataset), appStore = {async list() {return database.list();}, async mutate(input) {return database.mutate(input);}, async close() {}};
  const compat = join(data.root, 'compat');
  const resolver = createRequire(new URL('../../packages/input-api/package.json', import.meta.url));
  await symlink(dirname(resolver.resolve('express/package.json')), join(compat, 'node_modules', 'express'), process.platform === 'win32' ? 'junction' : 'dir');
  await writeFile(join(compat, 'server', 'app.js'), stripTypeScriptTypes(await readFile(new URL('../../templates/web-crud-v1/src/server/app.ts', import.meta.url), 'utf8'), {mode: 'transform'}));
  application = (await import(pathToFileURL(join(compat, 'server', 'app.js')).href)).application(appStore, webRoot);
  const store = data.layout.store, options = {enabled: true, runnerId: data.options.runnerId, controllerId: 'controller.preview.http.fixture', backendRef: effect.request.backendRef, repository: 'registry.example/devmesh-preview', capacity: {maximumJobs: 4, cpu: 4, memoryMiB: 1024}, resourceLimits: {cpu: 1, memoryMiB: 128, pids: 32, temporaryMiB: 32}};
  const driver = new ControlledContainerDriver(port), backend = new RunnerPreviewBackend(store, data.paths, data.backend, driver, options);
  let reservation = await store.request('previewReserve', {controllerId: options.controllerId, request: effect.request, requestHash: effect.requestHash, resourceLimits: options.resourceLimits, capacity: options.capacity});
  const bound = {controllerId: options.controllerId, reservationId: reservation.reservationId, requestHash: reservation.requestHash};
  await store.request('previewLifecycleEnroll', bound);
  const profile = previewContainerProfile.parse({schemaVersion: 'devmesh.preview-container-profile.v1', reservationId: reservation.reservationId, requestHash: reservation.requestHash, repository: options.repository, datasetDirectory: data.paths.resolve(effect.request).directory, datasetBytes: 64 * 1024 * 1024, resourceLimits: options.resourceLimits, ...previewContainerNames(reservation.reservationId)});
  await store.request('previewContainerPrepare', {...bound, profile});
  await store.request('previewReservationDispatch', bound);
  const networkId = hash('explicit original HTTP fixture network');
  for (const kind of ['NETWORK_CREATE', 'CREATE', 'START']) {
    await store.request('previewContainerActionBegin', {...bound, action: {kind, requestHash: effect.requestHash, request: effect.request}});
    await store.request('previewContainerActionObserve', {...bound, kind, actionRequestHash: effect.requestHash, observation: {objectId: kind === 'NETWORK_CREATE' ? networkId : instanceId, state: kind === 'START' ? 'RUNNING' : 'CREATED', checkedAt: new Date().toISOString()}});
  }
  driver.networks.set(profile.networkName, networkId);
  driver.containers.set(profile.containerName, {containerId: instanceId, networkId, state: 'running', pid: 123, exitCode: null, endpoint: {host: '127.0.0.1', port}});
  const observed = await backend.inspect({...effect, remoteKey: effect.request.previewId});
  if (observed.fact.state !== 'HEALTHY') throw Error('Original fixture HTTP failed health');
  const credentials = await tls(data.root);
  const https = createHttpsServer(credentials, (req, res) => void gateway.handle(req, res));
  https.requestTimeout = 15000; https.headersTimeout = 10000; https.keepAliveTimeout = 100;
  https.on('upgrade', (_req, socket) => socket.destroy());
  https.on('connect', (_req, socket) => socket.destroy());
  await listen(https); data.cleanup.push(() => close(https));
  const transport = new RunnerPreviewHttpTransport(backend), storage = {request: (method, input) => f.call(method, input)};
  gateway = new PreviewGateway(storageWrap ? storageWrap(storage) : storage, transportWrap ? transportWrap(transport) : transport, {enabled: true, mode: 'loopback-development', gatewayId: 'preview.gateway.https.fixture', principalId: 'preview.gateway.https.service', platformOrigin: 'https://control.devmesh.test', previewBaseOrigin: `https://apps.devmesh-app.test:${https.address().port}`, ...gatewayOptions});
  data.cleanup.push(() => gateway.close());
  await f.call('registerPreviewAccessPolicy', {principalId: 'user_1', projectId: f.p.projectId, policy: gateway.policy});
  await f.enroll(); await f.runtime(f.p);
  const request = (origin, path, {method = 'GET', headers = {}, body, rawHeaders} = {}) => new Promise((resolve, reject) => {
    const url = new URL(origin), bytes = typeof body === 'string' ? Buffer.from(body) : body;
    const req = httpsRequest({hostname: url.hostname, port: url.port, path, method, ca: credentials.cert, agent: false, lookup: (_host, opts, cb) => opts.all ? cb(null, [{address: '127.0.0.1', family: 4}]) : cb(null, '127.0.0.1', 4), headers: rawHeaders ?? {...headers, ...(bytes ? {'content-length': bytes.length} : {})}}, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('error', reject); res.on('end', () => resolve({status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString()}));
    });
    req.on('error', reject); req.setTimeout(10000, () => req.destroy(Error('HTTPS fixture timeout'))); req.end(bytes);
  });
  const issue = () => gateway.issueForMember({principalId: 'user_1', runId: f.p.runId, previewId: f.p.previewId});
  const exchange = ticket => request(ticket.previewOrigin, '/__devmesh/preview/session', {method: 'POST', headers: {origin: gateway.config.platformOrigin, 'content-type': 'application/json'}, body: JSON.stringify({ticket: ticket.ticket, expiresAt: ticket.sessionExpiresAt})});
  const login = async () => {const ticket = await issue(), response = await exchange(ticket); if (response.status !== 200) throw Error('Exchange failed: ' + response.body); return {ticket, response, cookie: response.headers['set-cookie'][0].split(';')[0], origin: ticket.previewOrigin};};
  const rows = async () => {const {DatabaseSync} = await import('node:sqlite'); const db = new DatabaseSync(join(f.root, 'access.sqlite'), {readOnly: true}); try {return db.prepare('SELECT * FROM preview_access_requests ORDER BY sequence').all();} finally {db.close();}};
  return {f, data, gateway, backend, driver, profile, transport, received, request, issue, exchange, login, rows, waitForResponse, releaseResponse, appStore, refresh: () => f.runtime(f.p), key: () => randomUUID(), canonical};
}
