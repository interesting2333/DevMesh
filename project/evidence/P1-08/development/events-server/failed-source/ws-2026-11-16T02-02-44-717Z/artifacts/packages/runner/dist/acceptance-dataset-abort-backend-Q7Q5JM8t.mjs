import { t as RunnerError } from "./protocol-CrzCRB9P.mjs";
import { i as RunnerDatasetPaths } from "./dataset-backend-qZrMml_D.mjs";
import { i as datasetHash, t as acceptanceDatasetFences } from "./dataset-journal-BxtC082T.mjs";
import { n as acceptanceDataOptions } from "./acceptance-dataset-backend-lXOInqKH.mjs";
import { z } from "zod";
import { ids, opaqueKey, sha256, timestamp } from "@devmesh/contracts";
import { acceptanceAbortDecision, acceptanceDatasetAbortProof as acceptanceDatasetAbortProof$1, acceptanceDatasetAbortReceipt, acceptanceDatasetAbortRequest, canonical } from "@devmesh/storage-sqlite";
import { Worker } from "node:worker_threads";
//#region src/acceptance-dataset-abort.ts
const acceptanceDatasetAbortJournal = z.strictObject({
	schemaVersion: z.literal("devmesh.local-dataset-abort-operation.v1"),
	request: acceptanceDatasetAbortRequest,
	requestHash: sha256,
	originalJournalHash: sha256.nullable(),
	originalFences: acceptanceDatasetFences.nullable(),
	createdAt: timestamp
});
function validateDatasetAbortJournal(raw) {
	const j = acceptanceDatasetAbortJournal.parse(raw), r = j.request;
	if (datasetHash(canonical(r)) !== j.requestHash || datasetHash(canonical(r.decision)) !== r.decisionHash) throw new RunnerError("ACCEPTANCE_DATA_ABORT_IDENTITY_CHANGED", 409);
	validateOriginalAbortFences(j.originalFences, j);
	return j;
}
function validateOriginalAbortFences(f, j) {
	const d = j.request.decision, q = d.preparation, s = q.source;
	if (f && (f.operationId !== q.operationId || f.requestHash !== d.preparationRequestHash || f.targetFence.datasetId !== q.target.datasetId || (s ? f.sourceFence?.datasetId !== s.datasetId || f.sourceFence.datasetOperationId !== s.datasetOperationId : f.sourceFence !== null))) throw new RunnerError("ACCEPTANCE_DATA_ABORT_CUSTODY_CHANGED", 409);
	return f;
}
function validateDatasetAbortProof(raw, j) {
	const p = acceptanceDatasetAbortProof$1.parse(raw), d = j.request.decision, q = d.preparation, s = q.source, f = validateOriginalAbortFences(p.originalFences, j);
	const follows = (next, old) => old ? next.fenceId === old.fenceId && next.generation > old.generation && next.previousHoldHash === old.proofHash : next.previousHoldHash === null;
	if (p.operationId !== q.operationId || p.abortOperationId !== d.operationId || p.decisionHash !== j.request.decisionHash || p.requestHash !== j.requestHash || j.originalFences && canonical(j.originalFences) !== canonical(f) || p.target.datasetId !== q.target.datasetId || !follows(p.target, f?.targetFence.physical ?? null) || (s ? !p.source || p.source.datasetId !== s.datasetId || p.source.datasetOperationId !== s.datasetOperationId || p.source.releaseId !== s.releaseId || !follows(p.source, f?.sourceFence?.physical ?? null) : p.source !== null) || Date.parse(p.settledAt) < Math.max(Date.parse(j.createdAt), Date.parse(d.decidedAt)) || Date.parse(p.settledAt) > Date.now()) throw new RunnerError("ACCEPTANCE_DATA_ABORT_PROOF_CHANGED", 409);
	return p;
}
//#endregion
//#region src/acceptance-dataset-abort-backend.ts
const acceptanceDatasetAbortOptions = acceptanceDataOptions.extend({
	enabled: z.boolean().default(false),
	controllerId: opaqueKey,
	principalId: opaqueKey
});
const input = z.strictObject({
	operationId: ids.operation,
	requestHash: sha256
});
/** Explicit trusted composition; the caller supplies neither a decision nor a
* cleanup-success flag. Each Worker owns one bounded durable file operation. */
var RunnerAcceptanceDatasetAbortBackend = class {
	store;
	control;
	authority;
	options;
	#active = 0;
	#authorityActive = 0;
	#waiting = [];
	constructor(store, control, authority, options) {
		this.store = store;
		this.control = control;
		this.authority = authority;
		this.options = acceptanceDatasetAbortOptions.parse(options);
		new RunnerDatasetPaths(this.options);
		if (store.options.runnerId !== this.options.runnerId) throw new RunnerError("RUNNER_STORE_IDENTITY_MISMATCH", 409);
	}
	get configured() {
		return this.options.enabled && this.authority?.configured === true;
	}
	async #authorityCall(call) {
		if (this.#authorityActive >= this.options.maximumWorkers) throw new RunnerError("ACCEPTANCE_DATA_ABORT_AUTHORITY_BUSY", 503, "not-sent");
		this.#authorityActive++;
		try {
			return await call();
		} finally {
			this.#authorityActive--;
		}
	}
	async #request(i) {
		const record = await this.control.request("getAcceptanceAbortDecision", {
			principalId: this.options.principalId,
			preparationOperationId: i.operationId,
			requestHash: i.requestHash
		});
		if (!record) throw new RunnerError("ACCEPTANCE_ABORT_NOT_REQUESTED", 409);
		const d = acceptanceAbortDecision.parse(record.decision), q = d.preparation;
		if (datasetHash(canonical(d)) !== record.decisionHash || q.operationId !== i.operationId || d.preparationRequestHash !== i.requestHash || q.runnerId !== this.options.runnerId || q.backendRef !== this.options.backendRef || q.backendPrincipalId !== this.options.principalId) throw new RunnerError("ACCEPTANCE_DATA_ABORT_IDENTITY_CHANGED", 409);
		const cleanup = await this.store.request("acceptanceAbortGet", {
			controllerId: this.options.controllerId,
			operationId: i.operationId,
			decisionHash: record.decisionHash
		});
		if (canonical(cleanup.record) !== canonical(record)) throw new RunnerError("ACCEPTANCE_DATA_ABORT_IDENTITY_CHANGED", 409);
		if (!cleanup.serviceCleared || !cleanup.networkCleared) return null;
		return acceptanceDatasetAbortRequest.parse({
			schemaVersion: "devmesh.acceptance-dataset-abort.v1",
			...record,
			controllerId: this.options.controllerId,
			serviceCleanupHash: datasetHash(canonical(cleanup))
		});
	}
	async advance(raw, signal) {
		signal?.throwIfAborted();
		if (!this.configured) throw new RunnerError("ACCEPTANCE_DATA_ABORT_NOT_CONFIGURED", 503, "not-sent");
		const i = input.parse(raw), request = await this.#request(i);
		if (!request) return {
			state: "UNKNOWN",
			errorCode: "ACCEPTANCE_DATA_ABORT_SERVICE_UNRESOLVED"
		};
		signal?.throwIfAborted();
		if (this.#active >= this.options.maximumWorkers) {
			if (this.#waiting.length >= 128) throw new RunnerError("ACCEPTANCE_DATA_WORKER_BUSY", 503, "not-sent");
			await new Promise((resolve) => this.#waiting.push(resolve));
		} else this.#active++;
		try {
			signal?.throwIfAborted();
			return await new Promise((resolve, reject) => {
				const worker = new Worker(new URL("./acceptance-dataset-abort-worker.mjs", import.meta.url), {
					workerData: {
						request,
						options: this.options
					},
					execArgv: []
				});
				let value, error, received = false, finished = false;
				const rpc = /* @__PURE__ */ new Set();
				const allowed = async () => {
					if (finished || signal?.aborted) return false;
					const current = await this.#request(i);
					return !finished && !signal?.aborted && current !== null && canonical(current) === canonical(request);
				};
				const timeout = setTimeout(() => {
					finished = true;
					error = new RunnerError("ACCEPTANCE_DATA_ABORT_OUTCOME_UNKNOWN", 503, "unknown");
					worker.terminate();
				}, this.options.timeoutMs);
				worker.on("message", (m) => {
					if (m.rpc) {
						const task = (async () => {
							try {
								if (finished) return;
								signal?.throwIfAborted();
								let result;
								if (m.rpc === "authorize") result = await allowed();
								else {
									const j = validateDatasetAbortJournal(m.journal);
									if (canonical(j.request) !== canonical(request)) throw new RunnerError("ACCEPTANCE_DATA_ABORT_IDENTITY_CHANGED", 409);
									if (m.rpc === "abort") {
										if (!await allowed()) throw new RunnerError("ACCEPTANCE_DATA_ABORT_AUTHORIZATION_CHANGED", 409);
										result = validateDatasetAbortProof(await this.#authorityCall(() => this.authority.abort(j, allowed)), j);
									} else if (m.rpc === "inspectAbort") {
										const p = await this.#authorityCall(() => this.authority.inspectAbort(j));
										result = p === null ? null : validateDatasetAbortProof(p, j);
									} else throw new RunnerError("ACCEPTANCE_DATA_WORKER_PROTOCOL", 409);
								}
								if (!finished) worker.postMessage({
									id: m.id,
									value: result
								});
							} catch (e) {
								if (!finished) worker.postMessage({
									id: m.id,
									error: {
										code: e instanceof RunnerError ? e.code : "ACCEPTANCE_DATA_ABORT_AUTHORITY_UNVERIFIED",
										status: e instanceof RunnerError ? e.status : 503
									}
								});
							}
						})();
						rpc.add(task);
						task.finally(() => rpc.delete(task));
						return;
					}
					received = true;
					if (m.error) error = new RunnerError(m.error.code, m.error.status);
					else value = m.value;
				});
				worker.on("error", () => {
					error = new RunnerError("ACCEPTANCE_DATA_ABORT_OUTCOME_UNKNOWN", 503, "unknown");
				});
				worker.once("exit", (code) => {
					finished = true;
					clearTimeout(timeout);
					(async () => {
						await Promise.allSettled(rpc);
						if (error) reject(error);
						else if (code !== 0 || !received || !value) reject(new RunnerError("ACCEPTANCE_DATA_ABORT_OUTCOME_UNKNOWN", 503, "unknown"));
						else resolve(value);
					})();
				});
			});
		} finally {
			const next = this.#waiting.shift();
			if (next) next();
			else this.#active--;
		}
	}
};
//#endregion
export { acceptanceDatasetAbortReceipt as a, validateDatasetAbortProof as c, acceptanceDatasetAbortProof$1 as i, validateOriginalAbortFences as l, acceptanceDatasetAbortOptions as n, acceptanceDatasetAbortRequest as o, acceptanceDatasetAbortJournal as r, validateDatasetAbortJournal as s, RunnerAcceptanceDatasetAbortBackend as t };

//# sourceMappingURL=acceptance-dataset-abort-backend-Q7Q5JM8t.mjs.map