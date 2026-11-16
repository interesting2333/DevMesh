import { t as RunnerError } from "./protocol-CrzCRB9P.mjs";
import { d as webCrudDatasetProfile } from "./dataset-journal-BxtC082T.mjs";
import { z } from "zod";
import { ids, opaqueKey } from "@devmesh/contracts";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { assertSeparate, canonicalRoot, safePath } from "@devmesh/blob-store";
import { canonical, datasetPreparationRequest } from "@devmesh/storage-sqlite";
import { Worker } from "node:worker_threads";
import { existsSync, lstatSync, readFileSync } from "node:fs";
//#region src/dataset-paths.ts
const marker = z.strictObject({
	nodeKind: z.literal("runner"),
	layoutVersion: z.literal(1),
	runnerId: opaqueKey
});
var RunnerDatasetPaths = class {
	options;
	root;
	constructor(options) {
		this.options = options;
		const runnerRoot = canonicalRoot(options.runnerRoot);
		assertSeparate([
			runnerRoot,
			canonicalRoot(options.controlDataRoot),
			canonicalRoot(options.backupRoot)
		]);
		if (marker.parse(JSON.parse(readFileSync(safePath(runnerRoot, "runner-layout.json"), "utf8"))).runnerId !== options.runnerId) throw new RunnerError("RUNNER_STORE_IDENTITY_MISMATCH", 409);
		this.root = canonicalRoot(join(runnerRoot, "datasets"));
		if (!existsSync(this.root)) throw new RunnerError("RUNNER_ROOT_NOT_INITIALIZED", 409);
	}
	resolve(input, createParents = false) {
		const projectId = ids.project.parse(input.projectId), datasetId = ids.dataset.parse(input.datasetId), key = projectId + "/" + datasetId, storageKey = key + "/app.sqlite";
		const databasePath = safePath(this.root, storageKey, createParents), journalPath = safePath(this.root, key + "/operation.json"), receiptPath = safePath(this.root, key + "/receipt.json"), markerPath = safePath(this.root, key + "/dataset.json"), stagingPath = safePath(this.root, key + "/preparing.sqlite"), fencesPath = safePath(this.root, key + "/fences.json"), abortJournalPath = safePath(this.root, key + "/abort-operation.json"), abortReceiptPath = safePath(this.root, key + "/abort-receipt.json");
		for (const file of [
			"app.sqlite",
			"app.sqlite-wal",
			"app.sqlite-shm",
			"app.sqlite-journal",
			"operation.json",
			"receipt.json",
			"dataset.json",
			"fences.json",
			"abort-operation.json",
			"abort-receipt.json",
			"writer.lock",
			"preparing.sqlite",
			"preparing.sqlite-wal",
			"preparing.sqlite-shm",
			"preparing.sqlite-journal"
		].map((name) => key + "/" + name)) {
			const checked = safePath(this.root, file);
			if (existsSync(checked)) {
				const stat = lstatSync(checked);
				if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new RunnerError("DATASET_FILE_UNSAFE", 403);
			}
		}
		return {
			directory: dirname(databasePath),
			storageKey,
			databasePath,
			journalPath,
			receiptPath,
			markerPath,
			stagingPath,
			fencesPath,
			abortJournalPath,
			abortReceiptPath
		};
	}
};
//#endregion
//#region src/dataset-backend.ts
const localSqliteDatasetOptions = z.strictObject({
	mode: z.literal("local-development"),
	runnerRoot: z.string(),
	controlDataRoot: z.string(),
	backupRoot: z.string(),
	runnerId: opaqueKey,
	backendRef: opaqueKey,
	maximumBytes: z.number().int().min(4096).max(256 * 1024 * 1024).default(64 * 1024 * 1024),
	timeoutMs: z.number().int().min(1e3).max(12e4).default(3e4),
	maximumWorkers: z.number().int().min(1).max(8).default(2)
});
function validateDatasetEffect(effect, options) {
	const request = datasetPreparationRequest.parse(effect.request), hash = createHash("sha256").update(canonical(request)).digest("hex");
	if (effect.kind !== "DATASET_PREPARE" || effect.previewId !== null || request.operationId !== effect.operationId || request.projectId !== effect.projectId || request.runId !== effect.runId || request.candidateId !== effect.candidateId || request.datasetId !== effect.datasetId || request.datasetId !== effect.remoteKey || request.policyHash !== effect.policyHash || hash !== effect.requestHash || request.runnerId !== options.runnerId || request.backendRef !== options.backendRef) throw new RunnerError("DATASET_ORIGINAL_REQUEST_CHANGED", 409);
	if (request.templateVersion !== webCrudDatasetProfile.templateVersion || request.schemaRevision !== webCrudDatasetProfile.schemaRevision) throw new RunnerError("DATASET_MIGRATION_NOT_CONFIGURED", 503);
	return request;
}
/** Explicit local development adapter. It cannot authorize a production migration. */
var LocalSqliteDatasetBackend = class {
	configured = true;
	options;
	#active = 0;
	#waiting = [];
	constructor(options) {
		this.options = localSqliteDatasetOptions.parse(options);
		new RunnerDatasetPaths(this.options);
	}
	async #call(action, effect, authorize) {
		validateDatasetEffect(effect, this.options);
		if (this.#active >= this.options.maximumWorkers) {
			if (this.#waiting.length >= 128) throw new RunnerError("DATASET_WORKER_BUSY", 503, "not-sent");
			await new Promise((resolve) => this.#waiting.push(resolve));
		} else this.#active++;
		try {
			return await new Promise((resolve, reject) => {
				const worker = new Worker(new URL("./dataset-worker.mjs", import.meta.url), {
					workerData: {
						action,
						effect,
						options: this.options
					},
					execArgv: []
				});
				let value, error, received = false, closed = false;
				const pending = /* @__PURE__ */ new Set();
				const timeout = setTimeout(() => {
					closed = true;
					error = new RunnerError("DATASET_WORKER_OUTCOME_UNKNOWN", 503, "unknown");
					worker.terminate();
				}, this.options.timeoutMs);
				worker.on("message", (m) => {
					if (closed) return;
					if (m.type === "authorize") {
						const request = (async () => {
							let allowed = false;
							try {
								allowed = action === "prepare" && (authorize ? await authorize() : true);
							} catch {}
							if (!closed) worker.postMessage({
								type: "authorization",
								allowed: allowed && !closed
							});
						})();
						pending.add(request);
						request.finally(() => pending.delete(request));
						return;
					}
					received = true;
					if (m.error) error = new RunnerError(m.error.code, m.error.status);
					else value = m.value;
				});
				worker.on("error", () => {
					error = new RunnerError("DATASET_WORKER_OUTCOME_UNKNOWN", 503, "unknown");
				});
				worker.once("exit", (code) => {
					closed = true;
					clearTimeout(timeout);
					Promise.allSettled(pending).then(() => {
						if (error) reject(error);
						else if (code !== 0 || !received) reject(new RunnerError("DATASET_WORKER_OUTCOME_UNKNOWN", 503, "unknown"));
						else resolve(value);
					});
				});
			});
		} finally {
			const next = this.#waiting.shift();
			if (next) next();
			else this.#active--;
		}
	}
	async preflight(effect) {
		await this.#call("preflight", effect);
	}
	async prepare(effect, authorize) {
		if (effect.state !== "SENT") throw new RunnerError("DATASET_DISPATCH_GRANT_REQUIRED", 409);
		return await this.#call("prepare", effect, authorize);
	}
	async inspect(effect) {
		return await this.#call("inspect", effect);
	}
};
//#endregion
export { RunnerDatasetPaths as i, localSqliteDatasetOptions as n, validateDatasetEffect as r, LocalSqliteDatasetBackend as t };

//# sourceMappingURL=dataset-backend-qZrMml_D.mjs.map