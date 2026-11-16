import { z } from "zod";
import { executionPermit, ids, opaqueKey, pipelineDefinition, relativeFile, sha256 } from "@devmesh/contracts";
import { createServer } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StorageError, canonical, gitDirectoryIdentity, issueCreateArgs, issueLinkArgs, issueVerifyArgs, managedSourcePath, repoBinding, repoCommitArgs, repoDeleteFileArgs, repoFileReadArgs, repoIntegrateArgs, repoWriteFileArgs } from "@devmesh/storage-sqlite";
import { RunnerError, attemptKey, commandSpec, imageDigest, ownerKey, resourceLimits, startJob } from "@devmesh/runner";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { constants } from "node:fs";
import { link, lstat, mkdir, mkdtemp, open, realpath, rename, rmdir, unlink } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { canonicalRoot } from "@devmesh/blob-store";
import { setTimeout as setTimeout$1 } from "node:timers/promises";
import { spawn } from "node:child_process";
import { devNull } from "node:os";
//#region src/protocol.ts
var ToolError = class extends Error {
	code;
	outcome;
	constructor(code, outcome = "known") {
		super(code);
		this.code = code;
		this.outcome = outcome;
	}
};
const toolEnvelope = (schema) => z.strictObject({
	operationId: ids.operation,
	permit: executionPermit,
	args: schema
});
const toolResult = z.discriminatedUnion("state", [z.strictObject({
	schemaVersion: z.literal("devmesh.mcp-tool-result.v1"),
	source: z.literal("mcp"),
	tool: opaqueKey,
	operationId: ids.operation,
	state: z.literal("SUCCEEDED"),
	value: z.json()
}), z.strictObject({
	schemaVersion: z.literal("devmesh.mcp-tool-result.v1"),
	source: z.literal("mcp"),
	tool: opaqueKey,
	operationId: ids.operation,
	state: z.literal("FAILED"),
	error: z.strictObject({
		code: opaqueKey,
		outcome: z.enum([
			"not-sent",
			"known",
			"unknown"
		])
	})
})]);
//#endregion
//#region src/server.ts
async function serveMcp(options) {
	opaqueKey.parse(options.serviceId);
	const names = options.tools.map((t) => t.name);
	if (new Set(names).size !== names.length || new Set(options.identities.map((i) => i.controllerId)).size !== options.identities.length || new Set(options.identities.map((i) => i.credentialRef)).size !== options.identities.length) throw new ToolError("MCP_CONFIGURATION_INVALID", "not-sent");
	for (const name of names) opaqueKey.parse(name);
	const app = express(), host = options.host ?? "127.0.0.1";
	if (!["127.0.0.1", "::1"].includes(host)) throw new ToolError("MCP_BIND_INVALID", "not-sent");
	app.disable("x-powered-by");
	app.disable("etag");
	const instances = /* @__PURE__ */ new Set();
	let closing = false;
	const auth = async (req, res, next) => {
		try {
			if (req.headers.origin !== void 0 || !/^(127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?$/.test(req.headers.host ?? "")) {
				res.status(403).json({ error: "MCP_ORIGIN_DENIED" });
				return;
			}
			const raw = req.headers.authorization, presented = Buffer.from(raw?.startsWith("Bearer ") ? raw.slice(7) : "");
			if (presented.length < 16 || presented.length > 4096) {
				res.status(401).json({ error: "MCP_AUTH_REQUIRED" });
				return;
			}
			const matches = [];
			for (const identity of options.identities) {
				const secret = await options.credentials(identity.credentialRef);
				if (!secret || secret.length < 16) continue;
				const expected = Buffer.from(secret);
				if (expected.length === presented.length && timingSafeEqual(expected, presented)) matches.push(identity);
			}
			if (matches.length !== 1) {
				res.status(401).json({ error: "MCP_AUTH_REQUIRED" });
				return;
			}
			res.locals.identity = matches[0];
			next();
		} catch {
			res.status(503).json({ error: "MCP_AUTH_UNAVAILABLE" });
		}
	};
	app.use("/mcp", auth, express.json({
		limit: "256kb",
		strict: true
	}));
	app.post("/mcp", async (req, res) => {
		if (closing) {
			res.status(503).json({ error: "MCP_STOPPING" });
			return;
		}
		const identity = res.locals.identity, server = new McpServer({
			name: options.serviceId,
			version: options.version
		}, { maxToolInputElements: 4096 });
		instances.add(server);
		for (const def of options.tools.filter((t) => identity.allowedTools.includes(t.name))) server.registerTool(def.name, {
			description: def.description,
			inputSchema: toolEnvelope(def.schema),
			annotations: {
				readOnlyHint: def.effectClass === "READ",
				idempotentHint: def.effectClass !== "NONIDEMPOTENT_WRITE",
				destructiveHint: def.action === "write",
				openWorldHint: false
			}
		}, async (input, extra) => {
			const base = {
				schemaVersion: "devmesh.mcp-tool-result.v1",
				source: "mcp",
				tool: def.name,
				operationId: input.operationId
			};
			try {
				await options.authority.authorize(identity.controllerId, def.name, input.permit, def.action);
			} catch {
				const body = {
					...base,
					state: "FAILED",
					error: {
						code: "MCP_AUTHORITY_DENIED",
						outcome: "not-sent"
					}
				};
				return {
					isError: true,
					content: [{
						type: "text",
						text: canonical(body)
					}],
					structuredContent: body
				};
			}
			try {
				const value = await def.execute({
					controllerId: identity.controllerId,
					operationId: input.operationId,
					permit: input.permit,
					args: def.schema.parse(input.args),
					signal: extra.signal
				}), body = {
					...base,
					state: "SUCCEEDED",
					value
				};
				return {
					content: [{
						type: "text",
						text: canonical(body)
					}],
					structuredContent: body
				};
			} catch (error) {
				const body = {
					...base,
					state: "FAILED",
					error: {
						code: error instanceof ToolError || error instanceof RunnerError || error instanceof StorageError ? error.code : "MCP_TOOL_FAILED",
						outcome: error instanceof ToolError || error instanceof RunnerError ? error.outcome : error instanceof StorageError ? "known" : "unknown"
					}
				};
				return {
					isError: true,
					content: [{
						type: "text",
						text: canonical(body)
					}],
					structuredContent: body
				};
			}
		});
		const transport = new StreamableHTTPServerTransport({ enableJsonResponse: true });
		res.once("close", () => {
			instances.delete(server);
			server.close().catch(() => {});
		});
		try {
			await server.connect(transport);
			await transport.handleRequest(req, res, req.body);
		} catch {
			if (!res.headersSent) res.status(500).json({
				jsonrpc: "2.0",
				id: null,
				error: {
					code: -32603,
					message: "MCP_REQUEST_FAILED"
				}
			});
		}
	});
	app.all("/mcp", (_req, res) => {
		res.status(405).json({
			jsonrpc: "2.0",
			id: null,
			error: {
				code: -32e3,
				message: "METHOD_NOT_ALLOWED"
			}
		});
	});
	const errors = (error, _req, res, _next) => {
		res.status(error?.type === "entity.too.large" ? 413 : 422).json({ error: "MCP_REQUEST_INVALID" });
	};
	app.use(errors);
	const server = createServer({
		headersTimeout: 5e3,
		requestTimeout: 1e4
	}, app);
	await new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(options.port ?? 0, host, () => {
			server.off("error", reject);
			resolve();
		});
	});
	let closed;
	return {
		address: server.address(),
		endpoint: "http://" + (host === "::1" ? "[::1]" : host) + ":" + server.address().port + "/mcp",
		close() {
			return closed ??= (async () => {
				closing = true;
				const done = new Promise((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
				server.closeAllConnections();
				await Promise.allSettled([...instances].map((s) => s.close()));
				await done;
			})();
		}
	};
}
//#endregion
//#region src/client.ts
const hash$1 = (v) => createHash("sha256").update(canonical(v)).digest("hex");
const freeze = (v) => {
	if (v && typeof v === "object") {
		for (const child of Object.values(v)) freeze(child);
		Object.freeze(v);
	}
};
var TrackingTransport = class extends StreamableHTTPClientTransport {
	negotiated = "";
	setProtocolVersion(value) {
		super.setProtocolVersion(value);
		this.negotiated = value;
	}
};
var McpToolClient = class {
	options;
	endpoint;
	timeoutMs;
	#client;
	#transport;
	#snapshot;
	constructor(options) {
		this.options = options;
		const url = new URL(options.endpoint);
		if (url.username || url.password || url.hash || url.search || !["https:", "http:"].includes(url.protocol) || url.protocol === "http:" && ![
			"127.0.0.1",
			"[::1]",
			"localhost"
		].includes(url.hostname)) throw new ToolError("MCP_ENDPOINT_INVALID", "not-sent");
		this.endpoint = url;
		this.timeoutMs = options.timeoutMs ?? 1e4;
		if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 10 || this.timeoutMs > 12e4) throw new ToolError("MCP_TIMEOUT_INVALID", "not-sent");
	}
	get snapshot() {
		if (!this.#snapshot) throw new ToolError("MCP_NOT_CONNECTED", "not-sent");
		return this.#snapshot;
	}
	connect() {
		return this.connectAttempt(0);
	}
	async connectAttempt(attempt) {
		await this.close();
		let secret;
		try {
			secret = await this.options.credentials(this.options.credentialRef);
		} catch {
			throw new ToolError("MCP_AUTH_UNAVAILABLE", "not-sent");
		}
		if (!secret || secret.length < 16) throw new ToolError("MCP_NOT_CONFIGURED", "not-sent");
		const fetchBound = async (input, init) => {
			if (new URL(input instanceof Request ? input.url : String(input)).href !== this.endpoint.href) throw new ToolError("MCP_ENDPOINT_CHANGED", "not-sent");
			const response = await fetch(input, {
				...init,
				headers: {
					...Object.fromEntries(new Headers(init?.headers)),
					Authorization: "Bearer " + secret
				},
				redirect: "error",
				signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(this.timeoutMs)]) : AbortSignal.timeout(this.timeoutMs)
			});
			if (!response.body) return response;
			const chunks = [];
			let bytes = 0;
			const reader = response.body.getReader();
			try {
				for (;;) {
					const r = await reader.read();
					if (r.done) break;
					bytes += r.value.byteLength;
					if (bytes > 1024 * 1024) throw new ToolError("MCP_RESPONSE_TOO_LARGE", "unknown");
					chunks.push(r.value);
				}
			} finally {
				await reader.cancel();
			}
			return new Response(Buffer.concat(chunks), {
				status: response.status,
				headers: response.headers
			});
		};
		const transport = new TrackingTransport(this.endpoint, {
			fetch: fetchBound,
			reconnectionOptions: {
				maxReconnectionDelay: 0,
				initialReconnectionDelay: 0,
				reconnectionDelayGrowFactor: 1,
				maxRetries: 0
			}
		}), client = new Client({
			name: "devmesh-agent-runtime",
			version: "0.1.0"
		});
		try {
			await client.connect(transport, { timeout: this.timeoutMs });
			const listed = await client.listTools({}, { timeout: this.timeoutMs });
			if (listed.nextCursor) throw new ToolError("MCP_TOOL_CATALOG_TOO_LARGE", "not-sent");
			const tools = listed.tools.map((t) => ({
				name: t.name,
				...t.description ? { description: t.description } : {},
				inputSchema: t.inputSchema,
				...t.annotations ? { annotations: t.annotations } : {}
			})).sort((a, b) => a.name.localeCompare(b.name));
			const basis = {
				endpointId: this.options.endpointId,
				endpoint: this.endpoint.href,
				requestTimeoutMs: this.timeoutMs,
				protocolVersion: transport.negotiated,
				server: client.getServerVersion(),
				capabilities: client.getServerCapabilities(),
				tools
			};
			const sha256 = hash$1(basis);
			if (!transport.negotiated || this.options.expectedSnapshotHash && sha256 !== this.options.expectedSnapshotHash || this.#snapshot && sha256 !== this.#snapshot.sha256) throw new ToolError("MCP_SCHEMA_CHANGED", "not-sent");
			const snapshot = {
				...basis,
				sha256
			};
			freeze(snapshot);
			this.#snapshot = snapshot;
			this.#client = client;
			this.#transport = transport;
			return snapshot;
		} catch (error) {
			await client.close();
			if (error instanceof ToolError) throw error;
			if (attempt === 0) return this.connectAttempt(1);
			throw new ToolError("MCP_CONNECT_FAILED", "not-sent");
		}
	}
	async call(name, operationId, permit, args, signal) {
		const client = this.#client;
		if (!client || !this.snapshot.tools.some((t) => t.name === name)) throw new ToolError("MCP_TOOL_UNAVAILABLE", "not-sent");
		try {
			const result = await client.callTool({
				name,
				arguments: {
					operationId,
					permit: executionPermit.parse(permit),
					args
				}
			}, void 0, {
				timeout: this.timeoutMs,
				...signal ? { signal } : {}
			});
			const text = z.array(z.object({
				type: z.string(),
				text: z.string().optional()
			})).catch([]).parse(result.content).find((c) => c.type === "text")?.text, parsed = toolResult.safeParse(result.structuredContent ?? (text ? JSON.parse(text) : void 0));
			if (!parsed.success || parsed.data.operationId !== operationId || parsed.data.tool !== name) throw new ToolError("MCP_RESULT_INVALID", "unknown");
			if (parsed.data.state === "FAILED") throw new ToolError(parsed.data.error.code, parsed.data.error.outcome);
			return parsed.data.value;
		} catch (error) {
			if (error instanceof ToolError) throw error;
			throw new ToolError("MCP_CALL_UNKNOWN", "unknown");
		}
	}
	async close() {
		const client = this.#client, transport = this.#transport;
		this.#client = void 0;
		this.#transport = void 0;
		if (client) await client.close();
		else if (transport) await transport.close();
	}
};
//#endregion
//#region src/repo.ts
const snapshotSchema = z.strictObject({
	snapshotRef: opaqueKey,
	resourceId: opaqueKey,
	root: z.string().min(1),
	files: z.array(z.strictObject({
		path: relativeFile,
		sha256,
		byteSize: z.number().int().min(0).max(65536)
	})).max(2e3)
});
const repoListArgs = z.strictObject({
	snapshotRef: opaqueKey,
	prefix: z.string().max(512).default(""),
	limit: z.number().int().min(1).max(200).default(100)
});
const repoReadArgs = z.strictObject({
	snapshotRef: opaqueKey,
	path: relativeFile
});
const denied$2 = (path) => path.split("/").some((v) => v.startsWith(".") || [
	"node_modules",
	"vendor",
	"secrets"
].includes(v) || /\.(pem|key|p12|pfx)$/i.test(v));
function repoTools(input) {
	const snapshots = input.map((v) => snapshotSchema.parse(structuredClone(v)));
	if (new Set(snapshots.map((s) => s.snapshotRef)).size !== snapshots.length) throw new ToolError("MCP_SNAPSHOT_CONFIGURATION_INVALID", "not-sent");
	for (const s of snapshots) if (new Set(s.files.map((f) => f.path)).size !== s.files.length || s.files.some((f) => denied$2(f.path))) throw new ToolError("MCP_SNAPSHOT_CONFIGURATION_INVALID", "not-sent");
	const get = (ref, permit) => {
		const s = snapshots.find((s) => s.snapshotRef === ref);
		if (!s || !permit.resources.some((r) => r.kind === "snapshot" && r.resourceId === s.resourceId)) throw new ToolError("MCP_SNAPSHOT_DENIED", "not-sent");
		return s;
	};
	return [{
		name: "repo.list",
		description: "List the authorized immutable repository snapshot manifest",
		schema: repoListArgs,
		action: "read",
		effectClass: "READ",
		async execute({ args, permit }) {
			const a = repoListArgs.parse(args), s = get(a.snapshotRef, permit);
			if (a.prefix && (a.prefix.startsWith("/") || a.prefix.includes("\\") || a.prefix.split("/").some((p) => p === ".." || p === "."))) throw new ToolError("MCP_PATH_DENIED", "not-sent");
			const matches = s.files.filter((f) => f.path.startsWith(a.prefix)).sort((a, b) => a.path.localeCompare(b.path));
			return {
				snapshotRef: s.snapshotRef,
				files: matches.slice(0, a.limit),
				truncated: matches.length > a.limit
			};
		}
	}, {
		name: "repo.read",
		description: "Read and verify one authorized snapshot file without executing code",
		schema: repoReadArgs,
		action: "read",
		effectClass: "READ",
		async execute({ args, permit }) {
			const a = repoReadArgs.parse(args), s = get(a.snapshotRef, permit), entry = s.files.find((f) => f.path === a.path);
			if (!entry || denied$2(a.path)) throw new ToolError("MCP_PATH_DENIED", "not-sent");
			canonicalRoot(s.root);
			const root = await realpath(s.root), parts = a.path.split("/");
			let path = root;
			for (const part of parts.slice(0, -1)) {
				path = join(path, part);
				const stat = await lstat(path);
				if (stat.isSymbolicLink() || !stat.isDirectory()) throw new ToolError("MCP_PATH_DENIED", "not-sent");
			}
			path = join(path, parts.at(-1));
			const before = await lstat(path);
			if (before.isSymbolicLink() || !before.isFile() || before.nlink !== 1 || before.size !== entry.byteSize) throw new ToolError("MCP_SNAPSHOT_CHANGED", "not-sent");
			const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
			let bytes;
			try {
				const st = await file.stat();
				if (!st.isFile() || st.nlink !== 1 || st.ino !== before.ino || st.dev !== before.dev || st.size !== entry.byteSize) throw new ToolError("MCP_SNAPSHOT_CHANGED", "not-sent");
				bytes = Buffer.alloc(st.size);
				let pos = 0;
				while (pos < bytes.length) {
					const r = await file.read(bytes, pos, bytes.length - pos, pos);
					if (!r.bytesRead) throw new ToolError("MCP_SNAPSHOT_CHANGED", "not-sent");
					pos += r.bytesRead;
				}
			} finally {
				await file.close();
			}
			if (createHash("sha256").update(bytes).digest("hex") !== entry.sha256) throw new ToolError("MCP_SNAPSHOT_CHANGED", "not-sent");
			let text;
			try {
				text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
			} catch {
				throw new ToolError("MCP_BINARY_FILE_UNSUPPORTED", "not-sent");
			}
			return {
				snapshotRef: s.snapshotRef,
				path: entry.path,
				sha256: entry.sha256,
				byteSize: entry.byteSize,
				text
			};
		}
	}];
}
//#endregion
//#region src/tests.ts
const checkSchema = z.strictObject({
	checkId: opaqueKey,
	imageDigest,
	commandSpec,
	resourceLimits,
	networkPolicyRef: z.literal("none"),
	outputSpec: z.array(relativeFile).max(32)
});
const testsStartArgs = z.strictObject({
	checkId: opaqueKey,
	workspaceRef: opaqueKey
});
const testsJobArgs = z.strictObject({ jobId: ids.job });
const testsOperationArgs = z.strictObject({ operationId: ids.operation });
function testTools(runner, definitions) {
	const checks = definitions.map((v) => checkSchema.parse(structuredClone(v)));
	if (new Set(checks.map((v) => v.checkId)).size !== checks.length) throw new ToolError("MCP_CHECK_CONFIGURATION_INVALID", "not-sent");
	const scoped = (job, permit) => {
		const p = job.request.permit;
		if (ownerKey(p) !== ownerKey(permit) || attemptKey(p) !== attemptKey(permit) || p.activationId !== permit.activationId || p.grantId !== permit.grantId) throw new ToolError("MCP_JOB_NOT_FOUND", "not-sent");
		return job;
	};
	const byJob = async (args, permit) => scoped(await runner.get(testsJobArgs.parse(args).jobId), permit);
	return [
		{
			name: "tests.start",
			description: "Admit an approved isolated check job; an acknowledgement is not a test verdict",
			schema: testsStartArgs,
			action: "write",
			effectClass: "NONIDEMPOTENT_WRITE",
			async execute({ operationId, args, permit }) {
				const a = testsStartArgs.parse(args), check = checks.find((c) => c.checkId === a.checkId);
				if (!check) throw new ToolError("MCP_CHECK_DENIED", "not-sent");
				const spec = {
					imageDigest: check.imageDigest,
					workspaceRef: a.workspaceRef,
					commandSpec: check.commandSpec,
					resourceLimits: check.resourceLimits,
					networkPolicyRef: check.networkPolicyRef,
					outputSpec: check.outputSpec
				};
				try {
					const original = scoped(await runner.byOperation(ids.operation.parse(operationId)), permit), { request } = original;
					if (canonical(spec) !== canonical({
						imageDigest: request.imageDigest,
						workspaceRef: request.workspaceRef,
						commandSpec: request.commandSpec,
						resourceLimits: request.resourceLimits,
						networkPolicyRef: request.networkPolicyRef,
						outputSpec: request.outputSpec
					})) throw new ToolError("IDEMPOTENCY_KEY_REUSED", "not-sent");
					return original;
				} catch (error) {
					if (!(error instanceof RunnerError) || error.code !== "JOB_NOT_FOUND") throw error;
				}
				const bounded = {
					...permit,
					notBefore: new Date(Math.max(Date.parse(permit.notBefore), Date.parse(permit.expiresAt) - 15e3)).toISOString()
				};
				return runner.start({
					schemaVersion: "devmesh.runner-job.v1",
					operationId: ids.operation.parse(operationId),
					permit: bounded,
					...spec
				});
			}
		},
		{
			name: "tests.get",
			description: "Query the original isolated job without starting another",
			schema: testsJobArgs,
			action: "read",
			effectClass: "READ",
			async execute({ args, permit }) {
				return byJob(args, permit);
			}
		},
		{
			name: "tests.stop",
			description: "Request stop of the original isolated job; verify exit separately",
			schema: testsJobArgs,
			action: "stop",
			effectClass: "IDEMPOTENT_WRITE",
			async execute({ args, permit }) {
				const job = await byJob(args, permit);
				return runner.stop(job.jobId);
			}
		},
		{
			name: "tests.by-operation",
			description: "Reconcile an uncertain admission using its original operation ID",
			schema: testsOperationArgs,
			action: "read",
			effectClass: "READ",
			async execute({ args, permit }) {
				const a = testsOperationArgs.parse(args);
				return scoped(await runner.byOperation(a.operationId), permit);
			}
		}
	];
}
//#endregion
//#region src/bridge.ts
const stripSchema = (value) => {
	if (Array.isArray(value)) return value.map(stripSchema);
	if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([k]) => k !== "$schema").map(([k, v]) => [k, stripSchema(v)]));
	return value;
};
function runtimeMcpTools(client, contracts) {
	const snapshot = client.snapshot;
	const modelNames = contracts.map((t) => t.name.replaceAll(".", "_"));
	if (new Set(modelNames).size !== modelNames.length || modelNames.some((n) => !/^[A-Za-z0-9_-]{1,128}$/.test(n))) throw new ToolError("MCP_MODEL_TOOL_NAME_INVALID", "not-sent");
	return contracts.map((contract) => {
		const advertised = snapshot.tools.find((t) => t.name === contract.name);
		if (!advertised || canonical(stripSchema(advertised.inputSchema)) !== canonical(stripSchema(z.toJSONSchema(toolEnvelope(contract.schema), {
			target: "draft-7",
			io: "input"
		})))) throw new ToolError("MCP_SCHEMA_CHANGED", "not-sent");
		if (advertised.annotations?.readOnlyHint !== (contract.effectClass === "READ") || advertised.annotations?.idempotentHint !== (contract.effectClass !== "NONIDEMPOTENT_WRITE")) throw new ToolError("MCP_EFFECT_POLICY_CHANGED", "not-sent");
		const call = async (name, op, host, args, signal) => {
			if (client.snapshot.sha256 !== snapshot.sha256) throw new ToolError("MCP_SCHEMA_CHANGED", "not-sent");
			try {
				const result = await client.call(name, op, executionPermit.parse(host.permit), args, signal), value = {
					source: "mcp",
					connectionHash: snapshot.sha256,
					result
				};
				if ([
					"repo.commit",
					"repo.integrate",
					"repo.by-operation",
					"repo.writeFile",
					"repo.deleteFile",
					"repo.fileByOperation"
				].includes(name)) {
					const state = result.state;
					if (state === "FAILED" || state === "CONFLICT") return {
						state: "FAILED",
						value
					};
					if (state !== "SUCCEEDED") return { state: "OUTCOME_UNKNOWN" };
				}
				return {
					state: "SUCCEEDED",
					value
				};
			} catch (error) {
				return error instanceof ToolError && error.outcome !== "unknown" ? {
					state: "FAILED",
					value: {
						source: "mcp",
						code: error.code
					}
				} : { state: "OUTCOME_UNKNOWN" };
			}
		};
		return {
			name: contract.name.replaceAll(".", "_"),
			description: contract.description,
			schema: contract.schema,
			effectClass: contract.effectClass,
			connection: {
				source: "mcp",
				toolName: contract.name,
				snapshot: z.record(z.string(), z.json()).parse(snapshot)
			},
			execute: (op, args, host, signal) => call(contract.name, op, host, contract.schema.parse(args), signal),
			async query(op, host, args) {
				const queryTool = contract.name === "tests.start" ? "tests.by-operation" : [
					"issues.create",
					"issues.linkFix",
					"issues.recordVerification"
				].includes(contract.name) ? "issues.by-operation" : contract.name === "pipeline.start" ? "pipeline.by-operation" : ["repo.commit", "repo.integrate"].includes(contract.name) ? "repo.by-operation" : ["repo.writeFile", "repo.deleteFile"].includes(contract.name) ? "repo.fileByOperation" : null;
				if (queryTool) {
					const result = await call(queryTool, op, host, { operationId: op });
					if (result.state === "FAILED" && (queryTool === "repo.by-operation" || queryTool === "repo.fileByOperation")) {
						const state = result.value?.result?.state;
						if (state === "FAILED" || state === "CONFLICT") return result;
					}
					return result.state === "FAILED" ? { state: "OUTCOME_UNKNOWN" } : result;
				}
				if ((contract.name === "tests.stop" || contract.name === "tests.get") && args) {
					const parsed = z.strictObject({ jobId: z.string() }).safeParse(args);
					if (!parsed.success) return { state: "OUTCOME_UNKNOWN" };
					const result = await call("tests.get", op, host, { jobId: parsed.data.jobId });
					if (contract.name === "tests.stop" && result.state === "SUCCEEDED") {
						if (!result.value.result.stopRequested) return { state: "OUTCOME_UNKNOWN" };
					}
					return result;
				}
				if (contract.name === "pipeline.stop" && args) {
					const parsed = z.strictObject({ pipelineId: z.string() }).safeParse(args);
					if (!parsed.success) return { state: "OUTCOME_UNKNOWN" };
					const result = await call("pipeline.get", op, host, parsed.data);
					if (result.state === "SUCCEEDED" && !result.value.result.stopRequested) return { state: "OUTCOME_UNKNOWN" };
					return result;
				}
				return { state: "OUTCOME_UNKNOWN" };
			}
		};
	});
}
//#endregion
//#region src/docs.ts
const source = z.discriminatedUnion("kind", [z.strictObject({
	kind: z.literal("artifact"),
	artifactId: ids.artifact
}), z.strictObject({
	kind: z.literal("attachment"),
	attachmentId: ids.attachment
})]);
const binding = z.strictObject({
	documentRef: opaqueKey,
	version: opaqueKey,
	resourceId: opaqueKey,
	runId: ids.run,
	principalId: opaqueKey,
	reference: source,
	sha256,
	byteSize: z.number().int().nonnegative().max(2 * 1024 * 1024)
});
const documentVersion = z.strictObject({
	documentRef: opaqueKey,
	version: opaqueKey
});
const docsReadArgs = documentVersion.extend({
	startOffset: z.number().int().nonnegative().default(0),
	limit: z.number().int().min(1).max(8192).default(4096)
});
const docsSearchArgs = z.strictObject({
	documents: z.array(documentVersion).min(1).max(32),
	query: z.string().min(1).max(256),
	limit: z.number().int().min(1).max(40).default(20)
});
const denied$1 = () => new ToolError("MCP_DOCUMENT_DENIED", "not-sent");
const low = (s, n) => n < s.length && s.charCodeAt(n) >= 56320 && s.charCodeAt(n) <= 57343;
function docsTools(content, input) {
	const documents = z.array(binding).max(128).parse(structuredClone(input));
	const keys = documents.map((d) => d.documentRef + "\0" + d.version);
	if (new Set(keys).size !== keys.length || documents.reduce((n, d) => n + d.byteSize, 0) > 16 * 1024 * 1024) throw new ToolError("MCP_DOCUMENT_CONFIGURATION_INVALID", "not-sent");
	function resolve(ref, permit) {
		const d = documents.find((d) => d.documentRef === ref.documentRef && d.version === ref.version);
		if (!d || permit.ownerKind !== "workflowAttempt" || permit.runId !== d.runId || !permit.resources.some((r) => r.kind === "dataset" && r.resourceId === d.resourceId)) throw denied$1();
		return d;
	}
	async function read(d, signal) {
		signal.throwIfAborted();
		const bytes = await content.readBytes(d.principalId, d.reference, 2 * 1024 * 1024);
		if (bytes.byteLength !== d.byteSize || createHash("sha256").update(bytes).digest("hex") !== d.sha256) throw new ToolError("MCP_DOCUMENT_CHANGED", "not-sent");
		signal.throwIfAborted();
		try {
			return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
		} catch {
			throw new ToolError("MCP_DOCUMENT_ENCODING_INVALID", "not-sent");
		}
	}
	const provenance = (d) => ({
		documentRef: d.documentRef,
		version: d.version,
		sha256: d.sha256,
		reference: d.reference,
		offsetUnit: "utf16-code-unit"
	});
	function* paragraphs(text) {
		let start = 0, paragraph = 0;
		for (const match of text.matchAll(/\r?\n[\t ]*\r?\n/g)) {
			const end = match.index;
			if (end > start) yield {
				paragraph: ++paragraph,
				startOffset: start,
				endOffset: end
			};
			start = end + match[0].length;
		}
		if (start < text.length) yield {
			paragraph: ++paragraph,
			startOffset: start,
			endOffset: text.length
		};
	}
	return [{
		name: "docs.read",
		description: "Read a bounded range from a fixed authorized document; offsets count UTF-16 code units",
		schema: docsReadArgs,
		action: "read",
		effectClass: "READ",
		async execute({ args, permit, signal }) {
			const a = docsReadArgs.parse(args), d = resolve(a, permit), text = await read(d, signal), start = a.startOffset;
			if (start > text.length || low(text, start)) throw new ToolError("MCP_DOCUMENT_OFFSET_INVALID", "not-sent");
			let end = Math.min(text.length, start + a.limit);
			if (low(text, end)) end--;
			if (end === start && start < text.length) throw new ToolError("MCP_DOCUMENT_RANGE_TOO_SMALL", "not-sent");
			const visible = [];
			for (const p of paragraphs(text)) {
				if (p.startOffset >= end) break;
				if (p.endOffset > start) visible.push(p);
				if (visible.length === 100) break;
			}
			return {
				...provenance(d),
				startOffset: start,
				endOffset: end,
				totalLength: text.length,
				text: text.slice(start, end),
				paragraphs: visible,
				truncated: end < text.length
			};
		}
	}, {
		name: "docs.search",
		description: "Find literal keyword matches in fixed authorized sources, preserving exact original offsets",
		schema: docsSearchArgs,
		action: "read",
		effectClass: "READ",
		async execute({ args, permit, signal }) {
			const a = docsSearchArgs.parse(args);
			if (new Set(a.documents.map((d) => d.documentRef + "\0" + d.version)).size !== a.documents.length) throw new ToolError("MCP_DOCUMENT_QUERY_INVALID", "not-sent");
			const selected = a.documents.map((ref) => resolve(ref, permit)), matches = [];
			for (const d of selected) {
				const text = await read(d, signal);
				let from = 0;
				while (from <= text.length) {
					const index = text.indexOf(a.query, from);
					if (index < 0) break;
					if (matches.length === a.limit) return {
						matches,
						truncated: true
					};
					let start = Math.max(0, index - 80), end = Math.min(text.length, index + a.query.length + 80);
					if (low(text, start)) start--;
					if (low(text, end)) end++;
					let paragraph = null;
					for (const p of paragraphs(text)) {
						if (p.startOffset > index) break;
						if (p.endOffset > index) {
							paragraph = p.paragraph;
							break;
						}
					}
					matches.push({
						...provenance(d),
						startOffset: index,
						endOffset: index + a.query.length,
						paragraph,
						excerpt: {
							startOffset: start,
							endOffset: end,
							text: text.slice(start, end)
						}
					});
					from = index + a.query.length;
				}
			}
			return {
				matches,
				truncated: false
			};
		}
	}];
}
//#endregion
//#region src/issues.ts
const issuesGetArgs = z.strictObject({
	issueId: opaqueKey,
	afterRevision: z.number().int().nonnegative().default(0),
	limit: z.number().int().min(1).max(20).default(20)
});
const issuesOperationArgs = z.strictObject({ operationId: ids.operation });
function issueTools(storage) {
	return [
		{
			name: "issues.create",
			description: "Create a sourced issue with a durable original operation; this is a finding, not verified failure",
			schema: issueCreateArgs,
			action: "write",
			effectClass: "NONIDEMPOTENT_WRITE",
			execute: ({ operationId, args, permit }) => storage.request("createIssue", {
				operationId,
				permit,
				args: issueCreateArgs.parse(args)
			})
		},
		{
			name: "issues.linkFix",
			description: "Link an approved fix Work using the exact current issue revision",
			schema: issueLinkArgs,
			action: "write",
			effectClass: "IDEMPOTENT_WRITE",
			execute: ({ operationId, args, permit }) => storage.request("linkIssueFix", {
				operationId,
				permit,
				args: issueLinkArgs.parse(args)
			})
		},
		{
			name: "issues.recordVerification",
			description: "Record sourced fix verification; a pass requires persisted tester evidence for that exact code commit",
			schema: issueVerifyArgs,
			action: "write",
			effectClass: "IDEMPOTENT_WRITE",
			execute: ({ operationId, args, permit }) => storage.request("recordIssueVerification", {
				operationId,
				permit,
				args: issueVerifyArgs.parse(args)
			})
		},
		{
			name: "issues.get",
			description: "Read an issue and a bounded page of immutable revision history in the original Run",
			schema: issuesGetArgs,
			action: "read",
			effectClass: "READ",
			execute: ({ args, permit }) => storage.request("getIssue", {
				permit,
				...issuesGetArgs.parse(args)
			})
		},
		{
			name: "issues.by-operation",
			description: "Reconcile an issue mutation using its original host and operation identity",
			schema: issuesOperationArgs,
			action: "read",
			effectClass: "READ",
			execute: ({ args, permit }) => storage.request("getIssueOperation", {
				permit,
				...issuesOperationArgs.parse(args)
			})
		}
	];
}
//#endregion
//#region src/authority.ts
/** Deployment-owned controllers; model arguments cannot add a controller or a tool. */
function workflowToolAuthority(storage, controllers) {
	const frozen = new Map([...controllers].map(([id, tools]) => [id, new Set(tools)]));
	return { async authorize(controllerId, toolName, permit, action) {
		if (!frozen.get(controllerId)?.has(toolName)) throw new ToolError("MCP_AUTHORITY_DENIED", "not-sent");
		await storage.request("authorizeMcpAction", {
			permit,
			toolName,
			action
		});
	} };
}
//#endregion
//#region src/pipeline.ts
const pipelineStartArgs = z.strictObject({
	definitionId: opaqueKey,
	workspaceRef: opaqueKey
});
const pipelineGetArgs = z.strictObject({ pipelineId: opaqueKey });
const pipelineOperationArgs = z.strictObject({ operationId: ids.operation });
const pipelineLogsArgs = pipelineGetArgs.extend({
	ordinal: z.number().int().min(0).max(7),
	offset: z.number().int().nonnegative().default(0),
	limit: z.number().int().min(1).max(65536).default(16384)
});
function pipelineTools(storage, runner, input) {
	const definitions = z.array(pipelineDefinition).max(64).parse(structuredClone(input));
	if (new Set(definitions.map((d) => d.definitionId)).size !== definitions.length) throw new ToolError("MCP_PIPELINE_CONFIGURATION_INVALID", "not-sent");
	const get = (permit, args) => storage.request("getPipeline", {
		permit,
		...pipelineGetArgs.parse(args)
	});
	return [
		{
			name: "pipeline.start",
			description: "Create an independent pipeline with frozen approved stages; acknowledgement is not stage success",
			schema: pipelineStartArgs,
			action: "write",
			effectClass: "NONIDEMPOTENT_WRITE",
			async execute({ permit, operationId, args }) {
				const a = pipelineStartArgs.parse(args), definition = definitions.find((d) => d.definitionId === a.definitionId);
				if (!definition) throw new ToolError("MCP_PIPELINE_DEFINITION_DENIED", "not-sent");
				return storage.request("createPipeline", {
					permit,
					operationId,
					workspaceRef: a.workspaceRef,
					definition
				});
			}
		},
		{
			name: "pipeline.get",
			description: "Read the original pipeline and its independent stage records",
			schema: pipelineGetArgs,
			action: "read",
			effectClass: "READ",
			execute: ({ permit, args }) => get(permit, args)
		},
		{
			name: "pipeline.stop",
			description: "Request stop of original stages; unresolved jobs remain unresolved until exit is verified",
			schema: pipelineGetArgs,
			action: "stop",
			effectClass: "IDEMPOTENT_WRITE",
			execute: ({ permit, args }) => storage.request("stopPipeline", {
				permit,
				...pipelineGetArgs.parse(args)
			})
		},
		{
			name: "pipeline.by-operation",
			description: "Query a pipeline by original creation operation without starting another",
			schema: pipelineOperationArgs,
			action: "read",
			effectClass: "READ",
			execute: ({ permit, args }) => storage.request("getPipelineOperation", {
				permit,
				...pipelineOperationArgs.parse(args)
			})
		},
		{
			name: "pipeline.artifacts",
			description: "List exact per-stage Runner output references and hashes",
			schema: pipelineGetArgs,
			action: "read",
			effectClass: "READ",
			async execute({ permit, args }) {
				const p = await get(permit, args);
				return {
					pipelineId: p.pipelineId,
					stages: p.stages.map((s) => ({
						ordinal: s.ordinal,
						stageId: s.stageId,
						jobId: s.jobId,
						outputs: s.outputRefs.map((r, index) => ({
							...r,
							index
						}))
					}))
				};
			}
		},
		{
			name: "pipeline.logs",
			description: "Read a bounded byte page from an original stage log through the Runner service",
			schema: pipelineLogsArgs,
			action: "read",
			effectClass: "READ",
			async execute({ permit, args }) {
				const a = pipelineLogsArgs.parse(args), stage = (await get(permit, { pipelineId: a.pipelineId })).stages.find((s) => s.ordinal === a.ordinal);
				if (!stage?.jobId) throw new ToolError("MCP_PIPELINE_LOGS_UNAVAILABLE", "not-sent");
				return runner.logs(stage.jobId, a.offset, a.limit);
			}
		}
	];
}
/** Explicitly started coordinator; only this service writes stage/Runner facts. */
var PipelineCoordinator = class {
	storage;
	runner;
	#stop = new AbortController();
	#loop;
	lastError = null;
	constructor(storage, runner) {
		this.storage = storage;
		this.runner = runner;
	}
	async record(item, job) {
		const { jobId, operationId, requestHash, request, state, exitCode, errorCode, stopRequested, stopEvidence, containerId, startedAt, endedAt, executionProfile, logCursor, outputRefs } = job;
		executionPermit.parse(request.permit);
		await this.storage.request("recordPipelineStage", {
			pipelineId: item.pipelineId,
			ordinal: item.ordinal,
			job: {
				jobId,
				operationId,
				requestHash,
				request: z.record(z.string(), z.json()).parse(request),
				state,
				exitCode,
				errorCode,
				stopRequested,
				stopEvidence: z.record(z.string(), z.json()).nullable().parse(stopEvidence),
				containerId,
				startedAt,
				endedAt,
				executionProfile: executionProfile ?? null,
				logCursor,
				outputRefs
			}
		});
	}
	async process(item) {
		if (this.#stop.signal.aborted) return;
		let job;
		try {
			if (item.state === "PENDING") {
				const admitted = await this.storage.request("markPipelineStageSent", {
					pipelineId: item.pipelineId,
					ordinal: item.ordinal
				});
				if (!admitted.send || !admitted.request) return;
				if (this.#stop.signal.aborted) throw new ToolError("PIPELINE_COORDINATOR_STOPPED", "not-sent");
				job = await this.runner.start(startJob.parse(admitted.request));
			} else job = item.jobId ? await this.runner.get(item.jobId) : await this.runner.byOperation(item.operationId);
			await this.record(item, job);
			const observed = job;
			if (item.stopRequested && job.state !== "EXITED") job = await this.runner.stop(job.jobId);
			else if (job.state !== "EXITED" && !job.stopRequested && Date.now() - Date.parse(job.lastHeartbeat) >= 5e3) {
				const permit = await this.storage.request("getPipelineStagePermit", {
					pipelineId: item.pipelineId,
					ordinal: item.ordinal
				});
				job = await this.runner.renew(job.jobId, {
					permit,
					sequence: job.leaseSequence + 1
				});
			}
			if (job !== observed) await this.record(item, job);
		} catch (error) {
			this.lastError = error instanceof RunnerError || error instanceof ToolError ? error.code : "PIPELINE_STAGE_UNAVAILABLE";
			await this.storage.request("markPipelineStageUnknown", {
				pipelineId: item.pipelineId,
				ordinal: item.ordinal,
				errorCode: this.lastError
			});
		}
	}
	async tick() {
		for (const item of await this.storage.request("listPipelineStages", {})) {
			if (this.#stop.signal.aborted) return;
			await this.process(item);
		}
	}
	start() {
		if (this.#loop || this.#stop.signal.aborted) throw new ToolError("PIPELINE_ALREADY_STARTED", "not-sent");
		this.#loop = (async () => {
			while (!this.#stop.signal.aborted) {
				try {
					await this.tick();
				} catch {
					this.lastError = "PIPELINE_COORDINATOR_UNAVAILABLE";
				}
				try {
					await setTimeout$1(250, void 0, { signal: this.#stop.signal });
				} catch {
					break;
				}
			}
		})();
	}
	async stop() {
		this.#stop.abort();
		await this.#loop;
	}
};
//#endregion
//#region src/repo-files.ts
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const missing = (e) => e.code === "ENOENT";
function deny(code) {
	throw new ToolError(code, "not-sent");
}
async function identity(path, directory = false) {
	const stat = await lstat(path, { bigint: true });
	if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile())) deny("MCP_FILE_PATH_DENIED");
	return {
		path,
		device: String(stat.dev),
		fileId: String(stat.ino)
	};
}
const same = (a, b) => a.device === b.device && a.fileId === b.fileId;
async function read(path, links = 1) {
	let before;
	try {
		before = await lstat(path, { bigint: true });
	} catch (e) {
		if (missing(e)) return null;
		throw e;
	}
	if (!before.isFile() || before.isSymbolicLink() || before.nlink !== BigInt(links) || before.size > 2n * 1024n * 1024n) deny("MCP_FILE_PATH_DENIED");
	const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
	try {
		const first = await handle.stat({ bigint: true });
		if (first.dev !== before.dev || first.ino !== before.ino || first.nlink !== before.nlink || first.size !== before.size) deny("MCP_FILE_CHANGED");
		const bytes = await handle.readFile(), after = await handle.stat({ bigint: true });
		if (bytes.length !== Number(first.size) || after.size !== first.size || after.mtimeNs !== first.mtimeNs || after.ctimeNs !== first.ctimeNs) deny("MCP_FILE_CHANGED");
		return {
			bytes,
			sha256: hash(bytes),
			mode: (first.mode & 73n) !== 0n ? "100755" : "100644",
			identity: {
				path,
				device: String(first.dev),
				fileId: String(first.ino)
			}
		};
	} finally {
		await handle.close();
	}
}
async function writeNew(path, bytes, mode = 384) {
	const handle = await open(path, "wx", mode);
	try {
		await handle.writeFile(bytes);
		await handle.sync();
	} finally {
		await handle.close();
	}
}
async function syncDirectory(path) {
	if (process.platform === "win32") return;
	const h = await open(path, "r");
	try {
		await h.sync();
	} finally {
		await h.close();
	}
}
function repoFileTools(context) {
	const { options, binding, git, acquire } = context;
	const safeRoot = async (b, signal) => {
		const root = await context.safeRoot(b, signal);
		if (new TextDecoder().decode((await git(root, ["rev-parse", "HEAD"], signal)).out).trim() !== b.baseCommit) deny("MCP_GIT_BASE_CHANGED");
		return root;
	};
	const publicBinding = (b) => repoBinding.parse(Object.fromEntries(Object.entries(b).filter(([k]) => ![
		"root",
		"gitDirectory",
		"commonDirectory",
		"identity"
	].includes(k))));
	const locations = (root, b, id) => {
		const parent = dirname(root), sidecar = join(parent, ".devmesh-file-operations"), group = join(sidecar, hash(b.workspaceRef)), directory = join(group, id);
		return {
			parent,
			sidecar,
			group,
			directory,
			stage: join(directory, "stage"),
			receipt: join(directory, "receipt"),
			previous: join(directory, "previous"),
			tombstone: join(directory, "deleted")
		};
	};
	async function target(root, path, create = false) {
		if (!managedSourcePath.safeParse(path).success) deny("MCP_FILE_PATH_DENIED");
		const dirs = [root];
		let at = root;
		for (const part of path.split("/").slice(0, -1)) {
			at = join(at, part);
			if (create) try {
				await mkdir(at);
			} catch (e) {
				if (e.code !== "EEXIST") throw e;
			}
			await identity(at, true);
			dirs.push(at);
		}
		return {
			path: join(root, path),
			dirs
		};
	}
	async function ownedRead(input, b) {
		if (input.permit.ownerKind !== "workflowAttempt" || input.permit.runId !== b.runId || input.permit.attemptId !== b.attemptId || input.args.baseCommit !== b.baseCommit || !input.permit.resources.some((r) => r.kind === "workspace" && r.resourceId === b.resourceId)) deny("MCP_WORKSPACE_DENIED");
	}
	async function authorized(input, toolName) {
		const permit = await options.storage.request("refreshMcpPermit", {
			permit: input.permit,
			toolName,
			action: "write"
		});
		await options.storage.request("authorizeMcpAction", {
			permit,
			toolName,
			action: "write"
		});
		return permit;
	}
	const finish = async (operation, state, result) => options.storage.request("finishRepoFileOperation", {
		operationId: operation.operationId,
		requestHash: operation.requestHash,
		state,
		result: z.record(z.string(), z.json()).parse(result)
	});
	const result = (operation) => ({
		operationId: operation.operationId,
		state: operation.state,
		...operation.result
	});
	async function prove(operation, b, signal) {
		const proof = operation.proof;
		if (!proof) return false;
		const root = await safeRoot(b, signal), loc = locations(root, b, operation.operationId), a = operation.request.args, t = await target(root, a.path);
		for (const dir of proof.directories) if (!same(await identity(dir.path, true), dir)) return false;
		if (proof.file.path !== t.path || proof.directories.some((d) => !d.path) || !proof.directories.some((d) => d.path === loc.directory)) return false;
		if (operation.toolName === "repo.writeFile") {
			const receipt = await read(loc.receipt, 2), current = await read(t.path, 2);
			return !!receipt && !!current && same(receipt.identity, proof.file) && same(current.identity, proof.file) && receipt.sha256 === proof.sha256 && current.sha256 === proof.sha256 && current.bytes.length === proof.byteSize;
		}
		const tombstone = await read(loc.tombstone, 2), receipt = await read(loc.receipt, 2);
		let absent = false;
		try {
			await lstat(t.path);
		} catch (e) {
			if (missing(e)) absent = true;
			else throw e;
		}
		return absent && !!receipt && !!tombstone && same(receipt.identity, proof.file) && same(tombstone.identity, proof.file) && receipt.sha256 === proof.sha256 && tombstone.sha256 === proof.sha256 && tombstone.bytes.length === proof.byteSize;
	}
	async function cleanup(operation, b, signal) {
		if (operation.cleanupConfirmed) return operation;
		{
			const root = await safeRoot(b, signal), loc = locations(root, b, operation.operationId), proof = operation.proof;
			for (const dir of proof.directories) if (!same(await identity(dir.path, true), dir)) throw new ToolError("MCP_FILE_PROOF_CHANGED", "unknown");
			let receipt;
			try {
				receipt = await lstat(loc.receipt, { bigint: true });
			} catch (e) {
				if (!missing(e)) throw e;
			}
			const material = operation.toolName === "repo.writeFile" ? proof.file.path : loc.tombstone;
			if (receipt) {
				const current = await read(material, 2), copy = await read(loc.receipt, 2);
				if (!current || !copy || !same(current.identity, proof.file) || !same(copy.identity, proof.file) || current.sha256 !== proof.sha256 || copy.sha256 !== proof.sha256) throw new ToolError("MCP_FILE_PROOF_CHANGED", "unknown");
				await unlink(loc.receipt);
				await syncDirectory(loc.directory);
			} else {
				const current = await read(material);
				if (!current || !same(current.identity, proof.file) || current.sha256 !== proof.sha256) throw new ToolError("MCP_FILE_PROOF_CHANGED", "unknown");
			}
		}
		return options.storage.request("confirmRepoFileCleanup", {
			operationId: operation.operationId,
			requestHash: operation.requestHash
		});
	}
	async function reconcile(operation, b, input) {
		if (canonical(operation.request.binding) !== canonical(publicBinding(b))) throw new ToolError("MCP_FILE_BINDING_CHANGED", "unknown");
		if (operation.state === "FAILED" || operation.cleanupConfirmed) return result(operation);
		const lease = await acquire(b, {
			...input,
			operationId: operation.operationId
		}, "repo.fileByOperation", "reconcile");
		try {
			if (operation.state !== "SUCCEEDED") {
				let proven = false;
				try {
					proven = await prove(operation, b, input.signal);
				} catch {}
				if (!proven) return {
					operationId: operation.operationId,
					state: "OUTCOME_UNKNOWN"
				};
				operation = await finish(operation, "SUCCEEDED", {
					path: operation.request.args.path,
					sha256: operation.toolName === "repo.writeFile" ? operation.proof.sha256 : null,
					byteSize: operation.toolName === "repo.writeFile" ? operation.proof.byteSize : 0
				});
			}
			return result(await cleanup(operation, b, input.signal));
		} finally {
			await lease.release();
		}
	}
	async function execute(toolName, input) {
		const args = toolName === "repo.writeFile" ? repoWriteFileArgs.parse(input.args) : repoDeleteFileArgs.parse(input.args), b = await binding(args.workspaceRef, input.permit);
		let operation = await options.storage.request("beginRepoFileOperation", {
			permit: input.permit,
			operationId: input.operationId,
			toolName,
			args,
			binding: publicBinding(b)
		});
		if (!operation.created) return reconcile(operation, b, input);
		let prepared = false;
		const lease = await acquire(b, input, toolName, "write").catch(async (error) => {
			await finish(operation, "FAILED", { code: "MCP_FILE_FENCE_NOT_ACQUIRED" });
			throw error;
		});
		try {
			const root = await safeRoot(b, input.signal), t = await target(root, args.path, true), old = await read(t.path);
			if ((old?.sha256 ?? null) !== args.expectedSha256) deny("MCP_FILE_CAS_CONFLICT");
			const loc = locations(root, b, input.operationId);
			for (const dir of [
				loc.parent,
				loc.sidecar,
				loc.group
			]) {
				if (dir !== loc.parent) try {
					await mkdir(dir);
				} catch (e) {
					if (e.code !== "EEXIST") throw e;
				}
				await identity(dir, true);
			}
			await mkdir(loc.directory, { mode: 448 });
			const directoryPaths = [.../* @__PURE__ */ new Set([
				...t.dirs,
				b.gitDirectory,
				b.commonDirectory,
				loc.parent,
				loc.sidecar,
				loc.group,
				loc.directory
			])], directories = await Promise.all(directoryPaths.map(async (path) => identity(await realpath(path), true)));
			let file, sha256, byteSize;
			if (toolName === "repo.writeFile") {
				const bytes = Buffer.from(args.text, "utf8");
				await writeNew(loc.stage, bytes, old?.mode === "100755" ? 493 : 420);
				if (old) await writeNew(loc.previous, old.bytes);
				await link(loc.stage, loc.receipt);
				file = {
					...await identity(loc.stage),
					path: t.path
				};
				sha256 = hash(bytes);
				byteSize = bytes.length;
			} else {
				if (!old) deny("MCP_FILE_CAS_CONFLICT");
				await link(t.path, loc.receipt);
				file = old.identity;
				sha256 = old.sha256;
				byteSize = old.bytes.length;
			}
			await syncDirectory(loc.directory);
			const permit = await authorized(input, toolName);
			operation = {
				...operation,
				...await options.storage.request("prepareRepoFileOperation", {
					permit,
					operationId: input.operationId,
					requestHash: operation.requestHash,
					proof: {
						directories,
						file,
						sha256,
						byteSize
					}
				})
			};
			prepared = true;
			await authorized(input, toolName);
			if (input.signal.aborted) throw new ToolError("MCP_FILE_ABORTED", "unknown");
			await safeRoot(b, input.signal);
			for (const dir of directories) if (!same(await identity(dir.path, true), dir)) throw new ToolError("MCP_FILE_PROOF_CHANGED", "unknown");
			const current = await read(t.path, toolName === "repo.deleteFile" ? 2 : 1);
			if ((current?.sha256 ?? null) !== args.expectedSha256 || old && (!current || !same(current.identity, old.identity))) throw new ToolError("MCP_FILE_CHANGED", "unknown");
			await rename(toolName === "repo.writeFile" ? loc.stage : t.path, toolName === "repo.writeFile" ? t.path : loc.tombstone);
			await syncDirectory(dirname(t.path));
			await syncDirectory(loc.directory);
			if (!await prove(operation, b, input.signal)) throw new ToolError("MCP_FILE_EFFECT_UNPROVEN", "unknown");
			operation = {
				...operation,
				...await finish(operation, "SUCCEEDED", {
					path: args.path,
					sha256: toolName === "repo.writeFile" ? sha256 : null,
					byteSize: toolName === "repo.writeFile" ? byteSize : 0
				})
			};
			return result(await cleanup(operation, b, input.signal));
		} catch (e) {
			if (!prepared && e instanceof ToolError && e.outcome === "not-sent") await finish(operation, "FAILED", { code: e.code });
			throw e;
		} finally {
			await lease.release();
		}
	}
	const workspaceArgs = z.strictObject({
		workspaceRef: opaqueKey,
		baseCommit: repoCommitArgs.shape.baseCommit
	});
	return [
		{
			name: "repo.workspaceRead",
			description: "Read an actual bounded UTF-8 workspace file and its current SHA",
			schema: repoFileReadArgs,
			action: "read",
			effectClass: "READ",
			async execute(input) {
				const a = repoFileReadArgs.parse(input.args), b = await binding(a.workspaceRef, input.permit);
				await ownedRead(input, b);
				const lease = await acquire(b, input, "repo.workspaceRead", "read");
				try {
					await options.storage.request("assertRepoWorkspaceSettled", {
						permit: input.permit,
						workspaceRef: b.workspaceRef
					});
					const file = await read((await target(await safeRoot(b, input.signal), a.path)).path);
					if (!file) deny("MCP_FILE_NOT_FOUND");
					let text;
					try {
						text = new TextDecoder("utf-8", { fatal: true }).decode(file.bytes);
					} catch {
						deny("MCP_BINARY_FILE_UNSUPPORTED");
					}
					if (a.offset > text.length) deny("MCP_FILE_OFFSET_INVALID");
					const end = Math.min(text.length, a.offset + a.length);
					return {
						path: a.path,
						sha256: file.sha256,
						byteSize: file.bytes.length,
						offset: a.offset,
						nextOffset: end < text.length ? end : null,
						text: text.slice(a.offset, end)
					};
				} finally {
					await lease.release();
				}
			}
		},
		{
			name: "repo.snapshot",
			description: "Hash actual tracked and nonignored source bytes under a workspace fence",
			schema: workspaceArgs,
			action: "read",
			effectClass: "READ",
			async execute(input) {
				const b = await binding(String(input.args.workspaceRef), input.permit);
				await ownedRead(input, b);
				const lease = await acquire(b, input, "repo.snapshot", "read");
				try {
					await options.storage.request("assertRepoWorkspaceSettled", {
						permit: input.permit,
						workspaceRef: b.workspaceRef
					});
					const root = await safeRoot(b, input.signal), paths = [...new Set(new TextDecoder("utf-8", { fatal: true }).decode((await git(root, [
						"ls-files",
						"--cached",
						"--others",
						"--exclude-standard",
						"-z",
						"--"
					], input.signal)).out).split("\0").filter(Boolean))].sort();
					if (paths.length > 2e3 || new Set(paths.map((p) => p.toLowerCase())).size !== paths.length) deny("MCP_FILE_SNAPSHOT_TOO_LARGE");
					const files = [];
					let byteSize = 0;
					for (const path of paths) {
						const file = await read((await target(root, path)).path);
						if (!file) continue;
						byteSize += file.bytes.length;
						if (byteSize > 8 * 1024 * 1024) deny("MCP_FILE_SNAPSHOT_TOO_LARGE");
						files.push({
							path,
							mode: file.mode,
							sha256: file.sha256,
							byteSize: file.bytes.length
						});
					}
					const manifest = {
						schemaVersion: "devmesh.workspace-source.v1",
						workspaceRef: b.workspaceRef,
						baseCommit: b.baseCommit,
						files,
						byteSize
					};
					const serialized = canonical(manifest);
					if (Buffer.byteLength(serialized) > 192 * 1024) deny("MCP_FILE_SNAPSHOT_TOO_LARGE");
					return {
						...manifest,
						sha256: hash(serialized)
					};
				} finally {
					await lease.release();
				}
			}
		},
		{
			name: "repo.writeFile",
			description: "Compare previous SHA or absence, then atomically write approved UTF-8 bytes with durable original proof",
			schema: repoWriteFileArgs,
			action: "write",
			effectClass: "IDEMPOTENT_WRITE",
			execute: (input) => execute("repo.writeFile", input)
		},
		{
			name: "repo.deleteFile",
			description: "Compare the previous SHA then retain the exact original file outside the mounted source tree",
			schema: repoDeleteFileArgs,
			action: "write",
			effectClass: "IDEMPOTENT_WRITE",
			execute: (input) => execute("repo.deleteFile", input)
		},
		{
			name: "repo.fileByOperation",
			description: "Query original file mutation evidence without repeating a write or delete",
			schema: z.strictObject({ operationId: opaqueKey }),
			action: "read",
			effectClass: "READ",
			async execute(input) {
				const operation = await options.storage.request("getRepoFileOperation", {
					permit: input.permit,
					operationId: String(input.args.operationId)
				});
				return reconcile(operation, await binding(operation.request.binding.workspaceRef, input.permit), input);
			}
		}
	];
}
//#endregion
//#region src/repo-git.ts
const bindingSchema = repoBinding.extend({
	root: z.string().min(1),
	gitDirectory: z.string().min(1),
	commonDirectory: z.string().min(1),
	identity: gitDirectoryIdentity.optional()
});
const denied = (path) => !managedSourcePath.safeParse(path).success;
const within = (root, path) => {
	const rel = relative(root, path);
	return rel !== "" && !isAbsolute(rel) && rel !== ".." && !rel.startsWith(".." + (process.platform === "win32" ? "\\" : "/"));
};
const oid = (v) => {
	if (!/^[a-f0-9]{40}$/.test(v)) throw new ToolError("MCP_GIT_OBJECT_INVALID");
	return v;
};
const text = (b) => new TextDecoder("utf-8", { fatal: true }).decode(b);
const locks = /* @__PURE__ */ new Set();
const gitNull = process.platform === "win32" ? "NUL" : devNull;
function repoGitTools(options) {
	const bindings = options.bindings.map((b) => bindingSchema.parse(structuredClone(b)));
	if (new Set(bindings.map((b) => b.workspaceRef)).size !== bindings.length || typeof options.acquire !== "function") throw new ToolError("MCP_GIT_CONFIGURATION_INVALID", "not-sent");
	canonicalRoot(options.scratchRoot);
	for (const b of bindings) {
		canonicalRoot(b.root);
		canonicalRoot(b.gitDirectory);
		canonicalRoot(b.commonDirectory);
	}
	const physicalBindings = new Map(bindings.map((b) => {
		const ready = Promise.all([
			realpath(b.root),
			realpath(b.gitDirectory),
			realpath(b.commonDirectory)
		]).then(async ([root, gitDirectory, commonDirectory]) => ({
			root,
			gitDirectory,
			commonDirectory,
			directories: await Promise.all([.../* @__PURE__ */ new Set([
				root,
				gitDirectory,
				commonDirectory
			])].map(async (path) => {
				const stat = await lstat(path, { bigint: true });
				return {
					path,
					dev: stat.dev,
					ino: stat.ino
				};
			}))
		}));
		ready.catch(() => {});
		return [b.workspaceRef, ready];
	}));
	async function binding(ref, permit) {
		const fixed = bindings.find((b) => b.workspaceRef === ref);
		if (fixed) return fixed;
		if (!options.resolveBinding) throw new ToolError("MCP_WORKSPACE_DENIED", "not-sent");
		const b = bindingSchema.parse(await options.resolveBinding(ref, permit)), identity = b.identity;
		if (b.workspaceRef !== ref || !identity || identity.root !== b.root || identity.gitDirectory !== b.gitDirectory || identity.commonDirectory !== b.commonDirectory || identity.commonDirectory !== identity.gitDirectory) throw new ToolError("MCP_WORKSPACE_CHANGED", "not-sent");
		for (const p of [
			b.root,
			b.gitDirectory,
			b.commonDirectory
		]) canonicalRoot(p);
		return b;
	}
	const publicBinding = (b) => repoBinding.parse(Object.fromEntries(Object.entries(b).filter(([k]) => ![
		"root",
		"gitDirectory",
		"commonDirectory",
		"identity"
	].includes(k))));
	async function acquire(b, input, toolName, purpose) {
		const permit = purpose === "reconcile" ? input.permit : await options.storage.request("refreshMcpPermit", {
			permit: input.permit,
			toolName,
			action: purpose === "write" ? "write" : "read"
		});
		return options.acquire(structuredClone(b), input.signal, {
			operationId: input.operationId,
			permit,
			purpose
		});
	}
	function git(root, args, signal, index, input, allowFailure = false) {
		if (signal.aborted) throw new ToolError("MCP_GIT_ABORTED", "not-sent");
		const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.toUpperCase().startsWith("GIT_")));
		Object.assign(env, {
			GIT_CONFIG_NOSYSTEM: "1",
			GIT_CONFIG_GLOBAL: gitNull,
			GIT_ATTR_NOSYSTEM: "1",
			GIT_TERMINAL_PROMPT: "0",
			GIT_OPTIONAL_LOCKS: "0",
			GIT_LITERAL_PATHSPECS: "1",
			LC_ALL: "C",
			...index ? { GIT_INDEX_FILE: index } : {}
		});
		return new Promise((resolve, reject) => {
			const child = spawn("git", [
				"--no-replace-objects",
				"--literal-pathspecs",
				"-c",
				"core.hooksPath=" + gitNull,
				"-c",
				"core.fsmonitor=false",
				"-c",
				"core.attributesFile=" + gitNull,
				"-c",
				"commit.gpgSign=false",
				"-c",
				"core.pager=cat",
				"-c",
				"protocol.allow=never",
				...args
			], {
				cwd: root,
				env,
				windowsHide: true,
				stdio: [
					"pipe",
					"pipe",
					"pipe"
				],
				signal
			});
			const chunks = [];
			let bytes = 0, failed = false, ioFailure = false;
			const timer = setTimeout(() => {
				failed = true;
				child.kill();
			}, 3e4);
			timer.unref();
			child.stdout.on("data", (b) => {
				bytes += b.length;
				if (bytes > 16 * 1024 * 1024) {
					failed = true;
					child.kill();
				} else chunks.push(b);
			});
			child.stderr.resume();
			child.stdin.on("error", () => {});
			child.stdin.end(input);
			child.on("error", () => {
				ioFailure = true;
			});
			child.on("close", (code) => {
				clearTimeout(timer);
				if (ioFailure) reject(new ToolError("MCP_GIT_IO_UNKNOWN", "unknown"));
				else if (failed || code === null || code !== 0 && !allowFailure) reject(new ToolError("MCP_GIT_ACTION_FAILED", "unknown"));
				else resolve({
					code,
					out: Buffer.concat(chunks)
				});
			});
		});
	}
	async function safeRoot(b, signal) {
		const i = b.identity, frozen = i ? {
			root: i.root,
			gitDirectory: i.gitDirectory,
			commonDirectory: i.commonDirectory,
			directories: [{
				path: i.root,
				dev: BigInt(i.rootDevice),
				ino: BigInt(i.rootFileId)
			}, {
				path: i.gitDirectory,
				dev: BigInt(i.gitDevice),
				ino: BigInt(i.gitFileId)
			}]
		} : await physicalBindings.get(b.workspaceRef), root = await realpath(b.root);
		if (root !== frozen.root) throw new ToolError("MCP_WORKSPACE_CHANGED", "not-sent");
		for (const entry of frozen.directories) {
			const stat = await lstat(entry.path, { bigint: true });
			if (!stat.isDirectory() || stat.isSymbolicLink() || stat.dev !== entry.dev || stat.ino !== entry.ino) throw new ToolError("MCP_WORKSPACE_CHANGED", "not-sent");
		}
		const [location, filters] = await Promise.all([git(root, [
			"rev-parse",
			"--show-toplevel",
			"--show-object-format",
			"--absolute-git-dir",
			"--git-common-dir"
		], signal), git(root, [
			"config",
			"--get-regexp",
			"^filter\\."
		], signal, void 0, void 0, true)]);
		const [top, format, actualGit, common] = text(location.out).trim().split("\n");
		if (!top || format !== "sha1" || !actualGit || !common || await realpath(top) !== root) throw new ToolError("MCP_GIT_CONFIGURATION_INVALID", "not-sent");
		if (await realpath(actualGit) !== frozen.gitDirectory || await realpath(resolve(root, common)) !== frozen.commonDirectory) throw new ToolError("MCP_GIT_REPOSITORY_CHANGED", "not-sent");
		if (filters.code !== 1) throw new ToolError("MCP_GIT_FILTER_DENIED", "not-sent");
		return root;
	}
	function scoped(paths, scope) {
		if (paths.length > 2e3 || new Set(paths.map((p) => p.toLowerCase())).size !== paths.length) throw new ToolError("MCP_GIT_WRITE_SCOPE_DENIED", "not-sent");
		for (const p of paths) if (!relativeFile.safeParse(p).success || denied(p) || !scope.some((s) => p === s || p.startsWith(s + "/"))) throw new ToolError("MCP_GIT_WRITE_SCOPE_DENIED", "not-sent");
	}
	async function physical(root, paths) {
		let bytes = 0;
		for (const path of paths) {
			let current = root;
			const parts = path.split("/");
			for (const [i, part] of parts.entries()) {
				current = join(current, part);
				let s;
				try {
					s = await lstat(current);
				} catch (e) {
					if (e.code === "ENOENT") break;
					throw e;
				}
				if (s.isSymbolicLink() || i < parts.length - 1 && !s.isDirectory() || i === parts.length - 1 && (!s.isFile() || s.nlink !== 1 || s.size > 2 * 1024 * 1024)) throw new ToolError("MCP_GIT_PATH_DENIED", "not-sent");
				if (i === parts.length - 1) {
					bytes += s.size;
					if (bytes > 8 * 1024 * 1024) throw new ToolError("MCP_GIT_CHANGE_TOO_LARGE", "not-sent");
				}
			}
		}
	}
	const paths = (b) => text(b).split("\0").filter(Boolean);
	async function cleanIndex(temp, index) {
		for (const file of [index, index + ".lock"]) try {
			await unlink(file);
		} catch (e) {
			if (e.code !== "ENOENT") throw e;
		}
		await rmdir(temp);
	}
	async function writeTree(root, operation, signal) {
		const base = operation.request.binding.baseCommit;
		const [head, changeList, otherList] = await Promise.all([
			git(root, ["rev-parse", "HEAD"], signal),
			git(root, [
				"diff",
				"--no-ext-diff",
				"--no-textconv",
				"--no-renames",
				"--name-only",
				"-z",
				base,
				"--"
			], signal),
			git(root, [
				"ls-files",
				"--others",
				"--exclude-standard",
				"-z",
				"--"
			], signal)
		]);
		if (text(head.out).trim() !== base) throw new ToolError("MCP_GIT_BASE_CHANGED", "not-sent");
		const changed = paths(changeList.out), untracked = paths(otherList.out), all = [.../* @__PURE__ */ new Set([...changed, ...untracked])];
		scoped(all, operation.scope);
		if (!all.length) throw new ToolError("MCP_GIT_EMPTY_COMMIT", "not-sent");
		await physical(root, all);
		await mkdir(options.scratchRoot, { recursive: true });
		const scratch = await realpath(options.scratchRoot);
		if (scratch === root || within(root, scratch)) throw new ToolError("MCP_GIT_SCRATCH_DENIED", "not-sent");
		const temp = await mkdtemp(join(scratch, "repo-")), index = join(temp, "index");
		try {
			await git(root, ["read-tree", base], signal, index);
			await git(root, [
				"add",
				"-A",
				"--",
				...all
			], signal, index);
			const [entries, changes] = await Promise.all([git(root, [
				"ls-files",
				"--stage",
				"-z"
			], signal, index), git(root, [
				"diff",
				"--cached",
				"--no-ext-diff",
				"--no-textconv",
				"--name-only",
				"-z",
				base,
				"--"
			], signal, index)]);
			for (const row of paths(entries.out)) if (!/^100(644|755) [a-f0-9]{40} 0\t/.test(row)) throw new ToolError("MCP_GIT_SPECIAL_ENTRY_DENIED", "not-sent");
			scoped(paths(changes.out), operation.scope);
			await physical(root, all);
			return oid(text((await git(root, ["write-tree"], signal, index)).out).trim());
		} finally {
			await cleanIndex(temp, index);
		}
	}
	async function finish(operation, state, result) {
		return options.storage.request("finishRepoOperation", {
			operationId: operation.operationId,
			requestHash: operation.requestHash,
			state,
			result
		});
	}
	async function reconcile(operation, b, signal) {
		if (operation.result) return {
			operationId: operation.operationId,
			state: operation.state,
			...operation.result
		};
		const p = operation.prepared;
		if (!p) return {
			operationId: operation.operationId,
			state: "OUTCOME_UNKNOWN"
		};
		const root = await safeRoot(b, signal), ref = await git(root, [
			"rev-parse",
			"--verify",
			p.ref
		], signal, void 0, void 0, true);
		if (ref.code !== 0 || text(ref.out).trim() !== p.commit) return {
			operationId: operation.operationId,
			state: "OUTCOME_UNKNOWN"
		};
		const body = text((await git(root, [
			"cat-file",
			"commit",
			p.commit
		], signal)).out);
		if (p.commitBody !== null && body !== p.commitBody || !body.startsWith("tree " + p.tree + "\n")) throw new ToolError("MCP_GIT_COMMIT_CHANGED", "unknown");
		const result = {
			commit: p.commit,
			tree: p.tree,
			baseCommit: operation.request.binding.baseCommit,
			ref: p.ref
		};
		await finish(operation, "SUCCEEDED", result);
		return {
			operationId: operation.operationId,
			state: "SUCCEEDED",
			...result
		};
	}
	async function execute(toolName, input) {
		const args = toolName === "repo.commit" ? repoCommitArgs.parse(input.args) : repoIntegrateArgs.parse(input.args), b = await binding(args.workspaceRef, input.permit);
		let operation = await options.storage.request("beginRepoOperation", {
			permit: input.permit,
			operationId: input.operationId,
			toolName,
			args,
			binding: publicBinding(b)
		});
		if (!operation.created) return reconcile(operation, b, input.signal);
		const key = toolName === "repo.integrate" ? "project:" + b.projectId : resolve(b.root).toLowerCase();
		if (locks.has(key)) {
			await finish(operation, "FAILED", { code: "MCP_GIT_WORKSPACE_BUSY" });
			throw new ToolError("MCP_GIT_WORKSPACE_BUSY", "not-sent");
		}
		locks.add(key);
		let lease;
		try {
			try {
				lease = await acquire(b, input, toolName, "write");
			} catch (error) {
				await finish(operation, "FAILED", { code: "MCP_GIT_FENCE_NOT_ACQUIRED" });
				operation = {
					...operation,
					state: "FAILED"
				};
				throw error;
			}
			const root = await safeRoot(b, input.signal), base = args.baseCommit;
			if (toolName === "repo.commit") {
				const tree = await writeTree(root, operation, input.signal), message = args.message + "\n\nDevMesh-Operation: " + input.operationId + "\n";
				const identity = "DevMesh <devmesh@localhost> " + Math.floor(Date.parse(operation.createdAt) / 1e3) + " +0000", body = `tree ${tree}\nparent ${base}\nauthor ${identity}\ncommitter ${identity}\n\n${message}`;
				const commit = createHash("sha1").update(Buffer.from("commit " + Buffer.byteLength(body) + "\0")).update(body).digest("hex"), ref = "refs/devmesh/operations/" + input.operationId;
				const current = await options.storage.request("refreshMcpPermit", {
					permit: input.permit,
					toolName,
					action: "write"
				});
				operation = {
					...operation,
					...await options.storage.request("prepareRepoOperation", {
						permit: current,
						operationId: input.operationId,
						requestHash: operation.requestHash,
						prepared: {
							commit,
							tree,
							ref,
							expected: null,
							commitBody: body
						}
					})
				};
				await options.storage.request("authorizeMcpAction", {
					permit: current,
					toolName,
					action: "write"
				});
				if (oid(text((await git(root, [
					"hash-object",
					"-t",
					"commit",
					"-w",
					"--stdin"
				], input.signal, void 0, body)).out).trim()) !== commit) throw new ToolError("MCP_GIT_COMMIT_CHANGED", "unknown");
				await git(root, [
					"update-ref",
					ref,
					commit,
					"0".repeat(40)
				], input.signal);
			} else {
				const commit = args.commit, source = await options.storage.request("getRepoOperation", {
					permit: input.permit,
					operationId: await sourceOperation(root, commit, input.signal)
				});
				if (source.toolName !== "repo.commit" || source.state !== "SUCCEEDED" || source.prepared?.commit !== commit || source.request.binding.workspaceRef !== b.workspaceRef) throw new ToolError("MCP_GIT_INTEGRATION_SOURCE_DENIED", "not-sent");
				if (!options.authorizeIntegration) throw new ToolError("MCP_GIT_INTEGRATION_NOT_CONFIGURED", "not-sent");
				await options.authorizeIntegration(structuredClone(b), commit, input.signal);
				const body = text((await git(root, [
					"cat-file",
					"commit",
					commit
				], input.signal)).out);
				if (!body.includes("\nparent " + base + "\n") || body.match(/\nparent /g)?.length !== 1) throw new ToolError("MCP_GIT_INTEGRATION_SOURCE_DENIED", "not-sent");
				scoped(paths((await git(root, [
					"diff-tree",
					"--no-commit-id",
					"--name-only",
					"-r",
					"-z",
					"--no-renames",
					base,
					commit,
					"--"
				], input.signal)).out), operation.scope);
				const tree = oid(text((await git(root, ["rev-parse", commit + "^{tree}"], input.signal)).out).trim()), projectRef = "refs/devmesh/candidates/" + b.runId, ref = "refs/devmesh/integrations/" + input.operationId;
				const permit = await options.storage.request("refreshMcpPermit", {
					permit: input.permit,
					toolName,
					action: "write"
				});
				operation = {
					...operation,
					...await options.storage.request("prepareRepoOperation", {
						permit,
						operationId: input.operationId,
						requestHash: operation.requestHash,
						prepared: {
							commit,
							tree,
							ref,
							expected: base,
							commitBody: null
						}
					})
				};
				await options.storage.request("authorizeMcpAction", {
					permit,
					toolName,
					action: "write"
				});
				const current = await git(root, [
					"rev-parse",
					"--verify",
					projectRef
				], input.signal, void 0, void 0, true);
				if (current.code !== 0 || text(current.out).trim() !== base) {
					await finish(operation, "CONFLICT", { code: "MCP_GIT_INTEGRATION_CONFLICT" });
					return {
						operationId: operation.operationId,
						state: "CONFLICT",
						code: "MCP_GIT_INTEGRATION_CONFLICT"
					};
				}
				if ((await git(root, ["update-ref", "--stdin"], input.signal, void 0, `start\nupdate ${projectRef} ${commit} ${base}\ncreate ${ref} ${commit}\nprepare\ncommit\n`, true)).code !== 0) {
					await finish(operation, "CONFLICT", { code: "MCP_GIT_INTEGRATION_CONFLICT" });
					return {
						operationId: operation.operationId,
						state: "CONFLICT",
						code: "MCP_GIT_INTEGRATION_CONFLICT"
					};
				}
			}
			const p = operation.prepared, result = {
				commit: p.commit,
				tree: p.tree,
				baseCommit: b.baseCommit,
				ref: p.ref
			};
			await finish(operation, "SUCCEEDED", result);
			return {
				operationId: operation.operationId,
				state: "SUCCEEDED",
				...result
			};
		} catch (error) {
			if (error instanceof ToolError && error.outcome === "not-sent" && operation.state === "SENT") await finish(operation, "FAILED", { code: error.code });
			throw error;
		} finally {
			try {
				await lease?.release();
			} finally {
				locks.delete(key);
			}
		}
	}
	async function sourceOperation(root, commit, signal) {
		const refs = text((await git(root, [
			"for-each-ref",
			"--format=%(refname)",
			"--points-at",
			commit,
			"refs/devmesh/operations/"
		], signal)).out).trim().split("\n").filter(Boolean);
		if (refs.length !== 1) throw new ToolError("MCP_GIT_INTEGRATION_SOURCE_DENIED", "not-sent");
		return opaqueKey.parse(refs[0].slice(24));
	}
	return [
		...repoFileTools({
			options,
			binding,
			safeRoot,
			git,
			acquire
		}),
		{
			name: "repo.diff",
			description: "Inspect bounded changes in an authorized fenced workspace against its frozen base",
			schema: z.strictObject({
				workspaceRef: opaqueKey,
				baseCommit: repoCommitArgs.shape.baseCommit
			}),
			action: "read",
			effectClass: "READ",
			async execute({ args, permit, signal, operationId }) {
				const b = await binding(String(args.workspaceRef), permit);
				if (permit.ownerKind !== "workflowAttempt" || permit.runId !== b.runId || permit.attemptId !== b.attemptId || args.baseCommit !== b.baseCommit || !permit.resources.some((r) => r.kind === "workspace" && r.resourceId === b.resourceId)) throw new ToolError("MCP_WORKSPACE_DENIED", "not-sent");
				const lease = await acquire(b, {
					operationId,
					permit,
					signal
				}, "repo.diff", "read");
				try {
					await options.storage.request("assertRepoWorkspaceSettled", {
						permit,
						workspaceRef: b.workspaceRef
					});
					const root = await safeRoot(b, signal), changed = paths((await git(root, [
						"diff",
						"--no-ext-diff",
						"--no-textconv",
						"--no-renames",
						"--name-only",
						"-z",
						b.baseCommit,
						"--"
					], signal)).out), untracked = paths((await git(root, [
						"ls-files",
						"--others",
						"--exclude-standard",
						"-z",
						"--"
					], signal)).out), all = [.../* @__PURE__ */ new Set([...changed, ...untracked])];
					if (all.length > 2e3 || all.some(denied)) throw new ToolError("MCP_GIT_PATH_DENIED", "not-sent");
					await physical(root, all);
					const diff = (await git(root, [
						"diff",
						"--no-ext-diff",
						"--no-textconv",
						"--no-renames",
						"--patch",
						b.baseCommit,
						"--"
					], signal)).out;
					if (diff.length > 65536) throw new ToolError("MCP_GIT_DIFF_TOO_LARGE", "not-sent");
					return {
						workspaceRef: b.workspaceRef,
						baseCommit: b.baseCommit,
						patch: text(diff),
						untracked
					};
				} finally {
					await lease.release();
				}
			}
		},
		{
			name: "repo.commit",
			description: "Commit only approved files from a fenced workspace at the frozen base",
			schema: repoCommitArgs,
			action: "write",
			effectClass: "IDEMPOTENT_WRITE",
			execute: (input) => execute("repo.commit", input)
		},
		{
			name: "repo.integrate",
			description: "Integrate a proven commit into the Run candidate ref with a serialized base compare-and-swap",
			schema: repoIntegrateArgs,
			action: "write",
			effectClass: "IDEMPOTENT_WRITE",
			execute: (input) => execute("repo.integrate", input)
		},
		{
			name: "repo.by-operation",
			description: "Reconcile the original Git operation without repeating its writes",
			schema: z.strictObject({ operationId: opaqueKey }),
			action: "read",
			effectClass: "READ",
			async execute({ args, permit, signal }) {
				const operation = await options.storage.request("getRepoOperation", {
					permit,
					operationId: String(args.operationId)
				}), b = await binding(operation.request.binding.workspaceRef, permit);
				if (canonical(publicBinding(b)) !== canonical(operation.request.binding)) throw new ToolError("MCP_GIT_BINDING_CHANGED", "unknown");
				return reconcile(operation, b, signal);
			}
		}
	].filter((t) => t.name !== "repo.integrate" || options.authorizeIntegration !== void 0);
}
//#endregion
//#region src/composition.ts
/** Explicit composition: no backend, identity or credential is inferred from a model. */
async function startWorkflowMcpServices(storage, content, options) {
	const definitions = /* @__PURE__ */ new Map();
	if (options.repo) definitions.set("repo", [...repoTools(options.repo.snapshots), ...options.repo.git ? repoGitTools({
		...options.repo.git,
		storage
	}) : []]);
	if (options.docs) definitions.set("docs", docsTools(content, options.docs));
	if (options.tests) definitions.set("tests", testTools(options.tests.runner, options.tests.checks));
	if (options.issues) definitions.set("issues", issueTools(storage));
	if (options.pipeline) definitions.set("pipeline", pipelineTools(storage, options.pipeline.runner, options.pipeline.definitions));
	const ids = [...definitions.keys()].map((kind) => {
		const identity = options.identities[kind];
		if (!identity) throw new ToolError("MCP_SERVICE_IDENTITY_REQUIRED", "not-sent");
		for (const field of [
			"serviceId",
			"controllerId",
			"credentialRef"
		]) opaqueKey.parse(identity[field]);
		return {
			kind,
			...identity
		};
	});
	for (const field of [
		"serviceId",
		"controllerId",
		"credentialRef"
	]) if (new Set(ids.map((i) => i[field])).size !== ids.length) throw new ToolError("MCP_SERVICE_IDENTITIES_MUST_DIFFER", "not-sent");
	const secrets = [];
	for (const i of ids) {
		const secret = await options.credentials(i.credentialRef);
		if (!secret || secret.length < 16) throw new ToolError("MCP_NOT_CONFIGURED", "not-sent");
		secrets.push(secret);
	}
	if (new Set(secrets).size !== secrets.length) throw new ToolError("MCP_SERVICE_CREDENTIALS_MUST_DIFFER", "not-sent");
	const servers = [], clients = [], tools = [], active = /* @__PURE__ */ new Set();
	let closing = false, closed;
	const coordinator = options.pipeline ? new PipelineCoordinator(storage, options.pipeline.runner) : void 0;
	const stopAdmission = () => {
		closing = true;
	};
	const close = () => closed ??= (async () => {
		stopAdmission();
		const results = [
			...await Promise.allSettled([coordinator?.stop()]),
			...await Promise.allSettled(clients.map((c) => c.close())),
			...await Promise.allSettled(servers.map((s) => s.close()))
		];
		await Promise.allSettled(active);
		if (results.some((r) => r.status === "rejected")) throw new ToolError("MCP_RELEASE_FAILED", "unknown");
	})();
	try {
		for (const identity of ids) {
			const defs = definitions.get(identity.kind), names = defs.map((t) => t.name), authority = workflowToolAuthority(storage, /* @__PURE__ */ new Map([[identity.controllerId, new Set(names)]]));
			const wrapped = defs.map((d) => ({
				...d,
				execute(i) {
					if (closing && d.action === "write") throw new ToolError("MCP_STOPPING", "not-sent");
					const pending = Promise.resolve().then(() => d.execute(i));
					active.add(pending);
					pending.finally(() => active.delete(pending)).catch(() => {});
					return pending;
				}
			}));
			const server = await serveMcp({
				serviceId: identity.serviceId,
				version: "1.0.0",
				identities: [{
					controllerId: identity.controllerId,
					credentialRef: identity.credentialRef,
					allowedTools: names
				}],
				credentials: options.credentials,
				authority,
				tools: wrapped
			});
			servers.push(server);
			const client = new McpToolClient({
				endpointId: identity.serviceId,
				endpoint: server.endpoint,
				credentialRef: identity.credentialRef,
				credentials: options.credentials,
				...identity.timeoutMs !== void 0 ? { timeoutMs: identity.timeoutMs } : {}
			});
			clients.push(client);
			await client.connect();
			tools.push(...runtimeMcpTools(client, defs));
		}
		coordinator?.start();
		return {
			tools: Object.freeze(tools),
			connections: Object.freeze(clients.map((c) => c.snapshot)),
			stopAdmission,
			close,
			coordinator
		};
	} catch (error) {
		await close().catch(() => {});
		throw error;
	}
}
//#endregion
export { McpToolClient, PipelineCoordinator, ToolError, docsReadArgs, docsSearchArgs, docsTools, issueTools, issuesGetArgs, issuesOperationArgs, pipelineGetArgs, pipelineLogsArgs, pipelineOperationArgs, pipelineStartArgs, pipelineTools, repoGitTools, repoListArgs, repoReadArgs, repoTools, runtimeMcpTools, serveMcp, startWorkflowMcpServices, testTools, testsJobArgs, testsOperationArgs, testsStartArgs, toolEnvelope, toolResult, workflowToolAuthority };

//# sourceMappingURL=index.mjs.map