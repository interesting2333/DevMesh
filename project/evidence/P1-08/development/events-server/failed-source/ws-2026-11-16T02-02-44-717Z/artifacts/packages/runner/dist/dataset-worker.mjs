import { t as RunnerError } from "./protocol-CrzCRB9P.mjs";
import { i as RunnerDatasetPaths, n as localSqliteDatasetOptions, r as validateDatasetEffect } from "./dataset-backend-qZrMml_D.mjs";
import { a as readDatasetJournal, c as initializeDatasetProfile, l as validateDatasetProfile, s as validateStoredDataset, u as webCrudDatasetMarker } from "./dataset-journal-BxtC082T.mjs";
import { z } from "zod";
import { ids, sha256, timestamp } from "@devmesh/contracts";
import { createHash, randomUUID } from "node:crypto";
import { dirname } from "node:path";
import { canonical, datasetPreparationRequest, previewEffectReceipt } from "@devmesh/storage-sqlite";
import { parentPort, workerData } from "node:worker_threads";
import { closeSync, constants, existsSync, fstatSync, fsyncSync, linkSync, lstatSync, openSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { DatabaseSync, backup } from "node:sqlite";
//#region src/dataset-worker.ts
if (!parentPort) throw Error("Dataset filesystem and SQLite actions require their dedicated Worker");
const port = parentPort;
const journalSchema = z.strictObject({
	schemaVersion: z.literal("devmesh.local-dataset-operation.v1"),
	request: datasetPreparationRequest,
	requestHash: sha256,
	appDatasetId: z.uuid(),
	createdAt: timestamp
});
const receiptSchema = z.strictObject({
	schemaVersion: z.literal("devmesh.local-dataset-receipt.v1"),
	operationId: ids.operation,
	requestHash: sha256,
	receipt: previewEffectReceipt
});
function durable(path, text) {
	const fd = openSync(path, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 384);
	try {
		writeFileSync(fd, text);
		fsyncSync(fd);
	} finally {
		closeSync(fd);
	}
}
function readJson(path) {
	const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
	try {
		const s = fstatSync(fd), named = lstatSync(path);
		if (!s.isFile() || s.nlink !== 1 || s.size > 32768 || named.isSymbolicLink() || named.dev !== s.dev || named.ino !== s.ino) throw new RunnerError("DATASET_JOURNAL_UNSAFE", 409);
		const value = readFileSync(fd, "utf8"), after = fstatSync(fd);
		if (after.size !== s.size || after.mtimeMs !== s.mtimeMs) throw new RunnerError("DATASET_JOURNAL_UNSAFE", 409);
		return JSON.parse(value);
	} finally {
		closeSync(fd);
	}
}
const unknown = (errorCode) => ({
	state: "UNKNOWN",
	errorCode
});
async function main() {
	const { action, effect: raw, options: rawOptions } = workerData, options = localSqliteDatasetOptions.parse(rawOptions), effect = raw, request = validateDatasetEffect(effect, options), paths = new RunnerDatasetPaths(options);
	function originalJournal(p, expected) {
		const j = journalSchema.parse(readJson(p.journalPath));
		if (j.requestHash !== createHash("sha256").update(canonical(j.request)).digest("hex") || canonical(j.request) !== canonical(expected)) throw new RunnerError("DATASET_ORIGINAL_REQUEST_CHANGED", 409);
		return j;
	}
	function profile(path, appId) {
		const db = new DatabaseSync(path, {
			readOnly: true,
			allowExtension: false,
			enableDoubleQuotedStringLiterals: false
		});
		try {
			db.exec("PRAGMA trusted_schema=OFF; PRAGMA query_only=ON; PRAGMA busy_timeout=1000");
			validateDatasetProfile(db, appId);
		} finally {
			db.close();
		}
	}
	function verifiedReceipt(p, j) {
		const saved = receiptSchema.parse(readJson(p.receiptPath)), r = saved.receipt, marker = webCrudDatasetMarker.parse(readJson(p.markerPath));
		if (saved.operationId !== j.request.operationId || saved.requestHash !== j.requestHash || r.kind !== "DATASET_READY" || r.datasetId !== j.request.datasetId || r.storageKey !== j.request.storageKey || r.originDatasetId !== j.request.sourceDatasetId || r.schemaRevision !== j.request.schemaRevision || marker.datasetId !== j.appDatasetId) throw new RunnerError("DATASET_RECEIPT_CHANGED", 409);
		if ([
			p.databasePath,
			p.databasePath + "-wal",
			p.databasePath + "-shm"
		].reduce((n, path) => n + (existsSync(path) ? lstatSync(path).size : 0), 0) > options.maximumBytes) throw new RunnerError("DATASET_SIZE_LIMIT", 413);
		profile(p.databasePath, j.appDatasetId);
		return r;
	}
	function inspect() {
		const p = paths.resolve(request);
		if (!existsSync(p.journalPath)) return unknown("DATASET_ORIGINAL_NOT_OBSERVED");
		try {
			const j = originalJournal(p, request);
			if (!existsSync(p.receiptPath) || !existsSync(p.databasePath) || !existsSync(p.markerPath)) return unknown("DATASET_ORIGINAL_INCOMPLETE");
			return {
				state: "SUCCEEDED",
				receipt: verifiedReceipt(p, j)
			};
		} catch (error) {
			return unknown(error instanceof RunnerError ? error.code : "DATASET_ORIGINAL_UNVERIFIED");
		}
	}
	function source() {
		if (!request.sourceDatasetId) return null;
		const p = paths.resolve({
			projectId: request.projectId,
			datasetId: request.sourceDatasetId
		}), j = readDatasetJournal(p);
		if (j.projectId !== request.projectId || j.datasetId !== request.sourceDatasetId || j.storageKey !== request.sourceStorageKey || j.schemaRevision !== request.schemaRevision || j.templateVersion !== request.templateVersion || j.runnerId !== options.runnerId || (j.purpose === "PREVIEW" ? j.backendRef !== options.backendRef : j.releaseId !== request.sourceReleaseId)) throw new RunnerError("DATASET_SOURCE_CHANGED", 409);
		validateStoredDataset(p, j, options.maximumBytes);
		return {
			p,
			j
		};
	}
	if (action === "inspect") return inspect();
	const existing = paths.resolve(request);
	if (existsSync(existing.journalPath)) {
		if (action === "prepare") return inspect();
		originalJournal(existing, request);
		return;
	}
	source();
	if (action === "preflight") return void 0;
	if (effect.state !== "SENT") throw new RunnerError("DATASET_DISPATCH_GRANT_REQUIRED", 409);
	if (!await new Promise((resolve) => {
		port.once("message", (message) => resolve(message.type === "authorization" && message.allowed === true));
		port.postMessage({ type: "authorize" });
	})) return unknown("DATASET_EXECUTION_NOT_AUTHORIZED");
	const p = paths.resolve(request, true);
	if (existsSync(p.journalPath)) return inspect();
	if (readdirSync(p.directory).length) return unknown("DATASET_UNRECOGNIZED_DIRECTORY");
	const j = {
		schemaVersion: "devmesh.local-dataset-operation.v1",
		request,
		requestHash: effect.requestHash,
		appDatasetId: randomUUID(),
		createdAt: (/* @__PURE__ */ new Date()).toISOString()
	};
	function syncParents() {
		if (process.platform === "win32") return;
		for (const directory of [
			paths.root,
			dirname(p.directory),
			p.directory
		]) {
			const fd = openSync(directory, constants.O_RDONLY);
			try {
				fsyncSync(fd);
			} finally {
				closeSync(fd);
			}
		}
	}
	try {
		durable(p.journalPath, canonical(j) + "\n");
	} catch (error) {
		if (error.code === "EEXIST") return inspect();
		throw error;
	}
	try {
		syncParents();
		closeSync(openSync(p.stagingPath, "wx", 384));
		let snapshotAt = (/* @__PURE__ */ new Date()).toISOString();
		const s = source();
		if (s) {
			const db = new DatabaseSync(s.p.databasePath, {
				readOnly: true,
				allowExtension: false,
				enableDoubleQuotedStringLiterals: false
			});
			try {
				db.exec("PRAGMA trusted_schema=OFF; PRAGMA query_only=ON; PRAGMA busy_timeout=1000; BEGIN");
				validateDatasetProfile(db, s.j.appDatasetId);
				snapshotAt = (/* @__PURE__ */ new Date()).toISOString();
				const pageSize = Number(db.prepare("PRAGMA page_size").get().page_size);
				if (pageSize * Number(db.prepare("PRAGMA page_count").get().page_count) > options.maximumBytes) throw new RunnerError("DATASET_SIZE_LIMIT", 413);
				await backup(db, p.stagingPath, {
					rate: 128,
					progress({ totalPages }) {
						if (totalPages * pageSize > options.maximumBytes) throw new RunnerError("DATASET_SIZE_LIMIT", 413);
					}
				});
			} finally {
				db.close();
			}
		}
		const db = new DatabaseSync(p.stagingPath, {
			allowExtension: false,
			enableDoubleQuotedStringLiterals: false
		});
		try {
			db.exec("PRAGMA trusted_schema=OFF; PRAGMA synchronous=FULL; PRAGMA journal_mode=DELETE");
			if (s) {
				validateDatasetProfile(db, s.j.appDatasetId);
				db.prepare("UPDATE dataset_identity SET dataset_id=? WHERE singleton=1").run(j.appDatasetId);
			} else initializeDatasetProfile(db, j.appDatasetId, request.initialData, snapshotAt);
			validateDatasetProfile(db, j.appDatasetId);
		} finally {
			db.close();
		}
		const sync = openSync(p.stagingPath, constants.O_RDWR | constants.O_NOFOLLOW);
		try {
			if (lstatSync(p.stagingPath).size > options.maximumBytes) throw new RunnerError("DATASET_SIZE_LIMIT", 413);
			fsyncSync(sync);
		} finally {
			closeSync(sync);
		}
		linkSync(p.stagingPath, p.databasePath);
		unlinkSync(p.stagingPath);
		durable(p.markerPath, canonical(webCrudDatasetMarker.parse({
			kind: "web-crud-dataset",
			templateId: "web-crud-v1",
			layoutVersion: 1,
			datasetId: j.appDatasetId
		})) + "\n");
		const bytes = readFileSync(p.databasePath), receipt = {
			kind: "DATASET_READY",
			datasetId: request.datasetId,
			storageKey: request.storageKey,
			originDatasetId: request.sourceDatasetId,
			schemaRevision: request.schemaRevision,
			snapshotAt,
			sha256: createHash("sha256").update(bytes).digest("hex"),
			byteSize: bytes.length,
			integrity: "ok"
		};
		durable(p.receiptPath, canonical({
			schemaVersion: "devmesh.local-dataset-receipt.v1",
			operationId: effect.operationId,
			requestHash: effect.requestHash,
			receipt
		}) + "\n");
		syncParents();
		return {
			state: "SUCCEEDED",
			receipt
		};
	} catch (error) {
		return unknown(error instanceof RunnerError ? error.code : "DATASET_PREPARATION_INTERRUPTED");
	}
}
try {
	port.postMessage({ value: await main() });
} catch (error) {
	port.postMessage({ error: {
		code: error instanceof RunnerError ? error.code : error instanceof z.ZodError ? "DATASET_REQUEST_INVALID" : "DATASET_BACKEND_FAILURE",
		status: error instanceof RunnerError ? error.status : error instanceof z.ZodError ? 422 : 503
	} });
} finally {
	port.close();
}
//#endregion
export {};

//# sourceMappingURL=dataset-worker.mjs.map