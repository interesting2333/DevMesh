import {createHash} from 'node:crypto';
import {request as httpRequest} from 'node:http';
import {canonical, previewAccessHttpRequest} from '@devmesh/storage-sqlite';
import type {PreviewAccessRecord, PreviewEffect} from '@devmesh/storage-sqlite';
import {RunnerError} from './protocol.js';
import type {RunnerPreviewBackend} from './preview-backend.js';

export interface PreviewHttpInput {
  record: PreviewAccessRecord;
  headers: Record<string, string>;
  body: Uint8Array;
  signal: AbortSignal;
  authorize: () => Promise<boolean>;
}
export interface PreviewHttpResult {
  status: number;
  headers: Record<string, string | string[]>;
  body: Uint8Array;
}
export interface PreviewHttpTransport {
  readonly configured: boolean;
  forward(input: PreviewHttpInput): Promise<PreviewHttpResult>;
}
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const allowedHeaders = new Set(['accept', 'accept-language', 'content-type', 'if-match', 'if-none-match', 'range', 'idempotency-key']);

/** Only compose on the Runner owning the original reservation and loopback port. */
export class RunnerPreviewHttpTransport implements PreviewHttpTransport {
  readonly configured: boolean;
  constructor(readonly backend: RunnerPreviewBackend, readonly maximumResponseBytes = 4 * 1024 * 1024, readonly timeoutMs = 15000) {
    if (!Number.isSafeInteger(maximumResponseBytes) || maximumResponseBytes < 1024 || maximumResponseBytes > 16 * 1024 * 1024 || !Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30000)
      throw new RunnerError('PREVIEW_HTTP_LIMIT_INVALID', 422, 'not-sent');
    this.configured = backend.configured;
  }
  async #validate(input: PreviewHttpInput) {
    const deny = (code: string): never => {throw new RunnerError(code, 503, 'not-sent');};
    if (!this.configured) deny('PREVIEW_HTTP_NOT_CONFIGURED');
    const {record, headers, body, signal} = input, t = record.target;
    const request = previewAccessHttpRequest.parse(record.request);
    if (record.state !== 'DISPATCHED' || record.requestHash !== sha(canonical({target: record.target, request: record.request, gateFence: record.gateFence})) || !request.headersSha256 || request.headersSha256 !== sha(canonical(headers)) || request.bodySha256 !== sha(body) || body.byteLength > 1024 * 1024)
      deny('PREVIEW_HTTP_REQUEST_CHANGED');
    for (const [name, value] of Object.entries(headers))
      if (!allowedHeaders.has(name) || /[\r\n\0]/.test(value) || value.length > 8192) deny('PREVIEW_HTTP_HEADER_FORBIDDEN');
    if (signal.aborted || t.runnerId !== this.backend.options.runnerId || t.backendRef !== this.backend.options.backendRef || t.endpoint.host !== '127.0.0.1')
      deny('PREVIEW_HTTP_WRONG_RUNNER');
    const reservation = await this.backend.store.request('previewReservationByOperation', {controllerId: this.backend.options.controllerId, operationId: t.startOperationId});
    if (!reservation || reservation.releasedAt || reservation.requestHash !== t.startRequestHash || reservation.instanceId !== t.instanceId || canonical(reservation.endpoint) !== canonical(t.endpoint))
      deny('PREVIEW_HTTP_ORIGINAL_UNAVAILABLE');
    const r = reservation!, original = r.request;
    for (const name of ['projectId', 'runId', 'candidateId', 'manifestHash', 'policyHash', 'datasetId', 'datasetOperationId', 'previewId', 'imageDigest', 'runnerId', 'backendRef', 'expiresAt'] as const)
      if (original[name] !== t[name]) deny('PREVIEW_HTTP_ORIGINAL_CHANGED');
    if (Date.parse(t.expiresAt) <= Date.now() || Date.parse(r.createdAt) > Date.now()) deny('PREVIEW_HTTP_EXPIRED');
    const effect: PreviewEffect = {
      operationId: original.operationId, projectId: original.projectId, runId: original.runId,
      candidateId: original.candidateId, datasetId: original.datasetId, previewId: original.previewId,
      policyHash: original.policyHash, kind: 'PREVIEW_START', remoteKey: original.previewId,
      requestHash: r.requestHash, request: original, state: 'SENT', revision: 0,
      receipt: null, errorCode: null, createdAt: r.createdAt,
    };
    const {fact} = await this.backend.inspect(effect);
    if (fact.state !== 'HEALTHY' || fact.instanceId !== t.instanceId || fact.imageDigest !== t.imageDigest || fact.datasetId !== t.datasetId || canonical(fact.endpoint) !== canonical(t.endpoint))
      deny('PREVIEW_HTTP_ORIGINAL_UNHEALTHY');
    const bound = {controllerId: this.backend.options.controllerId, reservationId: r.reservationId, requestHash: r.requestHash};
    const life = await this.backend.store.request('previewLifecycleGet', bound);
    const latest = await this.backend.store.request('previewReservationGet', {controllerId: bound.controllerId, reservationId: r.reservationId});
    if (signal.aborted || !life || life.state !== 'PREVIEW' || life.expiredAt || latest.releasedAt || latest.state !== 'ACTIVE' || latest.instanceId !== t.instanceId || canonical(latest.endpoint) !== canonical(t.endpoint)) deny('PREVIEW_HTTP_LIFECYCLE_CLOSED');
    if (signal.aborted || Date.parse(t.expiresAt) <= Date.now() || !await input.authorize()) deny('PREVIEW_HTTP_AUTHORIZATION_LOST');
    return {request, target: t};
  }
  async forward(input: PreviewHttpInput): Promise<PreviewHttpResult> {
    const checked = await this.#validate(input).catch(error => {throw new RunnerError(error instanceof RunnerError ? error.code : 'PREVIEW_HTTP_ORIGINAL_UNVERIFIED', 503, 'not-sent');});
    const {request, target: t} = checked, {headers, body, signal} = input;
    // No URL parser, DNS resolution, redirect following, connection pooling or retry.
    // Once an HTTP request is constructed, every incomplete result is UNKNOWN.
    return new Promise<PreviewHttpResult>((resolve, reject) => {
      let settled = false;
      const fail = () => {if (!settled) {settled = true; reject(new RunnerError('PREVIEW_HTTP_OUTCOME_UNKNOWN', 502, 'unknown'));}};
      const req = httpRequest({host: '127.0.0.1', port: t.endpoint.port, method: request.method, path: request.path, agent: false, signal, headers: {...headers, host: `127.0.0.1:${t.endpoint.port}`, 'content-length': body.byteLength}}, res => {
        if (!res.statusCode || res.statusCode < 200 || res.statusCode > 599) {res.destroy(); fail(); return;}
        const chunks: Buffer[] = []; let size = 0;
        res.on('data', (chunk: Buffer) => {size += chunk.length; if (size > this.maximumResponseBytes) {res.destroy(); req.destroy(); fail();} else chunks.push(chunk);});
        res.on('error', fail);
        res.on('aborted', fail);
        res.on('end', () => {
          if (settled) return;
          if (!res.complete) {fail(); return;}
          settled = true;
          const responseHeaders: Record<string, string | string[]> = {};
          for (const [name, value] of Object.entries(res.headers)) if (value !== undefined) responseHeaders[name] = value;
          resolve({status: res.statusCode!, headers: responseHeaders, body: Buffer.concat(chunks)});
        });
      });
      req.on('error', fail);
      req.on('upgrade', (_res, socket) => {socket.destroy(); fail();});
      const timer = setTimeout(() => {req.destroy(); fail();}, this.timeoutMs);
      timer.unref();
      req.on('close', () => clearTimeout(timer));
      req.end(body);
    });
  }
}
