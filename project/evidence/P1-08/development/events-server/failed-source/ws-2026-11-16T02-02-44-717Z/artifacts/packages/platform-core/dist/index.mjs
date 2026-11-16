import { ConfigError, loadConfig } from "./config.mjs";
import { createServer } from "node:http";
import express from "express";
import { Context } from "@deepseek-ai/cordis";
import { setTimeout as setTimeout$1 } from "node:timers/promises";
import { ReleaseExporter } from "@devmesh/result-verifier";
import { createHash } from "node:crypto";
import { ids, opaqueKey, roleOutput, sha256 } from "@devmesh/contracts";
import { StorageError, acceptancePreparationObservation, canonical, previewRuntimeFact, releasePublicationObservation } from "@devmesh/storage-sqlite";
//#region src/release-exports.ts
/** Consumes only local delivery jobs. It never drives acceptance or publication. */
var ReleaseExportScheduler = class {
	content;
	#stop = new AbortController();
	#exporter;
	#options;
	#loop;
	#pass;
	lastError = null;
	constructor(content, sources, options = {}) {
		this.content = content;
		const limit = (value, fallback, min, max) => {
			const n = value ?? fallback;
			if (!Number.isSafeInteger(n) || n < min || n > max) throw new Error("Invalid release export scheduler limits");
			return n;
		};
		this.#options = {
			pollIntervalMs: limit(options.pollIntervalMs, 1e3, 100, 6e4),
			maxConcurrentJobs: limit(options.maxConcurrentJobs, 2, 1, 2),
			maxJobsPerPass: limit(options.maxJobsPerPass, 32, 1, 200)
		};
		this.#exporter = new ReleaseExporter(content, sources);
	}
	/** Coalesced, bounded full scan. Every pass starts at the original queue head. */
	tick() {
		if (this.#stop.signal.aborted) return Promise.resolve();
		return this.#pass ??= this.consume().finally(() => {
			this.#pass = void 0;
		});
	}
	async consume() {
		let cursor;
		let remaining = this.#options.maxJobsPerPass;
		while (remaining > 0 && !this.#stop.signal.aborted) {
			const page = await this.content.storage.request("listReleaseExportWork", {
				...cursor ? { afterExportId: cursor } : {},
				limit: Math.min(remaining, this.#options.maxConcurrentJobs)
			});
			await Promise.all(page.jobs.map((job) => this.advance(job)));
			remaining -= page.jobs.length;
			if (!page.nextCursor || page.jobs.length === 0) return;
			cursor = page.nextCursor;
		}
	}
	async advance(job) {
		if (this.#stop.signal.aborted) return;
		const subject = {
			principalId: job.principalId,
			exportId: job.exportId
		};
		try {
			if (job.state === "PACKING") await this.content.storage.request("retryReleaseExport", {
				...subject,
				expectedGeneration: job.generation
			});
			if (this.#stop.signal.aborted) return;
			const signal = AbortSignal.any([this.#stop.signal, AbortSignal.timeout(9e4)]);
			const result = await this.#exporter.advance(job.principalId, job.exportId, signal);
			if (result.state === "FAILED") this.lastError = result.errorCode;
		} catch (error) {
			const code = error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : "";
			this.lastError = /^[A-Z][A-Z0-9_]{0,95}$/.test(code) ? code : "EXPORT_RECOVERY_UNAVAILABLE";
		}
	}
	start() {
		if (this.#loop || this.#stop.signal.aborted) throw new Error("Release export scheduler can only start once");
		this.#loop = (async () => {
			while (!this.#stop.signal.aborted) {
				try {
					await this.tick();
				} catch {
					this.lastError = "EXPORT_SCAN_UNAVAILABLE";
				}
				try {
					await setTimeout$1(this.#options.pollIntervalMs, void 0, { signal: this.#stop.signal });
				} catch {
					break;
				}
			}
		})();
	}
	async stop() {
		this.#stop.abort();
		await Promise.all([this.#loop, this.#pass]);
	}
};
//#endregion
//#region src/release-acceptor.ts
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
/** Trusted material preflight outside T5. Infrastructure readiness is supplied
* by the separately configured preparer; this never creates or publishes it. */
var ReleaseAcceptor = class {
	storage;
	content;
	constructor(storage, content) {
		this.storage = storage;
		this.content = content;
	}
	async accept(input) {
		if (await this.storage.request("lookupOperation", input.meta)) return this.storage.request("commitReleaseAcceptance", input);
		const principalId = input.meta.principalId, candidate = await this.storage.request("getReleaseCandidate", {
			principalId,
			runId: input.runId,
			candidateId: input.candidateId
		});
		const reject = () => {
			throw new StorageError("ACCEPTANCE_CONTENT_UNAVAILABLE", 409, "Exact frozen candidate bytes are required before acceptance");
		};
		if (candidate.qualification !== "CURRENT" || candidate.revision !== input.candidateRevision || candidate.manifestHash !== input.manifestHash) throw new StorageError("ACCEPTANCE_BASIS_CHANGED", 409, "Acceptance requires the exact current candidate");
		const queue = [], seen = /* @__PURE__ */ new Set(), candidates = new Set(candidate.manifest.works.map((w) => w.assessment.candidate.sha256));
		const add = (reference, sha256) => {
			if (!seen.has(sha256)) {
				if (seen.size >= 2048) reject();
				seen.add(sha256);
				queue.push({
					reference,
					sha256
				});
			}
		};
		function refs(value) {
			if (Array.isArray(value)) {
				for (const child of value) refs(child);
				return;
			}
			if (!value || typeof value !== "object") return;
			const ref = value;
			if (typeof ref.artifactId === "string" && typeof ref.sha256 === "string") add({
				kind: "artifact",
				artifactId: ref.artifactId
			}, ref.sha256);
			for (const child of Object.values(ref)) refs(child);
		}
		refs(candidate.manifest);
		for (const q of candidate.manifest.quality) for (const m of q.materials) add({
			kind: "qualityMaterial",
			operationId: q.verification.operationId,
			materialKey: m.materialKey
		}, m.contentHash);
		for (const m of candidate.manifest.delivery.materials) add({
			kind: "releaseDelivery",
			operationId: candidate.manifest.delivery.record.operationId,
			materialKey: m.materialKey
		}, m.contentHash);
		let total = 0;
		for (let index = 0; index < queue.length; index++) {
			const ref = queue[index], bytes = await this.content.readBytes(principalId, ref.reference, 64 * 1024 * 1024);
			total += bytes.byteLength;
			if (total > 512 * 1024 * 1024 || hash(bytes) !== ref.sha256) reject();
			if (candidates.has(ref.sha256)) {
				let value;
				try {
					value = JSON.parse(Buffer.from(bytes).toString("utf8"));
				} catch {
					reject();
				}
				const parsed = roleOutput.safeParse(value);
				if (!parsed.success) reject();
				if (hash(Buffer.from(canonical(parsed.data))) !== ref.sha256) reject();
				refs(parsed.data);
			}
		}
		if (canonical([...seen].sort()) !== canonical(candidate.preflightHashes)) reject();
		return this.storage.request("commitReleaseAcceptance", input);
	}
};
//#endregion
//#region src/acceptance-preparer.ts
/** Explicit trusted composition; no backend or model identity is installed by default. */
var AcceptancePreparer = class {
	storage;
	principalId;
	backend;
	constructor(storage, principalId, backend) {
		this.storage = storage;
		this.principalId = principalId;
		this.backend = backend;
		opaqueKey.parse(principalId);
	}
	async advance(operationId, signal) {
		signal?.throwIfAborted();
		const subject = {
			principalId: this.principalId,
			operationId: ids.operation.parse(operationId)
		};
		let preparation = await this.storage.request("getAcceptancePreparation", subject);
		const bound = {
			...subject,
			requestHash: sha256.parse(preparation.requestHash)
		}, before = await this.storage.request("getAcceptanceReadiness", bound);
		if (preparation.state === "FAILED" || preparation.resolution !== "UNRESOLVED") return before;
		signal?.throwIfAborted();
		if (!this.backend?.configured) throw new StorageError("ACCEPTANCE_BACKEND_NOT_CONFIGURED", 503, "An explicit trusted acceptance backend is required");
		let dispatch = false;
		if (preparation.state === "PREPARED") {
			await this.backend.preflight(preparation);
			signal?.throwIfAborted();
			const grant = await this.storage.request("markAcceptancePreparationSent", {
				...bound,
				expectedRevision: preparation.revision
			});
			preparation = grant.preparation;
			dispatch = grant.dispatch;
			if (preparation.resolution !== "UNRESOLVED") return this.storage.request("getAcceptanceReadiness", bound);
		}
		signal?.throwIfAborted();
		let observation;
		try {
			observation = acceptancePreparationObservation.parse(dispatch ? await this.backend.prepare(preparation, async () => !signal?.aborted && (await this.storage.request("verifyAcceptancePreparation", bound)).allowed && !signal?.aborted) : await this.backend.inspect(preparation));
		} catch {
			observation = {
				state: "UNKNOWN",
				errorCode: "ACCEPTANCE_BACKEND_UNCERTAIN",
				checkedAt: (/* @__PURE__ */ new Date()).toISOString()
			};
		}
		return this.storage.request("recordAcceptancePreparationObservation", {
			...bound,
			expectedPreparationRevision: preparation.revision,
			expectedSequence: before.sequence,
			observation
		});
	}
	async recoverPage(input) {
		const page = await this.storage.request("listAcceptancePreparations", {
			principalId: this.principalId,
			projectId: ids.project.parse(input.projectId),
			policyHash: sha256.parse(input.policyHash),
			...input.afterSequence === void 0 ? {} : { afterSequence: input.afterSequence },
			...input.limit === void 0 ? {} : { limit: input.limit }
		}), results = [];
		for (const { preparation } of page.items) try {
			const readiness = await this.advance(preparation.operationId);
			results.push({
				operationId: preparation.operationId,
				state: readiness.state,
				errorCode: readiness.reasonCode
			});
		} catch (error) {
			results.push({
				operationId: preparation.operationId,
				state: "UNAVAILABLE",
				errorCode: error instanceof StorageError ? error.code : "ACCEPTANCE_RECOVERY_UNAVAILABLE"
			});
		}
		return {
			results,
			nextSequence: page.nextSequence
		};
	}
};
//#endregion
//#region src/acceptance-consumer.ts
const invalid$4 = () => {
	throw new StorageError("ACCEPTANCE_CONSUMER_CONFIG_INVALID", 422, "Explicit bounded trusted acceptance bindings are required");
};
/** Trusted local composition only. No T5, publication or cleanup is performed. */
var AcceptancePreparationConsumer = class AcceptancePreparationConsumer {
	storage;
	#stop = new AbortController();
	#scopes;
	#limits;
	#nextScope = 0;
	#loop;
	#pass;
	#drain;
	lastError = null;
	constructor(storage, options) {
		this.storage = storage;
		const limit = (v, fallback, min, max) => {
			const n = v ?? fallback;
			if (!Number.isSafeInteger(n) || n < min || n > max) invalid$4();
			return n;
		};
		if (!Array.isArray(options.bindings) || options.bindings.length < 1 || options.bindings.length > 32) invalid$4();
		this.#limits = {
			pollIntervalMs: limit(options.pollIntervalMs, 5e3, 1e3, 1e4),
			maxConcurrentProjects: limit(options.maxConcurrentProjects, 2, 1, 2),
			maxScopesPerPass: limit(options.maxScopesPerPass, 32, 1, 32),
			pageSize: limit(options.pageSize, 1, 1, 20)
		};
		const projects = /* @__PURE__ */ new Set();
		this.#scopes = options.bindings.map((input) => {
			const binding = Object.freeze({
				projectId: ids.project.parse(input.projectId),
				policyHash: sha256.parse(input.policyHash),
				principalId: opaqueKey.parse(input.principalId),
				backendRef: opaqueKey.parse(input.backendRef),
				runnerId: opaqueKey.parse(input.runnerId),
				backend: input.backend
			});
			if (projects.has(binding.projectId) || !binding.backend?.configured || [
				"preflight",
				"prepare",
				"inspect"
			].some((k) => typeof binding.backend[k] !== "function")) invalid$4();
			projects.add(binding.projectId);
			const check = (p) => {
				if (p.projectId !== binding.projectId || p.policyHash !== binding.policyHash || p.request.projectId !== binding.projectId || p.request.backendPrincipalId !== binding.principalId || p.request.backendRef !== binding.backendRef || p.request.runnerId !== binding.runnerId) throw new StorageError("ACCEPTANCE_RECOVERY_SCOPE_CHANGED", 409, "Original acceptance binding changed");
			};
			const backend = binding.backend, preflight = backend.preflight.bind(backend), prepare = backend.prepare.bind(backend), inspect = backend.inspect.bind(backend);
			return {
				binding,
				preparer: new AcceptancePreparer(storage, binding.principalId, {
					get configured() {
						return backend.configured;
					},
					async preflight(p) {
						check(p);
						await preflight(p);
					},
					async prepare(p, authorize) {
						check(p);
						return prepare(p, authorize);
					},
					async inspect(p) {
						check(p);
						return inspect(p);
					}
				}),
				cursor: 0
			};
		});
	}
	static async create(storage, options) {
		const consumer = new AcceptancePreparationConsumer(storage, options);
		for (const { binding: b } of consumer.#scopes) {
			const { policy } = await storage.request("getAcceptancePreparationScope", {
				principalId: b.principalId,
				projectId: b.projectId,
				policyHash: b.policyHash
			});
			if (policy.backendPrincipalId !== b.principalId || policy.backendRef !== b.backendRef || policy.runnerId !== b.runnerId) invalid$4();
		}
		return consumer;
	}
	tick() {
		if (this.#stop.signal.aborted) return Promise.resolve();
		return this.#pass ??= this.consume().finally(() => {
			this.#pass = void 0;
		});
	}
	async consume() {
		const count = Math.min(this.#limits.maxScopesPerPass, this.#scopes.length), scopes = Array.from({ length: count }, (_, i) => this.#scopes[(this.#nextScope + i) % this.#scopes.length]);
		this.#nextScope = (this.#nextScope + count) % this.#scopes.length;
		for (let i = 0; i < scopes.length && !this.#stop.signal.aborted; i += this.#limits.maxConcurrentProjects) await Promise.all(scopes.slice(i, i + this.#limits.maxConcurrentProjects).map((scope) => this.consumeScope(scope)));
	}
	async consumeScope(scope) {
		const { binding: b } = scope;
		try {
			if (this.#stop.signal.aborted) return;
			if (!b.backend.configured) throw new StorageError("ACCEPTANCE_BACKEND_NOT_CONFIGURED", 503, "Original trusted backend unavailable");
			const page = await this.storage.request("listAcceptancePreparationWork", {
				principalId: b.principalId,
				projectId: b.projectId,
				policyHash: b.policyHash,
				afterSequence: scope.cursor,
				limit: this.#limits.pageSize
			});
			scope.cursor = page.nextSequence ?? 0;
			for (const { preparation: p } of page.items) {
				if (this.#stop.signal.aborted) return;
				if (p.projectId !== b.projectId || p.policyHash !== b.policyHash) throw new StorageError("ACCEPTANCE_RECOVERY_SCOPE_CHANGED", 409, "Original acceptance work changed");
				try {
					await scope.preparer.advance(p.operationId, this.#stop.signal);
				} catch (error) {
					this.recordError(error);
				}
			}
		} catch (error) {
			this.recordError(error);
		}
	}
	recordError(error) {
		if (this.#stop.signal.aborted) return;
		const code = error instanceof StorageError ? error.code : "";
		this.lastError = /^[A-Z][A-Z0-9_]{0,95}$/.test(code) ? code : "ACCEPTANCE_RECOVERY_UNAVAILABLE";
	}
	start() {
		if (this.#loop || this.#stop.signal.aborted) throw new Error("Acceptance preparation consumer can only start once");
		this.#loop = (async () => {
			while (!this.#stop.signal.aborted) {
				await this.tick();
				try {
					await setTimeout$1(this.#limits.pollIntervalMs, void 0, { signal: this.#stop.signal });
				} catch {
					break;
				}
			}
		})();
	}
	stopAdmission() {
		this.#stop.abort();
	}
	stop() {
		this.stopAdmission();
		return this.#drain ??= Promise.all([this.#loop, this.#pass]).then(() => {});
	}
};
//#endregion
//#region src/abort-consumer.ts
const invalid$3 = () => {
	throw new StorageError("ACCEPTANCE_ABORT_CONSUMER_CONFIG_INVALID", 422, "Explicit bounded trusted abort bindings are required");
};
/** Consumes already recorded original aborts only; no new owner decision or T5. */
var AcceptanceAbortConsumer = class AcceptanceAbortConsumer {
	storage;
	#stop = new AbortController();
	#scopes;
	#limits;
	#nextScope = 0;
	#loop;
	#pass;
	#drain;
	lastError = null;
	constructor(storage, options) {
		this.storage = storage;
		const limit = (v, fallback, min, max) => {
			const n = v ?? fallback;
			if (!Number.isSafeInteger(n) || n < min || n > max) invalid$3();
			return n;
		};
		if (!Array.isArray(options.bindings) || options.bindings.length < 1 || options.bindings.length > 32) invalid$3();
		this.#limits = {
			pollIntervalMs: limit(options.pollIntervalMs, 5e3, 1e3, 3e4),
			maxConcurrentProjects: limit(options.maxConcurrentProjects, 2, 1, 2),
			maxScopesPerPass: limit(options.maxScopesPerPass, 32, 1, 32),
			pageSize: limit(options.pageSize, 1, 1, 20)
		};
		const projects = /* @__PURE__ */ new Set();
		this.#scopes = options.bindings.map((input) => {
			const binding = Object.freeze({
				projectId: ids.project.parse(input.projectId),
				policyHash: sha256.parse(input.policyHash),
				principalId: opaqueKey.parse(input.principalId),
				backendRef: opaqueKey.parse(input.backendRef),
				runnerId: opaqueKey.parse(input.runnerId),
				backend: input.backend
			});
			const backend = binding.backend;
			if (projects.has(binding.projectId) || !backend?.configured || typeof backend.advance !== "function") invalid$3();
			projects.add(binding.projectId);
			return {
				binding,
				advance: backend.advance.bind(backend),
				cursor: 0
			};
		});
	}
	static async create(storage, options) {
		const consumer = new AcceptanceAbortConsumer(storage, options);
		for (const { binding: b } of consumer.#scopes) {
			const { policy } = await storage.request("getAcceptancePreparationScope", {
				principalId: b.principalId,
				projectId: b.projectId,
				policyHash: b.policyHash
			});
			if (policy.backendPrincipalId !== b.principalId || policy.backendRef !== b.backendRef || policy.runnerId !== b.runnerId) invalid$3();
		}
		return consumer;
	}
	tick() {
		if (this.#stop.signal.aborted) return Promise.resolve();
		return this.#pass ??= this.consume().finally(() => {
			this.#pass = void 0;
		});
	}
	async consume() {
		const count = Math.min(this.#limits.maxScopesPerPass, this.#scopes.length), scopes = Array.from({ length: count }, (_, i) => this.#scopes[(this.#nextScope + i) % this.#scopes.length]);
		this.#nextScope = (this.#nextScope + count) % this.#scopes.length;
		for (let i = 0; i < scopes.length && !this.#stop.signal.aborted; i += this.#limits.maxConcurrentProjects) await Promise.all(scopes.slice(i, i + this.#limits.maxConcurrentProjects).map((scope) => this.consumeScope(scope)));
	}
	async consumeScope(scope) {
		const { binding: b } = scope;
		try {
			if (this.#stop.signal.aborted) return;
			if (!b.backend.configured) throw new StorageError("ACCEPTANCE_ABORT_BACKEND_NOT_CONFIGURED", 503, "Original abort backend unavailable");
			const page = await this.storage.request("listAcceptanceAbortWork", {
				principalId: b.principalId,
				projectId: b.projectId,
				policyHash: b.policyHash,
				afterSequence: scope.cursor,
				limit: this.#limits.pageSize
			});
			scope.cursor = page.nextSequence ?? 0;
			for (const { preparation: p, record } of page.items) {
				if (this.#stop.signal.aborted) return;
				const q = p.request;
				if (p.resolution !== "ABORTING" || p.projectId !== b.projectId || p.policyHash !== b.policyHash || q.policyHash !== b.policyHash || q.projectId !== b.projectId || q.backendPrincipalId !== b.principalId || q.backendRef !== b.backendRef || q.runnerId !== b.runnerId || record.decision.preparation.operationId !== p.operationId || record.decision.preparationRequestHash !== p.requestHash) throw new StorageError("ACCEPTANCE_ABORT_RECOVERY_SCOPE_CHANGED", 409, "Original abort work changed");
				try {
					const result = await scope.advance({
						operationId: p.operationId,
						requestHash: p.requestHash
					}, this.#stop.signal);
					if (result.state === "UNKNOWN") this.recordCode(result.errorCode);
				} catch (error) {
					this.recordError(error);
				}
			}
		} catch (error) {
			this.recordError(error);
		}
	}
	recordCode(code) {
		if (!this.#stop.signal.aborted) this.lastError = /^[A-Z][A-Z0-9_]{0,95}$/.test(code) ? code : "ACCEPTANCE_ABORT_RECOVERY_UNAVAILABLE";
	}
	recordError(error) {
		this.recordCode(error instanceof StorageError ? error.code : "");
	}
	start() {
		if (this.#loop || this.#stop.signal.aborted) throw new Error("Acceptance abort consumer can only start once");
		this.#loop = (async () => {
			while (!this.#stop.signal.aborted) {
				await this.tick();
				try {
					await setTimeout$1(this.#limits.pollIntervalMs, void 0, { signal: this.#stop.signal });
				} catch {
					break;
				}
			}
		})();
	}
	stopAdmission() {
		this.#stop.abort();
	}
	stop() {
		this.stopAdmission();
		return this.#drain ??= Promise.all([this.#loop, this.#pass]).then(() => {});
	}
};
//#endregion
//#region src/release-publisher.ts
/** Trusted explicit composition. No physical publisher is installed by default. */
var ReleasePublisher = class {
	storage;
	principalId;
	backend;
	constructor(storage, principalId, backend) {
		this.storage = storage;
		this.principalId = principalId;
		this.backend = backend;
		opaqueKey.parse(principalId);
	}
	async advance(releaseId, signal) {
		signal?.throwIfAborted();
		const subject = {
			principalId: this.principalId,
			releaseId: ids.release.parse(releaseId)
		};
		let publication = await this.storage.request("getReleasePublication", subject);
		if (publication.state === "PUBLISHED") return publication;
		signal?.throwIfAborted();
		if (!this.backend?.configured) throw new StorageError("RELEASE_PUBLICATION_BACKEND_NOT_CONFIGURED", 503, "An explicit trusted publication backend is required");
		const bound = {
			...subject,
			requestHash: sha256.parse(publication.requestHash)
		};
		let dispatch = false;
		if (publication.state === "PENDING") {
			await this.backend.preflight(publication);
			signal?.throwIfAborted();
			const grant = await this.storage.request("beginReleasePublication", {
				...bound,
				expectedRevision: publication.revision
			});
			publication = grant.publication;
			dispatch = grant.dispatch;
			if (publication.state === "PUBLISHED") return publication;
		}
		signal?.throwIfAborted();
		let observation;
		try {
			observation = releasePublicationObservation.parse(dispatch ? await this.backend.publish(publication, async () => !signal?.aborted && (await this.storage.request("verifyReleasePublication", bound)).allowed && !signal?.aborted) : await this.backend.inspect(publication));
			if (!dispatch && observation.state === "UNKNOWN" && this.backend.resume && !signal?.aborted) {
				const authorize = async () => !signal?.aborted && (await this.storage.request("verifyReleasePublicationContinuation", bound)).allowed && !signal?.aborted;
				if (await authorize()) observation = releasePublicationObservation.parse(await this.backend.resume(publication, authorize));
			}
		} catch {
			observation = {
				state: "UNKNOWN",
				errorCode: "RELEASE_PUBLICATION_BACKEND_UNCERTAIN",
				checkedAt: (/* @__PURE__ */ new Date()).toISOString()
			};
		}
		return this.storage.request("recordReleasePublicationObservation", {
			...bound,
			expectedRevision: publication.revision,
			expectedSequence: publication.sequence,
			observation
		});
	}
	async recoverPage(input) {
		const page = await this.storage.request("listReleasePublications", {
			principalId: this.principalId,
			projectId: ids.project.parse(input.projectId),
			policyHash: sha256.parse(input.policyHash),
			...input.afterSequence === void 0 ? {} : { afterSequence: input.afterSequence },
			...input.limit === void 0 ? {} : { limit: input.limit }
		}), results = [];
		for (const { publication } of page.items) try {
			const value = await this.advance(publication.releaseId);
			results.push({
				releaseId: publication.releaseId,
				state: value.state,
				errorCode: value.errorCode
			});
		} catch (error) {
			results.push({
				releaseId: publication.releaseId,
				state: "UNAVAILABLE",
				errorCode: error instanceof StorageError ? error.code : "RELEASE_PUBLICATION_RECOVERY_UNAVAILABLE"
			});
		}
		return {
			results,
			nextSequence: page.nextSequence
		};
	}
};
//#endregion
//#region src/publication-consumer.ts
const invalid$2 = () => {
	throw new StorageError("RELEASE_CONSUMER_CONFIG_INVALID", 422, "Explicit bounded trusted publication bindings are required");
};
/** Consumes only already accepted original Outbox records. No T5 or data migration. */
var ReleasePublicationConsumer = class ReleasePublicationConsumer {
	storage;
	#stop = new AbortController();
	#scopes;
	#limits;
	#nextScope = 0;
	#loop;
	#pass;
	#drain;
	lastError = null;
	constructor(storage, options) {
		this.storage = storage;
		const limit = (v, fallback, min, max) => {
			const n = v ?? fallback;
			if (!Number.isSafeInteger(n) || n < min || n > max) invalid$2();
			return n;
		};
		if (!Array.isArray(options.bindings) || options.bindings.length < 1 || options.bindings.length > 32) invalid$2();
		this.#limits = {
			pollIntervalMs: limit(options.pollIntervalMs, 5e3, 1e3, 3e4),
			maxConcurrentProjects: limit(options.maxConcurrentProjects, 2, 1, 2),
			maxScopesPerPass: limit(options.maxScopesPerPass, 32, 1, 32),
			pageSize: limit(options.pageSize, 1, 1, 20)
		};
		const projects = /* @__PURE__ */ new Set();
		this.#scopes = options.bindings.map((input) => {
			const binding = Object.freeze({
				projectId: ids.project.parse(input.projectId),
				policyHash: sha256.parse(input.policyHash),
				principalId: opaqueKey.parse(input.principalId),
				backendRef: opaqueKey.parse(input.backendRef),
				runnerId: opaqueKey.parse(input.runnerId),
				backend: input.backend
			});
			const backend = binding.backend;
			if (projects.has(binding.projectId) || !backend?.configured || [
				"preflight",
				"publish",
				"inspect"
			].some((k) => typeof backend[k] !== "function") || backend.resume !== void 0 && typeof backend.resume !== "function") invalid$2();
			projects.add(binding.projectId);
			const check = (p) => {
				const q = p.request.preparation;
				if (p.projectId !== binding.projectId || q.projectId !== binding.projectId || q.policyHash !== binding.policyHash || q.backendPrincipalId !== binding.principalId || q.backendRef !== binding.backendRef || q.runnerId !== binding.runnerId) throw new StorageError("RELEASE_RECOVERY_SCOPE_CHANGED", 409, "Original publication binding changed");
			};
			const preflight = backend.preflight.bind(backend), publish = backend.publish.bind(backend), inspect = backend.inspect.bind(backend), resume = backend.resume?.bind(backend);
			const scoped = {
				get configured() {
					return backend.configured;
				},
				async preflight(p) {
					check(p);
					await preflight(p);
				},
				async publish(p, authorize) {
					check(p);
					return publish(p, authorize);
				},
				async inspect(p) {
					check(p);
					return inspect(p);
				},
				...resume ? { async resume(p, authorize) {
					check(p);
					return resume(p, authorize);
				} } : {}
			};
			return {
				binding,
				publisher: new ReleasePublisher(storage, binding.principalId, scoped),
				cursor: 0
			};
		});
	}
	static async create(storage, options) {
		const consumer = new ReleasePublicationConsumer(storage, options);
		for (const { binding: b } of consumer.#scopes) {
			const { policy } = await storage.request("getAcceptancePreparationScope", {
				principalId: b.principalId,
				projectId: b.projectId,
				policyHash: b.policyHash
			});
			if (policy.backendPrincipalId !== b.principalId || policy.backendRef !== b.backendRef || policy.runnerId !== b.runnerId) invalid$2();
		}
		return consumer;
	}
	tick() {
		if (this.#stop.signal.aborted) return Promise.resolve();
		return this.#pass ??= this.consume().finally(() => {
			this.#pass = void 0;
		});
	}
	async consume() {
		const count = Math.min(this.#limits.maxScopesPerPass, this.#scopes.length), scopes = Array.from({ length: count }, (_, i) => this.#scopes[(this.#nextScope + i) % this.#scopes.length]);
		this.#nextScope = (this.#nextScope + count) % this.#scopes.length;
		for (let i = 0; i < scopes.length && !this.#stop.signal.aborted; i += this.#limits.maxConcurrentProjects) await Promise.all(scopes.slice(i, i + this.#limits.maxConcurrentProjects).map((scope) => this.consumeScope(scope)));
	}
	async consumeScope(scope) {
		const { binding: b } = scope;
		try {
			if (this.#stop.signal.aborted) return;
			if (!b.backend.configured) throw new StorageError("RELEASE_PUBLICATION_BACKEND_NOT_CONFIGURED", 503, "Original publication backend unavailable");
			const page = await this.storage.request("listReleasePublicationWork", {
				principalId: b.principalId,
				projectId: b.projectId,
				policyHash: b.policyHash,
				afterSequence: scope.cursor,
				limit: this.#limits.pageSize
			});
			scope.cursor = page.nextSequence ?? 0;
			for (const { publication: p } of page.items) {
				if (this.#stop.signal.aborted) return;
				if (p.projectId !== b.projectId || p.request.preparation.policyHash !== b.policyHash) throw new StorageError("RELEASE_RECOVERY_SCOPE_CHANGED", 409, "Original publication work changed");
				try {
					await scope.publisher.advance(p.releaseId, this.#stop.signal);
				} catch (error) {
					this.recordError(error);
				}
			}
		} catch (error) {
			this.recordError(error);
		}
	}
	recordError(error) {
		if (this.#stop.signal.aborted) return;
		const code = error instanceof StorageError ? error.code : "";
		this.lastError = /^[A-Z][A-Z0-9_]{0,95}$/.test(code) ? code : "RELEASE_RECOVERY_UNAVAILABLE";
	}
	start() {
		if (this.#loop || this.#stop.signal.aborted) throw new Error("Release publication consumer can only start once");
		this.#loop = (async () => {
			while (!this.#stop.signal.aborted) {
				await this.tick();
				try {
					await setTimeout$1(this.#limits.pollIntervalMs, void 0, { signal: this.#stop.signal });
				} catch {
					break;
				}
			}
		})();
	}
	stopAdmission() {
		this.#stop.abort();
	}
	stop() {
		this.stopAdmission();
		return this.#drain ??= Promise.all([this.#loop, this.#pass]).then(() => {});
	}
};
//#endregion
//#region src/dataset-preparer.ts
var DatasetPreparer = class {
	storage;
	principalId;
	backend;
	#closed = false;
	constructor(storage, principalId, backend) {
		this.storage = storage;
		this.principalId = principalId;
		this.backend = backend;
		opaqueKey.parse(principalId);
	}
	stopAdmission() {
		this.#closed = true;
	}
	async advance(operationId) {
		const subject = {
			principalId: this.principalId,
			operationId: ids.operation.parse(operationId)
		};
		let effect = await this.storage.request("getPreviewEffect", subject);
		if (effect.kind !== "DATASET_PREPARE") throw new StorageError("DATASET_OPERATION_REQUIRED", 422, "Only dataset preparation can be advanced here");
		if (effect.state === "SUCCEEDED" || effect.state === "FAILED") return effect;
		if (this.#closed) throw new StorageError("DATASET_PREPARER_CLOSED", 503, "Dataset preparation admission is closed");
		if (!this.backend?.configured) throw new StorageError("DATASET_BACKEND_NOT_CONFIGURED", 503, "An explicit trusted dataset backend is required");
		let dispatch = false;
		if (effect.state === "PREPARED") {
			await this.backend.preflight(effect);
			if (this.#closed || !this.backend.configured) throw new StorageError("DATASET_PREPARER_CLOSED", 503, "Dataset preparation admission is closed");
			const grant = await this.storage.request("markPreviewEffectSent", {
				...subject,
				requestHash: sha256.parse(effect.requestHash),
				expectedRevision: effect.revision
			});
			effect = grant.effect;
			dispatch = grant.dispatch;
			if (effect.state === "SUCCEEDED" || effect.state === "FAILED") return effect;
		}
		let observation;
		const authorize = async () => {
			if (this.#closed || !this.backend?.configured) return false;
			const result = await this.storage.request("verifyPreviewExecution", {
				...subject,
				requestHash: sha256.parse(effect.requestHash)
			});
			return !this.#closed && this.backend.configured && result.allowed;
		};
		try {
			observation = dispatch ? await this.backend.prepare(effect, authorize) : await this.backend.inspect(effect);
		} catch {
			observation = {
				state: "UNKNOWN",
				errorCode: "DATASET_BACKEND_UNCERTAIN"
			};
		}
		const current = await this.storage.request("getPreviewEffect", subject);
		if (current.state === "SUCCEEDED" || current.state === "FAILED") return current;
		if (current.requestHash !== effect.requestHash) throw new StorageError("PREVIEW_REQUEST_CHANGED", 409, "Original dataset request changed");
		return this.storage.request("recordPreviewEffectObservation", {
			...subject,
			requestHash: sha256.parse(effect.requestHash),
			expectedRevision: current.revision,
			observation
		});
	}
	async recoverPage(input) {
		const page = await this.storage.request("listPreviewEffects", {
			principalId: this.principalId,
			projectId: ids.project.parse(input.projectId),
			policyHash: sha256.parse(input.policyHash),
			...input.afterSequence === void 0 ? {} : { afterSequence: input.afterSequence },
			...input.limit === void 0 ? {} : { limit: input.limit }
		}), results = [];
		for (const row of page.items) {
			if (row.effect.kind !== "DATASET_PREPARE") continue;
			try {
				const effect = await this.advance(row.effect.operationId);
				results.push({
					operationId: effect.operationId,
					state: effect.state,
					errorCode: effect.errorCode
				});
			} catch (error) {
				results.push({
					operationId: row.effect.operationId,
					state: row.effect.state,
					errorCode: error instanceof StorageError ? error.code : "DATASET_RECOVERY_UNAVAILABLE"
				});
			}
		}
		return {
			results,
			nextSequence: page.nextSequence
		};
	}
};
//#endregion
//#region src/dataset-consumer.ts
const invalid$1 = () => {
	throw new StorageError("DATASET_CONSUMER_CONFIG_INVALID", 422, "Explicit bounded trusted dataset bindings are required");
};
/** Consume recorded dataset preparation only. No new owner decisions or acceptance. */
var PreviewDatasetConsumer = class PreviewDatasetConsumer {
	storage;
	#stop = new AbortController();
	#scopes;
	#limits;
	#nextScope = 0;
	#loop;
	#pass;
	#drain;
	lastError = null;
	constructor(storage, options) {
		this.storage = storage;
		const limit = (v, fallback, min, max) => {
			const n = v ?? fallback;
			if (!Number.isSafeInteger(n) || n < min || n > max) invalid$1();
			return n;
		};
		if (!Array.isArray(options.bindings) || options.bindings.length < 1 || options.bindings.length > 32) invalid$1();
		this.#limits = {
			pollIntervalMs: limit(options.pollIntervalMs, 5e3, 1e3, 1e4),
			maxConcurrentProjects: limit(options.maxConcurrentProjects, 2, 1, 2),
			maxScopesPerPass: limit(options.maxScopesPerPass, 32, 1, 32),
			pageSize: limit(options.pageSize, 1, 1, 20)
		};
		const projects = /* @__PURE__ */ new Set();
		this.#scopes = options.bindings.map((input) => {
			const binding = Object.freeze({
				projectId: ids.project.parse(input.projectId),
				policyHash: sha256.parse(input.policyHash),
				principalId: opaqueKey.parse(input.principalId),
				backendRef: opaqueKey.parse(input.backendRef),
				runnerId: opaqueKey.parse(input.runnerId),
				backend: input.backend
			});
			if (projects.has(binding.projectId) || !binding.backend?.configured || [
				"preflight",
				"prepare",
				"inspect"
			].some((k) => typeof binding.backend[k] !== "function")) invalid$1();
			projects.add(binding.projectId);
			const check = (e) => {
				if (e.kind !== "DATASET_PREPARE" || e.previewId !== null || e.projectId !== binding.projectId || e.policyHash !== binding.policyHash || e.request.projectId !== binding.projectId || e.request.policyHash !== binding.policyHash || e.request.backendRef !== binding.backendRef || e.request.runnerId !== binding.runnerId) throw new StorageError("DATASET_RECOVERY_SCOPE_CHANGED", 409, "Original dataset binding changed");
			};
			const backend = binding.backend, preflight = backend.preflight.bind(backend), prepare = backend.prepare.bind(backend), inspect = backend.inspect.bind(backend);
			return {
				binding,
				manager: new DatasetPreparer(storage, binding.principalId, {
					get configured() {
						return backend.configured;
					},
					async preflight(e) {
						check(e);
						await preflight(e);
					},
					async prepare(e, authorize) {
						check(e);
						return prepare(e, authorize);
					},
					async inspect(e) {
						check(e);
						return inspect(e);
					}
				}),
				cursor: 0
			};
		});
	}
	static async create(storage, options) {
		const consumer = new PreviewDatasetConsumer(storage, options);
		for (const { binding: b } of consumer.#scopes) {
			const { policy } = await storage.request("getPreviewLifecycleScope", {
				principalId: b.principalId,
				projectId: b.projectId,
				policyHash: b.policyHash
			});
			if (policy.backendPrincipalId !== b.principalId || policy.backendRef !== b.backendRef || policy.runnerId !== b.runnerId) invalid$1();
		}
		return consumer;
	}
	tick() {
		if (this.#stop.signal.aborted) return Promise.resolve();
		return this.#pass ??= this.consume().finally(() => {
			this.#pass = void 0;
		});
	}
	async consume() {
		const count = Math.min(this.#limits.maxScopesPerPass, this.#scopes.length), scopes = Array.from({ length: count }, (_, i) => this.#scopes[(this.#nextScope + i) % this.#scopes.length]);
		this.#nextScope = (this.#nextScope + count) % this.#scopes.length;
		for (let i = 0; i < scopes.length && !this.#stop.signal.aborted; i += this.#limits.maxConcurrentProjects) await Promise.all(scopes.slice(i, i + this.#limits.maxConcurrentProjects).map((s) => this.consumeScope(s)));
	}
	async consumeScope(scope) {
		const { binding: b } = scope;
		try {
			if (this.#stop.signal.aborted) return;
			if (!b.backend.configured) throw new StorageError("DATASET_BACKEND_NOT_CONFIGURED", 503, "Original trusted backend unavailable");
			const page = await this.storage.request("listPreviewDatasetWork", {
				principalId: b.principalId,
				projectId: b.projectId,
				policyHash: b.policyHash,
				afterSequence: scope.cursor,
				limit: this.#limits.pageSize
			});
			scope.cursor = page.nextSequence ?? 0;
			for (const { effect: e } of page.items) {
				if (this.#stop.signal.aborted) return;
				if (e.projectId !== b.projectId || e.policyHash !== b.policyHash) throw new StorageError("DATASET_RECOVERY_SCOPE_CHANGED", 409, "Original dataset work changed");
				try {
					await scope.manager.advance(e.operationId);
				} catch (error) {
					this.recordError(error);
				}
			}
		} catch (error) {
			this.recordError(error);
		}
	}
	recordError(error) {
		if (this.#stop.signal.aborted) return;
		const code = error instanceof StorageError ? error.code : "";
		this.lastError = /^[A-Z][A-Z0-9_]{0,95}$/.test(code) ? code : "DATASET_RECOVERY_UNAVAILABLE";
	}
	start() {
		if (this.#loop || this.#stop.signal.aborted) throw new Error("Preview dataset consumer can only start once");
		this.#loop = (async () => {
			while (!this.#stop.signal.aborted) {
				await this.tick();
				try {
					await setTimeout$1(this.#limits.pollIntervalMs, void 0, { signal: this.#stop.signal });
				} catch {
					break;
				}
			}
		})();
	}
	stopAdmission() {
		this.#stop.abort();
		for (const s of this.#scopes) s.manager.stopAdmission();
	}
	stop() {
		this.stopAdmission();
		return this.#drain ??= Promise.all([this.#loop, this.#pass]).then(() => void 0);
	}
};
//#endregion
//#region src/preview-lifecycle.ts
var PreviewLifecycleManager = class {
	storage;
	principalId;
	backend;
	#timer;
	#tick;
	#closed = false;
	constructor(storage, principalId, backend) {
		this.storage = storage;
		this.principalId = principalId;
		this.backend = backend;
		opaqueKey.parse(principalId);
	}
	#subject(effect) {
		return {
			principalId: this.principalId,
			operationId: effect.operationId,
			requestHash: effect.requestHash
		};
	}
	#lifecycle(previewId) {
		return this.storage.request("getPreviewLifecycle", {
			principalId: this.principalId,
			previewId: ids.preview.parse(previewId)
		});
	}
	#configured() {
		if (this.#closed) throw new StorageError("PREVIEW_RECOVERY_CLOSED", 503, "The preview recovery controller is closed");
		if (!this.backend?.configured) throw new StorageError("PREVIEW_BACKEND_NOT_CONFIGURED", 503, "An explicit trusted preview execution backend is required");
		return this.backend;
	}
	async #runtime(before, result) {
		return this.storage.request("recordPreviewRuntimeObservation", {
			...this.#subject(before.startEffect),
			expectedSequence: before.runtime?.sequence ?? 0,
			fact: previewRuntimeFact.parse(result.fact)
		});
	}
	async advance(operationId) {
		let effect = await this.storage.request("getPreviewEffect", {
			principalId: this.principalId,
			operationId: ids.operation.parse(operationId)
		});
		if (effect.kind === "DATASET_PREPARE") throw new StorageError("PREVIEW_OPERATION_REQUIRED", 422, "Use the dataset preparer for data operations");
		if (effect.state === "SUCCEEDED" || effect.state === "FAILED") return effect;
		const backend = this.#configured();
		let before = await this.#lifecycle(effect.previewId), dispatch = false;
		this.#configured();
		if (effect.kind === "PREVIEW_START" && effect.state === "PREPARED" && Date.parse(before.preview.expiresAt) <= Date.now()) return this.storage.request("recordPreviewEffectObservation", {
			...this.#subject(effect),
			expectedRevision: effect.revision,
			observation: {
				state: "FAILED",
				errorCode: "PREVIEW_EXPIRED_WITHOUT_DISPATCH",
				absenceVerified: true
			}
		});
		if (effect.state === "PREPARED") {
			await backend.preflight(effect, before.datasetEffect);
			this.#configured();
			const grant = await this.storage.request("markPreviewEffectSent", {
				...this.#subject(effect),
				expectedRevision: effect.revision
			});
			effect = grant.effect;
			dispatch = grant.dispatch;
			if (effect.state === "SUCCEEDED" || effect.state === "FAILED") return effect;
		}
		before = await this.#lifecycle(effect.previewId);
		this.#configured();
		let result;
		try {
			result = dispatch ? await backend.execute(effect, before.datasetEffect, async () => {
				if (this.#closed) return false;
				const allowed = await this.storage.request("verifyPreviewExecution", this.#subject(effect));
				return !this.#closed && allowed.allowed;
			}) : await backend.inspect(effect);
		} catch {
			result = {
				observation: {
					state: "UNKNOWN",
					errorCode: "PREVIEW_BACKEND_UNCERTAIN"
				},
				fact: previewRuntimeFact.parse({
					previewId: effect.previewId,
					datasetId: effect.datasetId,
					imageDigest: before.preview.imageDigest,
					state: "UNKNOWN",
					instanceId: null,
					endpoint: null,
					checkedAt: (/* @__PURE__ */ new Date()).toISOString()
				})
			};
		}
		await this.#runtime(before, result);
		const current = await this.storage.request("getPreviewEffect", {
			principalId: this.principalId,
			operationId: effect.operationId
		});
		if (current.state === "SUCCEEDED" || current.state === "FAILED") return current;
		return this.storage.request("recordPreviewEffectObservation", {
			...this.#subject(current),
			expectedRevision: current.revision,
			observation: result.observation
		});
	}
	async reconcilePreview(previewId) {
		let current = await this.#lifecycle(previewId);
		const backend = this.#configured();
		if (!["SUCCEEDED", "FAILED"].includes(current.startEffect.state)) await this.advance(current.startEffect.operationId);
		else if (current.startEffect.state === "SUCCEEDED" && !["STOPPED", "EXPIRED"].includes(current.preview.state)) {
			let result;
			try {
				result = await backend.inspect(current.startEffect);
			} catch {
				result = {
					observation: {
						state: "UNKNOWN",
						errorCode: "PREVIEW_BACKEND_UNCERTAIN"
					},
					fact: previewRuntimeFact.parse({
						previewId,
						datasetId: current.preview.datasetId,
						imageDigest: current.preview.imageDigest,
						state: "UNKNOWN",
						instanceId: null,
						endpoint: null,
						checkedAt: (/* @__PURE__ */ new Date()).toISOString()
					})
				};
			}
			await this.#runtime(current, result);
		}
		current = await this.#lifecycle(previewId);
		if (current.stopEffect && !["SUCCEEDED", "FAILED"].includes(current.stopEffect.state)) await this.advance(current.stopEffect.operationId);
		current = await this.#lifecycle(previewId);
		if (!current.accepted && !current.stopEffect && current.preview.instanceId && [
			"READY",
			"STARTING",
			"UNKNOWN"
		].includes(current.preview.state) && Date.parse(current.preview.expiresAt) <= Date.now()) {
			this.#configured();
			const stopped = await this.storage.request("preparePreviewExpiry", {
				principalId: this.principalId,
				previewId
			});
			await this.advance(stopped.stopOperationId);
		}
		return (await this.#lifecycle(previewId)).preview;
	}
	async reconcilePage(input) {
		const page = await this.storage.request("listPreviewLifecycles", {
			principalId: this.principalId,
			projectId: ids.project.parse(input.projectId),
			policyHash: sha256.parse(input.policyHash),
			...input.afterSequence === void 0 ? {} : { afterSequence: input.afterSequence },
			...input.limit === void 0 ? {} : { limit: input.limit }
		}), results = [];
		for (const item of page.items) {
			if (this.#closed) break;
			const id = item.lifecycle.preview.previewId;
			try {
				const preview = await this.reconcilePreview(id);
				results.push({
					previewId: id,
					state: preview.state,
					errorCode: null
				});
			} catch (error) {
				results.push({
					previewId: id,
					state: item.lifecycle.preview.state,
					errorCode: error instanceof StorageError ? error.code : "PREVIEW_RECOVERY_UNAVAILABLE"
				});
			}
		}
		return {
			results,
			nextSequence: page.nextSequence
		};
	}
	async start(scopes, options = {}) {
		const interval = options.pollIntervalMs ?? 1e4;
		if (this.#timer || this.#tick || this.#closed || scopes.length < 1 || scopes.length > 32 || !Number.isInteger(interval) || interval < 1e3 || interval > 3e4) throw new StorageError("PREVIEW_RECOVERY_CONFIG_INVALID", 422, "A bounded explicit recovery scope is required");
		this.#configured();
		const fixed = scopes.map((s) => ({
			projectId: ids.project.parse(s.projectId),
			policyHash: sha256.parse(s.policyHash)
		}));
		const cycle = async () => {
			for (const scope of fixed) {
				if (this.#closed) break;
				let cursor;
				do {
					const page = await this.reconcilePage({
						...scope,
						...cursor === void 0 ? {} : { afterSequence: cursor }
					});
					for (const r of page.results) if (r.errorCode) options.onError?.(r.errorCode);
					cursor = page.nextSequence ?? void 0;
				} while (cursor !== void 0 && !this.#closed);
			}
		};
		this.#tick = cycle();
		try {
			await this.#tick;
		} finally {
			this.#tick = void 0;
		}
		if (!this.#closed) {
			this.#timer = setInterval(() => {
				if (!this.#tick) this.#tick = cycle().catch(() => options.onError?.("PREVIEW_RECOVERY_UNAVAILABLE")).finally(() => {
					this.#tick = void 0;
				});
			}, interval);
			this.#timer.unref();
		}
	}
	stopAdmission() {
		this.#closed = true;
		clearInterval(this.#timer);
	}
	async close() {
		this.stopAdmission();
		await this.#tick;
	}
};
//#endregion
//#region src/preview-consumer.ts
const invalid = () => {
	throw new StorageError("PREVIEW_CONSUMER_CONFIG_INVALID", 422, "Explicit bounded trusted preview bindings are required");
};
/** Original preview lifecycle recovery only. No dataset creation or acceptance. */
var PreviewLifecycleConsumer = class PreviewLifecycleConsumer {
	storage;
	#stop = new AbortController();
	#scopes;
	#limits;
	#nextScope = 0;
	#loop;
	#pass;
	#drain;
	lastError = null;
	constructor(storage, options) {
		this.storage = storage;
		const limit = (v, fallback, min, max) => {
			const n = v ?? fallback;
			if (!Number.isSafeInteger(n) || n < min || n > max) invalid();
			return n;
		};
		if (!Array.isArray(options.bindings) || options.bindings.length < 1 || options.bindings.length > 32) invalid();
		this.#limits = {
			pollIntervalMs: limit(options.pollIntervalMs, 5e3, 1e3, 1e4),
			maxConcurrentProjects: limit(options.maxConcurrentProjects, 2, 1, 2),
			maxScopesPerPass: limit(options.maxScopesPerPass, 32, 1, 32),
			pageSize: limit(options.pageSize, 1, 1, 20)
		};
		const projects = /* @__PURE__ */ new Set();
		this.#scopes = options.bindings.map((input) => {
			const binding = Object.freeze({
				projectId: ids.project.parse(input.projectId),
				policyHash: sha256.parse(input.policyHash),
				principalId: opaqueKey.parse(input.principalId),
				backendRef: opaqueKey.parse(input.backendRef),
				runnerId: opaqueKey.parse(input.runnerId),
				backend: input.backend
			});
			if (projects.has(binding.projectId) || !binding.backend?.configured || [
				"preflight",
				"execute",
				"inspect"
			].some((k) => typeof binding.backend[k] !== "function")) invalid();
			projects.add(binding.projectId);
			const check = (e) => {
				if (e.projectId !== binding.projectId || e.policyHash !== binding.policyHash || e.request.projectId !== binding.projectId || e.request.policyHash !== binding.policyHash || e.request.backendRef !== binding.backendRef || e.request.runnerId !== binding.runnerId) throw new StorageError("PREVIEW_RECOVERY_SCOPE_CHANGED", 409, "Original preview binding changed");
			};
			const backend = binding.backend, preflight = backend.preflight.bind(backend), execute = backend.execute.bind(backend), inspect = backend.inspect.bind(backend);
			return {
				binding,
				manager: new PreviewLifecycleManager(storage, binding.principalId, {
					get configured() {
						return backend.configured;
					},
					async preflight(e, d) {
						check(e);
						check(d);
						await preflight(e, d);
					},
					async execute(e, d, authorize) {
						check(e);
						check(d);
						return execute(e, d, authorize);
					},
					async inspect(e) {
						check(e);
						return inspect(e);
					}
				}),
				cursor: 0
			};
		});
	}
	static async create(storage, options) {
		const consumer = new PreviewLifecycleConsumer(storage, options);
		for (const { binding: b } of consumer.#scopes) {
			const { policy } = await storage.request("getPreviewLifecycleScope", {
				principalId: b.principalId,
				projectId: b.projectId,
				policyHash: b.policyHash
			});
			if (policy.backendPrincipalId !== b.principalId || policy.backendRef !== b.backendRef || policy.runnerId !== b.runnerId) invalid();
		}
		return consumer;
	}
	tick() {
		if (this.#stop.signal.aborted) return Promise.resolve();
		return this.#pass ??= this.consume().finally(() => {
			this.#pass = void 0;
		});
	}
	async consume() {
		const count = Math.min(this.#limits.maxScopesPerPass, this.#scopes.length), scopes = Array.from({ length: count }, (_, i) => this.#scopes[(this.#nextScope + i) % this.#scopes.length]);
		this.#nextScope = (this.#nextScope + count) % this.#scopes.length;
		for (let i = 0; i < scopes.length && !this.#stop.signal.aborted; i += this.#limits.maxConcurrentProjects) await Promise.all(scopes.slice(i, i + this.#limits.maxConcurrentProjects).map((s) => this.consumeScope(s)));
	}
	async consumeScope(scope) {
		const { binding: b } = scope;
		try {
			if (this.#stop.signal.aborted) return;
			if (!b.backend.configured) throw new StorageError("PREVIEW_BACKEND_NOT_CONFIGURED", 503, "Original trusted backend unavailable");
			const page = await this.storage.request("listPreviewLifecycles", {
				principalId: b.principalId,
				projectId: b.projectId,
				policyHash: b.policyHash,
				afterSequence: scope.cursor,
				limit: this.#limits.pageSize
			});
			scope.cursor = page.nextSequence ?? 0;
			for (const { lifecycle: l } of page.items) {
				if (this.#stop.signal.aborted) return;
				if (l.preview.projectId !== b.projectId || l.preview.policyHash !== b.policyHash) throw new StorageError("PREVIEW_RECOVERY_SCOPE_CHANGED", 409, "Original preview work changed");
				try {
					await scope.manager.reconcilePreview(l.preview.previewId);
				} catch (error) {
					this.recordError(error);
				}
			}
		} catch (error) {
			this.recordError(error);
		}
	}
	recordError(error) {
		if (this.#stop.signal.aborted) return;
		const code = error instanceof StorageError ? error.code : "";
		this.lastError = /^[A-Z][A-Z0-9_]{0,95}$/.test(code) ? code : "PREVIEW_RECOVERY_UNAVAILABLE";
	}
	start() {
		if (this.#loop || this.#stop.signal.aborted) throw new Error("Preview lifecycle consumer can only start once");
		this.#loop = (async () => {
			while (!this.#stop.signal.aborted) {
				await this.tick();
				try {
					await setTimeout$1(this.#limits.pollIntervalMs, void 0, { signal: this.#stop.signal });
				} catch {
					break;
				}
			}
		})();
	}
	stopAdmission() {
		this.#stop.abort();
		for (const s of this.#scopes) s.manager.stopAdmission();
	}
	stop() {
		this.stopAdmission();
		return this.#drain ??= Promise.all([this.#loop, this.#pass]).then(async () => {
			await Promise.all(this.#scopes.map((s) => s.manager.close()));
		});
	}
};
//#endregion
//#region src/index.ts
async function startPlatform(config, options = {}) {
	const previewPolicies = options.previewPolicies ? Object.freeze({ ...options.previewPolicies }) : void 0;
	const acceptancePolicies = options.acceptancePolicies ? Object.freeze({ ...options.acceptancePolicies }) : void 0;
	if (config.a2a && !config.storage) throw new Error("A2A requires explicitly initialized durable storage");
	if (config.runtime && (!config.storage || !config.a2a)) throw new Error("Runtime requires durable storage and hosted A2A endpoints");
	if (config.inputApi && !config.storage) throw new Error("Input API requires durable storage");
	if (options.workbenchEvents && !config.inputApi) throw new Error("Workbench events require the configured Input API");
	if (config.releaseExports && !config.storage) throw new Error("Release exports require durable storage");
	if (options.previewPolicies && !config.inputApi) throw new Error("Preview management requires the explicitly configured Input API");
	if (options.previewGateway && !config.inputApi) throw new Error("Preview entry requires the explicitly configured Input API");
	if (options.acceptancePolicies && !config.inputApi) throw new Error("Acceptance entry requires the explicitly configured Input API");
	if (options.acceptancePreparation && (!config.storage || !config.inputApi || !acceptancePolicies)) throw new Error("Acceptance preparation requires durable storage, Input API and explicit acceptance policies");
	if (options.acceptanceAbort && !config.storage) throw new Error("Acceptance abort requires durable storage");
	if (options.releasePublication && !config.storage) throw new Error("Release publication requires durable storage");
	if (options.previewDatasets && !config.storage) throw new Error("Preview datasets require durable storage");
	if (options.previewLifecycle && !config.storage) throw new Error("Preview lifecycle requires durable storage");
	if (options.mcp && !config.storage) throw new Error("MCP services require durable storage");
	if (options.workspaceLifecycle && !config.runtime) throw new Error("Managed workspaces require an explicitly configured Runtime");
	if (options.scheduler && (!config.runtime || !config.a2a?.identities.some((identity) => identity.principalId === options.scheduler?.callerId))) throw new Error("Scheduler requires configured Runtime and an internal service identity");
	const inputModule = config.inputApi ? await import("@devmesh/input-api") : void 0;
	const inputBaseline = config.inputApi ? await inputModule.resolveTemplateBaseline(config.inputApi.repositoryRoot, config.inputApi.commit, config.inputApi.templatePath) : void 0;
	const runtimeModule = config.runtime ? await import("@devmesh/agent-runtime") : void 0;
	const runtimeConfig = runtimeModule?.parseRuntimeConfig(config.runtime);
	if (runtimeConfig?.preparation && !config.inputApi) throw new Error("Preparation requires the input API and its trusted baseline");
	const context = new Context();
	let services;
	const storageFiber = config.storage ? context.plugin({
		name: "devmesh-local-storage",
		async apply(scope) {
			await scope.effect(async () => {
				const { openLocalStorage, LocalContentStore, SessionStore } = await import("@devmesh/blob-store");
				const local = await openLocalStorage(config.storage);
				try {
					const content = new LocalContentStore(local.storage, local.dataRoot, local.minimumFreeBytes), sessions = new SessionStore(content);
					await content.recoverPublished();
					await local.storage.request("recoverUploadIntakes", {});
					const integrity = await content.verifyAll();
					if (integrity.failures.length) throw new Error(`Storage integrity blocked startup: ${integrity.failures.length} unavailable objects`);
					services = {
						local,
						content,
						sessions
					};
					return () => local.close();
				} catch (error) {
					await local.close();
					throw error;
				}
			}, "devmesh.storage");
		}
	}) : void 0;
	if (storageFiber) await storageFiber;
	const sockets = /* @__PURE__ */ new Set();
	let ready = false;
	let cleanupError;
	const app = express();
	app.disable("x-powered-by");
	app.disable("etag");
	app.get("/healthz", (_request, response) => {
		response.json({
			status: "ok",
			component: "devmesh-server",
			scope: "platform-foundation"
		});
	});
	app.get("/readyz", (_request, response) => {
		response.status(ready ? 200 : 503).json({
			status: ready ? "ready" : "starting-or-stopping",
			scope: "platform-foundation"
		});
	});
	let agents;
	let consumer;
	let preparationConsumer;
	let scheduler;
	let a2aModule;
	let inputApi;
	let mcp;
	let releaseExports;
	let acceptancePreparation;
	let releasePublication;
	let acceptanceAbort;
	let previewLifecycle;
	let previewDatasets;
	try {
		if (config.a2a && services) {
			a2aModule = await import("@devmesh/a2a-adapter");
			agents = a2aModule.mountInternalAgents(app, services.local.storage, {
				...config.a2a,
				resolveCredential: options.resolveCredential ?? a2aModule.environmentCredentials()
			});
		}
	} catch (error) {
		await storageFiber?.dispose();
		throw error;
	}
	try {
		if (inputModule && inputBaseline && services) {
			const acceptor = acceptancePolicies ? new ReleaseAcceptor(services.local.storage, services.content) : void 0;
			inputApi = inputModule.mountInputApi(app, services.content, {
				enabled: true,
				baseline: inputBaseline,
				identityResolver: options.identityResolver,
				events: {
					...options.workbenchEvents,
					closeTimeoutMs: Math.min(options.workbenchEvents?.closeTimeoutMs ?? 250, config.shutdownTimeoutMs)
				},
				previewGateway: options.previewGateway,
				previewPolicies,
				...acceptor ? { acceptance: {
					policies: acceptancePolicies,
					commit: (input) => acceptor.accept(input)
				} } : {}
			});
		}
	} catch (error) {
		await agents?.stop();
		await storageFiber?.dispose();
		throw error;
	}
	app.use((_request, response) => {
		response.status(404).json({ error: "NOT_FOUND" });
	});
	const server = createServer({
		headersTimeout: 5e3,
		requestTimeout: config.inputApi ? 35e3 : 1e4
	}, app);
	if (inputApi?.enabled) inputApi.attachEvents(server);
	server.on("connection", (socket) => {
		sockets.add(socket);
		socket.once("close", () => sockets.delete(socket));
	});
	const fiber = context.plugin({
		name: "devmesh-http-foundation",
		async apply(scope) {
			await scope.effect(async () => {
				await new Promise((resolve, reject) => {
					const failed = (error) => {
						server.off("listening", listening);
						reject(error);
					};
					const listening = () => {
						server.off("error", failed);
						resolve();
					};
					server.once("error", failed);
					server.once("listening", listening);
					server.listen({
						host: config.host,
						port: config.port
					});
				});
				return async () => {
					ready = false;
					const connectionsClosed = [...sockets].map((socket) => new Promise((resolve) => {
						socket.once("close", () => resolve());
					}));
					const timer = setTimeout(() => {
						server.closeAllConnections();
						for (const socket of sockets) socket.destroy();
					}, config.shutdownTimeoutMs);
					timer.unref();
					try {
						await Promise.all([new Promise((resolve, reject) => {
							server.close((error) => error ? reject(error) : resolve());
						}), ...connectionsClosed]);
					} catch (error) {
						cleanupError = error;
						throw error;
					} finally {
						clearTimeout(timer);
					}
				};
			}, "devmesh.http");
		}
	});
	async function releaseServices() {
		inputApi?.stopAdmission();
		acceptancePreparation?.stopAdmission();
		releasePublication?.stopAdmission();
		acceptanceAbort?.stopAdmission();
		previewLifecycle?.stopAdmission();
		previewDatasets?.stopAdmission();
		mcp?.stopAdmission();
		const failures = [];
		const actions = [
			() => inputApi?.stop(),
			() => previewLifecycle?.stop(),
			() => previewDatasets?.stop(),
			() => acceptancePreparation?.stop(),
			() => releasePublication?.stop(),
			() => acceptanceAbort?.stop(),
			() => releaseExports?.stop(),
			() => scheduler?.stop(),
			() => preparationConsumer?.stop(),
			() => consumer?.stop(),
			() => mcp?.close(),
			() => agents?.stop(),
			() => fiber.dispose(),
			() => storageFiber?.dispose()
		];
		for (const action of actions) try {
			await action();
		} catch (error) {
			failures.push(error);
		}
		if (failures.length) {
			server.closeAllConnections();
			for (const socket of sockets) socket.destroy();
			throw new AggregateError(failures, "Platform resource release failed");
		}
	}
	try {
		await fiber;
		if (agents) await agents.activate();
		if (options.acceptancePreparation && services) {
			const configured = await options.acceptancePreparation(services);
			if (!Array.isArray(configured.bindings) || configured.bindings.some((b) => acceptancePolicies?.[b.projectId] !== b.policyHash)) throw new Error("Acceptance preparation binding must match the startup acceptance policy snapshot");
			acceptancePreparation = await AcceptancePreparationConsumer.create(services.local.storage, configured);
			acceptancePreparation.start();
		}
		if (options.acceptanceAbort && services) acceptanceAbort = await AcceptanceAbortConsumer.create(services.local.storage, await options.acceptanceAbort(services));
		if (options.releasePublication && services) releasePublication = await ReleasePublicationConsumer.create(services.local.storage, await options.releasePublication(services));
		if (options.previewDatasets && services) previewDatasets = await PreviewDatasetConsumer.create(services.local.storage, await options.previewDatasets(services));
		if (options.previewLifecycle && services) previewLifecycle = await PreviewLifecycleConsumer.create(services.local.storage, await options.previewLifecycle(services));
		if (options.mcp && services) {
			const { startWorkflowMcpServices } = await import("@devmesh/mcp-tools");
			mcp = await startWorkflowMcpServices(services.local.storage, services.content, await options.mcp(services));
		}
		if (config.releaseExports && services) {
			const { LocalReleaseExportSources } = await import("@devmesh/code-workspaces");
			releaseExports = new ReleaseExportScheduler(services.content, new LocalReleaseExportSources(services.local.dataRoot), config.releaseExports);
			releaseExports.start();
		}
		if (runtimeConfig && services && runtimeModule) {
			const { DeepSeekProvider, AgentRuntime, RuntimeConsumer } = runtimeModule;
			const credentials = options.resolveCredential ?? a2aModule.environmentCredentials();
			const providers = runtimeConfig.providers.map((p) => new DeepSeekProvider(p, credentials));
			const runtime = new AgentRuntime(services.local.storage, services.content, providers, [...options.runtimeTools ?? [], ...mcp?.tools ?? []], runtimeConfig.tokenLimit, await options.workspaceLifecycle?.(services));
			const localEndpoints = config.a2a.manifest.endpoints.filter((e) => e.hosting === "local" && e.enabled);
			consumer = new RuntimeConsumer(services.local.storage, runtime, localEndpoints.map((e) => e.endpointId), "runtime.local");
			await consumer.start();
			if (options.scheduler) {
				const { WorkflowScheduler } = await import("./scheduler.mjs");
				scheduler = new WorkflowScheduler(services.local.storage, agents.registry, credentials, options.scheduler);
				scheduler.start();
			}
			const prep = runtimeConfig.preparation;
			if (prep) {
				const { PreparationRuntime, PreparationConsumer } = runtimeModule;
				if (!config.a2a.identities.some((identity) => identity.principalId === prep.callerId)) throw new Error("Preparation caller must be a configured internal identity");
				preparationConsumer = new PreparationConsumer(new PreparationRuntime(services.content, agents.registry, credentials, {
					callerId: prep.callerId,
					workerId: "preparation.local",
					tokenLimit: runtimeConfig.tokenLimit,
					maxInputBytes: prep.maxInputBytes,
					maxOutputTokens: prep.maxOutputTokens,
					providers: {
						product: providers.find((p) => p.config.providerId === prep.productProviderId),
						architect: providers.find((p) => p.config.providerId === prep.architectProviderId)
					},
					available: async (provider) => !!await credentials(provider.config.credentialRef),
					...prep.bootstrapPaths.length ? { bootstrap: {
						repositoryRoot: config.inputApi.repositoryRoot,
						paths: prep.bootstrapPaths
					} } : {}
				}), localEndpoints.filter((e) => e.supportedSkills.includes("devmesh.prepare." + e.role)).map((e) => e.endpointId));
				await preparationConsumer.start();
			}
		}
		acceptanceAbort?.start();
		releasePublication?.start();
		previewDatasets?.start();
		previewLifecycle?.start();
		ready = true;
	} catch (error) {
		await releaseServices().catch(() => {});
		server.closeAllConnections();
		for (const socket of sockets) socket.destroy();
		throw error;
	}
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("HTTP server did not acquire a TCP address");
	let stopping;
	return {
		address: Object.freeze({ ...address }),
		...services ? { services } : {},
		...agents ? { agents } : {},
		...consumer ? { consumer } : {},
		...preparationConsumer ? { preparationConsumer } : {},
		...scheduler ? { scheduler } : {},
		...inputApi ? { inputApi } : {},
		...mcp ? { mcp } : {},
		...releaseExports ? { releaseExports } : {},
		...acceptancePreparation ? { acceptancePreparation } : {},
		...releasePublication ? { releasePublication } : {},
		...acceptanceAbort ? { acceptanceAbort } : {},
		...previewLifecycle ? { previewLifecycle } : {},
		...previewDatasets ? { previewDatasets } : {},
		stop() {
			ready = false;
			inputApi?.stopAdmission();
			acceptancePreparation?.stopAdmission();
			releasePublication?.stopAdmission();
			acceptanceAbort?.stopAdmission();
			previewLifecycle?.stopAdmission();
			previewDatasets?.stopAdmission();
			mcp?.stopAdmission();
			stopping ??= (async () => {
				await releaseServices();
				if (cleanupError) throw cleanupError;
				if (server.listening || sockets.size !== 0) throw new Error("HTTP resources remained active after Cordis disposal");
			})();
			return stopping;
		}
	};
}
//#endregion
export { AcceptanceAbortConsumer, AcceptancePreparationConsumer, AcceptancePreparer, ConfigError, DatasetPreparer, PreviewDatasetConsumer, PreviewLifecycleConsumer, PreviewLifecycleManager, ReleaseAcceptor, ReleaseExportScheduler, ReleasePublicationConsumer, ReleasePublisher, loadConfig, startPlatform };

//# sourceMappingURL=index.mjs.map