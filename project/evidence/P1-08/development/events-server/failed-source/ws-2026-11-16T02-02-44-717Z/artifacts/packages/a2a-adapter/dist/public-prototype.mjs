import { randomUUID, timingSafeEqual } from "node:crypto";
import { AgentCard, Message, Role } from "@a2a-js/sdk";
import { JsonRpcPushNotificationNotSupportedError, JsonRpcRequestMalformedError, JsonRpcTaskNotFoundError, JsonRpcUnsupportedOperationError } from "@a2a-js/sdk/errors";
import express from "express";
import { jsonRpcHandler } from "@a2a-js/sdk/server/express";
import { z } from "zod";
//#region src/public-prototype.ts
const key = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/);
const endpointSchema = z.strictObject({
	publicKey: key,
	kind: z.enum(["agent", "group"]),
	name: z.string().trim().min(1).max(120),
	applicationVersion: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9.+_-]{0,63}$/),
	publicCard: z.boolean().default(false)
});
const enabledSchema = z.strictObject({
	enabled: z.literal(true),
	mode: z.literal("loopback-protocol-prototype"),
	publicBaseUrl: z.string().url(),
	endpoints: z.array(endpointSchema).min(1).max(32),
	defaultEndpoint: key,
	identities: z.array(z.strictObject({
		principalId: key,
		credentialRef: key,
		targets: z.array(key).min(1).max(32)
	})).min(1).max(32)
});
const configSchema = z.union([z.strictObject({ enabled: z.literal(false) }), enabledSchema]);
/** Independent test configuration: never a published Exposure or a runtime grant. */
function parsePublicPrototypeConfig(value = { enabled: false }) {
	const config = configSchema.parse(value);
	if (!config.enabled) return Object.freeze(config);
	const url = new URL(config.publicBaseUrl);
	if (url.protocol !== "http:" || !["127.0.0.1", "[::1]"].includes(url.hostname) || !url.port || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Prototype requires an explicit loopback HTTP origin and port");
	const targets = new Set(config.endpoints.map((e) => e.publicKey));
	if (targets.size !== config.endpoints.length || !targets.has(config.defaultEndpoint)) throw new Error("Prototype endpoint keys must be unique and defaultEndpoint must exist");
	if (new Set(config.identities.map((i) => i.principalId)).size !== config.identities.length || new Set(config.identities.map((i) => i.credentialRef)).size !== config.identities.length) throw new Error("Prototype identities and credential references must be unique");
	for (const identity of config.identities) {
		if (new Set(identity.targets).size !== identity.targets.length || identity.targets.some((target) => !targets.has(target))) throw new Error("Prototype identity targets must be unique configured endpoints");
		Object.freeze(identity.targets);
		Object.freeze(identity);
	}
	config.publicBaseUrl = url.origin;
	config.endpoints.forEach(Object.freeze);
	Object.freeze(config.endpoints);
	Object.freeze(config.identities);
	return Object.freeze(config);
}
const cardPath = (e) => `/${e.kind === "agent" ? "agents" : "groups"}/${e.publicKey}/agent-card.json`;
const rpcPath = (e) => `/a2a/${e.kind === "agent" ? "agents" : "groups"}/${e.publicKey}`;
function createCard(endpoint, base) {
	return AgentCard.fromJSON({
		name: endpoint.name,
		description: "DevMesh controlled loopback protocol probe. Business execution is unavailable.",
		version: endpoint.applicationVersion,
		supportedInterfaces: [{
			url: base + rpcPath(endpoint),
			protocolBinding: "JSONRPC",
			protocolVersion: "1.0"
		}],
		capabilities: {
			streaming: true,
			pushNotifications: false
		},
		defaultInputModes: ["application/json"],
		defaultOutputModes: ["application/json"],
		skills: [{
			id: "devmesh.protocol-probe.v1",
			name: "Protocol probe",
			description: "Echo a bounded nonce as an immediate agent Message; creates no business Task.",
			tags: ["protocol-prototype"],
			inputModes: ["application/json"],
			outputModes: ["application/json"]
		}],
		securitySchemes: { prototypeBearer: { httpAuthSecurityScheme: { scheme: "Bearer" } } },
		securityRequirements: [{ schemes: { prototypeBearer: { list: [] } } }]
	});
}
const probeSchema = z.strictObject({
	kind: z.literal("devmesh.protocol-probe.v1"),
	nonce: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/)
});
function authenticated(context) {
	if (context.tenant || !context.user?.isAuthenticated) throw new JsonRpcRequestMalformedError({ message: "Prototype service identity required" });
}
var ProbeHandler = class {
	card;
	endpoint;
	constructor(card, endpoint) {
		this.card = card;
		this.endpoint = endpoint;
	}
	async getAgentCard() {
		return this.card;
	}
	async getAuthenticatedExtendedAgentCard() {
		throw new JsonRpcUnsupportedOperationError();
	}
	async sendMessage(params, context) {
		authenticated(context);
		const message = params.message;
		if (!message || message.role !== Role.ROLE_USER || !/^[a-zA-Z0-9_-]{1,128}$/.test(message.messageId) || message.taskId || message.contextId || message.parts.length !== 1 || message.parts[0]?.content?.$case !== "data") throw new JsonRpcRequestMalformedError({ message: "One initial bounded protocol probe DataPart is required" });
		if (params.configuration?.taskPushNotificationConfig) throw new JsonRpcPushNotificationNotSupportedError();
		const probe = probeSchema.safeParse(message.parts[0].content.value);
		if (!probe.success) throw new JsonRpcRequestMalformedError({ message: "Only devmesh.protocol-probe.v1 is available; business execution is disabled" });
		return Message.fromJSON({
			messageId: randomUUID(),
			role: "ROLE_AGENT",
			parts: [{ data: {
				kind: "devmesh.protocol-probe-result.v1",
				nonce: probe.data.nonce,
				publicKey: this.endpoint.publicKey,
				targetKind: this.endpoint.kind,
				applicationVersion: this.endpoint.applicationVersion,
				protocolVersion: "1.0"
			} }]
		});
	}
	async *sendMessageStream(params, context) {
		yield { payload: {
			$case: "message",
			value: await this.sendMessage(params, context)
		} };
	}
	async getTask() {
		throw new JsonRpcTaskNotFoundError();
	}
	async cancelTask() {
		throw new JsonRpcTaskNotFoundError();
	}
	resubscribe() {
		throw new JsonRpcTaskNotFoundError();
	}
	async listTasks() {
		return {
			tasks: [],
			nextPageToken: "",
			pageSize: 0,
			totalSize: 0
		};
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
/** Resolves all test credentials before mounting any route; failure leaves the app untouched. */
async function mountPublicPrototype(app, input, resolveCredential) {
	const config = parsePublicPrototypeConfig(input);
	if (!config.enabled) return void 0;
	const identities = [];
	for (const identity of config.identities) {
		const secret = await resolveCredential(identity.credentialRef);
		if (!secret || !/^[\x21-\x7e]{32,2048}$/.test(secret)) throw new Error("Prototype credential is unavailable or invalid");
		const bytes = Buffer.from(secret);
		if (identities.some((i) => i.secret.length === bytes.length && timingSafeEqual(i.secret, bytes))) throw new Error("Ambiguous prototype service credentials");
		identities.push({
			principalId: identity.principalId,
			secret: bytes,
			targets: new Set(identity.targets)
		});
	}
	const base = new URL(config.publicBaseUrl);
	const boundary = (req, res, next) => {
		res.set("Cache-Control", "no-store").set("X-Content-Type-Options", "nosniff");
		const hosts = req.rawHeaders.filter((_, index) => index % 2 === 0 && req.rawHeaders[index]?.toLowerCase() === "host");
		if (![
			"127.0.0.1",
			"::1",
			"::ffff:127.0.0.1"
		].includes(req.socket.remoteAddress ?? "") || hosts.length !== 1 || req.headers.host?.toLowerCase() !== base.host.toLowerCase() || req.headers.origin !== void 0 && req.headers.origin !== base.origin) {
			res.status(403).json({ error: "PROTOTYPE_ORIGIN_DENIED" });
			return;
		}
		next();
	};
	const principal = (req) => {
		if (req.rawHeaders.filter((_, index) => index % 2 === 0 && req.rawHeaders[index]?.toLowerCase() === "authorization").length !== 1 || !/^Bearer [\x21-\x7e]{32,2048}$/.test(req.headers.authorization ?? "")) return void 0;
		const supplied = Buffer.from(req.headers.authorization.slice(7));
		return identities.find((i) => i.secret.length === supplied.length && timingSafeEqual(i.secret, supplied));
	};
	const authorize = (target, publicCard = false) => (req, res, next) => {
		const identity = principal(req);
		if (!identity && !(publicCard && req.headers.authorization === void 0)) {
			res.set("WWW-Authenticate", "Bearer").status(401).json({ error: "PROTOTYPE_AUTH_REQUIRED" });
			return;
		}
		if (identity && target && !identity.targets.has(target)) {
			res.status(403).json({ error: "PROTOTYPE_TARGET_DENIED" });
			return;
		}
		if (identity) {
			res.locals.prototypePrincipal = identity.principalId;
			res.locals.prototypeTargets = identity.targets;
		}
		next();
	};
	const errors = (error, _req, res, next) => {
		if (res.headersSent) {
			next(error);
			return;
		}
		const status = error?.type === "entity.too.large" ? 413 : 400;
		res.status(status).json({ error: status === 413 ? "PROTOTYPE_BODY_TOO_LARGE" : "PROTOTYPE_REQUEST_INVALID" });
	};
	for (const endpoint of config.endpoints) {
		const card = createCard(endpoint, base.origin), handler = new ProbeHandler(card, endpoint);
		const readCard = (_req, res) => {
			res.json(AgentCard.toJSON(card));
		};
		app.get(cardPath(endpoint), boundary, authorize(endpoint.publicKey, endpoint.publicCard), readCard);
		if (endpoint.publicKey === config.defaultEndpoint) app.get("/.well-known/agent-card.json", boundary, authorize(endpoint.publicKey, endpoint.publicCard), readCard);
		app.use(rpcPath(endpoint), boundary, authorize(endpoint.publicKey), express.json({
			limit: "16kb",
			strict: true
		}), jsonRpcHandler({
			requestHandler: handler,
			userBuilder: async (req) => ({
				isAuthenticated: true,
				userName: String(req.res.locals.prototypePrincipal)
			})
		}), errors);
	}
	app.get("/catalog/agents", boundary, authorize(), (_req, res) => {
		const allowed = res.locals.prototypeTargets;
		res.json({
			mode: config.mode,
			endpoints: config.endpoints.filter((e) => allowed.has(e.publicKey)).map((e) => ({
				publicKey: e.publicKey,
				kind: e.kind,
				name: e.name,
				applicationVersion: e.applicationVersion,
				cardUrl: base.origin + cardPath(e)
			}))
		});
	});
	return {
		mode: config.mode,
		endpoints: config.endpoints.length
	};
}
//#endregion
export { mountPublicPrototype, parsePublicPrototypeConfig };

//# sourceMappingURL=public-prototype.mjs.map