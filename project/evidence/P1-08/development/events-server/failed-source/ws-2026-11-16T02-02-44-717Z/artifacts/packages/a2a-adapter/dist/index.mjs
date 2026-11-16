import { loadInternalA2AConfig } from "./config.mjs";
import { createHash, timingSafeEqual } from "node:crypto";
import { AgentCard, Message, Role, SendMessageRequest, Task, TaskState } from "@a2a-js/sdk";
import { StorageError, agentManifest, canonical } from "@devmesh/storage-sqlite";
import { parseContract, preparationDelegation, workDelegation } from "@devmesh/contracts";
import { setTimeout } from "node:timers/promises";
import { JsonRpcPushNotificationNotSupportedError, JsonRpcRequestMalformedError, JsonRpcTaskNotCancelableError, JsonRpcTaskNotFoundError, JsonRpcUnsupportedOperationError } from "@a2a-js/sdk/errors";
import express from "express";
import { agentCardHandler, jsonRpcHandler } from "@a2a-js/sdk/server/express";
import { ClientFactory, DefaultAgentCardResolver, JsonRpcTransportFactory } from "@a2a-js/sdk/client";
//#region src/registry.ts
const cardHash = (card) => createHash("sha256").update(canonical(AgentCard.toJSON(card))).digest("hex");
const freeze = (value) => {
	if (value && typeof value === "object") {
		for (const v of Object.values(value)) freeze(v);
		Object.freeze(value);
	}
	return value;
};
var AgentRegistry = class {
	storage;
	#snapshot;
	constructor(storage) {
		this.storage = storage;
	}
	get ready() {
		return this.#snapshot !== void 0;
	}
	get version() {
		const s = this.#snapshot;
		if (!s?.generationId) throw new StorageError("REGISTRY_NOT_READY", 503, "Registry projection is unavailable");
		return {
			generationId: s.generationId,
			projectionRevision: s.projectionRevision
		};
	}
	closeAdmission() {
		this.#snapshot = void 0;
	}
	async refresh() {
		try {
			for (let i = 0; i < 3; i++) {
				const s = await this.storage.request("getRegistrySnapshot", {});
				if (!s.generationId) throw new StorageError("REGISTRY_NOT_READY", 503, "No committed generation");
				const candidate = freeze(s), check = await this.storage.request("getRegistrySnapshot", {});
				if (check.generationId === s.generationId && check.projectionRevision === s.projectionRevision) {
					this.#snapshot = candidate;
					return;
				}
			}
			throw new StorageError("REGISTRY_BUSY", 503, "Registry changed during projection construction");
		} catch (error) {
			this.closeAdmission();
			throw error;
		}
	}
	async resolveRole(role) {
		const s = this.#snapshot, b = s?.bindings.find((b) => b.role === role);
		if (!s || !b) throw new StorageError("ROLE_UNAVAILABLE", 503, "No committed role binding");
		const e = s.endpoints.find((e) => e.config.endpointId === b.endpointId && e.config.revision === b.revision);
		try {
			return await this.storage.request("assertRegistryTarget", {
				...this.version,
				endpointId: b.endpointId,
				revision: b.revision,
				cardHash: e.config.cardHash
			});
		} catch (error) {
			if (error instanceof StorageError && error.code === "REGISTRY_PROJECTION_STALE") this.closeAdmission();
			throw error;
		}
	}
	async reconcile(manifestInput, resolveCredential, timeoutMs = 3e3) {
		this.closeAdmission();
		const manifest = parseContract(agentManifest, manifestInput), before = await this.storage.request("getRegistrySnapshot", {});
		const checks = await Promise.all(manifest.endpoints.map((e) => this.probe(e, resolveCredential, timeoutMs)));
		await this.storage.request("commitRegistry", {
			manifest,
			expectedProjectionRevision: before.projectionRevision,
			checks
		});
		await this.refresh();
	}
	async probe(e, resolveCredential, timeoutMs = 3e3) {
		const ticket = await this.storage.request("issueEndpointProbe", { endpoint: e });
		let status = "UNHEALTHY", observedCardHash = null, errorCode = null;
		try {
			const token = await resolveCredential(e.credentialRef);
			if (!token) throw new StorageError("SERVICE_CREDENTIAL_UNAVAILABLE", 503, "Service credential is not configured");
			const r = await fetch(e.cardUrl, {
				headers: {
					Authorization: "Bearer " + token,
					"A2A-Version": "1.0"
				},
				redirect: "error",
				signal: AbortSignal.timeout(timeoutMs)
			});
			if (!r.ok || !r.body) throw new StorageError("CARD_HTTP_FAILURE", 503, "Agent card request failed");
			const reader = r.body.getReader();
			const chunks = [];
			let size = 0;
			try {
				for (;;) {
					const { done, value } = await reader.read();
					if (done) break;
					size += value.byteLength;
					if (size > 65536) throw new StorageError("CARD_TOO_LARGE", 413, "Agent card exceeds 64 KiB");
					chunks.push(value);
				}
			} finally {
				await reader.cancel();
			}
			const card = AgentCard.fromJSON(JSON.parse(Buffer.concat(chunks).toString("utf8")));
			observedCardHash = cardHash(card);
			const face = card.supportedInterfaces.find((i) => i.protocolBinding === "JSONRPC" && i.protocolVersion === "1.0" && i.url === e.address);
			const skills = card.skills.map((s) => s.id).sort(), expected = [...e.supportedSkills].sort();
			status = face && card.version === e.implementationVersion && Boolean(card.capabilities?.streaming) === e.streaming && canonical(skills) === canonical(expected) && observedCardHash === e.cardHash ? "HEALTHY" : "NEEDS_REVIEW";
			if (status !== "HEALTHY") errorCode = "CARD_COMPATIBILITY_CHANGED";
		} catch (error) {
			errorCode = error instanceof StorageError ? error.code : "CARD_CHECK_FAILED";
		}
		const checkedAt = (/* @__PURE__ */ new Date()).toISOString();
		return {
			checkId: ticket.checkId,
			status,
			observedCardHash,
			checkedAt,
			expiresAt: new Date(Date.now() + 12e4).toISOString(),
			errorCode
		};
	}
	async checkHealth(manifest, credentials) {
		for (const e of manifest.endpoints) {
			const check = await this.probe(e, credentials);
			await this.storage.request("recordEndpointCheck", check);
		}
		await this.refresh();
	}
};
//#endregion
//#region src/handler.ts
function caller(context) {
	if (context.tenant || !context.user?.isAuthenticated) throw new JsonRpcRequestMalformedError({ message: "An authenticated internal service identity without tenant is required" });
	return context.user.userName;
}
function protocolError(error) {
	if (error instanceof StorageError) {
		if (error.status === 404) throw new JsonRpcTaskNotFoundError();
		if (error.code === "TASK_NOT_CANCELABLE") throw new JsonRpcTaskNotCancelableError();
		throw new JsonRpcRequestMalformedError({ message: error.code });
	}
	throw error;
}
const preparationTask = (id) => id.startsWith("prepTask_");
var DurableTaskStore = class {
	storage;
	endpointId;
	constructor(storage, endpointId) {
		this.storage = storage;
		this.endpointId = endpointId;
	}
	async load(taskId, context) {
		try {
			const r = await this.storage.request(preparationTask(taskId) ? "getPreparationTask" : "getA2ATask", {
				callerId: caller(context),
				endpointId: this.endpointId,
				taskId
			});
			return Task.fromJSON(r.snapshot);
		} catch (error) {
			if (error instanceof StorageError && error.status === 404) return void 0;
			protocolError(error);
		}
	}
	async save(task, context) {
		const c = context.state.get("devmesh.executionClaim");
		if (!c) throw new JsonRpcUnsupportedOperationError({ message: "Task creation requires atomic admission; updates require a durable consumer claim" });
		const state = {
			[TaskState.TASK_STATE_WORKING]: "working",
			[TaskState.TASK_STATE_INPUT_REQUIRED]: "input-required",
			[TaskState.TASK_STATE_AUTH_REQUIRED]: "auth-required",
			[TaskState.TASK_STATE_COMPLETED]: "completed",
			[TaskState.TASK_STATE_FAILED]: "failed",
			[TaskState.TASK_STATE_CANCELED]: "canceled",
			[TaskState.TASK_STATE_REJECTED]: "rejected"
		}[task.status?.state ?? 0];
		if (!state) throw new JsonRpcRequestMalformedError({ message: "Invalid consumer Task state" });
		await this.storage.request("settleAcceptedWork", {
			endpointId: this.endpointId,
			taskId: task.id,
			workerId: c.workerId,
			claimToken: c.claimToken,
			state,
			snapshot: Task.toJSON(task),
			stopVerified: c.stopVerified ?? false
		});
	}
	async list(params, context) {
		if (params.contextId || params.status || params.statusTimestampAfter || params.includeArtifacts) throw new JsonRpcUnsupportedOperationError({ message: "Requested task filter is unavailable" });
		const limit = params.pageSize || 50;
		if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new JsonRpcRequestMalformedError({ message: "pageSize must be 1..100" });
		const query = {
			callerId: caller(context),
			endpointId: this.endpointId,
			limit,
			...params.pageToken ? { afterId: params.pageToken } : {}
		};
		const [work, preparation] = await Promise.all([this.storage.request("listA2ATasks", query), this.storage.request("listPreparationTasks", query)]);
		const rows = [...work.tasks, ...preparation.tasks].sort((a, b) => a.taskId < b.taskId ? -1 : a.taskId > b.taskId ? 1 : 0);
		const tasks = rows.slice(0, limit).map((r) => Task.fromJSON(r.snapshot));
		if (params.historyLength !== void 0) {
			if (!Number.isInteger(params.historyLength) || params.historyLength < 0) throw new JsonRpcRequestMalformedError();
			for (const task of tasks) task.history = params.historyLength === 0 ? [] : task.history.slice(-params.historyLength);
		}
		for (const task of tasks) task.artifacts = [];
		return {
			tasks,
			nextPageToken: rows.length > limit || work.nextPageToken || preparation.nextPageToken ? tasks.at(-1).id : "",
			pageSize: limit,
			totalSize: work.totalSize + preparation.totalSize
		};
	}
};
var DurableRequestHandler = class {
	storage;
	registry;
	endpoint;
	card;
	tasks;
	constructor(storage, registry, endpoint, card) {
		this.storage = storage;
		this.registry = registry;
		this.endpoint = endpoint;
		this.card = card;
		this.tasks = new DurableTaskStore(storage, endpoint.endpointId);
	}
	async getAgentCard() {
		return this.card;
	}
	async getAuthenticatedExtendedAgentCard(_params, context) {
		caller(context);
		return this.card;
	}
	async sendMessage(params, context) {
		const id = caller(context), m = params.message;
		if (!m || m.role !== Role.ROLE_USER || !m.messageId || m.taskId || m.contextId || m.parts.length !== 1 || m.parts[0]?.content?.$case !== "data") throw new JsonRpcRequestMalformedError({ message: "Initial work requires one DataPart, a new messageId and no preassigned Task/context" });
		if (params.configuration?.taskPushNotificationConfig) throw new JsonRpcPushNotificationNotSupportedError();
		try {
			const payload = m.parts[0].content.value;
			if (payload?.schemaVersion === "devmesh.preparation.v1") {
				const delegation = parseContract(preparationDelegation, payload), version = this.registry.version;
				const r = await this.storage.request("acceptPreparationTask", {
					callerId: id,
					endpointId: this.endpoint.endpointId,
					endpointRevision: this.endpoint.revision,
					delegation,
					message: MessageJson(m),
					registryGenerationId: version.generationId,
					projectionRevision: version.projectionRevision
				});
				return Task.fromJSON(r.snapshot);
			}
			const d = parseContract(workDelegation, payload);
			const r = await this.storage.request("acceptA2AWork", {
				callerId: id,
				endpointId: this.endpoint.endpointId,
				endpointRevision: this.endpoint.revision,
				delegation: d,
				message: MessageJson(m),
				...this.registry.version
			});
			return Task.fromJSON(r.snapshot);
		} catch (error) {
			if (error instanceof StorageError) protocolError(error);
			throw new JsonRpcRequestMalformedError({ message: error instanceof Error ? error.message : "Invalid work payload" });
		}
	}
	async getTask(params, context) {
		try {
			const t = await this.tasks.load(params.id, context);
			if (!t) throw new JsonRpcTaskNotFoundError();
			if (params.historyLength !== void 0) {
				if (!Number.isInteger(params.historyLength) || params.historyLength < 0) throw new JsonRpcRequestMalformedError();
				t.history = params.historyLength === 0 ? [] : t.history.slice(-params.historyLength);
			}
			return t;
		} catch (error) {
			protocolError(error);
		}
	}
	async cancelTask(params, context) {
		try {
			const r = await this.storage.request(preparationTask(params.id) ? "cancelPreparationTask" : "cancelA2ATask", {
				callerId: caller(context),
				endpointId: this.endpoint.endpointId,
				taskId: params.id
			});
			return Task.fromJSON(r.snapshot);
		} catch (error) {
			protocolError(error);
		}
	}
	async *sendMessageStream(params, context) {
		const t = await this.sendMessage(params, context);
		if (!("id" in t)) throw new JsonRpcUnsupportedOperationError();
		yield* this.follow(t.id, context);
	}
	async *resubscribe(params, context) {
		yield* this.follow(params.id, context);
	}
	async *follow(taskId, context) {
		const isPreparation = preparationTask(taskId);
		let initial;
		try {
			initial = await this.storage.request(isPreparation ? "getPreparationTask" : "getA2ATask", {
				callerId: caller(context),
				endpointId: this.endpoint.endpointId,
				taskId
			});
		} catch (error) {
			protocolError(error);
		}
		yield { payload: {
			$case: "task",
			value: Task.fromJSON(initial.snapshot)
		} };
		if ([
			"completed",
			"failed",
			"canceled",
			"rejected",
			"input-required",
			"auth-required"
		].includes(initial.state)) return;
		let cursor = initial.revision;
		const signal = context.user?.signal;
		for (;;) {
			if (signal?.aborted) return;
			let rows;
			try {
				rows = await this.storage.request(isPreparation ? "listPreparationTaskEvents" : "listA2ATaskEvents", {
					callerId: caller(context),
					endpointId: this.endpoint.endpointId,
					taskId,
					afterSeq: cursor
				});
			} catch (error) {
				protocolError(error);
			}
			for (const r of rows) {
				cursor = r.seq;
				const t = Task.fromJSON(r.snapshot);
				yield { payload: {
					$case: "task",
					value: t
				} };
				if ([
					TaskState.TASK_STATE_COMPLETED,
					TaskState.TASK_STATE_FAILED,
					TaskState.TASK_STATE_CANCELED,
					TaskState.TASK_STATE_REJECTED,
					TaskState.TASK_STATE_INPUT_REQUIRED,
					TaskState.TASK_STATE_AUTH_REQUIRED
				].includes(t.status?.state ?? 0)) return;
			}
			try {
				await setTimeout(100, void 0, { signal });
			} catch (error) {
				if (signal?.aborted) return;
				throw error;
			}
		}
	}
	async listTasks(params, context) {
		return this.tasks.list(params, context);
	}
	async createTaskPushNotificationConfig() {
		throw new JsonRpcPushNotificationNotSupportedError();
	}
	async getTaskPushNotificationConfig() {
		throw new JsonRpcPushNotificationNotSupportedError();
	}
	async listTaskPushNotificationConfigs() {
		throw new JsonRpcPushNotificationNotSupportedError();
	}
	async deleteTaskPushNotificationConfig() {
		throw new JsonRpcPushNotificationNotSupportedError();
	}
};
const MessageJson = (m) => Message.toJSON(m);
//#endregion
//#region src/server.ts
function createRoleCard(e) {
	return AgentCard.fromJSON({
		name: e.agentKey,
		description: "DevMesh internal durable work endpoint",
		version: e.implementationVersion,
		supportedInterfaces: [{
			url: e.address,
			protocolBinding: "JSONRPC",
			protocolVersion: "1.0"
		}],
		capabilities: {
			streaming: e.streaming,
			pushNotifications: false
		},
		defaultInputModes: ["application/json"],
		defaultOutputModes: ["application/json"],
		skills: e.supportedSkills.map((id) => ({
			id,
			name: id,
			description: "Accept authorized versioned work and expose its persisted Task",
			tags: ["devmesh"],
			inputModes: ["application/json"],
			outputModes: ["application/json"]
		})),
		securitySchemes: { serviceBearer: { httpAuthSecurityScheme: { scheme: "Bearer" } } },
		securityRequirements: [{ schemes: { serviceBearer: { list: [] } } }]
	});
}
const environmentCredentials = (env = process.env) => async (ref) => env["DEVMESH_CREDENTIAL_" + ref.replaceAll(/[^a-zA-Z0-9]/g, "_").toUpperCase()];
function mountInternalAgents(app, storage, options) {
	const registry = new AgentRegistry(storage), handlers = /* @__PURE__ */ new Map();
	let disposed = false, runningHealth, runningProjection;
	const authenticate = async (req) => {
		const authorization = req.headers.authorization;
		if (!authorization?.startsWith("Bearer ")) return void 0;
		const presented = Buffer.from(authorization.slice(7));
		if (presented.length > 4096) return void 0;
		for (const i of options.identities) {
			const secret = await options.resolveCredential(i.credentialRef);
			if (!secret || secret.length < 16) continue;
			const expected = Buffer.from(secret);
			if (expected.length === presented.length && timingSafeEqual(expected, presented)) return i.principalId;
		}
	};
	const auth = async (req, res, next) => {
		try {
			const principal = await authenticate(req);
			if (!principal) {
				res.set("WWW-Authenticate", "Bearer").status(401).json({ error: "SERVICE_AUTH_REQUIRED" });
				return;
			}
			res.locals.a2aPrincipal = principal;
			next();
		} catch {
			res.status(503).json({ error: "SERVICE_AUTH_UNAVAILABLE" });
		}
	};
	for (const e of options.manifest.endpoints.filter((e) => e.hosting === "local")) {
		const card = createRoleCard(e);
		if (cardHash(card) !== e.cardHash) throw new Error("Configured cardHash does not match hosted card: " + e.endpointId);
		const path = e.role ? "/internal/agents/" + e.role : "/internal/services/" + encodeURIComponent(e.agentKey);
		if (new URL(e.address).pathname !== path + "/a2a" || new URL(e.cardUrl).pathname !== path + "/agent-card.json") throw new Error("Local endpoint path differs from hosted route");
		const handler = new DurableRequestHandler(storage, registry, e, card);
		handlers.set(e.endpointId, handler);
		app.use(path + "/agent-card.json", auth, agentCardHandler({ agentCardProvider: async () => AgentCard.toJSON(card) }));
		app.use(path + "/a2a", auth, express.json({ limit: "128kb" }), jsonRpcHandler({
			requestHandler: handler,
			userBuilder: async (req) => {
				const userName = String(req.res.locals.a2aPrincipal), controller = new AbortController();
				req.res.once("close", () => controller.abort());
				return {
					isAuthenticated: true,
					userName,
					signal: controller.signal
				};
			}
		}));
	}
	let healthTimer, projectionTimer;
	return {
		registry,
		handlers,
		async activate() {
			if (disposed) throw new Error("A2A service was closed");
			await storage.request("recoverAcceptedWork", {});
			await registry.reconcile(options.manifest, options.resolveCredential);
			healthTimer = setInterval(() => {
				if (!runningHealth) runningHealth = registry.checkHealth(options.manifest, options.resolveCredential).catch(() => {
					registry.closeAdmission();
				}).finally(() => {
					runningHealth = void 0;
				});
			}, options.healthIntervalMs ?? 6e4);
			healthTimer.unref();
			projectionTimer = setInterval(() => {
				if (!runningProjection) runningProjection = (async () => {
					const current = await storage.request("getRegistrySnapshot", {});
					if (!registry.ready || current.generationId !== registry.version.generationId || current.projectionRevision !== registry.version.projectionRevision) await registry.refresh();
				})().catch(() => {
					registry.closeAdmission();
				}).finally(() => {
					runningProjection = void 0;
				});
			}, options.projectionIntervalMs ?? 5e3);
			projectionTimer.unref();
		},
		async stop() {
			disposed = true;
			registry.closeAdmission();
			clearInterval(healthTimer);
			clearInterval(projectionTimer);
			await Promise.allSettled([runningHealth, runningProjection]);
		}
	};
}
//#endregion
//#region src/preparation-client.ts
/** Bind the client to the resolved, checked card and transport URLs. */
async function boundClient(endpoint, token, signal) {
	const card = new URL(endpoint.cardUrl), allowed = /* @__PURE__ */ new Set([card.href, new URL(endpoint.address).href]);
	const fetchImpl = async (input, init) => {
		const url = new URL(input instanceof Request ? input.url : input).href;
		if (!allowed.has(url)) throw new Error("Preparation transport URL changed");
		const headers = new Headers(init?.headers);
		headers.set("Authorization", "Bearer " + token);
		const deadline = AbortSignal.timeout(1e4);
		return fetch(input, {
			...init,
			headers,
			redirect: "error",
			signal: AbortSignal.any([
				signal,
				deadline,
				...init?.signal ? [init.signal] : []
			])
		});
	};
	return new ClientFactory({
		transports: [new JsonRpcTransportFactory({ fetchImpl })],
		cardResolver: new DefaultAgentCardResolver({ fetchImpl })
	}).createFromUrl(card.origin, card.pathname);
}
async function preparationClient(endpoint, token, signal) {
	const client = await boundClient(endpoint, token, signal);
	return async (input) => {
		const delegation = parseContract(preparationDelegation, input);
		if (delegation.endpointId !== endpoint.endpointId || delegation.endpointRevision !== endpoint.revision) throw new Error("Preparation binding changed");
		const message = Message.fromJSON({
			messageId: delegation.preparationAttemptId,
			role: "ROLE_USER",
			parts: [{ data: delegation }]
		});
		const response = await client.sendMessage(SendMessageRequest.fromJSON({ message: Message.toJSON(message) }));
		if (!("id" in response)) throw new Error("Preparation requires a durable A2A Task");
		return Task.toJSON(response);
	};
}
async function scheduledWorkClient(endpoint, token, signal) {
	const client = await boundClient(endpoint, token, signal);
	return async (input) => {
		const d = parseContract(workDelegation, input);
		if (d.endpointId !== endpoint.endpointId || d.endpointRevision !== endpoint.revision) throw new Error("Scheduled endpoint binding changed");
		const message = Message.fromJSON({
			messageId: d.operationId,
			role: "ROLE_USER",
			parts: [{ data: d }]
		});
		const result = await client.sendMessage(SendMessageRequest.fromJSON({ message: Message.toJSON(message) }));
		if (!("id" in result)) throw new Error("Scheduled Work requires a durable A2A Task");
		return Task.toJSON(result);
	};
}
//#endregion
//#region src/index.ts
const protocolVersion = "1.0";
//#endregion
export { AgentRegistry, DurableRequestHandler, DurableTaskStore, cardHash, createRoleCard, environmentCredentials, loadInternalA2AConfig, mountInternalAgents, preparationClient, protocolVersion, scheduledWorkClient };

//# sourceMappingURL=index.mjs.map