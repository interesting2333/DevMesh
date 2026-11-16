import { s as StorageError } from "./migrations-BsETEmRY.mjs";
import { A as releasePromotionRequest, At as repoIntegrateArgs, B as previewAccessHttpRequest, C as releasePublicationGate, Ct as repoWriteFileArgs, D as releaseRouteBinding, Et as sourceManifest, F as acceptanceServiceClaim, G as datasetPreparationRequest, H as previewAccessPolicy, I as previewAcceptanceReleaseClaim, It as canonical, K as previewBackendPolicy, L as acceptanceBackendPolicy, M as acceptancePreparedProof, Mt as issueCreateArgs, Nt as issueLinkArgs, O as releaseServiceClaim, Ot as repoBinding, P as acceptanceReleaseClaim, Pt as issueVerifyArgs, Q as qualityMaterialKey, R as acceptancePreparationRequest, S as releasePublicationBasis, T as releasePublicationProof, Tt as managedSourcePath, V as previewAccessObservation, W as previewWriteCloseRequest, X as previewStartRequest, Y as previewRuntimeFact, Z as previewStopRequest, _ as acceptanceDatasetAbortReceipt, _t as endpointConfig, a as releaseAccessRequestHash, at as workspaceMaterialSnapshot, b as acceptanceAbortDecision, bt as repoFileProof, c as releaseTargetForPublication, d as acceptanceAbortCompletionEvidence, dt as candidateMaterialKey, f as acceptanceAbortFenceSuccessor, g as acceptanceDatasetAbortProof, gt as agentManifest, h as acceptanceAbortSourceRecovery, ht as candidateReportEnvelope, i as releaseAccessPolicy, j as acceptancePreparationObservation, kt as repoCommitArgs, l as previewOrigin, m as acceptanceAbortSourceGate, mt as candidateMergeReport, n as releaseAccessHttpRequest, nt as workspacePreservationMaterialKey, ot as workspacePreservationManifest, q as previewEffectReceipt, r as releaseAccessObservation, rt as workspaceMaterialEntry, s as releaseAccessTarget, t as redactExportRecord, v as acceptanceDatasetAbortRequest, w as releasePublicationObservation, wt as gitDirectoryIdentity, xt as repoFileReadArgs, y as acceptanceDatasetFences, yt as repoDeleteFileArgs } from "./export-redaction-BFWjPx8a.mjs";
import { Worker } from "node:worker_threads";
import { closeSync, existsSync, fsyncSync, lstatSync, openSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
//#region src/lock.ts
function acquireWriterLock(databasePath, recoveryToken) {
	if (!isAbsolute(databasePath) || databasePath.startsWith("\\\\") || databasePath.startsWith("//")) throw new StorageError("DATABASE_PATH_INVALID", 422, "An explicit absolute local database path is required");
	const path = resolve(realpathSync(dirname(databasePath)), basename(databasePath));
	if (existsSync(path) && (lstatSync(path).isSymbolicLink() || lstatSync(path).nlink !== 1)) throw new StorageError("DATABASE_PATH_INVALID", 422, "Linked database files are not supported");
	const lockPath = path + ".writer.lock", guardPath = lockPath + ".guard";
	let guard;
	try {
		guard = openSync(guardPath, "wx", 384);
	} catch {
		throw new StorageError("STORAGE_LOCKED", 423, "Lock acquisition/recovery is already in progress; inspect an abandoned guard offline");
	}
	const token = randomUUID();
	try {
		if (existsSync(lockPath)) {
			const old = JSON.parse(readFileSync(lockPath, "utf8"));
			if (!Number.isSafeInteger(old.pid) || old.pid < 1 || old.hostname !== hostname()) throw new StorageError("LOCK_RECOVERY_REQUIRED", 423, "Lock owner cannot be verified locally");
			let dead = false;
			try {
				process.kill(old.pid, 0);
			} catch (error) {
				dead = error.code === "ESRCH";
			}
			if (!dead || recoveryToken !== old.token) throw new StorageError("STORAGE_LOCKED", 423, "Database has a live/unverified owner; dead-owner recovery requires its exact token", {
				pid: old.pid,
				recoveryToken: old.token
			});
			unlinkSync(lockPath);
		}
		const fd = openSync(lockPath, "wx", 384);
		try {
			writeFileSync(fd, JSON.stringify({
				pid: process.pid,
				hostname: hostname(),
				token,
				createdAt: (/* @__PURE__ */ new Date()).toISOString()
			}));
			fsyncSync(fd);
		} finally {
			closeSync(fd);
		}
	} finally {
		closeSync(guard);
		unlinkSync(guardPath);
	}
	return {
		path,
		token,
		release() {
			if (existsSync(lockPath)) {
				if (JSON.parse(readFileSync(lockPath, "utf8")).token === token) unlinkSync(lockPath);
			}
		}
	};
}
//#endregion
//#region src/index.ts
var SqliteStorage = class {
	#worker;
	#capacity;
	#eventSubscribers = /* @__PURE__ */ new Set();
	#pending = /* @__PURE__ */ new Map();
	#exited;
	#nextId = 1;
	#closed = false;
	#closing;
	#closeError;
	ready;
	constructor(options) {
		this.#capacity = options.queueCapacity ?? 128;
		if (!Number.isSafeInteger(this.#capacity) || this.#capacity < 1 || this.#capacity > 1e4) throw new StorageError("QUEUE_CAPACITY_INVALID", 422, "queueCapacity must be 1..10000");
		const lock = acquireWriterLock(options.databasePath, options.recoveryToken);
		try {
			this.#worker = new Worker(new URL("./worker.mjs", import.meta.url), {
				workerData: {
					...options,
					databasePath: lock.path
				},
				execArgv: []
			});
		} catch (error) {
			lock.release();
			throw error;
		}
		let readyResolve, readyReject;
		this.ready = new Promise((resolve, reject) => {
			readyResolve = resolve;
			readyReject = reject;
		});
		this.#exited = new Promise((resolve) => this.#worker.once("exit", () => {
			this.#closed = true;
			for (const listener of this.#eventSubscribers) try {
				listener();
			} catch {}
			this.#eventSubscribers.clear();
			const error = new StorageError("OUTCOME_UNKNOWN", 503, "Database Worker exited before acknowledgement; query the original operation key");
			readyReject(error);
			for (const pending of this.#pending.values()) pending.reject(error);
			this.#pending.clear();
			try {
				lock.release();
			} catch (releaseError) {
				this.#closeError = releaseError;
			} finally {
				resolve();
			}
		}));
		this.#worker.on("message", (message) => {
			if ("type" in message) {
				if (message.type === "ready") readyResolve();
				else if (message.type === "event-commit") for (const listener of this.#eventSubscribers) try {
					listener();
				} catch {
					this.#eventSubscribers.delete(listener);
				}
				return;
			}
			const error = message.error ? new StorageError(message.error.code, message.error.status, message.error.message, message.error.details) : void 0;
			if (message.id === 0) {
				if (error) readyReject(error);
				return;
			}
			if (message.id === -1) {
				if (error) this.#closeError = error;
				return;
			}
			const pending = this.#pending.get(message.id);
			if (!pending) return;
			this.#pending.delete(message.id);
			if (error) pending.reject(error);
			else pending.resolve(message.value);
		});
		this.#worker.on("error", (error) => readyReject(error));
	}
	/** Subscribe before an authorized event-window read; hints contain no facts or authorization. */
	subscribeEventCommits(listener) {
		if (this.#closed) throw new StorageError("STORAGE_CLOSED", 503, "Storage is closing or closed");
		if (this.#eventSubscribers.size >= 256) throw new StorageError("STORAGE_OVERLOADED", 503, "Event subscription capacity is full");
		this.#eventSubscribers.add(listener);
		return () => {
			this.#eventSubscribers.delete(listener);
		};
	}
	request(method, payload) {
		return this.#send(method, payload);
	}
	#send(method, payload) {
		if (this.#closed) return Promise.reject(new StorageError("STORAGE_CLOSED", 503, "Storage is closing or closed"));
		if (this.#pending.size >= this.#capacity) return Promise.reject(new StorageError("STORAGE_OVERLOADED", 503, "Database queue is full; request was not sent"));
		try {
			const json = JSON.stringify(payload);
			if (json === void 0) return Promise.reject(new StorageError("SCHEMA_INVALID", 422, "A JSON payload is required"));
			if (Buffer.byteLength(json, "utf8") > 256 * 1024) return Promise.reject(new StorageError("REQUEST_TOO_LARGE", 413, "Storage RPC is limited to 256 KiB; request was not sent"));
		} catch {
			return Promise.reject(new StorageError("SCHEMA_INVALID", 422, "Payload must be serializable JSON"));
		}
		const id = this.#nextId++;
		return new Promise((resolve, reject) => {
			this.#pending.set(id, {
				resolve,
				reject
			});
			try {
				this.#worker.postMessage({
					id,
					method,
					payload
				});
			} catch (error) {
				this.#pending.delete(id);
				reject(error);
			}
		});
	}
	close() {
		this.#closing ??= (async () => {
			if (!this.#closed) {
				this.#closed = true;
				this.#worker.postMessage({
					id: -1,
					method: "close",
					payload: {}
				});
			}
			await this.#exited;
			if (this.#closeError) throw this.#closeError;
		})();
		return this.#closing;
	}
	/** Deliberate emergency shutdown. In-flight writes remain OUTCOME_UNKNOWN. */
	async terminate() {
		this.#closed = true;
		await this.#worker.terminate();
		await this.#exited;
	}
};
async function openStorage(options) {
	const storage = new SqliteStorage(options);
	try {
		await storage.ready;
		return storage;
	} catch (error) {
		await storage.terminate();
		throw error;
	}
}
//#endregion
export { SqliteStorage, StorageError, acceptanceAbortCompletionEvidence, acceptanceAbortDecision, acceptanceAbortFenceSuccessor, acceptanceAbortSourceGate, acceptanceAbortSourceRecovery, acceptanceBackendPolicy, acceptanceDatasetAbortProof, acceptanceDatasetAbortReceipt, acceptanceDatasetAbortRequest, acceptanceDatasetFences, acceptancePreparationObservation, acceptancePreparationRequest, acceptancePreparedProof, acceptanceReleaseClaim, acceptanceServiceClaim, acquireWriterLock, agentManifest, candidateMaterialKey, candidateMergeReport, candidateReportEnvelope, canonical, datasetPreparationRequest, endpointConfig, gitDirectoryIdentity, issueCreateArgs, issueLinkArgs, issueVerifyArgs, managedSourcePath, openStorage, previewAcceptanceReleaseClaim, previewAccessHttpRequest, previewAccessObservation, previewAccessPolicy, previewBackendPolicy, previewEffectReceipt, previewOrigin, previewOrigin as releaseOrigin, previewRuntimeFact, previewStartRequest, previewStopRequest, previewWriteCloseRequest, qualityMaterialKey, redactExportRecord, releaseAccessHttpRequest, releaseAccessObservation, releaseAccessPolicy, releaseAccessRequestHash, releaseAccessTarget, releasePromotionRequest, releasePublicationBasis, releasePublicationGate, releasePublicationObservation, releasePublicationProof, releaseRouteBinding, releaseServiceClaim, releaseTargetForPublication, repoBinding, repoCommitArgs, repoDeleteFileArgs, repoFileProof, repoFileReadArgs, repoIntegrateArgs, repoWriteFileArgs, sourceManifest, workspaceMaterialEntry, workspaceMaterialSnapshot, workspacePreservationManifest, workspacePreservationMaterialKey };

//# sourceMappingURL=index.mjs.map