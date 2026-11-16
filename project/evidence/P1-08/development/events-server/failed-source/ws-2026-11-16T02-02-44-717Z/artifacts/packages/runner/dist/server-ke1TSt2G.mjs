import { l as startJob, n as attemptKey, s as renewJob, t as RunnerError } from "./protocol-CrzCRB9P.mjs";
import { n as releaseWorkspaceFence, t as acquireWorkspaceFence } from "./workspace-fence-BX3LCM3x.mjs";
import { z } from "zod";
import { assertPermit, executionPermit, opaqueKey, parseContract } from "@devmesh/contracts";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { link, lstat, mkdir, open, realpath, unlink } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { assertSeparate, canonicalRoot, safePath } from "@devmesh/blob-store";
import { acquireWriterLock, canonical } from "@devmesh/storage-sqlite";
import { Worker } from "node:worker_threads";
import { performance } from "node:perf_hooks";
import { closeSync, constants, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import express from "express";
//#region src/policy.ts
var RunnerPolicy = class {
	config;
	constructor(config) {
		const freeze = (v) => {
			if (v && typeof v === "object") {
				for (const child of Object.values(v)) freeze(child);
				Object.freeze(v);
			}
		};
		this.config = structuredClone(config);
		freeze(this.config);
	}
	async validate(input, stored) {
		const request = startJob.parse(input), c = this.config, limits = request.resourceLimits;
		if (!c.imageDigests.includes(request.imageDigest) || request.networkPolicyRef !== "none") throw new RunnerError("RUNNER_POLICY_DENIED", 403);
		if (limits.cpu > c.maximumCpu || limits.memoryMiB > c.maximumMemoryMiB || limits.temporaryMiB > c.maximumTemporaryMiB) throw new RunnerError("RUNNER_RESOURCE_LIMIT", 422);
		const argv = c.commands[request.commandSpec.kind];
		if (!argv?.length || argv.some((v) => typeof v !== "string" || v.includes("\0"))) throw new RunnerError("RUNNER_COMMAND_DENIED", 403);
		const configured = c.workspaces[request.workspaceRef];
		if (configured && stored && canonical(configured) !== canonical(stored)) throw new RunnerError("RUNNER_WORKSPACE_BINDING_CHANGED", 409);
		const w = configured ?? stored;
		if (!w) throw new RunnerError("RUNNER_WORKSPACE_DENIED", 403);
		const { root, path } = await this.workspacePath(request.permit, w);
		let current = root;
		for (const component of w.relativePath.replaceAll("\\", "/").split("/")) {
			current = resolve(current, component);
			const stat = await lstat(current);
			if (stat.isSymbolicLink() || !stat.isDirectory()) throw new RunnerError("RUNNER_WORKSPACE_DENIED", 403);
		}
		if (await realpath(path) !== path) throw new RunnerError("RUNNER_WORKSPACE_DENIED", 403);
		return {
			request,
			workspacePath: path,
			argv
		};
	}
	async workspacePath(permit, w, cleanup = false) {
		if (w.ownerKind !== permit.ownerKind || w.attemptId !== attemptKey(permit)) throw new RunnerError("RUNNER_WORKSPACE_DENIED", 403);
		permit = parseContract(executionPermit, permit);
		if (cleanup) {
			if (!permit.resources.some((r) => r.kind === "workspace" && r.resourceId === w.resourceId)) throw new RunnerError("RUNNER_WORKSPACE_DENIED", 403);
		} else try {
			assertPermit(permit, permit, {
				kind: "workspace",
				resourceId: w.resourceId,
				access: "write"
			}, Date.now());
		} catch {
			throw new RunnerError("RUNNER_WORKSPACE_DENIED", 403);
		}
		canonicalRoot(this.config.dataRoot);
		const root = await realpath(this.config.dataRoot), path = resolve(root, w.relativePath), expected = (permit.ownerKind === "workflowAttempt" ? "workspaces/" : "invocations/") + attemptKey(permit) + (w.sourceDirectory === "repo" ? "/repo" : "");
		if (w.relativePath.replaceAll("\\", "/") !== expected || !path.startsWith(root + sep) || [
			"\0",
			"\r",
			"\n",
			","
		].some((c) => path.includes(c))) throw new RunnerError("RUNNER_WORKSPACE_DENIED", 403);
		canonicalRoot(path);
		return {
			root,
			path
		};
	}
	async fence(input, stored) {
		if (input.permit.ownerKind !== "workflowAttempt") throw new RunnerError("RUNNER_WORKSPACE_DENIED", 403);
		const configured = this.config.workspaces[input.workspaceRef];
		if (configured && stored && canonical(configured) !== canonical(stored)) throw new RunnerError("RUNNER_WORKSPACE_BINDING_CHANGED", 409);
		const binding = configured ?? stored ?? {
			attemptId: input.permit.attemptId,
			ownerKind: "workflowAttempt",
			resourceId: input.workspaceRef,
			relativePath: "workspaces/" + input.permit.attemptId + "/repo",
			sourceDirectory: "repo"
		};
		return {
			binding,
			workspacePath: (await this.workspacePath(input.permit, binding, input.purpose === "cleanup")).path
		};
	}
};
//#endregion
//#region src/store.ts
var RunnerStore = class {
	options;
	#worker;
	#pending = /* @__PURE__ */ new Map();
	#exited;
	ready;
	#id = 0;
	#closed = false;
	#closeError;
	constructor(options) {
		this.options = options;
		const capacity = options.queueCapacity ?? 128;
		if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 1e3) throw new RunnerError("RUNNER_QUEUE_INVALID", 422);
		const lock = acquireWriterLock(options.databasePath, options.recoveryToken);
		try {
			this.#worker = new Worker(new URL("./worker.mjs", import.meta.url), {
				workerData: options,
				execArgv: []
			});
		} catch (error) {
			lock.release();
			throw error;
		}
		let ready, failed;
		this.ready = new Promise((resolve, reject) => {
			ready = resolve;
			failed = reject;
		});
		this.#exited = new Promise((resolve) => this.#worker.once("exit", () => {
			this.#closed = true;
			const error = new RunnerError("RUNNER_STORE_OUTCOME_UNKNOWN", 503, "unknown");
			failed(error);
			for (const p of this.#pending.values()) p.reject(error);
			this.#pending.clear();
			try {
				lock.release();
			} catch (error) {
				this.#closeError = error;
			} finally {
				resolve();
			}
		}));
		this.#worker.on("error", failed);
		this.#worker.on("message", (m) => {
			if (m.id === 0) {
				if (m.error) failed(new RunnerError(m.error.code, m.error.status));
				else ready();
				return;
			}
			const p = this.#pending.get(m.id);
			if (!p) return;
			this.#pending.delete(m.id);
			if (m.error) p.reject(new RunnerError(m.error.code, m.error.status));
			else p.resolve(m.value);
		});
	}
	request(method, input) {
		if (this.#closed) return Promise.reject(new RunnerError("RUNNER_STORE_CLOSED", 503, "not-sent"));
		if (this.#pending.size >= (this.options.queueCapacity ?? 128)) return Promise.reject(new RunnerError("RUNNER_STORE_BUSY", 503, "not-sent"));
		if (Buffer.byteLength(JSON.stringify(input), "utf8") > 256 * 1024) return Promise.reject(new RunnerError("RUNNER_REQUEST_TOO_LARGE", 413, "not-sent"));
		const id = ++this.#id;
		return new Promise((resolve, reject) => {
			this.#pending.set(id, {
				resolve,
				reject
			});
			try {
				this.#worker.postMessage({
					id,
					method,
					input
				});
			} catch (error) {
				this.#pending.delete(id);
				reject(error);
			}
		});
	}
	async close() {
		if (!this.#closed) {
			this.#closed = true;
			this.#worker.postMessage({
				id: -1,
				method: "close"
			});
		}
		await this.#exited;
		if (this.#closeError) throw this.#closeError;
	}
	async terminate() {
		this.#closed = true;
		await this.#worker.terminate();
		await this.#exited;
	}
};
async function openRunnerStore(options) {
	const store = new RunnerStore(options);
	try {
		await store.ready;
		return store;
	} catch (error) {
		await store.terminate();
		throw error;
	}
}
//#endregion
//#region src/materials.ts
var RunnerMaterials = class {
	root;
	maximumBytes;
	constructor(root, maximumBytes = 64 * 1024 * 1024) {
		this.root = root;
		this.maximumBytes = maximumBytes;
		canonicalRoot(root);
	}
	async put(job, name, bytes) {
		const directory = join(this.root, "job-outputs", job.jobId);
		canonicalRoot(directory);
		await mkdir(directory, {
			recursive: true,
			mode: 448
		});
		const sha256 = createHash("sha256").update(bytes).digest("hex"), path = join(directory, sha256 + "-" + name), temp = join(directory, ".pending-" + randomUUID());
		const file = await open(temp, "wx", 384);
		try {
			await file.writeFile(bytes);
			await file.sync();
		} finally {
			await file.close();
		}
		try {
			await link(temp, path);
		} catch (error) {
			if (error.code !== "EEXIST") throw error;
			const previous = await this.read("job-outputs/" + job.jobId + "/" + sha256 + "-" + name);
			if (previous.length !== bytes.length || createHash("sha256").update(previous).digest("hex") !== sha256) throw new RunnerError("RUNNER_OUTPUT_CORRUPT", 409);
		} finally {
			await unlink(temp);
		}
		return {
			path: "job-outputs/" + job.jobId + "/" + sha256 + "-" + name,
			sha256,
			byteSize: bytes.length
		};
	}
	async collect(job, workspacePath, backend) {
		const log = await backend.logs(job);
		if (log.byteLength > 1024 * 1024) throw new RunnerError("RUNNER_LOG_LIMIT", 413);
		const outputRefs = [await this.put(job, "container.log", log)];
		let total = log.byteLength;
		canonicalRoot(workspacePath);
		for (const [index, name] of job.request.outputSpec.entries()) {
			const parts = name.split("/");
			let current = workspacePath;
			for (const part of parts.slice(0, -1)) {
				current = join(current, part);
				const s = await lstat(current);
				if (s.isSymbolicLink() || !s.isDirectory()) throw new RunnerError("RUNNER_OUTPUT_LINK_DENIED", 403);
			}
			const path = join(workspacePath, ...parts), s = await lstat(path);
			if (s.isSymbolicLink() || !s.isFile() || s.nlink !== 1 || s.size > this.maximumBytes - total) throw new RunnerError("RUNNER_OUTPUT_LIMIT", 413);
			const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
			let bytes;
			try {
				const opened = await file.stat();
				if (opened.dev !== s.dev || opened.ino !== s.ino || opened.nlink !== 1 || !opened.isFile() || opened.size !== s.size) throw new RunnerError("RUNNER_OUTPUT_CHANGED", 409);
				bytes = Buffer.alloc(opened.size);
				let position = 0;
				while (position < bytes.length) {
					const r = await file.read(bytes, position, bytes.length - position, position);
					if (!r.bytesRead) throw new RunnerError("RUNNER_OUTPUT_CHANGED", 409);
					position += r.bytesRead;
				}
				const after = await file.stat();
				if (after.size !== opened.size || after.mtimeMs !== opened.mtimeMs) throw new RunnerError("RUNNER_OUTPUT_CHANGED", 409);
			} finally {
				await file.close();
			}
			total += bytes.length;
			outputRefs.push(await this.put(job, "output-" + index, bytes));
		}
		return {
			logCursor: log.byteLength,
			outputRefs
		};
	}
	async read(path) {
		if (!/^job-outputs\/job_[A-Za-z0-9_-]+\/[a-f0-9]{64}-(container\.log|output-[0-9]+)$/.test(path)) throw new RunnerError("RUNNER_OUTPUT_DENIED", 403);
		canonicalRoot(dirname(join(this.root, path)));
		const file = await open(join(this.root, path), constants.O_RDONLY | constants.O_NOFOLLOW);
		try {
			const stat = await file.stat();
			if (!stat.isFile() || stat.nlink !== 1 || stat.size > this.maximumBytes) throw new RunnerError("RUNNER_OUTPUT_DENIED", 403);
			return await file.readFile();
		} finally {
			await file.close();
		}
	}
};
//#endregion
//#region src/manager.ts
var RunnerManager = class {
	store;
	policy;
	backend;
	authority;
	materials;
	options;
	#watch = /* @__PURE__ */ new Map();
	#starts = /* @__PURE__ */ new Set();
	#stops = /* @__PURE__ */ new Map();
	#background = /* @__PURE__ */ new Set();
	#timer;
	#tick;
	#closed = false;
	#closing;
	constructor(store, policy, backend, authority, materials, options = {}) {
		this.store = store;
		this.policy = policy;
		this.backend = backend;
		this.authority = authority;
		this.materials = materials;
		this.options = options;
		if (policy.config.runnerId !== store.options.runnerId) throw new RunnerError("RUNNER_STORE_IDENTITY_MISMATCH", 409);
		if (!Number.isInteger(options.maximumJobs ?? 4) || (options.maximumJobs ?? 4) < 1 || (options.maximumJobs ?? 4) > 4 || !Number.isInteger(options.pollIntervalMs ?? 100) || (options.pollIntervalMs ?? 100) < 10) throw new RunnerError("RUNNER_CONFIG_INVALID", 422);
	}
	time(permit) {
		const now = Date.now(), from = Date.parse(permit.notBefore), until = Date.parse(permit.expiresAt);
		if (from > now || until <= now || until - from > 15e3) throw new RunnerError("RUNNER_LEASE_INVALID", 403);
		return Math.min(15e3, until - now);
	}
	async verify(controllerId, request, permit = request.permit) {
		this.time(permit);
		try {
			await this.authority.verify(controllerId, request, permit);
		} catch {
			throw new RunnerError("RUNNER_AUTHORITY_DENIED", 403);
		}
		this.time(permit);
	}
	async start() {
		if (this.#timer || this.#closed) throw new RunnerError("RUNNER_ALREADY_STARTED", 409);
		await this.store.request("capacityConfigure", {
			maximumJobs: this.options.maximumJobs ?? 4,
			cpu: this.policy.config.maximumCpu,
			memoryMiB: this.policy.config.maximumMemoryMiB
		});
		if (this.backend.configured) await this.backend.probe();
		for (const row of await this.store.request("active", {})) try {
			await this.verify(row.job.controllerId, row.job.request, row.leasePermit);
			this.watch(row);
		} catch {
			await this.store.request("stop", {
				controllerId: row.job.controllerId,
				jobId: row.job.jobId
			});
			this.background(this.stopOriginal(row.job));
		}
		this.#timer = setInterval(() => {
			if (!this.#tick) this.#tick = this.tick().catch((e) => this.report(e)).finally(() => {
				this.#tick = void 0;
			});
		}, this.options.pollIntervalMs ?? 100);
		this.#timer.unref();
	}
	report(error) {
		this.options.onError?.(error instanceof RunnerError ? error.code : "RUNNER_INTERNAL_ERROR");
	}
	background(p) {
		this.#background.add(p);
		p.catch((e) => this.report(e)).finally(() => this.#background.delete(p));
	}
	async submit(controllerId, input) {
		if (this.#closed || !this.backend.configured) throw new RunnerError("RUNNER_NOT_CONFIGURED", 503, "not-sent");
		const request = startJob.parse(input);
		const existing = await this.store.request("byOperation", {
			controllerId,
			operationId: request.operationId
		});
		if (existing) {
			if (canonical(existing.request) !== canonical(request)) throw new RunnerError("IDEMPOTENCY_KEY_REUSED", 409);
			return existing;
		}
		const binding = await this.store.request("workspaceBinding", { workspaceRef: request.workspaceRef }), execution = await this.policy.validate(request, binding ?? void 0);
		await this.verify(controllerId, request);
		return this.store.request("register", {
			controllerId,
			request,
			execution: {
				workspacePath: execution.workspacePath,
				argv: [...execution.argv]
			}
		});
	}
	get(controllerId, jobId) {
		return this.store.request("get", {
			controllerId,
			jobId
		});
	}
	async acquireWorkspaceFence(controllerId, input) {
		const request = acquireWorkspaceFence.parse(input), cleanup = request.purpose === "cleanup";
		if (this.#closed || !(cleanup ? this.authority.verifyWorkspaceCleanup : this.authority.verifyWorkspace)) throw new RunnerError("RUNNER_FENCING_NOT_CONFIGURED", 503, "not-sent");
		const stored = await this.store.request("workspaceBinding", { workspaceRef: request.workspaceRef }), binding = await this.policy.fence(request, stored ?? void 0);
		try {
			if (cleanup) await this.authority.verifyWorkspaceCleanup(controllerId, request.permit, request.workspaceRef, request.parentOperationId);
			else await this.authority.verifyWorkspace(controllerId, request.permit, request.workspaceRef);
		} catch {
			throw new RunnerError("RUNNER_AUTHORITY_DENIED", 403);
		}
		return this.store.request("fenceAcquire", {
			controllerId,
			request,
			...binding
		});
	}
	getWorkspaceFence(controllerId, fenceId) {
		return this.store.request("fenceGet", {
			controllerId,
			fenceId
		});
	}
	async workspaceFenceByOperation(controllerId, operationId) {
		const value = await this.store.request("fenceByOperation", {
			controllerId,
			operationId
		});
		if (!value) throw new RunnerError("WORKSPACE_FENCE_NOT_FOUND", 404);
		return value;
	}
	async activeWorkspaceFence(controllerId, workspaceRef) {
		const value = await this.store.request("fenceActive", {
			controllerId,
			workspaceRef
		});
		if (!value) throw new RunnerError("WORKSPACE_FENCE_NOT_FOUND", 404);
		return value;
	}
	releaseWorkspaceFence(controllerId, fenceId, input) {
		return this.store.request("fenceRelease", {
			controllerId,
			fenceId,
			release: releaseWorkspaceFence.parse(input)
		});
	}
	async byOperation(controllerId, operationId) {
		const job = await this.store.request("byOperation", {
			controllerId,
			operationId
		});
		if (!job) throw new RunnerError("JOB_NOT_FOUND", 404);
		return job;
	}
	async renew(controllerId, jobId, input) {
		const renewal = renewJob.parse(input), job = await this.get(controllerId, jobId);
		await this.verify(controllerId, job.request, renewal.permit);
		const changed = await this.store.request("renew", {
			controllerId,
			jobId,
			renewal
		});
		const row = (await this.store.request("active", {})).find((r) => r.job.jobId === jobId);
		if (row && !row.job.stopRequested) this.watch(row);
		return changed;
	}
	async stop(controllerId, jobId) {
		const job = await this.store.request("stop", {
			controllerId,
			jobId
		});
		if (job.state !== "EXITED") this.background(this.stopOriginal(job));
		return job;
	}
	watch(row) {
		const id = row.job.jobId, now = performance.now(), previous = this.#watch.get(id), leaseDeadline = Math.min(now + this.time(row.leasePermit), previous && row.job.leaseSequence <= previous.sequence ? previous.leaseDeadline : Infinity);
		const executionDeadline = previous?.executionDeadline ?? now + Math.max(0, row.job.request.resourceLimits.timeoutMs - Math.max(0, Date.now() - Date.parse(row.job.startedAt ?? row.job.createdAt)));
		if (previous) clearTimeout(previous.timer);
		const timer = setTimeout(() => {
			this.background((async () => {
				const job = await this.store.request("stop", {
					controllerId: row.job.controllerId,
					jobId: id
				});
				await this.stopOriginal(job);
			})());
		}, Math.max(0, Math.min(leaseDeadline, executionDeadline) - now));
		timer.unref();
		this.#watch.set(id, {
			leaseDeadline,
			executionDeadline,
			sequence: row.job.leaseSequence,
			timer
		});
	}
	async allowed(row) {
		const current = (await this.store.request("active", {})).find((r) => r.job.jobId === row.job.jobId);
		if (!current) return false;
		const latest = current.job, w = this.#watch.get(latest.jobId);
		if (this.#closed || latest.stopRequested || !w || performance.now() >= Math.min(w.leaseDeadline, w.executionDeadline)) return false;
		try {
			await this.verify(latest.controllerId, latest.request, current.leasePermit);
			return !this.#closed && performance.now() < Math.min(w.leaseDeadline, w.executionDeadline);
		} catch {
			return false;
		}
	}
	async fact(row, fact) {
		const job = await this.get(row.job.controllerId, row.job.jobId);
		if (job.state === "EXITED") return;
		if (!fact || fact.state === "unknown" || fact.state === "created") {
			await this.store.request("record", {
				jobId: job.jobId,
				state: "OUTCOME_UNKNOWN",
				containerId: fact?.containerId ?? null,
				exitCode: null,
				evidence: null,
				errorCode: "RUNNER_OUTCOME_UNKNOWN"
			});
			return;
		}
		if (fact.state === "exited" && fact.pid === 0 && fact.exitCode !== null && !this.#starts.has(job.jobId)) {
			let collected;
			let errorCode = null;
			try {
				collected = await this.materials.collect(job, row.execution.workspacePath, this.backend);
			} catch {
				errorCode = "RUNNER_MATERIALS_UNAVAILABLE";
			}
			await this.store.request("record", {
				jobId: job.jobId,
				state: "EXITED",
				containerId: fact.containerId,
				exitCode: fact.exitCode,
				evidence: {
					containerId: fact.containerId,
					pid: 0,
					state: "exited",
					finishedAt: fact.finishedAt,
					verifiedAt: (/* @__PURE__ */ new Date()).toISOString()
				},
				errorCode,
				...collected ? { materials: collected } : {}
			});
			const watch = this.#watch.get(job.jobId);
			if (watch) clearTimeout(watch.timer);
			this.#watch.delete(job.jobId);
			return;
		}
		if (job.stopRequested || fact.state !== "running") {
			await this.store.request("record", {
				jobId: job.jobId,
				state: job.stopRequested ? "STOPPING" : "OUTCOME_UNKNOWN",
				containerId: fact.containerId,
				exitCode: null,
				evidence: null,
				errorCode: null
			});
			return;
		}
		await this.store.request("record", {
			jobId: job.jobId,
			state: "RUNNING",
			containerId: fact.containerId,
			exitCode: null,
			evidence: null,
			errorCode: null
		});
	}
	stopOriginal(job) {
		const prior = this.#stops.get(job.jobId);
		if (prior) return prior;
		const action = (async () => {
			try {
				const row = (await this.store.request("active", {})).find((r) => r.job.jobId === job.jobId);
				if (!row) return;
				let fact = null;
				try {
					fact = await this.backend.stop(await this.get(job.controllerId, job.jobId));
				} catch {}
				await this.fact(row, fact);
			} finally {
				this.#stops.delete(job.jobId);
			}
		})();
		this.#stops.set(job.jobId, action);
		return action;
	}
	async tick() {
		if (this.#closed || !this.backend.configured) return;
		for (const row of await this.store.request("active", {})) {
			if (this.#starts.has(row.job.jobId) || this.#stops.has(row.job.jobId)) continue;
			if (row.job.stopRequested || !await this.allowed(row)) {
				await this.store.request("stop", {
					controllerId: row.job.controllerId,
					jobId: row.job.jobId
				});
				this.background(this.stopOriginal(row.job));
				continue;
			}
			try {
				await this.fact(row, await this.backend.inspect(row.job));
			} catch {
				await this.fact(row, null);
			}
		}
		for (const row of await this.store.request("pending", { limit: 20 })) {
			try {
				await this.verify(row.job.controllerId, row.job.request, row.leasePermit);
			} catch {
				await this.store.request("stop", {
					controllerId: row.job.controllerId,
					jobId: row.job.jobId
				});
				continue;
			}
			const claimed = await this.store.request("claim", {
				jobId: row.job.jobId,
				maximumJobs: this.options.maximumJobs ?? 4,
				cpu: this.policy.config.maximumCpu,
				memoryMiB: this.policy.config.maximumMemoryMiB
			});
			if (!claimed) continue;
			this.watch(claimed);
			this.#starts.add(claimed.job.jobId);
			this.background((async () => {
				let fact = null;
				try {
					fact = await this.backend.start(claimed.job, claimed.execution.workspacePath, claimed.execution.argv, () => this.allowed(claimed));
				} catch {
					try {
						fact = await this.backend.inspect(claimed.job);
					} catch {}
				} finally {
					this.#starts.delete(claimed.job.jobId);
				}
				if ((await this.get(claimed.job.controllerId, claimed.job.jobId)).stopRequested) await this.stopOriginal(claimed.job);
				else await this.fact(claimed, fact);
			})());
		}
	}
	async readOutput(controllerId, jobId, index) {
		const ref = (await this.get(controllerId, jobId)).outputRefs[index];
		if (!ref) throw new RunnerError("RUNNER_OUTPUT_NOT_FOUND", 404);
		const bytes = await this.materials.read(ref.path);
		if (bytes.length !== ref.byteSize || createHash("sha256").update(bytes).digest("hex") !== ref.sha256) throw new RunnerError("RUNNER_OUTPUT_CORRUPT", 409);
		return {
			ref,
			bytes
		};
	}
	close() {
		return this.#closing ??= (async () => {
			this.#closed = true;
			clearInterval(this.#timer);
			for (const w of this.#watch.values()) clearTimeout(w.timer);
			this.#watch.clear();
			await this.#tick;
			for (const row of await this.store.request("active", {})) {
				await this.store.request("stop", {
					controllerId: row.job.controllerId,
					jobId: row.job.jobId
				});
				await this.stopOriginal(row.job);
			}
			await Promise.allSettled(this.#background);
		})();
	}
};
//#endregion
//#region src/layout.ts
const markerSchema = z.strictObject({
	nodeKind: z.literal("runner"),
	layoutVersion: z.literal(1),
	runnerId: opaqueKey
});
async function openRunnerStorage(input) {
	const dataRoot = canonicalRoot(input.dataRoot);
	assertSeparate([
		dataRoot,
		canonicalRoot(input.controlDataRoot),
		canonicalRoot(input.backupRoot)
	]);
	opaqueKey.parse(input.runnerId);
	const markerPath = join(dataRoot, "runner-layout.json"), pendingPath = join(dataRoot, "runner-layout.pending.json"), exists = existsSync(dataRoot), hasMarker = existsSync(markerPath), pending = existsSync(pendingPath);
	if (!hasMarker && !input.initialize) throw new RunnerError("RUNNER_ROOT_NOT_INITIALIZED", 409);
	if (!hasMarker && exists && !pending && readdirSync(dataRoot).length) throw new RunnerError("RUNNER_ROOT_NOT_EMPTY", 409);
	if (!exists) mkdirSync(dataRoot, {
		recursive: true,
		mode: 448
	});
	const lock = acquireWriterLock(join(dataRoot, "runner-layout"), input.layoutRecoveryToken);
	try {
		const marker = hasMarker || pending ? markerSchema.parse(JSON.parse(readFileSync(safePath(dataRoot, hasMarker ? "runner-layout.json" : "runner-layout.pending.json"), "utf8"))) : markerSchema.parse({
			nodeKind: "runner",
			layoutVersion: 1,
			runnerId: input.runnerId
		});
		if (marker.runnerId !== input.runnerId) throw new RunnerError("RUNNER_STORE_IDENTITY_MISMATCH", 409);
		if (!hasMarker && !pending) {
			const fd = openSync(pendingPath, "wx", 384);
			try {
				writeFileSync(fd, JSON.stringify(marker) + "\n");
				fsyncSync(fd);
			} finally {
				closeSync(fd);
			}
		}
		for (const name of [
			"registry",
			"workspaces",
			"invocations",
			"job-outputs",
			"datasets"
		]) {
			const dir = join(dataRoot, name);
			canonicalRoot(dir);
			if (!existsSync(dir)) mkdirSync(dir, { mode: 448 });
		}
		const databasePath = safePath(dataRoot, "registry/runner.sqlite");
		if (hasMarker && !existsSync(databasePath)) throw new RunnerError("RUNNER_DATABASE_MISSING", 409);
		const store = await openRunnerStore({
			databasePath,
			runnerId: input.runnerId,
			initialize: !existsSync(databasePath),
			...input.recoveryToken ? { recoveryToken: input.recoveryToken } : {}
		});
		if (!hasMarker) renameSync(pendingPath, markerPath);
		let closing;
		return {
			store,
			dataRoot,
			marker,
			close() {
				return closing ??= (async () => {
					try {
						await store.close();
					} finally {
						lock.release();
					}
				})();
			}
		};
	} catch (error) {
		lock.release();
		throw error;
	}
}
//#endregion
//#region src/server.ts
async function serveRunner(manager, options) {
	const host = options.host ?? "127.0.0.1";
	if (!["127.0.0.1", "::1"].includes(host)) throw new RunnerError("RUNNER_BIND_INVALID", 422);
	if (new Set(options.identities.map((i) => i.controllerId)).size !== options.identities.length || new Set(options.identities.map((i) => i.credentialRef)).size !== options.identities.length) throw new RunnerError("RUNNER_IDENTITIES_INVALID", 422);
	for (const i of options.identities) {
		opaqueKey.parse(i.controllerId);
		opaqueKey.parse(i.credentialRef);
	}
	const app = express();
	app.disable("x-powered-by");
	app.disable("etag");
	const auth = async (req, res, next) => {
		try {
			const h = req.headers.authorization, presented = Buffer.from(h?.startsWith("Bearer ") ? h.slice(7) : "");
			if (presented.length >= 16 && presented.length <= 4096) {
				const matches = [];
				for (const i of options.identities) {
					const value = await options.credentials(i.credentialRef);
					if (!value || value.length < 16) continue;
					const expected = Buffer.from(value);
					if (expected.length === presented.length && timingSafeEqual(expected, presented)) matches.push(i.controllerId);
				}
				if (matches.length === 1) {
					res.locals.controllerId = matches[0];
					next();
					return;
				}
			}
			res.set("WWW-Authenticate", "Bearer").status(401).json({ error: "RUNNER_AUTH_REQUIRED" });
		} catch {
			res.status(503).json({ error: "RUNNER_AUTH_UNAVAILABLE" });
		}
	};
	app.get("/healthz", (_req, res) => res.json({
		status: "ok",
		component: "devmesh-runner",
		executionConfigured: manager.backend.configured
	}));
	app.use("/runner/v1", auth, express.json({
		limit: "256kb",
		strict: true
	}));
	app.post("/runner/v1/jobs", async (req, res) => res.status(202).json(await manager.submit(String(res.locals.controllerId), req.body)));
	app.post("/runner/v1/workspace-fences", async (req, res) => res.status(201).json(await manager.acquireWorkspaceFence(String(res.locals.controllerId), req.body)));
	app.get("/runner/v1/workspace-fences/by-operation/:id", async (req, res) => res.json(await manager.workspaceFenceByOperation(String(res.locals.controllerId), String(req.params.id))));
	app.get("/runner/v1/workspace-fences/active/:id", async (req, res) => res.json(await manager.activeWorkspaceFence(String(res.locals.controllerId), String(req.params.id))));
	app.get("/runner/v1/workspace-fences/:id", async (req, res) => res.json(await manager.getWorkspaceFence(String(res.locals.controllerId), String(req.params.id))));
	app.post(/^\/runner\/v1\/workspace-fences\/(fence_[A-Za-z0-9_-]+):release$/, async (req, res) => res.json(await manager.releaseWorkspaceFence(String(res.locals.controllerId), String(req.params[0]), req.body)));
	app.get("/runner/v1/jobs/by-operation/:id", async (req, res) => res.json(await manager.byOperation(String(res.locals.controllerId), String(req.params.id))));
	app.get("/runner/v1/jobs/:id", async (req, res) => res.json(await manager.get(String(res.locals.controllerId), String(req.params.id))));
	app.post(/^\/runner\/v1\/jobs\/(job_[A-Za-z0-9_-]+):stop$/, async (req, res) => res.status(202).json(await manager.stop(String(res.locals.controllerId), String(req.params[0]))));
	app.post(/^\/runner\/v1\/jobs\/(job_[A-Za-z0-9_-]+):renew$/, async (req, res) => res.json(await manager.renew(String(res.locals.controllerId), String(req.params[0]), req.body)));
	app.get("/runner/v1/jobs/:id/logs", async (req, res) => {
		const offset = Number(req.query.offset ?? 0), limit = Number(req.query.limit ?? 65536);
		if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 65536) throw new RunnerError("RUNNER_LOG_CURSOR_INVALID", 422);
		const job = await manager.get(String(res.locals.controllerId), String(req.params.id));
		if (!job.outputRefs.length) throw new RunnerError("RUNNER_LOGS_NOT_COLLECTED", 409);
		const { bytes } = await manager.readOutput(String(res.locals.controllerId), job.jobId, 0);
		if (offset > bytes.length) throw new RunnerError("RUNNER_LOG_CURSOR_INVALID", 422);
		const chunk = bytes.subarray(offset, offset + limit);
		res.json({
			jobId: job.jobId,
			offset,
			nextOffset: offset + chunk.length,
			complete: offset + chunk.length === bytes.length,
			data: chunk.toString("base64")
		});
	});
	app.get("/runner/v1/jobs/:id/outputs/:index", async (req, res) => {
		const index = Number(req.params.index);
		if (!Number.isSafeInteger(index) || index < 0) throw new RunnerError("RUNNER_OUTPUT_NOT_FOUND", 404);
		const { ref, bytes } = await manager.readOutput(String(res.locals.controllerId), String(req.params.id), index);
		res.set("Content-Type", "application/octet-stream").set("X-Content-SHA256", ref.sha256).send(Buffer.from(bytes));
	});
	app.use((_req, res) => {
		res.status(404).json({ error: "NOT_FOUND" });
	});
	const errors = (error, _req, res, _next) => {
		const invalid = error?.name === "ZodError" || error?.type === "entity.parse.failed";
		res.status(error instanceof RunnerError ? error.status : invalid ? 422 : error?.type === "entity.too.large" ? 413 : 500).json({ error: error instanceof RunnerError ? error.code : invalid ? "RUNNER_REQUEST_INVALID" : "RUNNER_REQUEST_FAILED" });
	};
	app.use(errors);
	const server = createServer({
		headersTimeout: 5e3,
		requestTimeout: 1e4
	}, app);
	server.maxRequestsPerSocket = 100;
	await new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(options.port ?? 0, host, () => {
			server.off("error", reject);
			resolve();
		});
	});
	let closing;
	return {
		address: server.address(),
		close() {
			return closing ??= (async () => {
				const closed = new Promise((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
				server.closeAllConnections();
				await closed;
				await manager.close();
			})();
		}
	};
}
//#endregion
export { RunnerStore as a, RunnerMaterials as i, openRunnerStorage as n, openRunnerStore as o, RunnerManager as r, RunnerPolicy as s, serveRunner as t };

//# sourceMappingURL=server-ke1TSt2G.mjs.map