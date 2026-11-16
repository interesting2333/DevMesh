import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { canonical, previewAccessHttpRequest, previewOrigin, releaseAccessHttpRequest } from "@devmesh/storage-sqlite";
import { isIP } from "node:net";
import { parse } from "tldts";
import { opaqueKey } from "@devmesh/contracts";
//#region src/config.ts
const previewGatewayConfig = z.strictObject({
	enabled: z.boolean().default(false),
	mode: z.enum(["loopback-development", "shared"]),
	gatewayId: opaqueKey,
	principalId: opaqueKey,
	platformOrigin: previewOrigin,
	previewBaseOrigin: previewOrigin,
	ticketTtlMs: z.number().int().min(1e3).max(6e4).default(6e4),
	sessionTtlMs: z.number().int().min(1e3).max(3e5).default(3e5),
	maximumRequestBytes: z.number().int().min(1024).max(1024 * 1024).default(1024 * 1024),
	maximumInFlight: z.number().int().min(1).max(64).default(16),
	requestTimeoutMs: z.number().int().min(100).max(3e4).default(15e3)
}).superRefine((c, ctx) => {
	const platform = new URL(c.platformOrigin), preview = new URL(c.previewBaseOrigin);
	const p = parse(platform.hostname, { allowPrivateDomains: true });
	const v = parse(preview.hostname, { allowPrivateDomains: true });
	const localPlatform = c.mode === "loopback-development" && ["127.0.0.1", "[::1]"].includes(platform.hostname);
	if (preview.protocol !== "https:" || c.mode === "shared" && platform.protocol !== "https:") ctx.addIssue({
		code: "custom",
		message: "Preview uses HTTPS; shared platform also requires HTTPS"
	});
	if (isIP(preview.hostname) || !p.domain && !localPlatform || !v.domain || p.domain === v.domain || preview.hostname === v.domain) ctx.addIssue({
		code: "custom",
		message: "Use a preview subdomain below a separate registrable domain"
	});
	if (c.mode === "shared" && (!(p.isIcann || p.isPrivate) || !(v.isIcann || v.isPrivate))) ctx.addIssue({
		code: "custom",
		message: "Shared origins require public/private suffix recognition"
	});
});
const sha256$1 = (data) => createHash("sha256").update(data).digest("hex");
function gatewayConfiguration(input) {
	const config = previewGatewayConfig.parse(input);
	return {
		config,
		configurationHash: sha256$1(canonical({
			schemaVersion: "devmesh.preview-gateway.v1",
			...config
		}))
	};
}
function originForPreview(config, previewId) {
	const url = new URL(config.previewBaseOrigin);
	url.hostname = `p-${sha256$1(previewId).slice(0, 40)}.${url.hostname}`;
	return url.origin;
}
//#endregion
//#region src/release-config.ts
const releaseGatewayConfig = z.strictObject({
	enabled: z.boolean().default(false),
	mode: z.enum(["loopback-development", "shared"]),
	gatewayId: opaqueKey,
	principalId: opaqueKey,
	platformOrigin: previewOrigin,
	releaseBaseOrigin: previewOrigin,
	ticketTtlMs: z.number().int().min(1e3).max(6e4).default(6e4),
	sessionTtlMs: z.number().int().min(1e3).max(3e5).default(3e5),
	maximumRequestBytes: z.number().int().min(1024).max(1024 * 1024).default(1024 * 1024),
	maximumInFlight: z.number().int().min(1).max(64).default(16),
	requestTimeoutMs: z.number().int().min(100).max(3e4).default(15e3)
}).superRefine((c, ctx) => {
	const platform = new URL(c.platformOrigin), release = new URL(c.releaseBaseOrigin);
	const p = parse(platform.hostname, { allowPrivateDomains: true });
	const v = parse(release.hostname, { allowPrivateDomains: true });
	const localPlatform = c.mode === "loopback-development" && ["127.0.0.1", "[::1]"].includes(platform.hostname);
	if (release.protocol !== "https:" || c.mode === "shared" && platform.protocol !== "https:") ctx.addIssue({
		code: "custom",
		message: "Release uses HTTPS; shared platform also requires HTTPS"
	});
	if (isIP(release.hostname) || !p.domain && !localPlatform || !v.domain || p.domain === v.domain || release.hostname === v.domain) ctx.addIssue({
		code: "custom",
		message: "Use a release subdomain below a separate registrable domain"
	});
	if (c.mode === "shared" && (!(p.isIcann || p.isPrivate) || !(v.isIcann || v.isPrivate))) ctx.addIssue({
		code: "custom",
		message: "Shared origins require public/private suffix recognition"
	});
});
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
function releaseGatewayConfiguration(input) {
	const config = releaseGatewayConfig.parse(input);
	return {
		config,
		configurationHash: sha256(canonical({
			schemaVersion: "devmesh.release-gateway.v1",
			...config
		}))
	};
}
function originForRelease(config, releaseId) {
	const url = new URL(config.releaseBaseOrigin);
	url.hostname = `r-${sha256(releaseId).slice(0, 40)}.${url.hostname}`;
	return url.origin;
}
//#endregion
//#region src/release.ts
const cookieName$1 = "__Host-devmesh-release";
const sessionPath$1 = "/__devmesh/release/session";
const token$1 = (purpose) => `dmr_${purpose}.${randomBytes(32).toString("base64url")}`;
const exchangeInput$1 = z.strictObject({
	ticket: z.string().regex(/^dmr_ticket\.[A-Za-z0-9_-]{43}$/),
	expiresAt: z.iso.datetime()
});
const criticalHeaders$1 = /* @__PURE__ */ new Set([
	"host",
	"origin",
	"cookie",
	"authorization",
	"content-type",
	"content-length",
	"transfer-encoding",
	"idempotency-key",
	"sec-fetch-site"
]);
const forwardHeaders$1 = [
	"accept",
	"accept-language",
	"content-type",
	"if-match",
	"if-none-match",
	"range"
];
const responseHeaders$1 = [
	"content-type",
	"etag",
	"last-modified",
	"content-range",
	"accept-ranges"
];
var GatewayError$1 = class extends Error {
	code;
	status;
	constructor(code, status) {
		super(code);
		this.code = code;
		this.status = status;
	}
};
const fail$1 = (code, status) => {
	throw new GatewayError$1(code, status);
};
function json$1(res, status, value) {
	if (res.destroyed || res.writableEnded) return;
	res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
	res.end(JSON.stringify(value));
}
async function body$1(req, maximum, signal) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let bytes = 0;
		const done = (error) => {
			req.off("data", data);
			req.off("end", end);
			req.off("error", errorListener);
			req.off("aborted", aborted);
			signal.removeEventListener("abort", aborted);
			if (error) {
				req.resume();
				reject(error);
			} else resolve(Buffer.concat(chunks));
		};
		const data = (chunk) => {
			bytes += chunk.length;
			if (bytes > maximum) done(new GatewayError$1("RELEASE_BODY_TOO_LARGE", 413));
			else chunks.push(chunk);
		};
		const end = () => done(), errorListener = () => done(new GatewayError$1("RELEASE_BODY_INCOMPLETE", 400)), aborted = () => done(new GatewayError$1("RELEASE_REQUEST_ABORTED", 408));
		if (signal.aborted) {
			aborted();
			return;
		}
		req.on("data", data);
		req.once("end", end);
		req.once("error", errorListener);
		req.once("aborted", aborted);
		signal.addEventListener("abort", aborted, { once: true });
	});
}
/** Trusted composition API. It does not turn a principal supplied over HTTP into identity. */
var ReleaseGateway = class {
	storage;
	transport;
	config;
	configurationHash;
	#gateway;
	#inFlight = 0;
	#closed = false;
	#active = /* @__PURE__ */ new Set();
	constructor(storage, transport, input) {
		this.storage = storage;
		this.transport = transport;
		const { config, configurationHash } = releaseGatewayConfiguration(input);
		this.config = config;
		this.configurationHash = configurationHash;
		this.#gateway = {
			principalId: config.principalId,
			gatewayId: config.gatewayId,
			configurationHash
		};
	}
	get policy() {
		return {
			schemaVersion: "devmesh.release-access-policy.v1",
			gatewayId: this.config.gatewayId,
			gatewayPrincipalId: this.config.principalId,
			configurationHash: this.configurationHash
		};
	}
	#enabled() {
		if (this.#closed || !this.config.enabled || !this.transport.configured) fail$1("RELEASE_ACCESS_NOT_CONFIGURED", 503);
	}
	async accessForMember(subject) {
		this.#enabled();
		const binding = await this.storage.request("resolveReleaseAccess", {
			...this.#gateway,
			subjectPrincipalId: subject.principalId,
			runId: subject.runId,
			releaseId: subject.releaseId
		});
		const checked = await this.transport.check(binding.target);
		const current = await this.storage.request("resolveReleaseAccess", {
			...this.#gateway,
			subjectPrincipalId: subject.principalId,
			runId: subject.runId,
			releaseId: subject.releaseId
		});
		if (canonical(binding.target) !== canonical(current.target) || binding.gate.fence !== current.gate.fence || binding.gate.revision !== current.gate.revision) fail$1("RELEASE_ACCESS_TARGET_CHANGED", 409);
		return {
			releaseOrigin: originForRelease(this.config, subject.releaseId),
			canWrite: binding.canWrite && binding.gate.state === "OPEN",
			checkedAt: checked.checkedAt
		};
	}
	/** Call only after the platform's configured identity resolver and CSRF boundary. */
	async issueForMember(subject) {
		this.#enabled();
		const target = {
			subjectPrincipalId: subject.principalId,
			runId: subject.runId,
			releaseId: subject.releaseId
		};
		const binding = await this.storage.request("resolveReleaseAccess", {
			...this.#gateway,
			...target
		});
		await this.transport.check(binding.target);
		const release = originForRelease(this.config, subject.releaseId), raw = token$1("ticket"), at = Date.now();
		const expiresAt = new Date(at + this.config.ticketTtlMs).toISOString();
		const sessionExpiresAt = new Date(at + this.config.sessionTtlMs).toISOString();
		await this.storage.request("issueReleaseTicket", {
			...this.#gateway,
			...target,
			ticketId: randomUUID(),
			tokenSha256: sha256(raw),
			platformOrigin: this.config.platformOrigin,
			releaseOrigin: release,
			expiresAt
		});
		return {
			ticket: raw,
			releaseOrigin: release,
			expiresAt,
			sessionExpiresAt
		};
	}
	#headers(res) {
		res.setHeader("cache-control", "no-store");
		res.setHeader("x-content-type-options", "nosniff");
		res.setHeader("referrer-policy", "no-referrer");
		res.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
		res.setHeader("content-security-policy", `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; object-src 'none'; worker-src 'none'; frame-src 'none'; frame-ancestors ${this.config.platformOrigin}; sandbox allow-scripts allow-forms allow-same-origin`);
	}
	#origin(req) {
		if (!req.socket.encrypted) fail$1("RELEASE_HTTPS_REQUIRED", 400);
		if (this.config.mode === "loopback-development" && ![
			"127.0.0.1",
			"::1",
			"::ffff:127.0.0.1"
		].includes(req.socket.remoteAddress ?? "")) fail$1("RELEASE_LOCAL_ONLY", 403);
		const seen = /* @__PURE__ */ new Set();
		for (let i = 0; i < req.rawHeaders.length; i += 2) {
			const key = req.rawHeaders[i].toLowerCase();
			if (criticalHeaders$1.has(key) && seen.has(key)) fail$1("RELEASE_DUPLICATE_HEADER", 400);
			seen.add(key);
		}
		if (req.headers.authorization) fail$1("RELEASE_CREDENTIAL_PURPOSE_INVALID", 401);
		let origin;
		try {
			origin = previewOrigin.parse(`https://${req.headers.host}`);
		} catch {
			fail$1("RELEASE_HOST_INVALID", 400);
		}
		const url = new URL(origin), base = new URL(this.config.releaseBaseOrigin), prefix = url.hostname.slice(0, -(base.hostname.length + 1));
		if (url.port !== base.port || !url.hostname.endsWith(`.${base.hostname}`) || !/^r-[a-f0-9]{40}$/.test(prefix)) fail$1("RELEASE_HOST_INVALID", 400);
		return origin;
	}
	#credential(req) {
		const cookies = (req.headers.cookie ?? "").split(";").map((p) => p.trim()).filter((p) => p.startsWith("__Host-devmesh-release="));
		if (cookies.length !== 1) fail$1("RELEASE_SESSION_REQUIRED", 401);
		const raw = cookies[0].slice(23);
		if (!/^dmr_session\.[A-Za-z0-9_-]{43}$/.test(raw)) fail$1("RELEASE_CREDENTIAL_PURPOSE_INVALID", 401);
		return sha256(raw);
	}
	async #authenticate(release, tokenSha256) {
		const result = await this.storage.request("authenticateReleaseSession", {
			...this.#gateway,
			releaseOrigin: release,
			tokenSha256
		});
		if (originForRelease(this.config, result.session.target.releaseId) !== release) fail$1("RELEASE_SESSION_TARGET_INVALID", 401);
		return result;
	}
	#cors(req, res) {
		if (req.headers.origin !== this.config.platformOrigin) fail$1("RELEASE_ORIGIN_FORBIDDEN", 403);
		res.setHeader("access-control-allow-origin", this.config.platformOrigin);
		res.setHeader("access-control-allow-credentials", "true");
		res.setHeader("vary", "Origin");
	}
	handle = async (req, res) => {
		this.#headers(res);
		const abort = new AbortController();
		let timer, counted = false;
		const cancelled = () => {
			if (!res.writableEnded) abort.abort();
		};
		res.once("close", cancelled);
		try {
			this.#enabled();
			if (this.#inFlight >= this.config.maximumInFlight) fail$1("RELEASE_GATEWAY_BUSY", 503);
			this.#inFlight++;
			counted = true;
			this.#active.add(abort);
			timer = setTimeout(() => abort.abort(), this.config.requestTimeoutMs);
			timer.unref();
			const release = this.#origin(req), path = req.url ?? "", method = req.method ?? "";
			if (path === sessionPath$1) {
				this.#cors(req, res);
				if (method === "GET") {
					const current = await this.#authenticate(release, this.#credential(req));
					if (abort.signal.aborted) fail$1("RELEASE_REQUEST_ABORTED", 408);
					json$1(res, 200, { expiresAt: current.session.expiresAt });
					return;
				}
				if (method === "OPTIONS") {
					if (req.headers["access-control-request-method"] !== "POST" || (req.headers["access-control-request-headers"] ?? "").toString().toLowerCase() !== "content-type") fail$1("RELEASE_PREFLIGHT_INVALID", 403);
					res.writeHead(204, {
						"access-control-allow-methods": "POST",
						"access-control-allow-headers": "content-type"
					});
					res.end();
					return;
				}
				if (method !== "POST" || req.headers["content-type"]?.split(";")[0] !== "application/json") fail$1("RELEASE_EXCHANGE_INVALID", 400);
				const bytes = await body$1(req, 4096, abort.signal);
				let input;
				try {
					input = exchangeInput$1.parse(JSON.parse(bytes.toString("utf8")));
				} catch {
					fail$1("RELEASE_EXCHANGE_INVALID", 400);
				}
				if (Date.parse(input.expiresAt) > Date.now() + this.config.sessionTtlMs) fail$1("RELEASE_SESSION_EXPIRY_INVALID", 422);
				const raw = token$1("session");
				const session = await this.storage.request("exchangeReleaseTicket", {
					...this.#gateway,
					platformOrigin: this.config.platformOrigin,
					releaseOrigin: release,
					ticketTokenSha256: sha256(input.ticket),
					sessionId: randomUUID(),
					sessionTokenSha256: sha256(raw),
					expiresAt: input.expiresAt
				});
				if (originForRelease(this.config, session.target.releaseId) !== release) fail$1("RELEASE_SESSION_TARGET_INVALID", 401);
				if (abort.signal.aborted) fail$1("RELEASE_REQUEST_ABORTED", 408);
				res.setHeader("set-cookie", `${cookieName$1}=${raw}; Path=/; Secure; HttpOnly; SameSite=None; Max-Age=${Math.max(0, Math.floor((Date.parse(session.expiresAt) - Date.now()) / 1e3))}`);
				json$1(res, 200, { expiresAt: session.expiresAt });
				return;
			}
			const digest = this.#credential(req), authenticated = await this.#authenticate(release, digest);
			if (path === "/__devmesh/release/logout") {
				if (method !== "POST" || req.headers.origin !== release) fail$1("RELEASE_ORIGIN_FORBIDDEN", 403);
				await this.storage.request("revokeReleaseSession", {
					...this.#gateway,
					releaseOrigin: release,
					tokenSha256: digest
				});
				res.setHeader("set-cookie", `${cookieName$1}=; Path=/; Secure; HttpOnly; SameSite=None; Max-Age=0`);
				json$1(res, 200, { revoked: true });
				return;
			}
			if (path.startsWith("/__devmesh/")) fail$1("RELEASE_ROUTE_NOT_FOUND", 404);
			const write = !["GET", "HEAD"].includes(method);
			if (write && req.headers.origin !== release || !write && req.headers.origin && req.headers.origin !== release) fail$1("RELEASE_ORIGIN_FORBIDDEN", 403);
			const key = req.headers["idempotency-key"];
			if (write && (typeof key !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(key))) fail$1("RELEASE_IDEMPOTENCY_KEY_REQUIRED", 428);
			const identity = sha256(canonical({
				purpose: "RELEASE",
				gateway: this.#gateway,
				routeHash: authenticated.session.target.routeHash,
				routeGeneration: authenticated.session.target.routeGeneration,
				subject: authenticated.session.subjectPrincipalId,
				releaseId: authenticated.session.target.releaseId,
				key: write ? key : null
			}));
			const headers = {};
			const connection = new Set((req.headers.connection ?? "").toLowerCase().split(",").map((v) => v.trim()));
			for (const name of forwardHeaders$1) {
				const value = req.headers[name];
				if (typeof value === "string" && !connection.has(name)) headers[name] = value;
			}
			if (write) headers["idempotency-key"] = identity;
			const bytes = await body$1(req, this.config.maximumRequestBytes, abort.signal);
			const request = releaseAccessHttpRequest.parse({
				method,
				path,
				bodySha256: sha256(bytes),
				headersSha256: sha256(canonical(headers))
			});
			const accessRequestId = write ? "release.http." + identity : randomUUID();
			await this.#forward({
				release,
				digest,
				session: authenticated.session,
				request,
				accessRequestId,
				headers,
				bytes,
				signal: abort.signal
			}, res);
		} catch (error) {
			const e = error;
			json$1(res, Number.isInteger(e.status) && e.status >= 400 && e.status <= 599 ? e.status : error instanceof z.ZodError ? 422 : 503, { error: e.code && /^[A-Z0-9_]+$/.test(e.code) ? e.code : "RELEASE_ACCESS_FAILED" });
		} finally {
			if (timer) clearTimeout(timer);
			this.#active.delete(abort);
			if (counted) this.#inFlight--;
			res.off("close", cancelled);
		}
	};
	async #forward(input, res) {
		const { session, release, digest } = input;
		const record = await this.storage.request("prepareReleaseAccessRequest", {
			...this.#gateway,
			subjectPrincipalId: session.subjectPrincipalId,
			runId: session.target.runId,
			releaseId: session.target.releaseId,
			accessRequestId: input.accessRequestId,
			request: input.request
		});
		if (canonical(record.target) !== canonical(session.target)) fail$1("RELEASE_SESSION_TARGET_INVALID", 409);
		const original = {
			...this.#gateway,
			accessRequestId: record.accessRequestId,
			requestHash: record.requestHash
		};
		const grant = await this.storage.request("beginReleaseAccessRequest", original);
		if (!grant.dispatch) {
			json$1(res, 409, {
				error: "RELEASE_REQUEST_ALREADY_RECORDED",
				accessRequestId: record.accessRequestId,
				state: grant.record.state
			});
			return;
		}
		const observe = async (observation) => {
			return this.storage.request("recordReleaseAccessObservation", {
				...original,
				observation
			});
		};
		const authorize = async () => {
			if (input.signal.aborted || this.#closed) return false;
			try {
				return canonical((await this.#authenticate(release, digest)).session.target) === canonical(record.target) && (await this.storage.request("releaseAccessRequestAuthorized", original)).allowed;
			} catch {
				return false;
			}
		};
		let result;
		try {
			if (!await authorize()) throw Object.assign(/* @__PURE__ */ new Error("Authorization lost before transport"), { outcome: "not-sent" });
			result = await this.transport.forward({
				record: grant.record,
				headers: input.headers,
				body: input.bytes,
				signal: input.signal,
				authorize
			});
		} catch (error) {
			const notSent = error.outcome === "not-sent";
			await observe({
				state: notSent ? "NOT_SENT" : "UNKNOWN",
				errorCode: notSent ? "RELEASE_HTTP_NOT_SENT" : "RELEASE_HTTP_OUTCOME_UNKNOWN",
				checkedAt: (/* @__PURE__ */ new Date()).toISOString()
			});
			json$1(res, 502, {
				error: notSent ? "RELEASE_HTTP_NOT_SENT" : "RELEASE_HTTP_OUTCOME_UNKNOWN",
				accessRequestId: record.accessRequestId
			});
			return;
		}
		await observe({
			state: "FINISHED",
			httpStatus: result.status,
			responseSha256: sha256(result.body),
			checkedAt: (/* @__PURE__ */ new Date()).toISOString()
		});
		await this.#authenticate(release, digest);
		if (input.signal.aborted) fail$1("RELEASE_REQUEST_ABORTED", 408);
		for (const name of responseHeaders$1) {
			const value = result.headers[name];
			if (typeof value === "string" && !/[\r\n\0]/.test(value)) res.setHeader(name, value);
		}
		res.writeHead(result.status);
		res.end(result.body);
	}
	close() {
		this.#closed = true;
		for (const abort of this.#active) abort.abort();
	}
};
//#endregion
//#region src/index.ts
const cookieName = "__Host-devmesh-preview";
const sessionPath = "/__devmesh/preview/session";
const token = (purpose) => `dmp_${purpose}.${randomBytes(32).toString("base64url")}`;
const exchangeInput = z.strictObject({
	ticket: z.string().regex(/^dmp_ticket\.[A-Za-z0-9_-]{43}$/),
	expiresAt: z.iso.datetime()
});
const criticalHeaders = /* @__PURE__ */ new Set([
	"host",
	"origin",
	"cookie",
	"authorization",
	"content-type",
	"content-length",
	"transfer-encoding",
	"idempotency-key",
	"sec-fetch-site"
]);
const forwardHeaders = [
	"accept",
	"accept-language",
	"content-type",
	"if-match",
	"if-none-match",
	"range"
];
const responseHeaders = [
	"content-type",
	"etag",
	"last-modified",
	"content-range",
	"accept-ranges"
];
var GatewayError = class extends Error {
	code;
	status;
	constructor(code, status) {
		super(code);
		this.code = code;
		this.status = status;
	}
};
const fail = (code, status) => {
	throw new GatewayError(code, status);
};
function json(res, status, value) {
	if (res.destroyed || res.writableEnded) return;
	res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
	res.end(JSON.stringify(value));
}
async function body(req, maximum, signal) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let bytes = 0;
		const done = (error) => {
			req.off("data", data);
			req.off("end", end);
			req.off("error", errorListener);
			req.off("aborted", aborted);
			signal.removeEventListener("abort", aborted);
			if (error) {
				req.resume();
				reject(error);
			} else resolve(Buffer.concat(chunks));
		};
		const data = (chunk) => {
			bytes += chunk.length;
			if (bytes > maximum) done(new GatewayError("PREVIEW_BODY_TOO_LARGE", 413));
			else chunks.push(chunk);
		};
		const end = () => done(), errorListener = () => done(new GatewayError("PREVIEW_BODY_INCOMPLETE", 400)), aborted = () => done(new GatewayError("PREVIEW_REQUEST_ABORTED", 408));
		if (signal.aborted) {
			aborted();
			return;
		}
		req.on("data", data);
		req.once("end", end);
		req.once("error", errorListener);
		req.once("aborted", aborted);
		signal.addEventListener("abort", aborted, { once: true });
	});
}
/** Trusted composition API. It does not turn a principal supplied over HTTP into identity. */
var PreviewGateway = class {
	storage;
	transport;
	config;
	configurationHash;
	#gateway;
	#inFlight = 0;
	#closed = false;
	#active = /* @__PURE__ */ new Set();
	constructor(storage, transport, input) {
		this.storage = storage;
		this.transport = transport;
		const { config, configurationHash } = gatewayConfiguration(input);
		this.config = config;
		this.configurationHash = configurationHash;
		this.#gateway = {
			principalId: config.principalId,
			gatewayId: config.gatewayId,
			configurationHash
		};
	}
	get policy() {
		return {
			schemaVersion: "devmesh.preview-access-policy.v1",
			gatewayId: this.config.gatewayId,
			gatewayPrincipalId: this.config.principalId,
			configurationHash: this.configurationHash
		};
	}
	#enabled() {
		if (this.#closed || !this.config.enabled || !this.transport.configured) fail("PREVIEW_ACCESS_NOT_CONFIGURED", 503);
	}
	async accessForMember(subject) {
		this.#enabled();
		const binding = await this.storage.request("resolvePreviewAccess", {
			...this.#gateway,
			subjectPrincipalId: subject.principalId,
			runId: subject.runId,
			previewId: subject.previewId
		});
		return {
			previewOrigin: originForPreview(this.config, subject.previewId),
			canWrite: binding.canWrite && binding.gate.state === "OPEN",
			expiresAt: binding.target.expiresAt
		};
	}
	/** Call only after the platform's configured identity resolver and CSRF boundary. */
	async issueForMember(subject) {
		this.#enabled();
		const target = {
			subjectPrincipalId: subject.principalId,
			runId: subject.runId,
			previewId: subject.previewId
		};
		const binding = await this.storage.request("resolvePreviewAccess", {
			...this.#gateway,
			...target
		});
		const preview = originForPreview(this.config, subject.previewId), raw = token("ticket"), at = Date.now();
		const expiresAt = new Date(Math.min(at + this.config.ticketTtlMs, Date.parse(binding.target.expiresAt))).toISOString();
		const sessionExpiresAt = new Date(Math.min(at + this.config.sessionTtlMs, Date.parse(binding.target.expiresAt))).toISOString();
		await this.storage.request("issuePreviewTicket", {
			...this.#gateway,
			...target,
			ticketId: randomUUID(),
			tokenSha256: sha256$1(raw),
			platformOrigin: this.config.platformOrigin,
			previewOrigin: preview,
			expiresAt
		});
		return {
			ticket: raw,
			previewOrigin: preview,
			expiresAt,
			sessionExpiresAt
		};
	}
	#headers(res) {
		res.setHeader("cache-control", "no-store");
		res.setHeader("x-content-type-options", "nosniff");
		res.setHeader("referrer-policy", "no-referrer");
		res.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
		res.setHeader("content-security-policy", `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; object-src 'none'; worker-src 'none'; frame-src 'none'; frame-ancestors ${this.config.platformOrigin}; sandbox allow-scripts allow-forms allow-same-origin`);
	}
	#origin(req) {
		if (!req.socket.encrypted) fail("PREVIEW_HTTPS_REQUIRED", 400);
		if (this.config.mode === "loopback-development" && ![
			"127.0.0.1",
			"::1",
			"::ffff:127.0.0.1"
		].includes(req.socket.remoteAddress ?? "")) fail("PREVIEW_LOCAL_ONLY", 403);
		const seen = /* @__PURE__ */ new Set();
		for (let i = 0; i < req.rawHeaders.length; i += 2) {
			const key = req.rawHeaders[i].toLowerCase();
			if (criticalHeaders.has(key) && seen.has(key)) fail("PREVIEW_DUPLICATE_HEADER", 400);
			seen.add(key);
		}
		if (req.headers.authorization) fail("PREVIEW_CREDENTIAL_PURPOSE_INVALID", 401);
		let origin;
		try {
			origin = previewOrigin.parse(`https://${req.headers.host}`);
		} catch {
			fail("PREVIEW_HOST_INVALID", 400);
		}
		const url = new URL(origin), base = new URL(this.config.previewBaseOrigin), prefix = url.hostname.slice(0, -(base.hostname.length + 1));
		if (url.port !== base.port || !url.hostname.endsWith(`.${base.hostname}`) || !/^p-[a-f0-9]{40}$/.test(prefix)) fail("PREVIEW_HOST_INVALID", 400);
		return origin;
	}
	#credential(req) {
		const cookies = (req.headers.cookie ?? "").split(";").map((p) => p.trim()).filter((p) => p.startsWith("__Host-devmesh-preview="));
		if (cookies.length !== 1) fail("PREVIEW_SESSION_REQUIRED", 401);
		const raw = cookies[0].slice(23);
		if (!/^dmp_session\.[A-Za-z0-9_-]{43}$/.test(raw)) fail("PREVIEW_CREDENTIAL_PURPOSE_INVALID", 401);
		return sha256$1(raw);
	}
	async #authenticate(preview, tokenSha256) {
		const result = await this.storage.request("authenticatePreviewSession", {
			...this.#gateway,
			previewOrigin: preview,
			tokenSha256
		});
		if (originForPreview(this.config, result.session.target.previewId) !== preview) fail("PREVIEW_SESSION_TARGET_INVALID", 401);
		return result;
	}
	#cors(req, res) {
		if (req.headers.origin !== this.config.platformOrigin) fail("PREVIEW_ORIGIN_FORBIDDEN", 403);
		res.setHeader("access-control-allow-origin", this.config.platformOrigin);
		res.setHeader("access-control-allow-credentials", "true");
		res.setHeader("vary", "Origin");
	}
	handle = async (req, res) => {
		this.#headers(res);
		const abort = new AbortController();
		let timer, counted = false;
		const cancelled = () => {
			if (!res.writableEnded) abort.abort();
		};
		res.once("close", cancelled);
		try {
			this.#enabled();
			if (this.#inFlight >= this.config.maximumInFlight) fail("PREVIEW_GATEWAY_BUSY", 503);
			this.#inFlight++;
			counted = true;
			this.#active.add(abort);
			timer = setTimeout(() => abort.abort(), this.config.requestTimeoutMs);
			timer.unref();
			const preview = this.#origin(req), path = req.url ?? "", method = req.method ?? "";
			if (path === sessionPath) {
				this.#cors(req, res);
				if (method === "GET") {
					const current = await this.#authenticate(preview, this.#credential(req));
					if (abort.signal.aborted) fail("PREVIEW_REQUEST_ABORTED", 408);
					json(res, 200, { expiresAt: current.session.expiresAt });
					return;
				}
				if (method === "OPTIONS") {
					if (req.headers["access-control-request-method"] !== "POST" || (req.headers["access-control-request-headers"] ?? "").toString().toLowerCase() !== "content-type") fail("PREVIEW_PREFLIGHT_INVALID", 403);
					res.writeHead(204, {
						"access-control-allow-methods": "POST",
						"access-control-allow-headers": "content-type"
					});
					res.end();
					return;
				}
				if (method !== "POST" || req.headers["content-type"]?.split(";")[0] !== "application/json") fail("PREVIEW_EXCHANGE_INVALID", 400);
				const bytes = await body(req, 4096, abort.signal);
				let input;
				try {
					input = exchangeInput.parse(JSON.parse(bytes.toString("utf8")));
				} catch {
					fail("PREVIEW_EXCHANGE_INVALID", 400);
				}
				if (Date.parse(input.expiresAt) > Date.now() + this.config.sessionTtlMs) fail("PREVIEW_SESSION_EXPIRY_INVALID", 422);
				const raw = token("session");
				const session = await this.storage.request("exchangePreviewTicket", {
					...this.#gateway,
					platformOrigin: this.config.platformOrigin,
					previewOrigin: preview,
					ticketTokenSha256: sha256$1(input.ticket),
					sessionId: randomUUID(),
					sessionTokenSha256: sha256$1(raw),
					expiresAt: input.expiresAt
				});
				if (originForPreview(this.config, session.target.previewId) !== preview) fail("PREVIEW_SESSION_TARGET_INVALID", 401);
				if (abort.signal.aborted) fail("PREVIEW_REQUEST_ABORTED", 408);
				res.setHeader("set-cookie", `${cookieName}=${raw}; Path=/; Secure; HttpOnly; SameSite=None; Max-Age=${Math.max(0, Math.floor((Date.parse(session.expiresAt) - Date.now()) / 1e3))}`);
				json(res, 200, { expiresAt: session.expiresAt });
				return;
			}
			const digest = this.#credential(req), authenticated = await this.#authenticate(preview, digest);
			if (path === "/__devmesh/preview/logout") {
				if (method !== "POST" || req.headers.origin !== preview) fail("PREVIEW_ORIGIN_FORBIDDEN", 403);
				await this.storage.request("revokePreviewSession", {
					...this.#gateway,
					previewOrigin: preview,
					tokenSha256: digest
				});
				res.setHeader("set-cookie", `${cookieName}=; Path=/; Secure; HttpOnly; SameSite=None; Max-Age=0`);
				json(res, 200, { revoked: true });
				return;
			}
			if (path.startsWith("/__devmesh/")) fail("PREVIEW_ROUTE_NOT_FOUND", 404);
			const write = !["GET", "HEAD"].includes(method);
			if (write && req.headers.origin !== preview || !write && req.headers.origin && req.headers.origin !== preview) fail("PREVIEW_ORIGIN_FORBIDDEN", 403);
			const key = req.headers["idempotency-key"];
			if (write && (typeof key !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(key))) fail("PREVIEW_IDEMPOTENCY_KEY_REQUIRED", 428);
			const identity = sha256$1(canonical({
				gateway: this.#gateway,
				subject: authenticated.session.subjectPrincipalId,
				previewId: authenticated.session.target.previewId,
				key: write ? key : null
			}));
			const headers = {};
			const connection = new Set((req.headers.connection ?? "").toLowerCase().split(",").map((v) => v.trim()));
			for (const name of forwardHeaders) {
				const value = req.headers[name];
				if (typeof value === "string" && !connection.has(name)) headers[name] = value;
			}
			if (write) headers["idempotency-key"] = identity;
			const bytes = await body(req, this.config.maximumRequestBytes, abort.signal);
			const request = previewAccessHttpRequest.parse({
				method,
				path,
				bodySha256: sha256$1(bytes),
				headersSha256: sha256$1(canonical(headers))
			});
			const accessRequestId = write ? "preview.http." + identity : randomUUID();
			await this.#forward({
				preview,
				digest,
				session: authenticated.session,
				request,
				accessRequestId,
				headers,
				bytes,
				signal: abort.signal
			}, res);
		} catch (error) {
			const e = error;
			json(res, Number.isInteger(e.status) && e.status >= 400 && e.status <= 599 ? e.status : error instanceof z.ZodError ? 422 : 503, { error: e.code && /^[A-Z0-9_]+$/.test(e.code) ? e.code : "PREVIEW_ACCESS_FAILED" });
		} finally {
			if (timer) clearTimeout(timer);
			this.#active.delete(abort);
			if (counted) this.#inFlight--;
			res.off("close", cancelled);
		}
	};
	async #forward(input, res) {
		const { session, preview, digest } = input;
		const record = await this.storage.request("preparePreviewAccessRequest", {
			...this.#gateway,
			subjectPrincipalId: session.subjectPrincipalId,
			runId: session.target.runId,
			previewId: session.target.previewId,
			accessRequestId: input.accessRequestId,
			request: input.request
		});
		if (canonical(record.target) !== canonical(session.target)) fail("PREVIEW_SESSION_TARGET_INVALID", 409);
		const original = {
			...this.#gateway,
			accessRequestId: record.accessRequestId,
			requestHash: record.requestHash
		};
		const grant = await this.storage.request("beginPreviewAccessRequest", original);
		if (!grant.dispatch) {
			json(res, 409, {
				error: "PREVIEW_REQUEST_ALREADY_RECORDED",
				accessRequestId: record.accessRequestId,
				state: grant.record.state
			});
			return;
		}
		const observe = async (observation) => {
			return this.storage.request("recordPreviewAccessObservation", {
				...original,
				observation
			});
		};
		const authorize = async () => {
			if (input.signal.aborted || this.#closed) return false;
			try {
				return canonical((await this.#authenticate(preview, digest)).session.target) === canonical(record.target) && (await this.storage.request("previewAccessRequestAuthorized", original)).allowed;
			} catch {
				return false;
			}
		};
		let result;
		try {
			if (!await authorize()) throw Object.assign(/* @__PURE__ */ new Error("Authorization lost before transport"), { outcome: "not-sent" });
			result = await this.transport.forward({
				record: grant.record,
				headers: input.headers,
				body: input.bytes,
				signal: input.signal,
				authorize
			});
		} catch (error) {
			const notSent = error.outcome === "not-sent";
			await observe({
				state: notSent ? "NOT_SENT" : "UNKNOWN",
				errorCode: notSent ? "PREVIEW_HTTP_NOT_SENT" : "PREVIEW_HTTP_OUTCOME_UNKNOWN",
				checkedAt: (/* @__PURE__ */ new Date()).toISOString()
			});
			json(res, 502, {
				error: notSent ? "PREVIEW_HTTP_NOT_SENT" : "PREVIEW_HTTP_OUTCOME_UNKNOWN",
				accessRequestId: record.accessRequestId
			});
			return;
		}
		await observe({
			state: "FINISHED",
			httpStatus: result.status,
			responseSha256: sha256$1(result.body),
			checkedAt: (/* @__PURE__ */ new Date()).toISOString()
		});
		await this.#authenticate(preview, digest);
		if (input.signal.aborted) fail("PREVIEW_REQUEST_ABORTED", 408);
		for (const name of responseHeaders) {
			const value = result.headers[name];
			if (typeof value === "string" && !/[\r\n\0]/.test(value)) res.setHeader(name, value);
		}
		res.writeHead(result.status);
		res.end(result.body);
	}
	close() {
		this.#closed = true;
		for (const abort of this.#active) abort.abort();
	}
};
//#endregion
export { PreviewGateway, ReleaseGateway, gatewayConfiguration, originForPreview, originForRelease, previewGatewayConfig, releaseGatewayConfig, releaseGatewayConfiguration };

//# sourceMappingURL=index.mjs.map