// Explicit local browser isolation verification. The platform identity and
// upstream candidate/container facts are fixtures; this is not OIDC acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:https';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {previewHttpFixture} from '../fixtures/preview-http.mjs';
const requireTemplate = createRequire(new URL('../../templates/web-crud-v1/package.json', import.meta.url));
const {chromium} = requireTemplate('@playwright/test');
test('actual Edge iframe isolates cookies, parent storage, writes, popups and Service Workers on separate HTTPS sites', {timeout: 120000}, async t => {
  const platform = createServer((_req, res) => {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.setHeader('set-cookie', 'platform_session=fixture-only-private; Path=/; Secure; HttpOnly; SameSite=Lax');
    res.end('<!doctype html><title>Preview isolation fixture</title><iframe id="preview" sandbox="allow-scripts allow-forms allow-same-origin"></iframe>');
  });
  await new Promise(resolve => platform.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => {platform.closeAllConnections(); platform.close(resolve);}));
  const platformOrigin = `https://control.devmesh.test:${platform.address().port}`;
  const f = await previewHttpFixture(t, {gatewayOptions: {platformOrigin}});
  platform.setSecureContext({key: await readFile(join(f.data.root, 'preview-tls.key')), cert: await readFile(join(f.data.root, 'preview-tls.crt'))});
  const browser = await chromium.launch({channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL ?? 'msedge', headless: true, args: ['--no-proxy-server', '--host-resolver-rules=MAP *.apps.devmesh-app.test 127.0.0.1,MAP control.devmesh.test 127.0.0.1,EXCLUDE localhost']});
  t.after(() => browser.close());
  // No certificate-store mutation. Node HTTPS tests separately verify the
  // runtime test certificate using an explicit CA; browser ignores test TLS errors.
  const context = await browser.newContext({ignoreHTTPSErrors: true});
  const page = await context.newPage();
  await page.goto(platformOrigin, {waitUntil: 'domcontentloaded'});
  await page.evaluate(() => localStorage.setItem('platform-only', 'fixture private platform storage'));
  await f.refresh();
  const ticket = await f.issue();
  const exchange = await page.evaluate(async ticket => {
    const response = await fetch(ticket.previewOrigin + '/__devmesh/preview/session', {method: 'POST', credentials: 'include', headers: {'content-type': 'application/json'}, body: JSON.stringify({ticket: ticket.ticket, expiresAt: ticket.sessionExpiresAt})});
    return {status: response.status, body: await response.json()};
  }, ticket);
  assert.equal(exchange.status, 200);
  const cookies = await context.cookies(ticket.previewOrigin), own = cookies.find(cookie => cookie.name === '__Host-devmesh-preview');
  assert.ok(own, 'The browser must actually accept the preview cookie');
  assert.equal(own.httpOnly, true); assert.equal(own.secure, true); assert.equal(own.sameSite, 'None');
  assert.equal(own.domain, new URL(ticket.previewOrigin).hostname);
  assert.equal((await context.cookies(platformOrigin)).some(cookie => cookie.name === '__Host-devmesh-preview'), false);
  const navigation = page.waitForEvent('framenavigated', {predicate: frame => frame.url().startsWith(ticket.previewOrigin), timeout: 15000});
  await page.locator('#preview').evaluate((iframe, origin) => {iframe.src = origin + '/__test/echo';}, ticket.previewOrigin);
  const frame = await navigation;
  await frame.waitForLoadState('domcontentloaded');
  const echo = JSON.parse(await frame.locator('pre').first().innerText());
  assert.equal(echo.headers.cookie, undefined); assert.equal(echo.headers.authorization, undefined);
  const isolation = await frame.evaluate(() => {
    let parentRead = false, parentStorage = false, topNavigation = false;
    try {void parent.document.body; parentRead = true;} catch {}
    try {void parent.localStorage.getItem('platform-only'); parentStorage = true;} catch {}
    try {top.location.href = 'https://external.example/escape'; topNavigation = true;} catch {}
    return {parentRead, parentStorage, topNavigation, cookies: document.cookie, popup: window.open('https://external.example/escape') !== null};
  });
  assert.deepEqual(isolation, {parentRead: false, parentStorage: false, topNavigation: false, cookies: '', popup: false});
  assert.equal(page.url(), platformOrigin + '/');
  const worker = await frame.evaluate(async () => {
    const violations = [];
    const listener = event => violations.push(event.violatedDirective);
    document.addEventListener('securitypolicyviolation', listener);
    let registered = false;
    try {await navigator.serviceWorker.register('/__test/sw.js'); registered = true;} catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
    document.removeEventListener('securitypolicyviolation', listener);
    return {registered, violations};
  });
  assert.equal(worker.registered, false); assert.ok(worker.violations.includes('worker-src'));
  await f.refresh();
  const created = await frame.evaluate(async () => {
    const response = await fetch('/api/tasks', {method: 'POST', headers: {'content-type': 'application/json', 'idempotency-key': crypto.randomUUID()}, body: JSON.stringify({title: 'Browser iframe write', description: 'actual SQLite', status: 'todo'})});
    return {status: response.status, body: await response.json()};
  });
  assert.equal(created.status, 201, JSON.stringify(created)); assert.equal((await f.appStore.list()).tasks.length, 1);
  t.diagnostic(JSON.stringify({browser: browser.version(), channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL ?? 'msedge', platformOrigin, previewOrigin: ticket.previewOrigin, cookie: {httpOnly: own.httpOnly, secure: own.secure, sameSite: own.sameSite, domain: own.domain}, serviceWorkerViolation: worker.violations, scope: 'Local HTTPS/CORS and actual browser origin/sandbox/Cookie boundary; explicit identity/container facts, browser test TLS errors ignored, no enterprise or physical container acceptance'}));
});
