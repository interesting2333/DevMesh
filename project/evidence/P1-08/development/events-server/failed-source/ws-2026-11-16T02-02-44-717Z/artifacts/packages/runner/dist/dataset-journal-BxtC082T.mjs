import { t as RunnerError } from "./protocol-CrzCRB9P.mjs";
import { z } from "zod";
import { ids, sha256, timestamp } from "@devmesh/contracts";
import { createHash, randomUUID } from "node:crypto";
import { acceptanceDatasetFences, acceptancePreparationRequest, acceptancePreparedProof, canonical, datasetPreparationRequest, previewEffectReceipt } from "@devmesh/storage-sqlite";
import { closeSync, constants, existsSync, fstatSync, lstatSync, openSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
//#region src/dataset-profile.ts
const webCrudDatasetProfile = {
	templateVersion: "web-crud-v1",
	schemaRevision: "web-crud-v1.schema.1"
};
const webCrudDatasetMarker = z.strictObject({
	kind: z.literal("web-crud-dataset"),
	templateId: z.literal("web-crud-v1"),
	layoutVersion: z.literal(1),
	datasetId: z.uuid()
});
const schema = [
	"CREATE TABLE dataset_identity (singleton INTEGER PRIMARY KEY CHECK(singleton=1),dataset_id TEXT NOT NULL) STRICT",
	"CREATE TABLE tasks (id TEXT PRIMARY KEY,title TEXT NOT NULL,description TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('todo','doing','done')),revision INTEGER NOT NULL CHECK(revision>0),createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL) STRICT",
	"CREATE TABLE receipts (key TEXT PRIMARY KEY,request_hash TEXT NOT NULL,response TEXT NOT NULL) STRICT"
];
const normalize = (sql) => sql.replace(/\s/g, "").toLowerCase();
const task = z.strictObject({
	id: z.uuid(),
	title: z.string().refine((v) => v.trim().length > 0 && Array.from(v).length <= 120),
	description: z.string().refine((v) => Array.from(v).length <= 4e3),
	status: z.enum([
		"todo",
		"doing",
		"done"
	]),
	revision: z.number().int().positive(),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime()
});
function validateDatasetProfile(db, appDatasetId) {
	const definitions = db.prepare("SELECT sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all();
	if (Number(db.prepare("PRAGMA user_version").get().user_version) !== 1 || definitions.length !== schema.length || definitions.some((r) => typeof r.sql !== "string" || !schema.some((s) => normalize(s) === normalize(String(r.sql)))) || db.prepare("SELECT dataset_id FROM dataset_identity WHERE singleton=1").get()?.dataset_id !== appDatasetId || Number(db.prepare("SELECT count(*) n FROM dataset_identity").get().n) !== 1 || db.prepare("PRAGMA quick_check").get()?.quick_check !== "ok" || db.prepare("PRAGMA foreign_key_check").get()) throw new RunnerError("DATASET_PROFILE_INTEGRITY", 409);
	const tasks = db.prepare("SELECT * FROM tasks LIMIT 1001").all();
	if (tasks.length > 1e3) throw new RunnerError("DATASET_PROFILE_LIMIT", 413);
	for (const row of tasks) task.parse(row);
	if (Number(db.prepare("SELECT count(*) n FROM receipts").get().n) > 1e4) throw new RunnerError("DATASET_PROFILE_LIMIT", 413);
}
function initializeDatasetProfile(db, appDatasetId, mode, time) {
	db.exec("PRAGMA synchronous=FULL; BEGIN IMMEDIATE;");
	try {
		for (const sql of schema) db.exec(sql);
		db.exec("PRAGMA user_version=1");
		db.prepare("INSERT INTO dataset_identity VALUES(1,?)").run(appDatasetId);
		if (mode === "DEMO") for (const [title, description, status] of [[
			"欢迎使用任务看板",
			"这条记录来自明确选择的演示数据。",
			"todo"
		], [
			"尝试编辑任务",
			"预览中的修改只写入当前隔离数据集。",
			"doing"
		]]) db.prepare("INSERT INTO tasks VALUES(?,?,?,?,1,?,?)").run(randomUUID(), title, description, status, time, time);
		db.exec("COMMIT");
	} catch (error) {
		db.exec("ROLLBACK");
		throw error;
	}
}
//#endregion
//#region src/dataset-journal.ts
const datasetHash = (value) => createHash("sha256").update(value).digest("hex");
const previewDatasetJournal = z.strictObject({
	schemaVersion: z.literal("devmesh.local-dataset-operation.v1"),
	request: datasetPreparationRequest,
	requestHash: sha256,
	appDatasetId: z.uuid(),
	createdAt: timestamp
});
const previewDatasetReceipt = z.strictObject({
	schemaVersion: z.literal("devmesh.local-dataset-receipt.v1"),
	operationId: ids.operation,
	requestHash: sha256,
	receipt: previewEffectReceipt
});
const acceptanceDatasetJournal = z.strictObject({
	schemaVersion: z.literal("devmesh.local-dataset-operation.v2"),
	purpose: z.literal("ACCEPTANCE"),
	request: acceptancePreparationRequest,
	requestHash: sha256,
	appDatasetId: z.uuid(),
	createdAt: timestamp
});
const acceptanceDatasetReceipt = z.strictObject({
	schemaVersion: z.literal("devmesh.local-dataset-receipt.v2"),
	purpose: z.literal("ACCEPTANCE"),
	operationId: ids.operation,
	requestHash: sha256,
	fencesHash: sha256,
	data: acceptancePreparedProof.shape.data
});
function readDatasetJson(path, maximum = 32768) {
	const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
	try {
		const before = fstatSync(fd), named = lstatSync(path);
		if (!before.isFile() || before.nlink !== 1 || before.size > maximum || named.isSymbolicLink() || named.dev !== before.dev || named.ino !== before.ino) throw new RunnerError("DATASET_JOURNAL_UNSAFE", 409);
		const bytes = readFileSync(fd), after = fstatSync(fd);
		if (after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs) throw new RunnerError("DATASET_JOURNAL_UNSAFE", 409);
		return {
			value: JSON.parse(bytes.toString("utf8")),
			bytes
		};
	} finally {
		closeSync(fd);
	}
}
function readDatasetJournal(paths) {
	const raw = readDatasetJson(paths.journalPath, 320 * 1024), legacy = previewDatasetJournal.safeParse(raw.value);
	if (legacy.success) {
		if (raw.bytes.length > 32768) throw new RunnerError("DATASET_JOURNAL_UNSAFE", 409);
		const j = legacy.data;
		if (j.requestHash !== datasetHash(canonical(j.request))) throw new RunnerError("DATASET_ORIGINAL_REQUEST_CHANGED", 409);
		return {
			purpose: "PREVIEW",
			journal: j,
			journalHash: datasetHash(raw.bytes),
			operationId: j.request.operationId,
			requestHash: j.requestHash,
			projectId: j.request.projectId,
			datasetId: j.request.datasetId,
			storageKey: j.request.storageKey,
			schemaRevision: j.request.schemaRevision,
			templateVersion: j.request.templateVersion,
			runnerId: j.request.runnerId,
			backendRef: j.request.backendRef,
			appDatasetId: j.appDatasetId,
			releaseId: null
		};
	}
	const j = acceptanceDatasetJournal.parse(raw.value);
	if (j.requestHash !== datasetHash(canonical(j.request))) throw new RunnerError("DATASET_ORIGINAL_REQUEST_CHANGED", 409);
	return {
		purpose: "ACCEPTANCE",
		journal: j,
		journalHash: datasetHash(raw.bytes),
		operationId: j.request.operationId,
		requestHash: j.requestHash,
		projectId: j.request.projectId,
		datasetId: j.request.target.datasetId,
		storageKey: j.request.target.storageKey,
		schemaRevision: j.request.target.schemaRevision,
		templateVersion: j.request.dataPlan.templateVersion,
		runnerId: j.request.runnerId,
		backendRef: j.request.backendRef,
		appDatasetId: j.appDatasetId,
		releaseId: j.request.releaseId
	};
}
function validateStoredDataset(paths, original, maximumBytes, strictAcceptanceBytes = false) {
	if (webCrudDatasetMarker.parse(readDatasetJson(paths.markerPath).value).datasetId !== original.appDatasetId) throw new RunnerError("DATASET_RECEIPT_CHANGED", 409);
	if ([
		paths.databasePath,
		paths.databasePath + "-wal",
		paths.databasePath + "-shm",
		paths.databasePath + "-journal"
	].reduce((n, path) => n + (existsSync(path) ? lstatSync(path).size : 0), 0) > maximumBytes) throw new RunnerError("DATASET_SIZE_LIMIT", 413);
	if (original.purpose === "PREVIEW") {
		const saved = previewDatasetReceipt.parse(readDatasetJson(paths.receiptPath).value), r = saved.receipt, j = original.journal;
		if (saved.operationId !== original.operationId || saved.requestHash !== original.requestHash || r.kind !== "DATASET_READY" || r.datasetId !== original.datasetId || r.storageKey !== original.storageKey || r.originDatasetId !== j.request.sourceDatasetId || r.schemaRevision !== original.schemaRevision) throw new RunnerError("DATASET_RECEIPT_CHANGED", 409);
	} else {
		const saved = acceptanceDatasetReceipt.parse(readDatasetJson(paths.receiptPath).value), r = original.journal.request, d = saved.data, fences = readDatasetJson(paths.fencesPath), f = acceptanceDatasetFences.parse(fences.value);
		if (saved.fencesHash !== datasetHash(fences.bytes) || f.operationId !== original.operationId || f.requestHash !== original.requestHash || f.targetFence.datasetId !== original.datasetId || (r.source ? f.sourceFence?.datasetId !== r.source.datasetId || f.sourceFence.datasetOperationId !== r.source.datasetOperationId : f.sourceFence !== null)) throw new RunnerError("DATASET_RECEIPT_CHANGED", 409);
		if (saved.operationId !== original.operationId || saved.requestHash !== original.requestHash || d.datasetId !== original.datasetId || d.storageKey !== original.storageKey || d.schemaRevision !== original.schemaRevision || d.journalHash !== original.journalHash || d.originDatasetId !== (r.dataPlan.strategy === "PRESERVE_MIGRATE" ? r.source.datasetId : null) || d.sourceReleaseId !== r.expectedAcceptedReleaseId || canonical(d.migrationRef) !== canonical(r.dataPlan.migrationRef)) throw new RunnerError("DATASET_RECEIPT_CHANGED", 409);
		if (strictAcceptanceBytes) {
			if (["-wal", "-journal"].some((suffix) => existsSync(paths.databasePath + suffix) && lstatSync(paths.databasePath + suffix).size > 0)) throw new RunnerError("ACCEPTANCE_DATA_BYTES_CHANGED", 409);
			const fd = openSync(paths.databasePath, constants.O_RDONLY | constants.O_NOFOLLOW);
			try {
				const stat = fstatSync(fd), bytes = readFileSync(fd), after = fstatSync(fd);
				if (stat.size !== d.byteSize || bytes.length !== d.byteSize || datasetHash(bytes) !== d.sha256 || stat.size !== after.size || stat.mtimeMs !== after.mtimeMs || stat.ctimeMs !== after.ctimeMs) throw new RunnerError("ACCEPTANCE_DATA_BYTES_CHANGED", 409);
			} finally {
				closeSync(fd);
			}
		}
	}
	const db = new DatabaseSync(paths.databasePath, {
		readOnly: true,
		allowExtension: false,
		enableDoubleQuotedStringLiterals: false
	});
	try {
		db.exec("PRAGMA trusted_schema=OFF; PRAGMA query_only=ON; PRAGMA busy_timeout=1000");
		validateDatasetProfile(db, original.appDatasetId);
	} finally {
		db.close();
	}
}
//#endregion
export { readDatasetJournal as a, initializeDatasetProfile as c, webCrudDatasetProfile as d, datasetHash as i, validateDatasetProfile as l, acceptanceDatasetJournal as n, readDatasetJson as o, acceptanceDatasetReceipt as r, validateStoredDataset as s, acceptanceDatasetFences as t, webCrudDatasetMarker as u };

//# sourceMappingURL=dataset-journal-BxtC082T.mjs.map