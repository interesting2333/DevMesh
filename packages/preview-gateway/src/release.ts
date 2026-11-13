import {randomBytes, randomUUID} from 'node:crypto';
import type {IncomingMessage, ServerResponse} from 'node:http';
import type {TLSSocket} from 'node:tls';
import {z} from 'zod';
import {canonical, releaseAccessHttpRequest, releaseAccessObservation, previewOrigin as releaseOrigin} from '@devmesh/storage-sqlite';
import type {SqliteStorage, ReleaseSession, ReleaseAccessRecord} from '@devmesh/storage-sqlite';
import type {ReleaseHttpTransport} from '@devmesh/runner';
import {releaseGatewayConfiguration, originForRelease, sha256} from './release-config.js';
import type {ReleaseGatewayConfig, ResolvedReleaseGatewayConfig} from './release-config.js';
export {releaseGatewayConfig, releaseGatewayConfiguration, originForRelease} from './release-config.js';
export type {ReleaseGatewayConfig, ResolvedReleaseGatewayConfig} from './release-config.js';

const cookieName = '__Host-devmesh-release';
const sessionPath = '/__devmesh/release/session';
const token = (purpose: 'ticket' | 'session') => `dmr_${purpose}.${randomBytes(32).toString('base64url')}`;
const exchangeInput = z.strictObject({ticket: z.string().regex(/^dmr_ticket\.[A-Za-z0-9_-]{43}$/), expiresAt: z.iso.datetime()});
const criticalHeaders = new Set(['host', 'origin', 'cookie', 'authorization', 'content-type', 'content-length', 'transfer-encoding', 'idempotency-key', 'sec-fetch-site']);
const forwardHeaders = ['accept', 'accept-language', 'content-type', 'if-match', 'if-none-match', 'range'];
const responseHeaders = ['content-type', 'etag', 'last-modified', 'content-range', 'accept-ranges'];
class GatewayError extends Error {constructor(readonly code: string, readonly status: number) {super(code);}}
const fail = (code: string, status: number): never => {throw new GatewayError(code, status);};
function json(res: ServerResponse, status: number, value: unknown) {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(status, {'content-type': 'application/json; charset=utf-8'});
  res.end(JSON.stringify(value));
}
async function body(req: IncomingMessage, maximum: number, signal: AbortSignal): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []; let bytes = 0;
    const done = (error?: Error) => {req.off('data', data); req.off('end', end); req.off('error', errorListener); req.off('aborted', aborted); signal.removeEventListener('abort', aborted); if (error) {req.resume(); reject(error);} else resolve(Buffer.concat(chunks));};
    const data = (chunk: Buffer) => {bytes += chunk.length; if (bytes > maximum) done(new GatewayError('RELEASE_BODY_TOO_LARGE', 413)); else chunks.push(chunk);};
    const end = () => done(), errorListener = () => done(new GatewayError('RELEASE_BODY_INCOMPLETE', 400)), aborted = () => done(new GatewayError('RELEASE_REQUEST_ABORTED', 408));
    if (signal.aborted) {aborted(); return;}
    req.on('data', data); req.once('end', end); req.once('error', errorListener); req.once('aborted', aborted); signal.addEventListener('abort', aborted, {once: true});
  });
}

