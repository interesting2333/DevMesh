import { t as RunnerError } from "./protocol-CrzCRB9P.mjs";
import { i as RunnerDatasetPaths, n as localSqliteDatasetOptions } from "./dataset-backend-qZrMml_D.mjs";
import { d as webCrudDatasetProfile, i as datasetHash, t as acceptanceDatasetFences } from "./dataset-journal-BxtC082T.mjs";
import { z } from "zod";
import { opaqueKey, sha256 } from "@devmesh/contracts";
import { acceptancePreparationRequest, canonical } from "@devmesh/storage-sqlite";
import { Worker } from "node:worker_threads";
//#region src/acceptance-dataset-backend.ts
const acceptanceDataOptions = localSqliteDatasetOptions.extend({ backendRef: opaqueKey });
const acceptanceCopyPlan = z.strictObject({
	schemaVersion: z.literal("devmesh.sqlite-migration.v1"),
	kind: z.literal("COPY_SAME_SCHEMA"),
	templateVersion: z.literal(webCrudDatasetProfile.templateVersion),
	fromSchema: z.literal(webCrudDatasetProfile.schemaRevision),
	toSchema: z.literal(webCrudDatasetProfile.schemaRevision)
});
function validateAcceptanceDataset(preparation, options) {
	const r = acceptancePreparationRequest.parse(preparation.request);
	if (r.operationId !== preparation.operationId || r.releaseId !== preparation.releaseId || r.projectId !== preparation.projectId || r.runId !== preparation.runId || r.candidateId !== preparation.candidateId || r.policyHash !== preparation.policyHash || r.dataPlanHash !== datasetHash(canonical(r.dataPlan)) || datasetHash(canonical(r)) !== preparation.requestHash || r.runnerId !== options.runnerId || r.backendRef !== options.backendRef) throw new RunnerError("ACCEPTANCE_DATA_ORIGINAL_CHANGED", 409);
	if (r.dataPlan.templateVersion !== webCrudDatasetProfile.templateVersion || r.target.schemaRevision !== webCrudDatasetProfile.schemaRevision || r.source && r.source.schemaRevision !== webCrudDatasetProfile.schemaRevision) throw new RunnerError("ACCEPTANCE_DATA_MIGRATION_NOT_CONFIGURED", 503);
	return r;
}
function validateAcceptanceFences(value, p) {
	const f = acceptanceDatasetFences.parse(value), s = p.request.source;
	if (f.operationId !== p.operationId || f.requestHash !== p.requestHash || f.targetFence.datasetId !== p.request.target.datasetId || (s ? f.sourceFence?.datasetId !== s.datasetId || f.sourceFence.datasetOperationId !== s.datasetOperationId : f.sourceFence !== null)) throw new RunnerError("ACCEPTANCE_DATA_CUSTODY_CHANGED", 409);
	return f;
}
function validateAcceptanceMigration(bytes, preparation, trusted) {
	const ref = preparation.request.dataPlan.migrationRef;
	if (!ref || bytes.length > 32768 || !trusted.includes(ref.sha256) || datasetHash(bytes) !== ref.sha256) throw new RunnerError("ACCEPTANCE_DATA_MIGRATION_UNTRUSTED", 409);
	return acceptanceCopyPlan.parse(JSON.parse(Buffer.from(bytes).toString("utf8")));
}
/** Explicit local data materializer. This produces data evidence only; it does
* not implement AcceptancePreparationBackend or attest service/release readiness. */
var LocalSqliteAcceptanceDatasetBackend = class {
	options;
	authority;
	trustedMigrationHashes;
	loadMigration;
	#active = 0;
	#waiting = [];
	constructor(options) {
		const { authority, trustedMigrationHashes = [], loadMigration, ...paths } = options;
		this.options = acceptanceDataOptions.parse(paths);
		new RunnerDatasetPaths(this.options);
		this.authority = authority;
		this.trustedMigrationHashes = Object.freeze(trustedMigrationHashes.map((h) => sha256.parse(h)));
		this.loadMigration = loadMigration;
	}
	get configured() {
		return this.authority?.configured === true;
	}
	async #call(action, preparation, authorize) {
		validateAcceptanceDataset(preparation, this.options);
		if (!this.configured) throw new RunnerError("ACCEPTANCE_DATA_CUSTODY_NOT_CONFIGURED", 503, "not-sent");
		if (this.#active >= this.options.maximumWorkers) {
			if (this.#waiting.length >= 128) throw new RunnerError("ACCEPTANCE_DATA_WORKER_BUSY", 503, "not-sent");
			await new Promise((resolve) => this.#waiting.push(resolve));
		} else this.#active++;
		try {
			return await new Promise((resolve, reject) => {
				const worker = new Worker(new URL("./acceptance-dataset-worker.mjs", import.meta.url), {
					workerData: {
						action,
						preparation,
						options: this.options,
						trustedMigrationHashes: this.trustedMigrationHashes
					},
					execArgv: []
				});
				let value, error, received = false, finished = false;
				const rpc = /* @__PURE__ */ new Set();
				const allowed = async () => !finished && !!authorize && await authorize() && !finished;
				const timeout = setTimeout(() => {
					finished = true;
					error = new RunnerError("ACCEPTANCE_DATA_OUTCOME_UNKNOWN", 503, "unknown");
					worker.terminate();
				}, this.options.timeoutMs);
				worker.on("message", (m) => {
					if (m.rpc) {
						const task = (async () => {
							try {
								let result;
								if (finished) return;
								if (m.rpc === "authorize") result = await allowed();
								else if (m.rpc === "preflight") await this.authority.preflight(preparation);
								else if (m.rpc === "acquire") {
									if (!await allowed()) throw new RunnerError("ACCEPTANCE_DATA_AUTHORIZATION_CHANGED", 409);
									result = validateAcceptanceFences(await this.authority.acquire(preparation, allowed), preparation);
								} else if (m.rpc === "inspect" || m.rpc === "verify") {
									if (m.rpc === "verify" && !await allowed()) throw new RunnerError("ACCEPTANCE_DATA_AUTHORIZATION_CHANGED", 409);
									result = validateAcceptanceFences(await this.authority.inspect(preparation), preparation);
								} else if (m.rpc === "migration") {
									if (!this.loadMigration) throw new RunnerError("ACCEPTANCE_DATA_MIGRATION_NOT_CONFIGURED", 503);
									const bytes = await this.loadMigration(preparation.request.dataPlan.migrationRef);
									validateAcceptanceMigration(bytes, preparation, this.trustedMigrationHashes);
									result = bytes;
								} else throw new RunnerError("ACCEPTANCE_DATA_WORKER_PROTOCOL", 409);
								if (!finished) worker.postMessage({
									id: m.id,
									value: result
								});
							} catch (e) {
								if (!finished) worker.postMessage({
									id: m.id,
									error: {
										code: e instanceof RunnerError ? e.code : "ACCEPTANCE_DATA_AUTHORITY_UNVERIFIED",
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
					error = new RunnerError("ACCEPTANCE_DATA_OUTCOME_UNKNOWN", 503, "unknown");
				});
				worker.once("exit", (code) => {
					finished = true;
					clearTimeout(timeout);
					(async () => {
						await Promise.allSettled(rpc);
						if (error) reject(error);
						else if (code !== 0 || !received) reject(new RunnerError("ACCEPTANCE_DATA_OUTCOME_UNKNOWN", 503, "unknown"));
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
	async preflight(preparation) {
		await this.#call("preflight", preparation);
	}
	async prepare(preparation, authorize) {
		if (preparation.state !== "SENT") throw new RunnerError("ACCEPTANCE_DATA_DISPATCH_GRANT_REQUIRED", 409);
		return await this.#call("prepare", preparation, authorize);
	}
	async inspect(preparation) {
		return await this.#call("inspect", preparation);
	}
};
//#endregion
export { validateAcceptanceMigration as a, validateAcceptanceFences as i, acceptanceDataOptions as n, validateAcceptanceDataset as r, LocalSqliteAcceptanceDatasetBackend as t };

//# sourceMappingURL=acceptance-dataset-backend-lXOInqKH.mjs.map