/** Trusted composition API. It does not turn a principal supplied over HTTP into identity. */
export class ReleaseGateway {
  readonly config: ResolvedReleaseGatewayConfig;
  readonly configurationHash: string;
  readonly #gateway: {principalId: string; gatewayId: string; configurationHash: string};
  #inFlight = 0;
  #closed = false;
  readonly #active = new Set<AbortController>();
  constructor(readonly storage: Pick<SqliteStorage, 'request'>, readonly transport: ReleaseHttpTransport, input: ReleaseGatewayConfig) {
    const {config, configurationHash} = releaseGatewayConfiguration(input);
    this.config = config; this.configurationHash = configurationHash;
    this.#gateway = {principalId: config.principalId, gatewayId: config.gatewayId, configurationHash};
  }
  get policy() {return {schemaVersion: 'devmesh.release-access-policy.v1' as const, gatewayId: this.config.gatewayId, gatewayPrincipalId: this.config.principalId, configurationHash: this.configurationHash};}
  #enabled() {if (this.#closed || !this.config.enabled || !this.transport.configured) fail('RELEASE_ACCESS_NOT_CONFIGURED', 503);}
  async accessForMember(subject: {principalId: string; runId: string; releaseId: string}) {
    this.#enabled();
    const binding = await this.storage.request('resolveReleaseAccess', {...this.#gateway, subjectPrincipalId: subject.principalId, runId: subject.runId, releaseId: subject.releaseId});
    const checked = await this.transport.check(binding.target);
    const current = await this.storage.request('resolveReleaseAccess', {...this.#gateway, subjectPrincipalId: subject.principalId, runId: subject.runId, releaseId: subject.releaseId});
    if (canonical(binding.target) !== canonical(current.target) || binding.gate.fence !== current.gate.fence || binding.gate.revision !== current.gate.revision) fail('RELEASE_ACCESS_TARGET_CHANGED',409);
    return {releaseOrigin: originForRelease(this.config, subject.releaseId), canWrite: binding.canWrite && binding.gate.state === 'OPEN', checkedAt: checked.checkedAt};
  }
  /** Call only after the platform's configured identity resolver and CSRF boundary. */
  async issueForMember(subject: {principalId: string; runId: string; releaseId: string}) {
    this.#enabled();
    const target = {subjectPrincipalId: subject.principalId, runId: subject.runId, releaseId: subject.releaseId};
    const binding = await this.storage.request('resolveReleaseAccess', {...this.#gateway, ...target});
    await this.transport.check(binding.target);
    const release = originForRelease(this.config, subject.releaseId), raw = token('ticket'), at = Date.now();
    const expiresAt = new Date(at + this.config.ticketTtlMs).toISOString();
    const sessionExpiresAt = new Date(at + this.config.sessionTtlMs).toISOString();
    await this.storage.request('issueReleaseTicket', {...this.#gateway, ...target, ticketId: randomUUID(), tokenSha256: sha256(raw), platformOrigin: this.config.platformOrigin, releaseOrigin: release, expiresAt});
    return {ticket: raw, releaseOrigin: release, expiresAt, sessionExpiresAt};
  }
  #headers(res: ServerResponse) {
    res.setHeader('cache-control', 'no-store');
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('referrer-policy', 'no-referrer');
    res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    res.setHeader('content-security-policy', `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; object-src 'none'; worker-src 'none'; frame-src 'none'; frame-ancestors ${this.config.platformOrigin}; sandbox allow-scripts allow-forms allow-same-origin`);
  }
  #origin(req: IncomingMessage) {
    if (!(req.socket as TLSSocket).encrypted) fail('RELEASE_HTTPS_REQUIRED', 400);
    if (this.config.mode === 'loopback-development' && !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '')) fail('RELEASE_LOCAL_ONLY', 403);
    const seen = new Set<string>();
    for (let i = 0; i < req.rawHeaders.length; i += 2) {const key = req.rawHeaders[i]!.toLowerCase(); if (criticalHeaders.has(key) && seen.has(key)) fail('RELEASE_DUPLICATE_HEADER', 400); seen.add(key);}
    if (req.headers.authorization) fail('RELEASE_CREDENTIAL_PURPOSE_INVALID', 401);
    let origin: string;
    try {origin = releaseOrigin.parse(`https://${req.headers.host}`);} catch {fail('RELEASE_HOST_INVALID', 400);}
    const url = new URL(origin!), base = new URL(this.config.releaseBaseOrigin), prefix = url.hostname.slice(0, -(base.hostname.length + 1));
    if (url.port !== base.port || !url.hostname.endsWith(`.${base.hostname}`) || !/^r-[a-f0-9]{40}$/.test(prefix)) fail('RELEASE_HOST_INVALID', 400);
    return origin!;
  }
  #credential(req: IncomingMessage) {
    const cookies = (req.headers.cookie ?? '').split(';').map(p => p.trim()).filter(p => p.startsWith(cookieName + '='));
    if (cookies.length !== 1) fail('RELEASE_SESSION_REQUIRED', 401);
    const raw = cookies[0]!.slice(cookieName.length + 1);
    if (!/^dmr_session\.[A-Za-z0-9_-]{43}$/.test(raw)) fail('RELEASE_CREDENTIAL_PURPOSE_INVALID', 401);
    return sha256(raw);
  }
  async #authenticate(release: string, tokenSha256: string) {
    const result = await this.storage.request('authenticateReleaseSession', {...this.#gateway, releaseOrigin: release, tokenSha256});
    if (originForRelease(this.config, result.session.target.releaseId) !== release) fail('RELEASE_SESSION_TARGET_INVALID', 401);
    return result;
  }
  #cors(req: IncomingMessage, res: ServerResponse) {
    if (req.headers.origin !== this.config.platformOrigin) fail('RELEASE_ORIGIN_FORBIDDEN', 403);
    res.setHeader('access-control-allow-origin', this.config.platformOrigin);
    res.setHeader('access-control-allow-credentials', 'true');
    res.setHeader('vary', 'Origin');
  }
  readonly handle = async (req: IncomingMessage, res: ServerResponse) => {
    this.#headers(res);
    const abort = new AbortController(); let timer: NodeJS.Timeout | undefined, counted = false;
    const cancelled = () => {if (!res.writableEnded) abort.abort();};
    res.once('close', cancelled);
    try {
      this.#enabled();
      if (this.#inFlight >= this.config.maximumInFlight) fail('RELEASE_GATEWAY_BUSY', 503);
      this.#inFlight++; counted = true; this.#active.add(abort);
      timer = setTimeout(() => abort.abort(), this.config.requestTimeoutMs); timer.unref();
      const release = this.#origin(req), path = req.url ?? '', method = req.method ?? '';
      if (path === sessionPath) {
        this.#cors(req, res);
        if (method === 'GET') {
          const current = await this.#authenticate(release, this.#credential(req));
          if (abort.signal.aborted) fail('RELEASE_REQUEST_ABORTED', 408);
          json(res, 200, {expiresAt: current.session.expiresAt}); return;
        }
        if (method === 'OPTIONS') {
          if (req.headers['access-control-request-method'] !== 'POST' || (req.headers['access-control-request-headers'] ?? '').toString().toLowerCase() !== 'content-type') fail('RELEASE_PREFLIGHT_INVALID', 403);
          res.writeHead(204, {'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type'}); res.end(); return;
        }
        if (method !== 'POST' || req.headers['content-type']?.split(';')[0] !== 'application/json') fail('RELEASE_EXCHANGE_INVALID', 400);
        const bytes = await body(req, 4096, abort.signal);
        let input: z.output<typeof exchangeInput>;
        try {input = exchangeInput.parse(JSON.parse(bytes.toString('utf8')));} catch {fail('RELEASE_EXCHANGE_INVALID', 400);}
        if (Date.parse(input!.expiresAt) > Date.now() + this.config.sessionTtlMs) fail('RELEASE_SESSION_EXPIRY_INVALID', 422);
        const raw = token('session');
        const session = await this.storage.request('exchangeReleaseTicket', {...this.#gateway, platformOrigin: this.config.platformOrigin, releaseOrigin: release, ticketTokenSha256: sha256(input!.ticket), sessionId: randomUUID(), sessionTokenSha256: sha256(raw), expiresAt: input!.expiresAt});
        if (originForRelease(this.config, session.target.releaseId) !== release) fail('RELEASE_SESSION_TARGET_INVALID', 401);
        if (abort.signal.aborted) fail('RELEASE_REQUEST_ABORTED', 408);
        res.setHeader('set-cookie', `${cookieName}=${raw}; Path=/; Secure; HttpOnly; SameSite=None; Max-Age=${Math.max(0, Math.floor((Date.parse(session.expiresAt) - Date.now()) / 1000))}`);
        json(res, 200, {expiresAt: session.expiresAt}); return;
      }
      const digest = this.#credential(req), authenticated = await this.#authenticate(release, digest);
      if (path === '/__devmesh/release/logout') {
        if (method !== 'POST' || req.headers.origin !== release) fail('RELEASE_ORIGIN_FORBIDDEN', 403);
        await this.storage.request('revokeReleaseSession', {...this.#gateway, releaseOrigin: release, tokenSha256: digest});
        res.setHeader('set-cookie', `${cookieName}=; Path=/; Secure; HttpOnly; SameSite=None; Max-Age=0`); json(res, 200, {revoked: true}); return;
      }
      if (path.startsWith('/__devmesh/')) fail('RELEASE_ROUTE_NOT_FOUND', 404);
      const write = !['GET', 'HEAD'].includes(method);
      if (write && req.headers.origin !== release || !write && req.headers.origin && req.headers.origin !== release) fail('RELEASE_ORIGIN_FORBIDDEN', 403);
      const key = req.headers['idempotency-key'];
      if (write && (typeof key !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(key))) fail('RELEASE_IDEMPOTENCY_KEY_REQUIRED', 428);
      const identity = sha256(canonical({purpose: 'RELEASE', gateway: this.#gateway, routeHash: authenticated.session.target.routeHash, routeGeneration: authenticated.session.target.routeGeneration, subject: authenticated.session.subjectPrincipalId, releaseId: authenticated.session.target.releaseId, key: write ? key : null}));
      const headers: Record<string, string> = {};
      const connection = new Set((req.headers.connection ?? '').toLowerCase().split(',').map(v => v.trim()));
      for (const name of forwardHeaders) {const value = req.headers[name]; if (typeof value === 'string' && !connection.has(name)) headers[name] = value;}
      if (write) headers['idempotency-key'] = identity;
      const bytes = await body(req, this.config.maximumRequestBytes, abort.signal);
      const request = releaseAccessHttpRequest.parse({method, path, bodySha256: sha256(bytes), headersSha256: sha256(canonical(headers))});
      const accessRequestId = write ? 'release.http.' + identity : randomUUID();
      await this.#forward({release, digest, session: authenticated.session, request, accessRequestId, headers, bytes, signal: abort.signal}, res);
    } catch (error) {
      const e = error as {code?: string; status?: number};
      const status = Number.isInteger(e.status) && e.status! >= 400 && e.status! <= 599 ? e.status! : error instanceof z.ZodError ? 422 : 503;
      json(res, status, {error: e.code && /^[A-Z0-9_]+$/.test(e.code) ? e.code : 'RELEASE_ACCESS_FAILED'});
    } finally {if (timer) clearTimeout(timer); this.#active.delete(abort); if (counted) this.#inFlight--; res.off('close', cancelled);}
  };
  async #forward(input: {release: string; digest: string; session: ReleaseSession; request: ReleaseAccessRecord['request']; accessRequestId: string; headers: Record<string, string>; bytes: Uint8Array; signal: AbortSignal}, res: ServerResponse) {
    const {session, release, digest} = input;
    const record = await this.storage.request('prepareReleaseAccessRequest', {...this.#gateway, subjectPrincipalId: session.subjectPrincipalId, runId: session.target.runId, releaseId: session.target.releaseId, accessRequestId: input.accessRequestId, request: input.request});
    if (canonical(record.target) !== canonical(session.target)) fail('RELEASE_SESSION_TARGET_INVALID', 409);
    const original = {...this.#gateway, accessRequestId: record.accessRequestId, requestHash: record.requestHash};
    const grant = await this.storage.request('beginReleaseAccessRequest', original);
    // Lost dispatch ACK is handled by the outer boundary; no transport call occurs.
    if (!grant.dispatch) {json(res, 409, {error: 'RELEASE_REQUEST_ALREADY_RECORDED', accessRequestId: record.accessRequestId, state: grant.record.state}); return;}
    const observe = async (observation: z.output<typeof releaseAccessObservation>) => {
      // This helper deliberately keeps observation errors visible: no automatic retry or send.
      return this.storage.request('recordReleaseAccessObservation', {...original, observation});
    };
    const authorize = async () => {
      if (input.signal.aborted || this.#closed) return false;
      try {const current = await this.#authenticate(release, digest); return canonical(current.session.target) === canonical(record.target) && (await this.storage.request('releaseAccessRequestAuthorized', original)).allowed;} catch {return false;}
    };
    let result: Awaited<ReturnType<ReleaseHttpTransport['forward']>>;
    try {
      if (!await authorize()) throw Object.assign(new Error('Authorization lost before transport'), {outcome: 'not-sent'});
      result = await this.transport.forward({record: grant.record, headers: input.headers, body: input.bytes, signal: input.signal, authorize});
    } catch (error) {
      const notSent = (error as {outcome?: string}).outcome === 'not-sent';
      await observe({state: notSent ? 'NOT_SENT' : 'UNKNOWN', errorCode: notSent ? 'RELEASE_HTTP_NOT_SENT' : 'RELEASE_HTTP_OUTCOME_UNKNOWN', checkedAt: new Date().toISOString()});
      json(res, 502, {error: notSent ? 'RELEASE_HTTP_NOT_SENT' : 'RELEASE_HTTP_OUTCOME_UNKNOWN', accessRequestId: record.accessRequestId}); return;
    }
    await observe({state: 'FINISHED', httpStatus: result.status, responseSha256: sha256(result.body), checkedAt: new Date().toISOString()});
    // Accounting may finish after revocation. Content still requires a live member session.
    await this.#authenticate(release, digest);
    if (input.signal.aborted) fail('RELEASE_REQUEST_ABORTED', 408);
    for (const name of responseHeaders) {const value = result.headers[name]; if (typeof value === 'string' && !/[\r\n\0]/.test(value)) res.setHeader(name, value);}
    res.writeHead(result.status); res.end(result.body);
  }
  close() {this.#closed = true; for (const abort of this.#active) abort.abort();}
}
