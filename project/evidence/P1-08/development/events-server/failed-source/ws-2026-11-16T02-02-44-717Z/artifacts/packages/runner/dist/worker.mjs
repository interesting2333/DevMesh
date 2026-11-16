import { l as startJob, o as ownerKey, s as renewJob, t as RunnerError } from "./protocol-CrzCRB9P.mjs";
import { i as workspaceFenceSchema, n as releaseWorkspaceFence, r as workspaceBindingSchema, t as acquireWorkspaceFence } from "./workspace-fence-BX3LCM3x.mjs";
import { A as acceptanceServiceActionRecord, B as previewContainerActionRequest, C as releaseRetirementActionRequest, D as releaseRetirementStoreRequests, H as previewContainerNames, I as acceptanceServiceReservation, J as reservePreview, K as previewReservationSchema, L as reserveAcceptanceService, M as acceptanceServiceFact, N as acceptanceServiceNames, O as acceptanceServiceActionKind, P as acceptanceServiceProfile, S as releaseRetirementAction, T as releaseRetirementRequest, U as previewContainerObservation, V as previewContainerActionSchema, W as previewContainerProfile, Y as runnerCapacity, _ as runnerPreviewLifecycle, a as releaseServiceGateBinding, c as releaseServiceProfile, d as releaseServiceStoreRequests, f as previewCleanupAction, g as previewReleaseClaim, h as previewCleanupRequest, j as acceptanceServiceActionRequest, k as acceptanceServiceActionObservation, l as releaseServiceRequest, m as previewCleanupObservation, n as releaseServiceActionRequest, p as previewCleanupKind, s as releaseServiceNames, t as releaseServiceAction, u as releaseServiceReservation, v as acceptanceAbortAction, x as acceptanceAbortStoreRequests, y as acceptanceAbortActionRequest, z as previewContainerAction } from "./release-service-CQfgXb3J.mjs";
import { ZodError, z } from "zod";
import { opaqueKey } from "@devmesh/contracts";
import { createHash, randomUUID } from "node:crypto";
import { acceptanceAbortDecision, acceptancePreparedProof, acceptanceServiceClaim, canonical, previewRuntimeFact, previewStopRequest, releasePublicationProof, releaseServiceClaim } from "@devmesh/storage-sqlite";
import { parentPort, workerData } from "node:worker_threads";
import { performance } from "node:perf_hooks";
import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
//#region src/store-protocol.ts
const owner = { controllerId: opaqueKey };
const previewBound = {
	...owner,
	reservationId: opaqueKey,
	requestHash: z.string().regex(/^[a-f0-9]{64}$/)
};
const storeRequests = {
	...acceptanceAbortStoreRequests,
	...releaseRetirementStoreRequests,
	...releaseServiceStoreRequests,
	acceptanceServiceReserve: z.strictObject({
		...owner,
		...reserveAcceptanceService.shape
	}),
	acceptanceServiceGet: z.strictObject(previewBound),
	acceptanceServiceByOperation: z.strictObject({
		...owner,
		operationId: opaqueKey
	}),
	acceptanceServicePage: z.strictObject({
		...owner,
		afterSequence: z.number().int().nonnegative().default(0),
		limit: z.number().int().min(1).max(100).default(20)
	}),
	acceptanceServiceDispatch: z.strictObject(previewBound),
	acceptanceServiceCancel: z.strictObject(previewBound),
	acceptanceServiceRecord: z.strictObject({
		...previewBound,
		expectedRevision: z.number().int().nonnegative().safe(),
		fact: acceptanceServiceFact
	}),
	acceptanceServiceProfilePrepare: z.strictObject({
		...previewBound,
		profile: acceptanceServiceProfile
	}),
	acceptanceServiceJournal: z.strictObject(previewBound),
	acceptanceServiceActionBegin: z.strictObject({
		...previewBound,
		kind: acceptanceServiceActionKind
	}),
	acceptanceServiceActionAuthorized: z.strictObject({
		...previewBound,
		kind: acceptanceServiceActionKind,
		actionRequestHash: z.string().regex(/^[a-f0-9]{64}$/)
	}),
	acceptanceServiceActionObserve: z.strictObject({
		...previewBound,
		kind: acceptanceServiceActionKind,
		actionRequestHash: z.string().regex(/^[a-f0-9]{64}$/),
		observation: acceptanceServiceActionObservation
	}),
	acceptanceServiceHold: z.strictObject({
		...previewBound,
		claim: acceptanceServiceClaim,
		claimHash: z.string().regex(/^[a-f0-9]{64}$/)
	}),
	acceptanceServicePrepareProof: z.strictObject(previewBound),
	previewCleanupGet: z.strictObject(previewBound),
	previewCleanupPage: z.strictObject({
		...owner,
		afterSequence: z.number().int().nonnegative().default(0),
		limit: z.number().int().min(1).max(100).default(20)
	}),
	previewCleanupActionBegin: z.strictObject({
		...previewBound,
		kind: previewCleanupKind
	}),
	previewCleanupActionAuthorized: z.strictObject({
		...previewBound,
		kind: previewCleanupKind,
		actionRequestHash: z.string().regex(/^[a-f0-9]{64}$/)
	}),
	previewCleanupActionObserve: z.strictObject({
		...previewBound,
		kind: previewCleanupKind,
		actionRequestHash: z.string().regex(/^[a-f0-9]{64}$/),
		observation: previewCleanupObservation
	}),
	previewLifecycleEnroll: z.strictObject(previewBound),
	previewLifecycleGet: z.strictObject(previewBound),
	previewExpiryPrepare: z.strictObject(previewBound),
	previewExpiryAuthorized: z.strictObject({
		...previewBound,
		expiryRequestHash: z.string().regex(/^[a-f0-9]{64}$/)
	}),
	previewLifecycleActionAuthorized: z.strictObject({
		...previewBound,
		kind: previewContainerAction,
		actionRequestHash: z.string().regex(/^[a-f0-9]{64}$/)
	}),
	previewReleaseHold: z.strictObject({
		...previewBound,
		claim: previewReleaseClaim,
		claimHash: z.string().regex(/^[a-f0-9]{64}$/)
	}),
	previewReleaseCommit: z.strictObject({
		...previewBound,
		claimHash: z.string().regex(/^[a-f0-9]{64}$/),
		releaseId: opaqueKey,
		acceptanceOperationId: opaqueKey,
		acceptanceRequestHash: z.string().regex(/^[a-f0-9]{64}$/)
	}),
	previewContainerPrepare: z.strictObject({
		...previewBound,
		profile: previewContainerProfile
	}),
	previewContainerGet: z.strictObject(previewBound),
	previewContainerActionBegin: z.strictObject({
		...previewBound,
		action: previewContainerActionRequest
	}),
	previewContainerActionObserve: z.strictObject({
		...previewBound,
		kind: previewContainerAction,
		actionRequestHash: z.string().regex(/^[a-f0-9]{64}$/),
		observation: previewContainerObservation
	}),
	capacityConfigure: runnerCapacity,
	capacityUsage: z.strictObject({}),
	previewReserve: z.strictObject({
		...owner,
		...reservePreview.shape
	}),
	previewReservationGet: z.strictObject({
		...owner,
		reservationId: opaqueKey
	}),
	previewReservationByOperation: z.strictObject({
		...owner,
		operationId: opaqueKey
	}),
	previewReservationPage: z.strictObject({
		...owner,
		afterSequence: z.number().int().nonnegative().default(0),
		limit: z.number().int().min(1).max(100).default(20)
	}),
	previewReservationDispatch: z.strictObject({
		...owner,
		reservationId: opaqueKey,
		requestHash: z.string().regex(/^[a-f0-9]{64}$/)
	}),
	previewReservationCancel: z.strictObject({
		...owner,
		reservationId: opaqueKey,
		requestHash: z.string().regex(/^[a-f0-9]{64}$/)
	}),
	previewReservationRecord: z.strictObject({
		...owner,
		reservationId: opaqueKey,
		requestHash: z.string().regex(/^[a-f0-9]{64}$/),
		expectedRevision: z.number().int().nonnegative(),
		fact: previewRuntimeFact
	}),
	fenceAcquire: z.strictObject({
		...owner,
		request: acquireWorkspaceFence,
		workspacePath: z.string().min(1),
		binding: workspaceBindingSchema
	}),
	fenceGet: z.strictObject({
		...owner,
		fenceId: opaqueKey
	}),
	fenceByOperation: z.strictObject({
		...owner,
		operationId: opaqueKey
	}),
	fenceActive: z.strictObject({
		...owner,
		workspaceRef: opaqueKey
	}),
	fenceRelease: z.strictObject({
		...owner,
		fenceId: opaqueKey,
		release: releaseWorkspaceFence
	}),
	workspaceBinding: z.strictObject({ workspaceRef: opaqueKey }),
	register: z.strictObject({
		...owner,
		request: startJob,
		execution: z.strictObject({
			workspacePath: z.string().min(1),
			argv: z.array(z.string()).min(1)
		})
	}),
	get: z.strictObject({
		...owner,
		jobId: opaqueKey
	}),
	byOperation: z.strictObject({
		...owner,
		operationId: opaqueKey
	}),
	pending: z.strictObject({ limit: z.number().int().min(1).max(100).default(20) }),
	active: z.strictObject({}),
	claim: z.strictObject({
		jobId: opaqueKey,
		maximumJobs: z.number().int().min(1).max(4),
		cpu: z.number().positive(),
		memoryMiB: z.number().int().positive()
	}),
	stop: z.strictObject({
		...owner,
		jobId: opaqueKey
	}),
	renew: z.strictObject({
		...owner,
		jobId: opaqueKey,
		renewal: renewJob
	}),
	record: z.strictObject({
		jobId: opaqueKey,
		state: z.enum([
			"RUNNING",
			"STOPPING",
			"EXITED",
			"OUTCOME_UNKNOWN"
		]),
		containerId: z.string().nullable(),
		exitCode: z.number().int().nullable(),
		evidence: z.record(z.string(), z.json()).nullable(),
		errorCode: opaqueKey.nullable(),
		materials: z.strictObject({
			logCursor: z.number().int().nonnegative(),
			outputRefs: z.array(z.strictObject({
				path: z.string().min(1),
				sha256: z.string().regex(/^[a-f0-9]{64}$/),
				byteSize: z.number().int().nonnegative()
			})).max(33)
		}).optional()
	}),
	inspect: z.strictObject({})
};
//#endregion
//#region src/fence-domain.ts
const migration$3 = `
ALTER TABLE runner_identity RENAME TO runner_identity_v1;
CREATE TABLE runner_identity(singleton INTEGER PRIMARY KEY CHECK(singleton=1),runner_id TEXT NOT NULL,version INTEGER NOT NULL CHECK(version=2)) STRICT;
INSERT INTO runner_identity SELECT singleton,runner_id,2 FROM runner_identity_v1;
DROP TABLE runner_identity_v1;
CREATE TABLE runner_schema_history(version INTEGER PRIMARY KEY,sha256 TEXT NOT NULL,applied_at TEXT NOT NULL) STRICT;
CREATE TABLE workspace_bindings(workspace_ref TEXT PRIMARY KEY,binding_json TEXT NOT NULL CHECK(json_valid(binding_json)),created_at TEXT NOT NULL) STRICT;
CREATE TRIGGER immutable_workspace_binding BEFORE UPDATE ON workspace_bindings BEGIN SELECT RAISE(ABORT,'WORKSPACE_BINDING_IMMUTABLE'); END;
CREATE TABLE workspace_fences(fence_id TEXT PRIMARY KEY,controller_id TEXT NOT NULL,operation_id TEXT NOT NULL,workspace_ref TEXT NOT NULL,workspace_path TEXT NOT NULL,holder_token TEXT NOT NULL,request_hash TEXT NOT NULL,request_json TEXT NOT NULL CHECK(json_valid(request_json)),state TEXT NOT NULL CHECK(state IN ('ACTIVE','RELEASED')),created_at TEXT NOT NULL,released_at TEXT,UNIQUE(controller_id,operation_id),CHECK((state='ACTIVE' AND released_at IS NULL) OR (state='RELEASED' AND released_at IS NOT NULL))) STRICT;
CREATE UNIQUE INDEX exclusive_workspace_fence ON workspace_fences(workspace_path) WHERE state='ACTIVE';
CREATE TRIGGER immutable_workspace_fence BEFORE UPDATE ON workspace_fences WHEN OLD.state='RELEASED' OR NEW.fence_id<>OLD.fence_id OR NEW.controller_id<>OLD.controller_id OR NEW.operation_id<>OLD.operation_id OR NEW.workspace_ref<>OLD.workspace_ref OR NEW.workspace_path<>OLD.workspace_path OR NEW.holder_token<>OLD.holder_token OR NEW.request_hash<>OLD.request_hash OR NEW.request_json<>OLD.request_json OR NEW.created_at<>OLD.created_at BEGIN SELECT RAISE(ABORT,'WORKSPACE_FENCE_IMMUTABLE'); END;
PRAGMA user_version=2;`;
const hash$9 = (v) => createHash("sha256").update(v).digest("hex");
const fail$8 = (code, status = 409) => {
	throw new RunnerError(code, status);
};
function createRunnerFenceDomain(db) {
	const get = (sql, ...args) => db.prepare(sql).get(...args);
	const exec = (sql, ...args) => db.prepare(sql).run(...args);
	const transaction = (body) => {
		db.exec("BEGIN IMMEDIATE");
		try {
			const result = body();
			db.exec("COMMIT");
			return result;
		} catch (e) {
			db.exec("ROLLBACK");
			throw e;
		}
	};
	const version = Number(Object.values(db.prepare("PRAGMA user_version").get())[0]);
	if (version === 1) transaction(() => {
		db.exec(migration$3);
		exec("INSERT INTO runner_schema_history VALUES(2,?,?)", hash$9(migration$3), (/* @__PURE__ */ new Date()).toISOString());
	});
	else if (![
		2,
		3,
		4,
		5,
		6,
		7,
		8,
		9,
		10,
		11,
		12
	].includes(version)) fail$8("RUNNER_STORE_IDENTITY_MISMATCH");
	if (get("SELECT sha256 FROM runner_schema_history WHERE version=2")?.sha256 !== hash$9(migration$3) || get("SELECT version FROM runner_identity WHERE singleton=1")?.version !== (version === 1 ? 2 : version)) fail$8("RUNNER_MIGRATION_DRIFT");
	const view = (r) => workspaceFenceSchema.parse({
		fenceId: String(r.fence_id),
		controllerId: String(r.controller_id),
		operationId: String(r.operation_id),
		workspaceRef: String(r.workspace_ref),
		workspacePath: String(r.workspace_path),
		holderToken: String(r.holder_token),
		requestHash: String(r.request_hash),
		request: JSON.parse(String(r.request_json)),
		state: r.state,
		createdAt: String(r.created_at),
		releasedAt: r.released_at
	});
	const owned = (controllerId, fenceId) => {
		return get("SELECT * FROM workspace_fences WHERE fence_id=? AND controller_id=?", fenceId, controllerId) ?? fail$8("WORKSPACE_FENCE_NOT_FOUND", 404);
	};
	const assertAvailable = (workspacePath) => {
		if (get("SELECT 1 FROM workspace_fences WHERE workspace_path=? AND state='ACTIVE'", workspacePath)) fail$8("RUNNER_WORKSPACE_FENCED", 423);
	};
	return {
		assertAvailable,
		fenceAcquire(i) {
			return transaction(() => {
				const requestHash = hash$9(canonical({
					request: i.request,
					binding: i.binding,
					workspacePath: i.workspacePath
				})), old = get("SELECT * FROM workspace_fences WHERE controller_id=? AND operation_id=?", i.controllerId, i.request.operationId);
				if (old) {
					if (old.request_hash !== requestHash) fail$8("IDEMPOTENCY_KEY_REUSED");
					return view(old);
				}
				assertAvailable(i.workspacePath);
				if (get("SELECT 1 FROM jobs WHERE state<>'EXITED' AND json_extract(execution_json,'$.workspacePath')=?", i.workspacePath)) fail$8("RUNNER_WORKSPACE_BUSY");
				const prior = get("SELECT binding_json FROM workspace_bindings WHERE workspace_ref=?", i.request.workspaceRef), binding = canonical(i.binding), now = (/* @__PURE__ */ new Date()).toISOString();
				if (prior && prior.binding_json !== binding) fail$8("RUNNER_WORKSPACE_BINDING_CHANGED");
				if (!prior) exec("INSERT INTO workspace_bindings VALUES(?,?,?)", i.request.workspaceRef, binding, now);
				const id = "fence_" + randomUUID().replaceAll("-", "");
				exec("INSERT INTO workspace_fences VALUES(?,?,?,?,?,?,?,?,'ACTIVE',?,NULL)", id, i.controllerId, i.request.operationId, i.request.workspaceRef, i.workspacePath, i.request.holderToken, requestHash, canonical(i.request), now);
				return view(owned(i.controllerId, id));
			});
		},
		fenceGet(i) {
			return view(owned(i.controllerId, i.fenceId));
		},
		fenceByOperation(i) {
			const row = get("SELECT * FROM workspace_fences WHERE controller_id=? AND operation_id=?", i.controllerId, i.operationId);
			return row ? view(row) : null;
		},
		fenceActive(i) {
			const row = get("SELECT * FROM workspace_fences WHERE controller_id=? AND workspace_ref=? AND state='ACTIVE'", i.controllerId, i.workspaceRef);
			return row ? view(row) : null;
		},
		fenceRelease(i) {
			return transaction(() => {
				const row = owned(i.controllerId, i.fenceId);
				if (row.holder_token !== i.release.holderToken || row.request_hash !== i.release.requestHash) fail$8("RUNNER_WORKSPACE_FENCE_OWNER_CHANGED", 403);
				if (row.state === "ACTIVE") exec("UPDATE workspace_fences SET state='RELEASED',released_at=? WHERE fence_id=?", (/* @__PURE__ */ new Date()).toISOString(), i.fenceId);
				return view(owned(i.controllerId, i.fenceId));
			});
		},
		workspaceBinding(i) {
			const row = get("SELECT binding_json FROM workspace_bindings WHERE workspace_ref=?", i.workspaceRef);
			return row ? JSON.parse(String(row.binding_json)) : null;
		}
	};
}
//#endregion
//#region src/capacity-domain.ts
const migration$2 = `
ALTER TABLE runner_identity RENAME TO runner_identity_v2;
CREATE TABLE runner_identity(singleton INTEGER PRIMARY KEY CHECK(singleton=1),runner_id TEXT NOT NULL,version INTEGER NOT NULL CHECK(version=3)) STRICT;
INSERT INTO runner_identity SELECT singleton,runner_id,3 FROM runner_identity_v2;
DROP TABLE runner_identity_v2;
CREATE TABLE preview_reservations(sequence INTEGER PRIMARY KEY,reservation_id TEXT NOT NULL UNIQUE,controller_id TEXT NOT NULL,operation_id TEXT NOT NULL,preview_id TEXT NOT NULL,dataset_id TEXT NOT NULL,request_hash TEXT NOT NULL,request_json TEXT NOT NULL CHECK(json_valid(request_json)),limits_json TEXT NOT NULL CHECK(json_valid(limits_json)),state TEXT NOT NULL CHECK(state IN ('RESERVED','DISPATCHED','ACTIVE','UNKNOWN','EXITED','CANCELLED')),revision INTEGER NOT NULL CHECK(revision>=0),instance_id TEXT,endpoint_json TEXT CHECK(endpoint_json IS NULL OR json_valid(endpoint_json)),fact_json TEXT CHECK(fact_json IS NULL OR json_valid(fact_json)),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,released_at TEXT,UNIQUE(controller_id,operation_id),CHECK((state IN ('EXITED','CANCELLED') AND released_at IS NOT NULL) OR (state NOT IN ('EXITED','CANCELLED') AND released_at IS NULL)),CHECK(state<>'RESERVED' OR (instance_id IS NULL AND fact_json IS NULL)),CHECK(state<>'EXITED' OR instance_id IS NOT NULL)) STRICT;
CREATE UNIQUE INDEX exclusive_preview_reservation ON preview_reservations(preview_id) WHERE released_at IS NULL;
CREATE UNIQUE INDEX exclusive_preview_dataset ON preview_reservations(dataset_id) WHERE released_at IS NULL;
CREATE TABLE preview_reservation_events(reservation_id TEXT NOT NULL REFERENCES preview_reservations(reservation_id),revision INTEGER NOT NULL,snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),created_at TEXT NOT NULL,PRIMARY KEY(reservation_id,revision)) STRICT;
CREATE TRIGGER immutable_preview_reservation BEFORE UPDATE ON preview_reservations WHEN OLD.released_at IS NOT NULL OR NEW.sequence<>OLD.sequence OR NEW.reservation_id<>OLD.reservation_id OR NEW.controller_id<>OLD.controller_id OR NEW.operation_id<>OLD.operation_id OR NEW.preview_id<>OLD.preview_id OR NEW.dataset_id<>OLD.dataset_id OR NEW.request_hash<>OLD.request_hash OR NEW.request_json<>OLD.request_json OR NEW.limits_json<>OLD.limits_json OR NEW.created_at<>OLD.created_at OR (OLD.instance_id IS NOT NULL AND NEW.instance_id IS NOT OLD.instance_id) OR (OLD.endpoint_json IS NOT NULL AND NEW.endpoint_json IS NOT OLD.endpoint_json) BEGIN SELECT RAISE(ABORT,'PREVIEW_RESERVATION_IMMUTABLE'); END;
CREATE TRIGGER preserve_preview_reservation BEFORE DELETE ON preview_reservations BEGIN SELECT RAISE(ABORT,'PREVIEW_RESERVATION_IMMUTABLE'); END;
CREATE TRIGGER immutable_preview_reservation_event BEFORE UPDATE ON preview_reservation_events BEGIN SELECT RAISE(ABORT,'PREVIEW_RESERVATION_EVENT_IMMUTABLE'); END;
CREATE TRIGGER preserve_preview_reservation_event BEFORE DELETE ON preview_reservation_events BEGIN SELECT RAISE(ABORT,'PREVIEW_RESERVATION_EVENT_IMMUTABLE'); END;
PRAGMA user_version=3;`;
const hash$8 = (v) => createHash("sha256").update(typeof v === "string" ? v : canonical(v)).digest("hex");
const fail$7 = (code, status = 409) => {
	throw new RunnerError(code, status);
};
/** Private to the Runner writer; physical facts must come from a trusted backend. */
function createRunnerCapacityDomain(db, runnerId) {
	const get = (sql, ...args) => db.prepare(sql).get(...args);
	const all = (sql, ...args) => db.prepare(sql).all(...args);
	const exec = (sql, ...args) => db.prepare(sql).run(...args);
	const tx = (body) => {
		db.exec("BEGIN IMMEDIATE");
		try {
			const value = body();
			db.exec("COMMIT");
			return value;
		} catch (error) {
			db.exec("ROLLBACK");
			throw error;
		}
	};
	const version = Number(Object.values(db.prepare("PRAGMA user_version").get())[0]);
	if (version === 2) tx(() => {
		db.exec(migration$2);
		exec("INSERT INTO runner_schema_history VALUES(3,?,?)", hash$8(migration$2), (/* @__PURE__ */ new Date()).toISOString());
	});
	else if (![
		3,
		4,
		5,
		6,
		7,
		8,
		9,
		10,
		11,
		12
	].includes(version)) fail$7("RUNNER_STORE_IDENTITY_MISMATCH");
	if (get("SELECT sha256 FROM runner_schema_history WHERE version=3")?.sha256 !== hash$8(migration$2) || get("SELECT version FROM runner_identity WHERE singleton=1")?.version !== (version === 2 ? 3 : version)) fail$7("RUNNER_MIGRATION_DRIFT");
	let capacity = null;
	const configure = (input) => {
		const parsed = runnerCapacity.parse(input);
		if (capacity && canonical(capacity) !== canonical(parsed)) fail$7("RUNNER_CAPACITY_CONFIG_CHANGED");
		return capacity ??= Object.freeze(parsed);
	};
	const usage = () => {
		const jobs = all("SELECT request_json FROM jobs WHERE state NOT IN ('QUEUED','EXITED')").map((r) => JSON.parse(String(r.request_json)).resourceLimits);
		const previews = all("SELECT limits_json FROM preview_reservations WHERE released_at IS NULL").map((r) => JSON.parse(String(r.limits_json)));
		const services = all("SELECT limits_json FROM acceptance_services WHERE released_at IS NULL").map((r) => JSON.parse(String(r.limits_json)));
		const releases = all("SELECT h.limits_json FROM release_service_reservations r JOIN release_service_handoffs h ON h.release_id=r.release_id WHERE r.released_at IS NULL").map((r) => JSON.parse(String(r.limits_json)));
		const used = [
			...jobs,
			...previews,
			...services,
			...releases
		];
		return {
			slots: used.length,
			jobSlots: jobs.length,
			previewSlots: previews.length,
			acceptanceServiceSlots: services.length,
			releaseServiceSlots: releases.length,
			cpu: used.reduce((sum, l) => sum + l.cpu, 0),
			memoryMiB: used.reduce((sum, l) => sum + l.memoryMiB, 0)
		};
	};
	const fits = (limits, budget) => {
		const c = configure(budget), u = usage();
		return u.slots < c.maximumJobs && u.cpu + limits.cpu <= c.cpu && u.memoryMiB + limits.memoryMiB <= c.memoryMiB;
	};
	const view = (r) => previewReservationSchema.parse({
		reservationId: r.reservation_id,
		controllerId: r.controller_id,
		request: JSON.parse(String(r.request_json)),
		requestHash: r.request_hash,
		resourceLimits: JSON.parse(String(r.limits_json)),
		state: r.state,
		revision: r.revision,
		instanceId: r.instance_id,
		endpoint: r.endpoint_json ? JSON.parse(String(r.endpoint_json)) : null,
		fact: r.fact_json ? JSON.parse(String(r.fact_json)) : null,
		createdAt: r.created_at,
		updatedAt: r.updated_at,
		releasedAt: r.released_at
	});
	const owned = (controllerId, id) => get("SELECT * FROM preview_reservations WHERE reservation_id=? AND controller_id=?", id, controllerId) ?? fail$7("PREVIEW_RESERVATION_NOT_FOUND", 404);
	const bound = (i) => {
		const r = owned(i.controllerId, i.reservationId);
		if (r.request_hash !== i.requestHash) fail$7("PREVIEW_RESERVATION_IDENTITY_MISMATCH");
		return r;
	};
	const event = (r) => exec("INSERT INTO preview_reservation_events VALUES(?,?,?,?)", String(r.reservation_id), Number(r.revision), canonical(view(r)), String(r.updated_at));
	const changed = (r) => {
		const current = owned(String(r.controller_id), String(r.reservation_id));
		event(current);
		return view(current);
	};
	return {
		recordRemoved(i, checkedAt) {
			const r = bound(i);
			if (r.released_at !== null) return;
			if (r.instance_id === null || r.state === "RESERVED") fail$7("PREVIEW_CLEANUP_ORIGINAL_UNKNOWN");
			const request = JSON.parse(String(r.request_json)), fact = {
				previewId: request.previewId,
				datasetId: request.datasetId,
				imageDigest: request.imageDigest,
				state: "REMOVED",
				instanceId: r.instance_id,
				endpoint: null,
				checkedAt
			}, at = (/* @__PURE__ */ new Date()).toISOString();
			exec("UPDATE preview_reservations SET state='REMOVED',revision=revision+1,fact_json=?,updated_at=?,released_at=? WHERE reservation_id=?", canonical(fact), at, at, i.reservationId);
			changed(r);
		},
		fits,
		capacityConfigure: configure,
		capacityUsage() {
			return {
				capacity,
				usage: usage()
			};
		},
		previewReserve(i) {
			return tx(() => {
				if (i.request.runnerId !== runnerId || i.requestHash !== hash$8(i.request)) fail$7("PREVIEW_RESERVATION_IDENTITY_MISMATCH");
				const old = get("SELECT * FROM preview_reservations WHERE controller_id=? AND operation_id=?", i.controllerId, i.request.operationId);
				if (old) {
					if (old.request_hash !== i.requestHash || old.limits_json !== canonical(i.resourceLimits)) fail$7("IDEMPOTENCY_KEY_REUSED");
					return view(old);
				}
				if (Date.parse(i.request.expiresAt) <= Date.now()) fail$7("PREVIEW_RESERVATION_EXPIRED");
				if (get("SELECT 1 FROM preview_reservations WHERE released_at IS NULL AND (preview_id=? OR dataset_id=?)", i.request.previewId, i.request.datasetId)) fail$7("PREVIEW_RESERVATION_BUSY");
				if (get("SELECT 1 FROM acceptance_services WHERE released_at IS NULL AND dataset_id=?", i.request.datasetId)) fail$7("PREVIEW_RESERVATION_BUSY");
				if (get("SELECT 1 FROM release_retirements WHERE dataset_id=?", i.request.datasetId)) fail$7("PREVIEW_RESERVATION_BUSY");
				if (!fits(i.resourceLimits, i.capacity)) fail$7("RUNNER_CAPACITY_EXHAUSTED", 429);
				const id = "reservation_" + randomUUID().replaceAll("-", ""), now = (/* @__PURE__ */ new Date()).toISOString();
				exec("INSERT INTO preview_reservations(reservation_id,controller_id,operation_id,preview_id,dataset_id,request_hash,request_json,limits_json,state,revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,'RESERVED',0,?,?)", id, i.controllerId, i.request.operationId, i.request.previewId, i.request.datasetId, i.requestHash, canonical(i.request), canonical(i.resourceLimits), now, now);
				return changed(owned(i.controllerId, id));
			});
		},
		previewReservationGet(i) {
			return view(owned(i.controllerId, i.reservationId));
		},
		previewReservationByOperation(i) {
			const r = get("SELECT * FROM preview_reservations WHERE controller_id=? AND operation_id=?", i.controllerId, i.operationId);
			return r ? view(r) : null;
		},
		previewReservationPage(i) {
			const limit = i.limit ?? 20, rows = all("SELECT * FROM preview_reservations WHERE controller_id=? AND released_at IS NULL AND sequence>? ORDER BY sequence LIMIT ?", i.controllerId, i.afterSequence ?? 0, limit + 1), more = rows.length > limit, items = rows.slice(0, limit).map((r) => ({
				sequence: Number(r.sequence),
				reservation: view(r)
			}));
			return {
				items,
				nextSequence: more ? items.at(-1).sequence : null
			};
		},
		previewReservationDispatch(i) {
			return tx(() => {
				const r = bound(i);
				if (r.state !== "RESERVED") return {
					dispatch: false,
					reservation: view(r)
				};
				const life = get("SELECT state,expired_at FROM preview_lifecycles WHERE reservation_id=?", i.reservationId);
				if (life && (life.state !== "PREVIEW" || life.expired_at !== null)) fail$7("PREVIEW_EXPIRY_CLAIMED");
				if (Date.parse(JSON.parse(String(r.request_json)).expiresAt) <= Date.now()) fail$7("PREVIEW_RESERVATION_EXPIRED");
				exec("UPDATE preview_reservations SET state='DISPATCHED',revision=revision+1,updated_at=? WHERE reservation_id=?", (/* @__PURE__ */ new Date()).toISOString(), i.reservationId);
				return {
					dispatch: true,
					reservation: changed(r)
				};
			});
		},
		previewReservationCancel(i) {
			return tx(() => {
				const r = bound(i);
				if (r.state === "CANCELLED") return view(r);
				if (r.state !== "RESERVED") fail$7("PREVIEW_RESERVATION_DISPATCHED");
				const now = (/* @__PURE__ */ new Date()).toISOString();
				exec("UPDATE preview_reservations SET state='CANCELLED',revision=revision+1,updated_at=?,released_at=? WHERE reservation_id=?", now, now, i.reservationId);
				return changed(r);
			});
		},
		previewReservationRecord(i) {
			return tx(() => {
				const r = bound(i), request = JSON.parse(String(r.request_json)), f = i.fact;
				if (f.state === "REMOVED") fail$7("PREVIEW_REMOVAL_PROOF_REQUIRED");
				if (f.previewId !== request.previewId || f.datasetId !== request.datasetId || f.imageDigest !== request.imageDigest) fail$7("PREVIEW_RESERVATION_IDENTITY_MISMATCH");
				if (r.fact_json === canonical(f)) return view(r);
				if (r.revision !== i.expectedRevision) fail$7("PREVIEW_RESERVATION_REVISION_CONFLICT");
				if ([
					"RESERVED",
					"CANCELLED",
					"EXITED",
					"REMOVED"
				].includes(String(r.state))) fail$7("PREVIEW_RESERVATION_NOT_OBSERVABLE");
				const at = Date.parse(f.checkedAt), previous = r.fact_json ? JSON.parse(String(r.fact_json)) : null;
				if (at > Date.now() || at < Date.parse(String(r.created_at)) || previous && at < Date.parse(previous.checkedAt)) fail$7("PREVIEW_RESERVATION_OBSERVATION_STALE");
				if (r.instance_id !== null && f.instanceId !== null && r.instance_id !== f.instanceId) fail$7("PREVIEW_RESERVATION_IDENTITY_MISMATCH");
				if (r.endpoint_json !== null && f.endpoint !== null && r.endpoint_json !== canonical(f.endpoint)) fail$7("PREVIEW_RESERVATION_IDENTITY_MISMATCH");
				const state = f.state === "EXITED" ? "EXITED" : f.state === "UNKNOWN" ? "UNKNOWN" : f.state === "CREATED" ? "DISPATCHED" : "ACTIVE", now = (/* @__PURE__ */ new Date()).toISOString();
				exec("UPDATE preview_reservations SET state=?,revision=revision+1,instance_id=coalesce(instance_id,?),endpoint_json=coalesce(endpoint_json,?),fact_json=?,updated_at=?,released_at=? WHERE reservation_id=?", state, f.instanceId, f.endpoint ? canonical(f.endpoint) : null, canonical(f), now, state === "EXITED" ? now : null, i.reservationId);
				return changed(r);
			});
		}
	};
}
//#endregion
//#region src/container-domain.ts
const migration$1 = `
ALTER TABLE runner_identity RENAME TO runner_identity_v3;
CREATE TABLE runner_identity(singleton INTEGER PRIMARY KEY CHECK(singleton=1),runner_id TEXT NOT NULL,version INTEGER NOT NULL CHECK(version=4)) STRICT;
INSERT INTO runner_identity SELECT singleton,runner_id,4 FROM runner_identity_v3;
DROP TABLE runner_identity_v3;
CREATE UNIQUE INDEX preview_reservation_request_binding ON preview_reservations(reservation_id,request_hash);
CREATE TABLE preview_container_profiles(reservation_id TEXT PRIMARY KEY,request_hash TEXT NOT NULL,profile_hash TEXT NOT NULL,profile_json TEXT NOT NULL CHECK(json_valid(profile_json)),network_id TEXT,container_id TEXT,created_at TEXT NOT NULL,UNIQUE(reservation_id,profile_hash),FOREIGN KEY(reservation_id,request_hash) REFERENCES preview_reservations(reservation_id,request_hash)) STRICT;
CREATE TABLE preview_container_actions(reservation_id TEXT NOT NULL,profile_hash TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('NETWORK_CREATE','CREATE','START','STOP')),operation_id TEXT NOT NULL,request_hash TEXT NOT NULL,request_json TEXT NOT NULL CHECK(json_valid(request_json)),state TEXT NOT NULL CHECK(state IN ('SENT','OBSERVED')),observation_json TEXT CHECK(observation_json IS NULL OR json_valid(observation_json)),created_at TEXT NOT NULL,observed_at TEXT,PRIMARY KEY(reservation_id,kind),FOREIGN KEY(reservation_id,profile_hash) REFERENCES preview_container_profiles(reservation_id,profile_hash),CHECK((state='SENT' AND observation_json IS NULL AND observed_at IS NULL) OR (state='OBSERVED' AND observation_json IS NOT NULL AND observed_at IS NOT NULL))) STRICT;
CREATE TRIGGER immutable_preview_container_profile BEFORE UPDATE ON preview_container_profiles WHEN NEW.reservation_id<>OLD.reservation_id OR NEW.request_hash<>OLD.request_hash OR NEW.profile_hash<>OLD.profile_hash OR NEW.profile_json<>OLD.profile_json OR NEW.created_at<>OLD.created_at OR (OLD.network_id IS NOT NULL AND NEW.network_id IS NOT OLD.network_id) OR (OLD.container_id IS NOT NULL AND NEW.container_id IS NOT OLD.container_id) BEGIN SELECT RAISE(ABORT,'PREVIEW_CONTAINER_PROFILE_IMMUTABLE'); END;
CREATE TRIGGER preserve_preview_container_profile BEFORE DELETE ON preview_container_profiles BEGIN SELECT RAISE(ABORT,'PREVIEW_CONTAINER_PROFILE_IMMUTABLE'); END;
CREATE TRIGGER immutable_preview_container_action BEFORE UPDATE ON preview_container_actions WHEN OLD.state='OBSERVED' OR NEW.reservation_id<>OLD.reservation_id OR NEW.profile_hash<>OLD.profile_hash OR NEW.kind<>OLD.kind OR NEW.operation_id<>OLD.operation_id OR NEW.request_hash<>OLD.request_hash OR NEW.request_json<>OLD.request_json OR NEW.created_at<>OLD.created_at BEGIN SELECT RAISE(ABORT,'PREVIEW_CONTAINER_ACTION_IMMUTABLE'); END;
CREATE TRIGGER preserve_preview_container_action BEFORE DELETE ON preview_container_actions BEGIN SELECT RAISE(ABORT,'PREVIEW_CONTAINER_ACTION_IMMUTABLE'); END;
PRAGMA user_version=4;`;
const hash$7 = (v) => createHash("sha256").update(typeof v === "string" ? v : canonical(v)).digest("hex");
const fail$6 = (code, status = 409) => {
	throw new RunnerError(code, status);
};
function createPreviewContainerDomain(db, actionGuard) {
	const get = (sql, ...p) => db.prepare(sql).get(...p), exec = (sql, ...p) => db.prepare(sql).run(...p);
	const tx = (body) => {
		db.exec("BEGIN IMMEDIATE");
		try {
			const r = body();
			db.exec("COMMIT");
			return r;
		} catch (e) {
			db.exec("ROLLBACK");
			throw e;
		}
	};
	const version = Number(Object.values(db.prepare("PRAGMA user_version").get())[0]);
	if (version === 3) tx(() => {
		db.exec(migration$1);
		exec("INSERT INTO runner_schema_history VALUES(4,?,?)", hash$7(migration$1), (/* @__PURE__ */ new Date()).toISOString());
	});
	else if (![
		4,
		5,
		6,
		7,
		8,
		9,
		10,
		11,
		12
	].includes(version)) fail$6("RUNNER_STORE_IDENTITY_MISMATCH");
	if (get("SELECT sha256 FROM runner_schema_history WHERE version=4")?.sha256 !== hash$7(migration$1) || get("SELECT version FROM runner_identity WHERE singleton=1")?.version !== (version === 3 ? 4 : version)) fail$6("RUNNER_MIGRATION_DRIFT");
	const reservation = (i) => {
		const r = get("SELECT * FROM preview_reservations WHERE reservation_id=? AND controller_id=?", i.reservationId, i.controllerId) ?? fail$6("PREVIEW_RESERVATION_NOT_FOUND", 404);
		if (r.request_hash !== i.requestHash) fail$6("PREVIEW_RESERVATION_IDENTITY_MISMATCH");
		return r;
	};
	const profile = (id) => get("SELECT * FROM preview_container_profiles WHERE reservation_id=?", id) ?? fail$6("PREVIEW_CONTAINER_JOURNAL_NOT_FOUND", 404);
	const actionView = (r) => previewContainerActionSchema.parse({
		kind: r.kind,
		operationId: r.operation_id,
		requestHash: r.request_hash,
		request: JSON.parse(String(r.request_json)),
		state: r.state,
		observation: r.observation_json ? JSON.parse(String(r.observation_json)) : null,
		createdAt: r.created_at,
		observedAt: r.observed_at
	});
	const view = (p) => ({
		profile: previewContainerProfile.parse(JSON.parse(String(p.profile_json))),
		profileHash: String(p.profile_hash),
		networkId: p.network_id,
		containerId: p.container_id,
		actions: db.prepare("SELECT * FROM preview_container_actions WHERE reservation_id=? ORDER BY created_at,kind").all(String(p.reservation_id)).map(actionView)
	});
	return {
		previewContainerPrepare(i) {
			return tx(() => {
				const r = reservation(i), old = get("SELECT * FROM preview_container_profiles WHERE reservation_id=?", i.reservationId), p = i.profile, names = previewContainerNames(i.reservationId);
				if (p.reservationId !== i.reservationId || p.requestHash !== i.requestHash || canonical(p.resourceLimits) !== r.limits_json || p.networkName !== names.networkName || p.containerName !== names.containerName) fail$6("PREVIEW_CONTAINER_PROFILE_CHANGED");
				if (old) {
					if (old.profile_json !== canonical(p)) fail$6("PREVIEW_CONTAINER_PROFILE_CHANGED");
					return view(old);
				}
				if (r.state !== "RESERVED") fail$6("PREVIEW_CONTAINER_NOT_PREPARED");
				exec("INSERT INTO preview_container_profiles VALUES(?,?,?,?,NULL,NULL,?)", i.reservationId, i.requestHash, hash$7(p), canonical(p), (/* @__PURE__ */ new Date()).toISOString());
				return view(profile(i.reservationId));
			});
		},
		previewContainerGet(i) {
			reservation(i);
			const p = get("SELECT * FROM preview_container_profiles WHERE reservation_id=?", i.reservationId);
			return p ? view(p) : null;
		},
		previewContainerActionBegin(i) {
			return tx(() => {
				const r = reservation(i), p = profile(i.reservationId), a = i.action, original = JSON.parse(String(r.request_json));
				if (a.requestHash !== hash$7(a.request)) fail$6("PREVIEW_CONTAINER_ACTION_CHANGED");
				if (a.kind === "STOP") {
					const stop = previewStopRequest.parse(a.request);
					if (stop.startOperationId !== original.operationId || stop.startRequestHash !== r.request_hash || stop.instanceId !== p.container_id) fail$6("PREVIEW_CONTAINER_ACTION_CHANGED");
					for (const k of [
						"projectId",
						"runId",
						"candidateId",
						"policyHash",
						"backendRef",
						"runnerId",
						"previewId",
						"datasetId",
						"imageDigest"
					]) if (stop[k] !== original[k]) fail$6("PREVIEW_CONTAINER_ACTION_CHANGED");
				} else if (a.requestHash !== r.request_hash || canonical(a.request) !== r.request_json) fail$6("PREVIEW_CONTAINER_ACTION_CHANGED");
				const old = get("SELECT * FROM preview_container_actions WHERE reservation_id=? AND kind=?", i.reservationId, a.kind);
				if (old) {
					if (old.operation_id !== a.request.operationId || old.request_hash !== a.requestHash) fail$6("PREVIEW_CONTAINER_ACTION_CHANGED");
					return {
						dispatch: false,
						journal: view(p)
					};
				}
				actionGuard(i);
				if (r.state === "RESERVED" || r.released_at !== null) fail$6("PREVIEW_CONTAINER_DISPATCH_REQUIRED");
				if (a.kind !== "STOP" && Date.parse(original.expiresAt) <= Date.now()) fail$6("PREVIEW_RESERVATION_EXPIRED");
				if (a.kind === "CREATE" && !p.network_id || a.kind === "START" && !p.container_id || a.kind === "STOP" && !p.container_id) fail$6("PREVIEW_CONTAINER_PREDECESSOR_UNKNOWN");
				if (a.kind === "START" && get("SELECT 1 FROM preview_container_actions WHERE reservation_id=? AND kind='STOP'", i.reservationId)) fail$6("PREVIEW_CONTAINER_STOPPING");
				exec("INSERT INTO preview_container_actions VALUES(?,?,?,?,?,?,'SENT',NULL,?,NULL)", i.reservationId, String(p.profile_hash), a.kind, a.request.operationId, a.requestHash, canonical(a.request), (/* @__PURE__ */ new Date()).toISOString());
				return {
					dispatch: true,
					journal: view(p)
				};
			});
		},
		previewContainerActionObserve(i) {
			return tx(() => {
				reservation(i);
				const p = profile(i.reservationId), a = get("SELECT * FROM preview_container_actions WHERE reservation_id=? AND kind=?", i.reservationId, i.kind) ?? fail$6("PREVIEW_CONTAINER_ACTION_NOT_FOUND", 404), o = i.observation;
				if (a.request_hash !== i.actionRequestHash) fail$6("PREVIEW_CONTAINER_ACTION_CHANGED");
				if (a.state === "OBSERVED") {
					if (a.observation_json !== canonical(o)) fail$6("PREVIEW_CONTAINER_OBSERVATION_IMMUTABLE");
					return view(p);
				}
				if (Date.parse(o.checkedAt) < Date.parse(String(a.created_at)) || Date.parse(o.checkedAt) > Date.now()) fail$6("PREVIEW_CONTAINER_OBSERVATION_STALE");
				if (i.kind === "NETWORK_CREATE" && o.state !== "CREATED" || i.kind === "START" && o.state === "CREATED" || i.kind === "STOP" && o.state !== "EXITED") fail$6("PREVIEW_CONTAINER_OUTCOME_UNVERIFIED");
				const field = i.kind === "NETWORK_CREATE" ? "network_id" : "container_id";
				if (p[field] !== null && p[field] !== o.objectId) fail$6("PREVIEW_CONTAINER_IDENTITY_CHANGED");
				if (["START", "STOP"].includes(i.kind) && p.container_id !== o.objectId) fail$6("PREVIEW_CONTAINER_IDENTITY_CHANGED");
				if (i.kind === "NETWORK_CREATE") exec("UPDATE preview_container_profiles SET network_id=coalesce(network_id,?) WHERE reservation_id=?", o.objectId, i.reservationId);
				if (i.kind === "CREATE") exec("UPDATE preview_container_profiles SET container_id=coalesce(container_id,?) WHERE reservation_id=?", o.objectId, i.reservationId);
				exec("UPDATE preview_container_actions SET state='OBSERVED',observation_json=?,observed_at=? WHERE reservation_id=? AND kind=?", canonical(o), (/* @__PURE__ */ new Date()).toISOString(), i.reservationId, i.kind);
				return view(profile(i.reservationId));
			});
		}
	};
}
//#endregion
//#region src/preview-clock.ts
/** One Worker lifetime. Persisted high-water and expiry latches survive it. */
var PreviewClock = class {
	#source;
	#deadlines = /* @__PURE__ */ new Map();
	constructor(source = {
		wall: Date.now,
		monotonic: () => performance.now()
	}) {
		this.#source = source;
	}
	forget(id) {
		this.#deadlines.delete(id);
	}
	observe(id, expiresAt, lastWallAt, latched) {
		const wall = this.#source.wall(), monotonic = this.#source.monotonic(), last = Date.parse(lastWallAt), expiry = Date.parse(expiresAt);
		let current = this.#deadlines.get(id);
		if (current === void 0) {
			current = {
				deadline: monotonic + Math.max(0, expiry - Math.max(wall, last)),
				expired: false
			};
			this.#deadlines.set(id, current);
		}
		current.expired ||= latched || wall < last || wall >= expiry || monotonic >= current.deadline;
		return {
			expired: current.expired,
			wallAt: new Date(Math.max(wall, last)).toISOString()
		};
	}
};
//#endregion
//#region src/preview-lifecycle-domain.ts
const migration = `
ALTER TABLE runner_identity RENAME TO runner_identity_v4;
CREATE TABLE runner_identity(singleton INTEGER PRIMARY KEY CHECK(singleton=1),runner_id TEXT NOT NULL,version INTEGER NOT NULL CHECK(version=5)) STRICT;
INSERT INTO runner_identity SELECT singleton,runner_id,5 FROM runner_identity_v4;
DROP TABLE runner_identity_v4;
CREATE TABLE preview_lifecycles(reservation_id TEXT PRIMARY KEY,request_hash TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('PREVIEW','STOPPING','RELEASE_HELD','RELEASE_OWNED')),revision INTEGER NOT NULL,expires_at TEXT NOT NULL,expired_at TEXT,last_wall_at TEXT NOT NULL,release_claim_json TEXT CHECK(release_claim_json IS NULL OR json_valid(release_claim_json)),release_claim_hash TEXT,expiry_request_json TEXT CHECK(expiry_request_json IS NULL OR json_valid(expiry_request_json)),expiry_request_hash TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,FOREIGN KEY(reservation_id,request_hash) REFERENCES preview_reservations(reservation_id,request_hash),CHECK((state IN ('RELEASE_HELD','RELEASE_OWNED'))=(release_claim_json IS NOT NULL)),CHECK((release_claim_json IS NULL)=(release_claim_hash IS NULL)),CHECK((expiry_request_json IS NULL)=(expiry_request_hash IS NULL)),CHECK(expiry_request_json IS NULL OR state='STOPPING')) STRICT;
CREATE TABLE preview_lifecycle_events(reservation_id TEXT NOT NULL REFERENCES preview_lifecycles(reservation_id),revision INTEGER NOT NULL,snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),created_at TEXT NOT NULL,PRIMARY KEY(reservation_id,revision)) STRICT;
CREATE TRIGGER immutable_preview_lifecycle BEFORE UPDATE ON preview_lifecycles WHEN NEW.reservation_id<>OLD.reservation_id OR NEW.request_hash<>OLD.request_hash OR NEW.expires_at<>OLD.expires_at OR NEW.created_at<>OLD.created_at OR NEW.last_wall_at<OLD.last_wall_at OR (OLD.expired_at IS NOT NULL AND NEW.expired_at IS NOT OLD.expired_at) OR (OLD.release_claim_json IS NOT NULL AND (NEW.release_claim_json IS NOT OLD.release_claim_json OR NEW.release_claim_hash IS NOT OLD.release_claim_hash)) OR (OLD.expiry_request_json IS NOT NULL AND (NEW.expiry_request_json IS NOT OLD.expiry_request_json OR NEW.expiry_request_hash IS NOT OLD.expiry_request_hash)) OR (NEW.state<>OLD.state AND NOT ((OLD.state='PREVIEW' AND NEW.state IN ('STOPPING','RELEASE_HELD')) OR (OLD.state='RELEASE_HELD' AND NEW.state='RELEASE_OWNED'))) BEGIN SELECT RAISE(ABORT,'PREVIEW_LIFECYCLE_IMMUTABLE'); END;
CREATE TRIGGER preserve_preview_lifecycle BEFORE DELETE ON preview_lifecycles BEGIN SELECT RAISE(ABORT,'PREVIEW_LIFECYCLE_IMMUTABLE'); END;
CREATE TRIGGER immutable_preview_lifecycle_event BEFORE UPDATE ON preview_lifecycle_events BEGIN SELECT RAISE(ABORT,'PREVIEW_LIFECYCLE_EVENT_IMMUTABLE'); END;
CREATE TRIGGER preserve_preview_lifecycle_event BEFORE DELETE ON preview_lifecycle_events BEGIN SELECT RAISE(ABORT,'PREVIEW_LIFECYCLE_EVENT_IMMUTABLE'); END;
PRAGMA user_version=5;`;
const hash$6 = (v) => createHash("sha256").update(typeof v === "string" ? v : canonical(v)).digest("hex");
const fail$5 = (code, status = 409) => {
	throw new RunnerError(code, status);
};
function createPreviewLifecycleDomain(db) {
	const get = (sql, ...p) => db.prepare(sql).get(...p), exec = (sql, ...p) => db.prepare(sql).run(...p), clock = new PreviewClock();
	const tx = (body) => {
		db.exec("BEGIN IMMEDIATE");
		try {
			const r = body();
			db.exec("COMMIT");
			return r;
		} catch (e) {
			db.exec("ROLLBACK");
			throw e;
		}
	};
	const version = Number(Object.values(db.prepare("PRAGMA user_version").get())[0]);
	if (version === 4) tx(() => {
		db.exec(migration);
		exec("INSERT INTO runner_schema_history VALUES(5,?,?)", hash$6(migration), (/* @__PURE__ */ new Date()).toISOString());
	});
	else if (![
		5,
		6,
		7,
		8,
		9,
		10,
		11,
		12
	].includes(version)) fail$5("RUNNER_STORE_IDENTITY_MISMATCH");
	if (get("SELECT sha256 FROM runner_schema_history WHERE version=5")?.sha256 !== hash$6(migration) || get("SELECT version FROM runner_identity WHERE singleton=1")?.version !== (version === 4 ? 5 : version)) fail$5("RUNNER_MIGRATION_DRIFT");
	const reservation = (i) => {
		const r = get("SELECT * FROM preview_reservations WHERE reservation_id=? AND controller_id=?", i.reservationId, i.controllerId) ?? fail$5("PREVIEW_RESERVATION_NOT_FOUND", 404);
		if (r.request_hash !== i.requestHash) fail$5("PREVIEW_RESERVATION_IDENTITY_MISMATCH");
		return r;
	};
	const row = (id) => get("SELECT * FROM preview_lifecycles WHERE reservation_id=?", id);
	const view = (r) => runnerPreviewLifecycle.parse({
		reservationId: r.reservation_id,
		requestHash: r.request_hash,
		state: r.state,
		revision: r.revision,
		expiresAt: r.expires_at,
		expiredAt: r.expired_at,
		lastWallAt: r.last_wall_at,
		releaseClaim: r.release_claim_json ? JSON.parse(String(r.release_claim_json)) : null,
		releaseClaimHash: r.release_claim_hash,
		expiryRequest: r.expiry_request_json ? JSON.parse(String(r.expiry_request_json)) : null,
		expiryRequestHash: r.expiry_request_hash,
		createdAt: r.created_at,
		updatedAt: r.updated_at
	});
	const event = (id) => {
		const r = row(id);
		exec("INSERT INTO preview_lifecycle_events VALUES(?,?,?,?)", id, Number(r.revision), canonical(view(r)), String(r.updated_at));
		return r;
	};
	const observeClock = (id) => {
		const r = row(id);
		if (!r) return null;
		if (get("SELECT released_at FROM preview_reservations WHERE reservation_id=?", id)?.released_at !== null) {
			clock.forget(id);
			return r;
		}
		const observation = clock.observe(id, String(r.expires_at), String(r.last_wall_at), r.expired_at !== null);
		if (observation.expired && r.expired_at === null) {
			exec("UPDATE preview_lifecycles SET expired_at=?,last_wall_at=?,revision=revision+1,updated_at=? WHERE reservation_id=?", observation.wallAt, observation.wallAt, observation.wallAt, id);
			return event(id);
		}
		if (observation.wallAt !== r.last_wall_at) exec("UPDATE preview_lifecycles SET last_wall_at=? WHERE reservation_id=?", observation.wallAt, id);
		return row(id);
	};
	const stop = (id) => {
		const r = row(id);
		if (r.state === "PREVIEW") {
			const at = (/* @__PURE__ */ new Date()).toISOString();
			exec("UPDATE preview_lifecycles SET state='STOPPING',revision=revision+1,updated_at=? WHERE reservation_id=?", at, id);
			return event(id);
		}
		if (r.state !== "STOPPING") fail$5("PREVIEW_OWNED_BY_RELEASE");
		return r;
	};
	function actionGuard(i) {
		reservation(i);
		const life = observeClock(i.reservationId) ?? fail$5("PREVIEW_LIFECYCLE_NOT_ENROLLED");
		if (i.action.kind === "STOP") stop(i.reservationId);
		else if (life.state !== "PREVIEW" || life.expired_at !== null) fail$5(String(life.state).startsWith("RELEASE_") ? "PREVIEW_OWNED_BY_RELEASE" : "PREVIEW_EXPIRY_CLAIMED");
	}
	return {
		actionGuard,
		forgetClock: (id) => clock.forget(id),
		previewLifecycleEnroll(i) {
			return tx(() => {
				const r = reservation(i);
				if (row(i.reservationId)) return view(observeClock(i.reservationId));
				if (r.state !== "RESERVED" || get("SELECT 1 FROM preview_container_actions WHERE reservation_id=?", i.reservationId)) fail$5("PREVIEW_LIFECYCLE_ADOPTION_FORBIDDEN");
				const at = (/* @__PURE__ */ new Date()).toISOString(), request = JSON.parse(String(r.request_json));
				exec("INSERT INTO preview_lifecycles VALUES(?,?,'PREVIEW',0,?,NULL,?,NULL,NULL,NULL,NULL,?,?)", i.reservationId, i.requestHash, request.expiresAt, at, at, at);
				return view(event(i.reservationId));
			});
		},
		previewLifecycleGet(i) {
			return tx(() => {
				reservation(i);
				const r = observeClock(i.reservationId);
				return r ? view(r) : null;
			});
		},
		previewLifecycleActionAuthorized(i) {
			return tx(() => {
				const r = reservation(i), life = observeClock(i.reservationId), a = get("SELECT * FROM preview_container_actions WHERE reservation_id=? AND kind=?", i.reservationId, i.kind);
				return { allowed: !!life && r.released_at === null && a?.state === "SENT" && a.request_hash === i.actionRequestHash && (i.kind === "STOP" ? life.state === "STOPPING" : life.state === "PREVIEW" && life.expired_at === null) };
			});
		},
		previewExpiryPrepare(i) {
			return tx(() => {
				const r = reservation(i);
				let life = observeClock(i.reservationId);
				if (!life || r.released_at !== null || String(life.state).startsWith("RELEASE_") || life.expired_at === null) return life ? view(life) : null;
				life = stop(i.reservationId);
				if (life.expiry_request_json !== null || get("SELECT 1 FROM preview_container_actions WHERE reservation_id=? AND kind='STOP'", i.reservationId)) return view(life);
				const p = get("SELECT container_id FROM preview_container_profiles WHERE reservation_id=?", i.reservationId);
				if (!p?.container_id || r.instance_id !== p.container_id) return view(life);
				const original = JSON.parse(String(r.request_json)), request = previewStopRequest.parse({
					schemaVersion: "devmesh.preview-stop.v1",
					operationId: "op_" + hash$6("runner-preview-expiry:" + i.reservationId).slice(0, 32),
					projectId: original.projectId,
					runId: original.runId,
					candidateId: original.candidateId,
					policyHash: original.policyHash,
					backendRef: original.backendRef,
					runnerId: original.runnerId,
					previewId: original.previewId,
					datasetId: original.datasetId,
					imageDigest: original.imageDigest,
					startOperationId: original.operationId,
					startRequestHash: i.requestHash,
					instanceId: p.container_id,
					reason: "EXPIRED"
				}), at = (/* @__PURE__ */ new Date()).toISOString();
				exec("UPDATE preview_lifecycles SET expiry_request_json=?,expiry_request_hash=?,revision=revision+1,updated_at=? WHERE reservation_id=?", canonical(request), hash$6(request), at, i.reservationId);
				return view(event(i.reservationId));
			});
		},
		previewExpiryAuthorized(i) {
			return tx(() => {
				const r = reservation(i), life = observeClock(i.reservationId);
				return { allowed: !!life && r.released_at === null && life.state === "STOPPING" && life.expired_at !== null && life.expiry_request_hash === i.expiryRequestHash };
			});
		},
		previewReleaseHold(i) {
			return tx(() => {
				const r = reservation(i), life = observeClock(i.reservationId) ?? fail$5("PREVIEW_LIFECYCLE_NOT_ENROLLED"), claim = i.claim, original = JSON.parse(String(r.request_json)), claimHash = hash$6(claim);
				if (i.claimHash !== claimHash || claim.startRequestHash !== i.requestHash || claim.startOperationId !== original.operationId || claim.instanceId !== r.instance_id) fail$5("PREVIEW_RELEASE_CLAIM_CHANGED");
				for (const k of [
					"candidateId",
					"manifestHash",
					"previewId",
					"datasetId",
					"imageDigest"
				]) if (claim[k] !== original[k]) fail$5("PREVIEW_RELEASE_CLAIM_CHANGED");
				if (life.release_claim_hash !== null) {
					if (life.release_claim_hash !== claimHash || life.release_claim_json !== canonical(claim)) fail$5("PREVIEW_RELEASE_CLAIM_CHANGED");
					return view(life);
				}
				const fact = r.fact_json ? JSON.parse(String(r.fact_json)) : null;
				if (life.state !== "PREVIEW" || life.expired_at !== null || r.released_at !== null || fact?.state !== "HEALTHY" || fact.instanceId !== claim.instanceId || Date.now() - Date.parse(fact.checkedAt) > 3e4 || get("SELECT 1 FROM preview_container_actions WHERE reservation_id=? AND kind='STOP'", i.reservationId)) fail$5("PREVIEW_RELEASE_HOLD_UNAVAILABLE");
				const at = (/* @__PURE__ */ new Date()).toISOString();
				exec("UPDATE preview_lifecycles SET state='RELEASE_HELD',release_claim_json=?,release_claim_hash=?,revision=revision+1,updated_at=? WHERE reservation_id=?", canonical(claim), claimHash, at, i.reservationId);
				return view(event(i.reservationId));
			});
		},
		previewReleaseCommit(i) {
			return tx(() => {
				reservation(i);
				const life = row(i.reservationId) ?? fail$5("PREVIEW_LIFECYCLE_NOT_ENROLLED");
				if (life.release_claim_hash !== i.claimHash || !["RELEASE_HELD", "RELEASE_OWNED"].includes(String(life.state))) fail$5("PREVIEW_RELEASE_CLAIM_CHANGED");
				const claim = JSON.parse(String(life.release_claim_json));
				if (claim.releaseId !== i.releaseId || claim.operationId !== i.acceptanceOperationId || claim.acceptanceRequestHash !== i.acceptanceRequestHash) fail$5("PREVIEW_RELEASE_CLAIM_CHANGED");
				if (life.state === "RELEASE_OWNED") return view(life);
				const at = (/* @__PURE__ */ new Date()).toISOString();
				exec("UPDATE preview_lifecycles SET state='RELEASE_OWNED',revision=revision+1,updated_at=? WHERE reservation_id=?", at, i.reservationId);
				return view(event(i.reservationId));
			});
		}
	};
}
//#endregion
//#region src/cleanup-migration.ts
const cleanupMigration = `
ALTER TABLE runner_identity RENAME TO runner_identity_v5;
CREATE TABLE runner_identity(singleton INTEGER PRIMARY KEY CHECK(singleton=1),runner_id TEXT NOT NULL,version INTEGER NOT NULL CHECK(version=6)) STRICT;
INSERT INTO runner_identity SELECT singleton,runner_id,6 FROM runner_identity_v5;
DROP TABLE runner_identity_v5;
CREATE TABLE preview_reservations_v6(sequence INTEGER PRIMARY KEY,reservation_id TEXT NOT NULL UNIQUE,controller_id TEXT NOT NULL,operation_id TEXT NOT NULL,preview_id TEXT NOT NULL,dataset_id TEXT NOT NULL,request_hash TEXT NOT NULL,request_json TEXT NOT NULL CHECK(json_valid(request_json)),limits_json TEXT NOT NULL CHECK(json_valid(limits_json)),state TEXT NOT NULL CHECK(state IN ('RESERVED','DISPATCHED','ACTIVE','UNKNOWN','EXITED','CANCELLED','REMOVED')),revision INTEGER NOT NULL CHECK(revision>=0),instance_id TEXT,endpoint_json TEXT CHECK(endpoint_json IS NULL OR json_valid(endpoint_json)),fact_json TEXT CHECK(fact_json IS NULL OR json_valid(fact_json)),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,released_at TEXT,UNIQUE(controller_id,operation_id),CHECK((state IN ('EXITED','CANCELLED','REMOVED') AND released_at IS NOT NULL) OR (state NOT IN ('EXITED','CANCELLED','REMOVED') AND released_at IS NULL)),CHECK(state<>'RESERVED' OR (instance_id IS NULL AND fact_json IS NULL)),CHECK(state NOT IN ('EXITED','REMOVED') OR instance_id IS NOT NULL)) STRICT;
INSERT INTO preview_reservations_v6 SELECT * FROM preview_reservations;
DROP TABLE preview_reservations;
ALTER TABLE preview_reservations_v6 RENAME TO preview_reservations;
CREATE UNIQUE INDEX exclusive_preview_reservation ON preview_reservations(preview_id) WHERE released_at IS NULL;
CREATE UNIQUE INDEX exclusive_preview_dataset ON preview_reservations(dataset_id) WHERE released_at IS NULL;
CREATE UNIQUE INDEX preview_reservation_request_binding ON preview_reservations(reservation_id,request_hash);
CREATE TRIGGER immutable_preview_reservation BEFORE UPDATE ON preview_reservations WHEN OLD.released_at IS NOT NULL OR NEW.sequence<>OLD.sequence OR NEW.reservation_id<>OLD.reservation_id OR NEW.controller_id<>OLD.controller_id OR NEW.operation_id<>OLD.operation_id OR NEW.preview_id<>OLD.preview_id OR NEW.dataset_id<>OLD.dataset_id OR NEW.request_hash<>OLD.request_hash OR NEW.request_json<>OLD.request_json OR NEW.limits_json<>OLD.limits_json OR NEW.created_at<>OLD.created_at OR (OLD.instance_id IS NOT NULL AND NEW.instance_id IS NOT OLD.instance_id) OR (OLD.endpoint_json IS NOT NULL AND NEW.endpoint_json IS NOT OLD.endpoint_json) BEGIN SELECT RAISE(ABORT,'PREVIEW_RESERVATION_IMMUTABLE'); END;
CREATE TRIGGER preserve_preview_reservation BEFORE DELETE ON preview_reservations BEGIN SELECT RAISE(ABORT,'PREVIEW_RESERVATION_IMMUTABLE'); END;
CREATE TABLE preview_cleanup_actions(reservation_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('CONTAINER_REMOVE','NETWORK_REMOVE')),profile_hash TEXT NOT NULL,request_hash TEXT NOT NULL,request_json TEXT NOT NULL CHECK(json_valid(request_json)),state TEXT NOT NULL CHECK(state IN ('SENT','OBSERVED')),observation_json TEXT CHECK(observation_json IS NULL OR json_valid(observation_json)),created_at TEXT NOT NULL,observed_at TEXT,PRIMARY KEY(reservation_id,kind),FOREIGN KEY(reservation_id,profile_hash) REFERENCES preview_container_profiles(reservation_id,profile_hash),CHECK((state='SENT' AND observation_json IS NULL AND observed_at IS NULL) OR (state='OBSERVED' AND observation_json IS NOT NULL AND observed_at IS NOT NULL))) STRICT;
CREATE TRIGGER immutable_preview_cleanup BEFORE UPDATE ON preview_cleanup_actions WHEN OLD.state='OBSERVED' OR NEW.reservation_id<>OLD.reservation_id OR NEW.kind<>OLD.kind OR NEW.profile_hash<>OLD.profile_hash OR NEW.request_hash<>OLD.request_hash OR NEW.request_json<>OLD.request_json OR NEW.created_at<>OLD.created_at BEGIN SELECT RAISE(ABORT,'PREVIEW_CLEANUP_IMMUTABLE'); END;
CREATE TRIGGER preserve_preview_cleanup BEFORE DELETE ON preview_cleanup_actions BEGIN SELECT RAISE(ABORT,'PREVIEW_CLEANUP_IMMUTABLE'); END;
PRAGMA user_version=6;`;
//#endregion
//#region src/cleanup-domain.ts
const hash$5 = (v) => createHash("sha256").update(typeof v === "string" ? v : canonical(v)).digest("hex");
const fail$4 = (code, status = 409) => {
	throw new RunnerError(code, status);
};
function createPreviewCleanupDomain(db, removed) {
	const get = (sql, ...p) => db.prepare(sql).get(...p), all = (sql, ...p) => db.prepare(sql).all(...p), exec = (sql, ...p) => db.prepare(sql).run(...p);
	const tx = (body) => {
		db.exec("BEGIN IMMEDIATE");
		try {
			const r = body();
			db.exec("COMMIT");
			return r;
		} catch (e) {
			db.exec("ROLLBACK");
			throw e;
		}
	};
	const version = Number(Object.values(db.prepare("PRAGMA user_version").get())[0]);
	if (version === 5) {
		db.exec("PRAGMA foreign_keys=OFF");
		try {
			if (Number(Object.values(db.prepare("PRAGMA foreign_keys").get())[0]) !== 0) fail$4("RUNNER_MIGRATION_FAILED");
			tx(() => {
				db.exec(cleanupMigration);
				exec("INSERT INTO runner_schema_history VALUES(6,?,?)", hash$5(cleanupMigration), (/* @__PURE__ */ new Date()).toISOString());
				if (db.prepare("PRAGMA foreign_key_check").all().length) fail$4("RUNNER_MIGRATION_FOREIGN_KEYS");
			});
		} finally {
			db.exec("PRAGMA foreign_keys=ON");
		}
	} else if (![
		6,
		7,
		8,
		9,
		10,
		11,
		12
	].includes(version)) fail$4("RUNNER_STORE_IDENTITY_MISMATCH");
	if (get("SELECT sha256 FROM runner_schema_history WHERE version=6")?.sha256 !== hash$5(cleanupMigration) || get("SELECT version FROM runner_identity")?.version !== (version === 5 ? 6 : version)) fail$4("RUNNER_MIGRATION_DRIFT");
	if (Number(Object.values(db.prepare("PRAGMA foreign_keys").get())[0]) !== 1) fail$4("RUNNER_MIGRATION_FOREIGN_KEYS");
	const reservation = (i) => {
		const r = get("SELECT * FROM preview_reservations WHERE controller_id=? AND reservation_id=?", i.controllerId, i.reservationId) ?? fail$4("PREVIEW_RESERVATION_NOT_FOUND", 404);
		if (r.request_hash !== i.requestHash) fail$4("PREVIEW_RESERVATION_IDENTITY_MISMATCH");
		return r;
	};
	const action = (id, kind) => get("SELECT * FROM preview_cleanup_actions WHERE reservation_id=? AND kind=?", id, kind);
	const view = (r) => previewCleanupAction.parse({
		request: JSON.parse(String(r.request_json)),
		requestHash: r.request_hash,
		state: r.state,
		observation: r.observation_json ? JSON.parse(String(r.observation_json)) : null,
		createdAt: r.created_at,
		observedAt: r.observed_at
	});
	const eligible = (i) => {
		const r = reservation(i);
		if (get("SELECT state FROM preview_lifecycles WHERE reservation_id=?", i.reservationId)?.state !== "STOPPING") fail$4("PREVIEW_CLEANUP_CUSTODY_REQUIRED");
		const p = get("SELECT * FROM preview_container_profiles WHERE reservation_id=?", i.reservationId) ?? fail$4("PREVIEW_CLEANUP_ORIGINAL_UNKNOWN"), stop = get("SELECT request_hash FROM preview_container_actions WHERE reservation_id=? AND kind='STOP'", i.reservationId) ?? fail$4("PREVIEW_CLEANUP_ORIGINAL_UNKNOWN");
		if (!p.container_id || !p.network_id || r.instance_id !== p.container_id) fail$4("PREVIEW_CLEANUP_ORIGINAL_UNKNOWN");
		return {
			r,
			p,
			stop
		};
	};
	return {
		previewCleanupGet(i) {
			reservation(i);
			return all("SELECT * FROM preview_cleanup_actions WHERE reservation_id=? ORDER BY created_at,kind", i.reservationId).map(view);
		},
		previewCleanupPage(i) {
			const rows = all("SELECT r.sequence,r.reservation_id,r.request_hash FROM preview_reservations r JOIN preview_lifecycles l USING(reservation_id) JOIN preview_container_profiles p USING(reservation_id) WHERE r.controller_id=? AND r.sequence>? AND l.state='STOPPING' AND p.container_id IS NOT NULL AND p.container_id=r.instance_id AND p.network_id IS NOT NULL AND EXISTS(SELECT 1 FROM preview_container_actions a WHERE a.reservation_id=r.reservation_id AND a.kind='STOP') AND NOT EXISTS(SELECT 1 FROM preview_cleanup_actions c WHERE c.reservation_id=r.reservation_id AND c.kind='NETWORK_REMOVE' AND c.state='OBSERVED') ORDER BY r.sequence LIMIT ?", i.controllerId, i.afterSequence ?? 0, (i.limit ?? 20) + 1), more = rows.length > (i.limit ?? 20);
			if (more) rows.pop();
			return {
				items: rows.map((r) => ({
					sequence: Number(r.sequence),
					reservationId: String(r.reservation_id),
					requestHash: String(r.request_hash)
				})),
				nextSequence: more ? Number(rows.at(-1).sequence) : null
			};
		},
		previewCleanupActionBegin(i) {
			return tx(() => {
				const { p, stop } = eligible(i), old = action(i.reservationId, i.kind);
				if (old) return {
					dispatch: false,
					action: view(old)
				};
				if (i.kind === "NETWORK_REMOVE" && action(i.reservationId, "CONTAINER_REMOVE")?.state !== "OBSERVED") fail$4("PREVIEW_CLEANUP_PREDECESSOR_UNKNOWN");
				const request = previewCleanupRequest.parse({
					schemaVersion: "devmesh.preview-cleanup.v1",
					operationId: "op_" + hash$5("runner-preview-cleanup:" + i.reservationId + ":" + i.kind).slice(0, 32),
					reservationId: i.reservationId,
					startRequestHash: i.requestHash,
					profileHash: p.profile_hash,
					stopRequestHash: stop.request_hash,
					containerId: p.container_id,
					networkId: p.network_id,
					kind: i.kind
				});
				exec("INSERT INTO preview_cleanup_actions VALUES(?,?,?,?,?,'SENT',NULL,?,NULL)", i.reservationId, i.kind, String(p.profile_hash), hash$5(request), canonical(request), (/* @__PURE__ */ new Date()).toISOString());
				return {
					dispatch: true,
					action: view(action(i.reservationId, i.kind))
				};
			});
		},
		previewCleanupActionAuthorized(i) {
			reservation(i);
			const a = action(i.reservationId, i.kind);
			try {
				eligible(i);
				return { allowed: a?.state === "SENT" && a.request_hash === i.actionRequestHash && (i.kind !== "NETWORK_REMOVE" || action(i.reservationId, "CONTAINER_REMOVE")?.state === "OBSERVED") };
			} catch (error) {
				if (error instanceof RunnerError) return { allowed: false };
				throw error;
			}
		},
		previewCleanupActionObserve(i) {
			return tx(() => {
				const { p } = eligible(i), a = action(i.reservationId, i.kind) ?? fail$4("PREVIEW_CLEANUP_ACTION_NOT_FOUND", 404), o = i.observation;
				if (a.request_hash !== i.actionRequestHash || o.objectId !== (i.kind === "CONTAINER_REMOVE" ? p.container_id : p.network_id)) fail$4("PREVIEW_CLEANUP_IDENTITY_CHANGED");
				if (a.state === "OBSERVED") {
					if (a.observation_json !== canonical(o)) fail$4("PREVIEW_CLEANUP_IMMUTABLE");
					return view(a);
				}
				if (Date.parse(o.checkedAt) < Date.parse(String(a.created_at)) || Date.parse(o.checkedAt) > Date.now()) fail$4("PREVIEW_CLEANUP_OBSERVATION_STALE");
				if (i.kind === "NETWORK_REMOVE" && action(i.reservationId, "CONTAINER_REMOVE")?.state !== "OBSERVED") fail$4("PREVIEW_CLEANUP_PREDECESSOR_UNKNOWN");
				exec("UPDATE preview_cleanup_actions SET state='OBSERVED',observation_json=?,observed_at=? WHERE reservation_id=? AND kind=?", canonical(o), (/* @__PURE__ */ new Date()).toISOString(), i.reservationId, i.kind);
				if (i.kind === "CONTAINER_REMOVE") removed(i, o.checkedAt);
				return view(action(i.reservationId, i.kind));
			});
		}
	};
}
//#endregion
//#region src/acceptance-service-migration.ts
const acceptanceServiceMigration = `
ALTER TABLE runner_identity RENAME TO runner_identity_v6;
CREATE TABLE runner_identity(singleton INTEGER PRIMARY KEY CHECK(singleton=1),runner_id TEXT NOT NULL,version INTEGER NOT NULL CHECK(version=7)) STRICT;
INSERT INTO runner_identity SELECT singleton,runner_id,7 FROM runner_identity_v6;
DROP TABLE runner_identity_v6;
CREATE TABLE acceptance_services(sequence INTEGER PRIMARY KEY,reservation_id TEXT NOT NULL UNIQUE,controller_id TEXT NOT NULL,operation_id TEXT NOT NULL,release_id TEXT NOT NULL,dataset_id TEXT NOT NULL,purpose TEXT NOT NULL CHECK(purpose='ACCEPTANCE'),request_hash TEXT NOT NULL,request_json TEXT NOT NULL CHECK(json_valid(request_json)),limits_json TEXT NOT NULL CHECK(json_valid(limits_json)),state TEXT NOT NULL CHECK(state IN ('RESERVED','DISPATCHED','ACTIVE','UNKNOWN','EXITED','CANCELLED')),revision INTEGER NOT NULL CHECK(revision>=0),instance_id TEXT,endpoint_json TEXT CHECK(endpoint_json IS NULL OR json_valid(endpoint_json)),fact_json TEXT CHECK(fact_json IS NULL OR json_valid(fact_json)),custody_state TEXT NOT NULL CHECK(custody_state IN ('PREPARING','RELEASE_HELD')),claim_json TEXT CHECK(claim_json IS NULL OR json_valid(claim_json)),claim_hash TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,released_at TEXT,UNIQUE(controller_id,operation_id),UNIQUE(reservation_id,request_hash),CHECK((state IN ('EXITED','CANCELLED'))=(released_at IS NOT NULL)),CHECK(state<>'RESERVED' OR (instance_id IS NULL AND fact_json IS NULL)),CHECK(state<>'EXITED' OR instance_id IS NOT NULL),CHECK((custody_state='RELEASE_HELD')=(claim_json IS NOT NULL)),CHECK((claim_json IS NULL)=(claim_hash IS NULL))) STRICT;
CREATE UNIQUE INDEX exclusive_acceptance_service_dataset ON acceptance_services(dataset_id) WHERE released_at IS NULL;
CREATE UNIQUE INDEX exclusive_acceptance_service_release ON acceptance_services(release_id) WHERE released_at IS NULL;
CREATE TABLE acceptance_service_events(reservation_id TEXT NOT NULL REFERENCES acceptance_services(reservation_id),revision INTEGER NOT NULL,snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),created_at TEXT NOT NULL,PRIMARY KEY(reservation_id,revision)) STRICT;
CREATE TABLE acceptance_service_profiles(reservation_id TEXT PRIMARY KEY,request_hash TEXT NOT NULL,profile_hash TEXT NOT NULL,profile_json TEXT NOT NULL CHECK(json_valid(profile_json)),network_id TEXT,container_id TEXT,created_at TEXT NOT NULL,UNIQUE(reservation_id,profile_hash),FOREIGN KEY(reservation_id,request_hash) REFERENCES acceptance_services(reservation_id,request_hash)) STRICT;
CREATE TABLE acceptance_service_actions(reservation_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('NETWORK_CREATE','CREATE','START')),profile_hash TEXT NOT NULL,request_hash TEXT NOT NULL,request_json TEXT NOT NULL CHECK(json_valid(request_json)),state TEXT NOT NULL CHECK(state IN ('SENT','OBSERVED')),observation_json TEXT CHECK(observation_json IS NULL OR json_valid(observation_json)),created_at TEXT NOT NULL,observed_at TEXT,PRIMARY KEY(reservation_id,kind),FOREIGN KEY(reservation_id,profile_hash) REFERENCES acceptance_service_profiles(reservation_id,profile_hash),CHECK((state='OBSERVED')=(observation_json IS NOT NULL)),CHECK((state='OBSERVED')=(observed_at IS NOT NULL))) STRICT;
CREATE TRIGGER immutable_acceptance_service BEFORE UPDATE ON acceptance_services WHEN OLD.released_at IS NOT NULL OR NEW.sequence<>OLD.sequence OR NEW.reservation_id<>OLD.reservation_id OR NEW.controller_id<>OLD.controller_id OR NEW.operation_id<>OLD.operation_id OR NEW.release_id<>OLD.release_id OR NEW.dataset_id<>OLD.dataset_id OR NEW.purpose<>OLD.purpose OR NEW.request_hash<>OLD.request_hash OR NEW.request_json<>OLD.request_json OR NEW.limits_json<>OLD.limits_json OR NEW.created_at<>OLD.created_at OR (OLD.instance_id IS NOT NULL AND NEW.instance_id IS NOT OLD.instance_id) OR (OLD.endpoint_json IS NOT NULL AND NEW.endpoint_json IS NOT OLD.endpoint_json) OR (OLD.claim_json IS NOT NULL AND (NEW.claim_json IS NOT OLD.claim_json OR NEW.claim_hash IS NOT OLD.claim_hash)) OR (NEW.custody_state<>OLD.custody_state AND NOT (OLD.custody_state='PREPARING' AND NEW.custody_state='RELEASE_HELD')) BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_SERVICE_IMMUTABLE'); END;
CREATE TRIGGER preserve_acceptance_service BEFORE DELETE ON acceptance_services BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_SERVICE_IMMUTABLE'); END;
CREATE TRIGGER immutable_acceptance_service_event BEFORE UPDATE ON acceptance_service_events BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_SERVICE_EVENT_IMMUTABLE'); END;
CREATE TRIGGER preserve_acceptance_service_event BEFORE DELETE ON acceptance_service_events BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_SERVICE_EVENT_IMMUTABLE'); END;
CREATE TRIGGER immutable_acceptance_service_profile BEFORE UPDATE ON acceptance_service_profiles WHEN NEW.reservation_id<>OLD.reservation_id OR NEW.request_hash<>OLD.request_hash OR NEW.profile_hash<>OLD.profile_hash OR NEW.profile_json<>OLD.profile_json OR NEW.created_at<>OLD.created_at OR (OLD.network_id IS NOT NULL AND NEW.network_id IS NOT OLD.network_id) OR (OLD.container_id IS NOT NULL AND NEW.container_id IS NOT OLD.container_id) BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_SERVICE_PROFILE_IMMUTABLE'); END;
CREATE TRIGGER preserve_acceptance_service_profile BEFORE DELETE ON acceptance_service_profiles BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_SERVICE_PROFILE_IMMUTABLE'); END;
CREATE TRIGGER immutable_acceptance_service_action BEFORE UPDATE ON acceptance_service_actions WHEN OLD.state='OBSERVED' OR NEW.reservation_id<>OLD.reservation_id OR NEW.kind<>OLD.kind OR NEW.profile_hash<>OLD.profile_hash OR NEW.request_hash<>OLD.request_hash OR NEW.request_json<>OLD.request_json OR NEW.created_at<>OLD.created_at BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_SERVICE_ACTION_IMMUTABLE'); END;
CREATE TRIGGER preserve_acceptance_service_action BEFORE DELETE ON acceptance_service_actions BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_SERVICE_ACTION_IMMUTABLE'); END;
PRAGMA user_version=7;`;
//#endregion
//#region src/acceptance-service-domain.ts
const hash$4 = (v) => createHash("sha256").update(typeof v === "string" ? v : canonical(v)).digest("hex");
const fail$3 = (code, status = 409) => {
	throw new RunnerError(code, status);
};
/** Private Runner writer. Physical observations are supplied only by trusted composition. */
function createAcceptanceServiceDomain(db, runnerId, fits) {
	const get = (sql, ...p) => db.prepare(sql).get(...p), all = (sql, ...p) => db.prepare(sql).all(...p), exec = (sql, ...p) => db.prepare(sql).run(...p);
	const tx = (body) => {
		db.exec("BEGIN IMMEDIATE");
		try {
			const r = body();
			db.exec("COMMIT");
			return r;
		} catch (e) {
			db.exec("ROLLBACK");
			throw e;
		}
	};
	const version = Number(Object.values(db.prepare("PRAGMA user_version").get())[0]);
	if (version === 6) tx(() => {
		db.exec(acceptanceServiceMigration);
		exec("INSERT INTO runner_schema_history VALUES(7,?,?)", hash$4(acceptanceServiceMigration), (/* @__PURE__ */ new Date()).toISOString());
		if (db.prepare("PRAGMA foreign_key_check").all().length) fail$3("RUNNER_MIGRATION_FOREIGN_KEYS");
	});
	else if (![
		7,
		8,
		9,
		10,
		11,
		12
	].includes(version)) fail$3("RUNNER_STORE_IDENTITY_MISMATCH");
	if (get("SELECT sha256 FROM runner_schema_history WHERE version=7")?.sha256 !== hash$4(acceptanceServiceMigration) || get("SELECT version FROM runner_identity")?.version !== (version === 6 ? 7 : version)) fail$3("RUNNER_MIGRATION_DRIFT");
	const row = (i) => {
		const r = get("SELECT * FROM acceptance_services WHERE controller_id=? AND reservation_id=?", i.controllerId, i.reservationId) ?? fail$3("ACCEPTANCE_SERVICE_NOT_FOUND", 404);
		if (r.request_hash !== i.requestHash) fail$3("ACCEPTANCE_SERVICE_IDENTITY_CHANGED");
		return r;
	};
	const view = (r) => acceptanceServiceReservation.parse({
		purpose: r.purpose,
		reservationId: r.reservation_id,
		controllerId: r.controller_id,
		request: JSON.parse(String(r.request_json)),
		requestHash: r.request_hash,
		resourceLimits: JSON.parse(String(r.limits_json)),
		state: r.state,
		revision: r.revision,
		instanceId: r.instance_id,
		endpoint: r.endpoint_json ? JSON.parse(String(r.endpoint_json)) : null,
		fact: r.fact_json ? JSON.parse(String(r.fact_json)) : null,
		custodyState: r.custody_state,
		claim: r.claim_json ? JSON.parse(String(r.claim_json)) : null,
		claimHash: r.claim_hash,
		createdAt: r.created_at,
		updatedAt: r.updated_at,
		releasedAt: r.released_at
	});
	const changed = (i) => {
		const r = row(i);
		exec("INSERT INTO acceptance_service_events VALUES(?,?,?,?)", i.reservationId, Number(r.revision), canonical(view(r)), String(r.updated_at));
		return view(r);
	};
	const profile = (id) => get("SELECT * FROM acceptance_service_profiles WHERE reservation_id=?", id) ?? fail$3("ACCEPTANCE_SERVICE_PROFILE_NOT_FOUND", 404);
	const journal = (p) => ({
		profile: acceptanceServiceProfile.parse(JSON.parse(String(p.profile_json))),
		profileHash: String(p.profile_hash),
		networkId: p.network_id,
		containerId: p.container_id,
		actions: all("SELECT * FROM acceptance_service_actions WHERE reservation_id=? ORDER BY created_at,kind", String(p.reservation_id)).map((a) => acceptanceServiceActionRecord.parse({
			request: JSON.parse(String(a.request_json)),
			requestHash: a.request_hash,
			state: a.state,
			observation: a.observation_json ? JSON.parse(String(a.observation_json)) : null,
			createdAt: a.created_at,
			observedAt: a.observed_at
		}))
	});
	const aborting = (r) => !!get("SELECT 1 FROM acceptance_service_aborts WHERE operation_id=?", r.operation_id);
	const publishing = (r) => !!get("SELECT 1 FROM release_retirements WHERE reservation_id=?", r.reservation_id);
	const mutable = (r) => {
		if (publishing(r)) fail$3("RELEASE_RETIREMENT_ENROLLED");
		if (aborting(r)) fail$3("ACCEPTANCE_ABORT_REQUESTED");
		if (r.released_at !== null || r.custody_state !== "PREPARING") fail$3("ACCEPTANCE_SERVICE_EXECUTION_CLOSED");
	};
	return {
		acceptanceServiceReserve(i) {
			return tx(() => {
				const r = i.request.preparation;
				if (r.runnerId !== runnerId || i.requestHash !== hash$4(i.request)) fail$3("ACCEPTANCE_SERVICE_IDENTITY_CHANGED");
				const old = get("SELECT * FROM acceptance_services WHERE controller_id=? AND operation_id=?", i.controllerId, r.operationId);
				if (old) {
					if (old.request_hash !== i.requestHash || old.limits_json !== canonical(i.resourceLimits)) fail$3("IDEMPOTENCY_KEY_REUSED");
					return view(old);
				}
				if (get("SELECT 1 FROM acceptance_services WHERE released_at IS NULL AND (dataset_id=? OR release_id=?)", r.target.datasetId, r.releaseId) || get("SELECT 1 FROM preview_reservations WHERE released_at IS NULL AND dataset_id=?", r.target.datasetId)) fail$3("ACCEPTANCE_SERVICE_BUSY");
				if (get("SELECT 1 FROM release_retirements WHERE dataset_id=?", r.target.datasetId)) fail$3("ACCEPTANCE_SERVICE_BUSY");
				if (!fits(i.resourceLimits, i.capacity)) fail$3("RUNNER_CAPACITY_EXHAUSTED", 429);
				const id = "acceptance_" + randomUUID().replaceAll("-", ""), at = (/* @__PURE__ */ new Date()).toISOString();
				exec("INSERT INTO acceptance_services(reservation_id,controller_id,operation_id,release_id,dataset_id,purpose,request_hash,request_json,limits_json,state,revision,custody_state,created_at,updated_at) VALUES(?,?,?,?,?,'ACCEPTANCE',?,?,?,'RESERVED',0,'PREPARING',?,?)", id, i.controllerId, r.operationId, r.releaseId, r.target.datasetId, i.requestHash, canonical(i.request), canonical(i.resourceLimits), at, at);
				return changed({
					controllerId: i.controllerId,
					reservationId: id,
					requestHash: i.requestHash
				});
			});
		},
		acceptanceServiceGet(i) {
			return view(row(i));
		},
		acceptanceServiceByOperation(i) {
			const r = get("SELECT * FROM acceptance_services WHERE controller_id=? AND operation_id=?", i.controllerId, i.operationId);
			return r ? view(r) : null;
		},
		acceptanceServicePage(i) {
			const rows = all("SELECT * FROM acceptance_services WHERE controller_id=? AND sequence>? AND released_at IS NULL ORDER BY sequence LIMIT ?", i.controllerId, i.afterSequence ?? 0, (i.limit ?? 20) + 1), page = rows.slice(0, i.limit ?? 20);
			return {
				items: page.map((r) => ({
					sequence: Number(r.sequence),
					reservation: view(r)
				})),
				nextSequence: rows.length > page.length ? Number(page.at(-1).sequence) : null
			};
		},
		acceptanceServiceDispatch(i) {
			return tx(() => {
				const r = row(i);
				if (r.state !== "RESERVED") return {
					dispatch: false,
					reservation: view(r)
				};
				if (aborting(r)) fail$3("ACCEPTANCE_ABORT_REQUESTED");
				profile(i.reservationId);
				const at = (/* @__PURE__ */ new Date()).toISOString();
				exec("UPDATE acceptance_services SET state='DISPATCHED',revision=revision+1,updated_at=? WHERE reservation_id=?", at, i.reservationId);
				return {
					dispatch: true,
					reservation: changed(i)
				};
			});
		},
		acceptanceServiceCancel(i) {
			return tx(() => {
				const r = row(i);
				if (r.state === "CANCELLED") return view(r);
				if (r.state !== "RESERVED") fail$3("ACCEPTANCE_SERVICE_ALREADY_DISPATCHED");
				const at = (/* @__PURE__ */ new Date()).toISOString();
				exec("UPDATE acceptance_services SET state='CANCELLED',revision=revision+1,updated_at=?,released_at=? WHERE reservation_id=?", at, at, i.reservationId);
				return changed(i);
			});
		},
		acceptanceServiceRecord(i) {
			return tx(() => {
				const r = row(i), request = JSON.parse(String(r.request_json)).preparation, f = i.fact;
				if (f.operationId !== request.operationId || f.releaseId !== request.releaseId || f.datasetId !== request.target.datasetId || f.imageDigest !== request.image.imageDigest) fail$3("ACCEPTANCE_SERVICE_IDENTITY_CHANGED");
				if (r.fact_json === canonical(f)) return view(r);
				if (publishing(r)) fail$3("RELEASE_RETIREMENT_ENROLLED");
				if (aborting(r)) fail$3("ACCEPTANCE_ABORT_REQUESTED");
				if (i.expectedRevision !== r.revision) fail$3("ACCEPTANCE_SERVICE_REVISION_CHANGED");
				if ([
					"RESERVED",
					"CANCELLED",
					"EXITED"
				].includes(String(r.state))) fail$3("ACCEPTANCE_SERVICE_NOT_OBSERVABLE");
				const p = profile(i.reservationId), previous = r.fact_json ? JSON.parse(String(r.fact_json)) : null, at = Date.parse(f.checkedAt);
				if (at > Date.now() || at < Date.parse(String(r.created_at)) || previous && at < Date.parse(previous.checkedAt)) fail$3("ACCEPTANCE_SERVICE_OBSERVATION_STALE");
				if (f.instanceId !== null && f.instanceId !== p.container_id || r.instance_id !== null && f.instanceId !== null && f.instanceId !== r.instance_id || r.endpoint_json !== null && f.endpoint !== null && canonical(f.endpoint) !== r.endpoint_json) fail$3("ACCEPTANCE_SERVICE_IDENTITY_CHANGED");
				if (f.state === "HEALTHY" && !get("SELECT 1 FROM acceptance_service_actions WHERE reservation_id=? AND kind='START' AND state='OBSERVED' AND json_extract(observation_json,'$.state')='RUNNING'", i.reservationId)) fail$3("ACCEPTANCE_SERVICE_START_UNVERIFIED");
				const state = f.state === "EXITED" ? "EXITED" : f.state === "UNKNOWN" ? "UNKNOWN" : f.state === "CREATED" ? "DISPATCHED" : "ACTIVE", now = (/* @__PURE__ */ new Date()).toISOString();
				exec("UPDATE acceptance_services SET state=?,revision=revision+1,instance_id=coalesce(instance_id,?),endpoint_json=coalesce(endpoint_json,?),fact_json=?,updated_at=?,released_at=? WHERE reservation_id=?", state, f.instanceId, f.endpoint ? canonical(f.endpoint) : null, canonical(f), now, state === "EXITED" ? now : null, i.reservationId);
				return changed(i);
			});
		},
		acceptanceServiceProfilePrepare(i) {
			return tx(() => {
				const r = row(i), p = i.profile, names = acceptanceServiceNames(i.reservationId), old = get("SELECT * FROM acceptance_service_profiles WHERE reservation_id=?", i.reservationId);
				if (p.reservationId !== i.reservationId || p.requestHash !== i.requestHash || canonical(p.resourceLimits) !== r.limits_json || p.networkName !== names.networkName || p.containerName !== names.containerName) fail$3("ACCEPTANCE_SERVICE_PROFILE_CHANGED");
				if (old) {
					if (old.profile_json !== canonical(p)) fail$3("ACCEPTANCE_SERVICE_PROFILE_CHANGED");
					return journal(old);
				}
				if (r.state !== "RESERVED") fail$3("ACCEPTANCE_SERVICE_ALREADY_DISPATCHED");
				exec("INSERT INTO acceptance_service_profiles VALUES(?,?,?,?,NULL,NULL,?)", i.reservationId, i.requestHash, hash$4(p), canonical(p), (/* @__PURE__ */ new Date()).toISOString());
				return journal(profile(i.reservationId));
			});
		},
		acceptanceServiceJournal(i) {
			row(i);
			const p = get("SELECT * FROM acceptance_service_profiles WHERE reservation_id=?", i.reservationId);
			return p ? journal(p) : null;
		},
		acceptanceServiceActionBegin(i) {
			return tx(() => {
				const r = row(i), p = profile(i.reservationId);
				if (get("SELECT * FROM acceptance_service_actions WHERE reservation_id=? AND kind=?", i.reservationId, i.kind)) return {
					dispatch: false,
					journal: journal(p)
				};
				mutable(r);
				if (r.state === "RESERVED") fail$3("ACCEPTANCE_SERVICE_NOT_DISPATCHED");
				if (i.kind !== "NETWORK_CREATE" && !p.network_id || i.kind === "START" && !p.container_id) fail$3("ACCEPTANCE_SERVICE_PREDECESSOR_UNKNOWN");
				const request = acceptanceServiceActionRequest.parse({
					schemaVersion: "devmesh.acceptance-service-action.v1",
					purpose: "ACCEPTANCE",
					operationId: "op_" + hash$4("acceptance-service:" + i.reservationId + ":" + i.kind).slice(0, 32),
					reservationId: i.reservationId,
					serviceRequestHash: i.requestHash,
					profileHash: p.profile_hash,
					kind: i.kind,
					networkId: p.network_id,
					containerId: p.container_id
				});
				exec("INSERT INTO acceptance_service_actions VALUES(?,?,?,?,?,'SENT',NULL,?,NULL)", i.reservationId, i.kind, String(p.profile_hash), hash$4(request), canonical(request), (/* @__PURE__ */ new Date()).toISOString());
				return {
					dispatch: true,
					journal: journal(p)
				};
			});
		},
		acceptanceServiceActionAuthorized(i) {
			const r = row(i), a = get("SELECT * FROM acceptance_service_actions WHERE reservation_id=? AND kind=?", i.reservationId, i.kind);
			return { allowed: !publishing(r) && !aborting(r) && r.released_at === null && r.custody_state === "PREPARING" && r.state !== "RESERVED" && a?.state === "SENT" && a.request_hash === i.actionRequestHash };
		},
		acceptanceServiceActionObserve(i) {
			return tx(() => {
				row(i);
				const p = profile(i.reservationId), a = get("SELECT * FROM acceptance_service_actions WHERE reservation_id=? AND kind=?", i.reservationId, i.kind) ?? fail$3("ACCEPTANCE_SERVICE_ACTION_NOT_FOUND", 404), o = i.observation;
				if (a.request_hash !== i.actionRequestHash) fail$3("ACCEPTANCE_SERVICE_IDENTITY_CHANGED");
				if (a.state === "OBSERVED") {
					if (a.observation_json !== canonical(o)) fail$3("ACCEPTANCE_SERVICE_ACTION_IMMUTABLE");
					return journal(p);
				}
				if (Date.parse(o.checkedAt) < Date.parse(String(a.created_at)) || Date.parse(o.checkedAt) > Date.now()) fail$3("ACCEPTANCE_SERVICE_OBSERVATION_STALE");
				if (i.kind === "NETWORK_CREATE" && o.state !== "CREATED" || i.kind === "CREATE" && o.state !== "CREATED" || i.kind === "START" && o.state === "CREATED") fail$3("ACCEPTANCE_SERVICE_ACTION_UNVERIFIED");
				const key = i.kind === "NETWORK_CREATE" ? "network_id" : "container_id";
				if (p[key] !== null && p[key] !== o.objectId || i.kind === "START" && p.container_id !== o.objectId) fail$3("ACCEPTANCE_SERVICE_IDENTITY_CHANGED");
				if (i.kind !== "START") exec("UPDATE acceptance_service_profiles SET " + key + "=coalesce(" + key + ",?) WHERE reservation_id=?", o.objectId, i.reservationId);
				exec("UPDATE acceptance_service_actions SET state='OBSERVED',observation_json=?,observed_at=? WHERE reservation_id=? AND kind=?", canonical(o), (/* @__PURE__ */ new Date()).toISOString(), i.reservationId, i.kind);
				return journal(profile(i.reservationId));
			});
		},
		acceptanceServiceHold(i) {
			return tx(() => {
				const r = row(i), v = view(r), p = profile(i.reservationId), q = v.request.preparation, f = v.fact, claim = acceptanceServiceClaim.parse(i.claim);
				if (i.claimHash !== hash$4(claim) || claim.acceptanceRequestHash !== v.request.acceptanceRequestHash || claim.serviceRequestHash !== i.requestHash || claim.reservationId !== i.reservationId || claim.profileHash !== p.profile_hash || claim.instanceId !== r.instance_id) fail$3("ACCEPTANCE_SERVICE_CLAIM_CHANGED");
				for (const k of [
					"operationId",
					"releaseId",
					"projectId",
					"runId",
					"candidateId",
					"manifestHash",
					"reviewHash",
					"dataPlanHash"
				]) if (claim[k] !== q[k]) fail$3("ACCEPTANCE_SERVICE_CLAIM_CHANGED");
				if (claim.datasetId !== q.target.datasetId || claim.imageDigest !== q.image.imageDigest) fail$3("ACCEPTANCE_SERVICE_CLAIM_CHANGED");
				if (r.claim_hash !== null) {
					if (r.claim_hash !== i.claimHash || r.claim_json !== canonical(claim)) fail$3("ACCEPTANCE_SERVICE_CLAIM_CHANGED");
					return v;
				}
				const age = f ? Date.now() - Date.parse(f.checkedAt) : -1;
				if (aborting(r)) fail$3("ACCEPTANCE_ABORT_REQUESTED");
				if (r.released_at !== null || f?.state !== "HEALTHY" || f.instanceId !== claim.instanceId || !f.endpoint || age < 0 || age > 3e4) fail$3("ACCEPTANCE_SERVICE_HOLD_UNAVAILABLE");
				const at = (/* @__PURE__ */ new Date()).toISOString();
				exec("UPDATE acceptance_services SET custody_state='RELEASE_HELD',claim_json=?,claim_hash=?,revision=revision+1,updated_at=? WHERE reservation_id=?", canonical(claim), i.claimHash, at, i.reservationId);
				return changed(i);
			});
		}
	};
}
//#endregion
//#region src/acceptance-proof-migration.ts
const acceptanceProofMigration = `
ALTER TABLE runner_identity RENAME TO runner_identity_v7;
CREATE TABLE runner_identity(singleton INTEGER PRIMARY KEY CHECK(singleton=1),runner_id TEXT NOT NULL,version INTEGER NOT NULL CHECK(version=8)) STRICT;
INSERT INTO runner_identity SELECT singleton,runner_id,8 FROM runner_identity_v7;
DROP TABLE runner_identity_v7;
CREATE TABLE acceptance_service_proofs(reservation_id TEXT PRIMARY KEY,request_hash TEXT NOT NULL,profile_hash TEXT NOT NULL,proof_hash TEXT NOT NULL,proof_json TEXT NOT NULL CHECK(json_valid(proof_json)),created_at TEXT NOT NULL,FOREIGN KEY(reservation_id,request_hash) REFERENCES acceptance_services(reservation_id,request_hash),FOREIGN KEY(reservation_id,profile_hash) REFERENCES acceptance_service_profiles(reservation_id,profile_hash)) STRICT;
CREATE TRIGGER immutable_acceptance_proof_update BEFORE UPDATE ON acceptance_service_proofs BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_SERVICE_PROOF_IMMUTABLE'); END;
CREATE TRIGGER immutable_acceptance_proof_delete BEFORE DELETE ON acceptance_service_proofs BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_SERVICE_PROOF_IMMUTABLE'); END;
PRAGMA user_version=8;`;
//#endregion
//#region src/acceptance-proof-domain.ts
const hash$3 = (v) => createHash("sha256").update(typeof v === "string" ? v : canonical(v)).digest("hex");
function createAcceptanceProofDomain(db, runnerId, services) {
	const tx = (body) => {
		db.exec("BEGIN IMMEDIATE");
		try {
			const result = body();
			db.exec("COMMIT");
			return result;
		} catch (e) {
			db.exec("ROLLBACK");
			throw e;
		}
	};
	const version = Number(Object.values(db.prepare("PRAGMA user_version").get())[0]);
	if (version === 7) tx(() => {
		db.exec(acceptanceProofMigration);
		db.prepare("INSERT INTO runner_schema_history VALUES(8,?,?)").run(hash$3(acceptanceProofMigration), (/* @__PURE__ */ new Date()).toISOString());
		if (db.prepare("PRAGMA foreign_key_check").all().length) throw new RunnerError("RUNNER_MIGRATION_FOREIGN_KEYS", 409);
	});
	else if (![
		8,
		9,
		10,
		11,
		12
	].includes(version)) throw new RunnerError("RUNNER_STORE_IDENTITY_MISMATCH", 409);
	if (db.prepare("SELECT sha256 FROM runner_schema_history WHERE version=8").get()?.sha256 !== hash$3(acceptanceProofMigration) || db.prepare("SELECT version FROM runner_identity").get()?.version !== (version === 7 ? 8 : version)) throw new RunnerError("RUNNER_MIGRATION_DRIFT", 409);
	return { acceptanceServicePrepareProof(i) {
		return tx(() => {
			const r = services.acceptanceServiceGet(i), old = db.prepare("SELECT * FROM acceptance_service_proofs WHERE reservation_id=?").get(i.reservationId);
			if (old) {
				if (old.request_hash !== i.requestHash || hash$3(String(old.proof_json)) !== old.proof_hash) throw new RunnerError("ACCEPTANCE_SERVICE_PROOF_CHANGED", 409);
				return acceptancePreparedProof.parse(JSON.parse(String(old.proof_json)));
			}
			if (db.prepare("SELECT 1 FROM acceptance_service_aborts WHERE reservation_id=?").get(i.reservationId)) throw new RunnerError("ACCEPTANCE_ABORT_REQUESTED", 409);
			const j = services.acceptanceServiceJournal(i), f = r.fact, age = f ? Date.now() - Date.parse(f.checkedAt) : -1;
			if (!j || r.custodyState !== "RELEASE_HELD" || r.state !== "ACTIVE" || r.releasedAt !== null || !r.claim || !r.claimHash || !f?.endpoint || f.state !== "HEALTHY" || f.instanceId !== r.claim.instanceId || age < 0 || age > 3e4) throw new RunnerError("ACCEPTANCE_SERVICE_PROOF_UNAVAILABLE", 409);
			const q = r.request.preparation, at = (/* @__PURE__ */ new Date()).toISOString(), proof = acceptancePreparedProof.parse({
				schemaVersion: "devmesh.acceptance-prepared.v1",
				operationId: q.operationId,
				requestHash: r.request.acceptanceRequestHash,
				releaseId: q.releaseId,
				projectId: q.projectId,
				runId: q.runId,
				candidateId: q.candidateId,
				manifestHash: q.manifestHash,
				reviewHash: q.reviewHash,
				dataPlanHash: q.dataPlanHash,
				runnerId,
				backendRef: q.backendRef,
				data: r.request.dataReceipt.data,
				sourceFence: r.request.fences.sourceFence,
				targetFence: r.request.fences.targetFence,
				service: {
					reservationId: r.reservationId,
					profileHash: j.profileHash,
					endpoint: f.endpoint,
					claim: r.claim,
					claimHash: r.claimHash,
					custodyState: "RELEASE_HELD",
					custodyRevision: r.revision
				},
				preparedAt: f.checkedAt
			}), json = canonical(proof);
			db.prepare("INSERT INTO acceptance_service_proofs VALUES(?,?,?,?,?,?)").run(i.reservationId, i.requestHash, j.profileHash, hash$3(json), json, at);
			return proof;
		});
	} };
}
//#endregion
//#region src/acceptance-abort-migration.ts
const acceptanceAbortMigration = `
ALTER TABLE runner_identity RENAME TO runner_identity_v8;
CREATE TABLE runner_identity(singleton INTEGER PRIMARY KEY CHECK(singleton=1),runner_id TEXT NOT NULL,version INTEGER NOT NULL CHECK(version=9)) STRICT;
INSERT INTO runner_identity SELECT singleton,runner_id,9 FROM runner_identity_v8;
DROP TABLE runner_identity_v8;
CREATE TABLE acceptance_services_v9(sequence INTEGER PRIMARY KEY,reservation_id TEXT NOT NULL UNIQUE,controller_id TEXT NOT NULL,operation_id TEXT NOT NULL,release_id TEXT NOT NULL,dataset_id TEXT NOT NULL,purpose TEXT NOT NULL CHECK(purpose='ACCEPTANCE'),request_hash TEXT NOT NULL,request_json TEXT NOT NULL CHECK(json_valid(request_json)),limits_json TEXT NOT NULL CHECK(json_valid(limits_json)),state TEXT NOT NULL CHECK(state IN ('RESERVED','DISPATCHED','ACTIVE','UNKNOWN','EXITED','CANCELLED','REMOVED')),revision INTEGER NOT NULL CHECK(revision>=0),instance_id TEXT,endpoint_json TEXT CHECK(endpoint_json IS NULL OR json_valid(endpoint_json)),fact_json TEXT CHECK(fact_json IS NULL OR json_valid(fact_json)),custody_state TEXT NOT NULL CHECK(custody_state IN ('PREPARING','RELEASE_HELD')),claim_json TEXT CHECK(claim_json IS NULL OR json_valid(claim_json)),claim_hash TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,released_at TEXT,UNIQUE(controller_id,operation_id),UNIQUE(reservation_id,request_hash),CHECK((state IN ('EXITED','CANCELLED','REMOVED'))=(released_at IS NOT NULL)),CHECK(state<>'RESERVED' OR (instance_id IS NULL AND fact_json IS NULL)),CHECK(state NOT IN ('EXITED','REMOVED') OR instance_id IS NOT NULL),CHECK((custody_state='RELEASE_HELD')=(claim_json IS NOT NULL)),CHECK((claim_json IS NULL)=(claim_hash IS NULL))) STRICT;
INSERT INTO acceptance_services_v9 SELECT * FROM acceptance_services;
DROP TABLE acceptance_services;
ALTER TABLE acceptance_services_v9 RENAME TO acceptance_services;
CREATE UNIQUE INDEX exclusive_acceptance_service_dataset ON acceptance_services(dataset_id) WHERE released_at IS NULL;
CREATE UNIQUE INDEX exclusive_acceptance_service_release ON acceptance_services(release_id) WHERE released_at IS NULL;
CREATE TRIGGER immutable_acceptance_service BEFORE UPDATE ON acceptance_services WHEN OLD.released_at IS NOT NULL OR NEW.sequence<>OLD.sequence OR NEW.reservation_id<>OLD.reservation_id OR NEW.controller_id<>OLD.controller_id OR NEW.operation_id<>OLD.operation_id OR NEW.release_id<>OLD.release_id OR NEW.dataset_id<>OLD.dataset_id OR NEW.purpose<>OLD.purpose OR NEW.request_hash<>OLD.request_hash OR NEW.request_json<>OLD.request_json OR NEW.limits_json<>OLD.limits_json OR NEW.created_at<>OLD.created_at OR (OLD.instance_id IS NOT NULL AND NEW.instance_id IS NOT OLD.instance_id) OR (OLD.endpoint_json IS NOT NULL AND NEW.endpoint_json IS NOT OLD.endpoint_json) OR (OLD.claim_json IS NOT NULL AND (NEW.claim_json IS NOT OLD.claim_json OR NEW.claim_hash IS NOT OLD.claim_hash)) OR (NEW.custody_state<>OLD.custody_state AND NOT (OLD.custody_state='PREPARING' AND NEW.custody_state='RELEASE_HELD')) BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_SERVICE_IMMUTABLE'); END;
CREATE TRIGGER preserve_acceptance_service BEFORE DELETE ON acceptance_services BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_SERVICE_IMMUTABLE'); END;
CREATE TABLE acceptance_service_aborts(operation_id TEXT PRIMARY KEY,controller_id TEXT NOT NULL,reservation_id TEXT UNIQUE REFERENCES acceptance_services(reservation_id),decision_hash TEXT NOT NULL UNIQUE,decision_json TEXT NOT NULL CHECK(json_valid(decision_json)),created_at TEXT NOT NULL) STRICT;
CREATE TABLE acceptance_abort_actions(operation_id TEXT NOT NULL REFERENCES acceptance_service_aborts(operation_id),kind TEXT NOT NULL CHECK(kind IN ('STOP','CONTAINER_REMOVE','NETWORK_REMOVE')),profile_hash TEXT NOT NULL,request_hash TEXT NOT NULL,request_json TEXT NOT NULL CHECK(json_valid(request_json)),state TEXT NOT NULL CHECK(state IN ('SENT','OBSERVED')),observation_json TEXT CHECK(observation_json IS NULL OR json_valid(observation_json)),created_at TEXT NOT NULL,observed_at TEXT,PRIMARY KEY(operation_id,kind),CHECK((state='OBSERVED')=(observation_json IS NOT NULL)),CHECK((state='OBSERVED')=(observed_at IS NOT NULL))) STRICT;
CREATE TRIGGER immutable_acceptance_abort BEFORE UPDATE ON acceptance_service_aborts BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_ABORT_IMMUTABLE'); END;
CREATE TRIGGER preserve_acceptance_abort BEFORE DELETE ON acceptance_service_aborts BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_ABORT_IMMUTABLE'); END;
CREATE TRIGGER immutable_acceptance_abort_action BEFORE UPDATE ON acceptance_abort_actions WHEN OLD.state='OBSERVED' OR NEW.operation_id<>OLD.operation_id OR NEW.kind<>OLD.kind OR NEW.profile_hash<>OLD.profile_hash OR NEW.request_hash<>OLD.request_hash OR NEW.request_json<>OLD.request_json OR NEW.created_at<>OLD.created_at BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_ABORT_ACTION_IMMUTABLE'); END;
CREATE TRIGGER preserve_acceptance_abort_action BEFORE DELETE ON acceptance_abort_actions BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_ABORT_ACTION_IMMUTABLE'); END;
CREATE TRIGGER aborted_acceptance_reserve BEFORE INSERT ON acceptance_services WHEN EXISTS(SELECT 1 FROM acceptance_service_aborts WHERE operation_id=NEW.operation_id) BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_ABORT_REQUESTED'); END;
CREATE TRIGGER aborted_acceptance_action BEFORE INSERT ON acceptance_service_actions WHEN EXISTS(SELECT 1 FROM acceptance_service_aborts WHERE reservation_id=NEW.reservation_id) BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_ABORT_REQUESTED'); END;
CREATE TRIGGER aborted_acceptance_proof BEFORE INSERT ON acceptance_service_proofs WHEN EXISTS(SELECT 1 FROM acceptance_service_aborts WHERE reservation_id=NEW.reservation_id) BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_ABORT_REQUESTED'); END;
CREATE TRIGGER aborted_acceptance_service BEFORE UPDATE ON acceptance_services WHEN EXISTS(SELECT 1 FROM acceptance_service_aborts WHERE reservation_id=OLD.reservation_id) AND NOT (
 (NEW.state='REMOVED' AND EXISTS(SELECT 1 FROM acceptance_service_aborts a JOIN acceptance_abort_actions x USING(operation_id) WHERE a.reservation_id=OLD.reservation_id AND x.kind='CONTAINER_REMOVE' AND x.state='OBSERVED' AND json_extract(x.observation_json,'$.objectId')=NEW.instance_id)) OR
 (NEW.state='CANCELLED' AND NOT EXISTS(SELECT 1 FROM acceptance_service_actions WHERE reservation_id=OLD.reservation_id AND kind='CREATE') AND (NOT EXISTS(SELECT 1 FROM acceptance_service_actions WHERE reservation_id=OLD.reservation_id) OR EXISTS(SELECT 1 FROM acceptance_service_aborts a JOIN acceptance_abort_actions x USING(operation_id) WHERE a.reservation_id=OLD.reservation_id AND x.kind='NETWORK_REMOVE' AND x.state='OBSERVED')))
) BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_ABORT_REQUESTED'); END;
PRAGMA user_version=9;`;
//#endregion
//#region src/acceptance-abort-domain.ts
const hash$2 = (v) => createHash("sha256").update(typeof v === "string" ? v : canonical(v)).digest("hex");
const fail$2 = (code, status = 409) => {
	throw new RunnerError(code, status);
};
/** Private writer; a trusted adapter reads the original control decision. */
function createAcceptanceAbortDomain(db, runnerId, services) {
	const get = (sql, ...p) => db.prepare(sql).get(...p), all = (sql, ...p) => db.prepare(sql).all(...p), exec = (sql, ...p) => db.prepare(sql).run(...p);
	const tx = (body) => {
		db.exec("BEGIN IMMEDIATE");
		try {
			const v = body();
			db.exec("COMMIT");
			return v;
		} catch (e) {
			db.exec("ROLLBACK");
			throw e;
		}
	};
	const version = Number(Object.values(db.prepare("PRAGMA user_version").get())[0]);
	if (version === 8) {
		db.exec("PRAGMA foreign_keys=OFF");
		try {
			if (Number(Object.values(db.prepare("PRAGMA foreign_keys").get())[0]) !== 0) fail$2("RUNNER_MIGRATION_FOREIGN_KEYS");
			tx(() => {
				db.exec(acceptanceAbortMigration);
				exec("INSERT INTO runner_schema_history VALUES(9,?,?)", hash$2(acceptanceAbortMigration), (/* @__PURE__ */ new Date()).toISOString());
				if (db.prepare("PRAGMA foreign_key_check").all().length) fail$2("RUNNER_MIGRATION_FOREIGN_KEYS");
			});
		} finally {
			db.exec("PRAGMA foreign_keys=ON");
		}
	} else if (![
		9,
		10,
		11,
		12
	].includes(version)) fail$2("RUNNER_STORE_IDENTITY_MISMATCH");
	if (get("SELECT sha256 FROM runner_schema_history WHERE version=9")?.sha256 !== hash$2(acceptanceAbortMigration) || get("SELECT version FROM runner_identity")?.version !== (version === 8 ? 9 : version)) fail$2("RUNNER_MIGRATION_DRIFT");
	if (Number(Object.values(db.prepare("PRAGMA foreign_keys").get())[0]) !== 1) fail$2("RUNNER_MIGRATION_FOREIGN_KEYS");
	const row = (i) => {
		const r = get("SELECT * FROM acceptance_service_aborts WHERE operation_id=? AND controller_id=?", i.operationId, i.controllerId) ?? fail$2("ACCEPTANCE_ABORT_NOT_FOUND", 404);
		if (r.decision_hash !== i.decisionHash) fail$2("ACCEPTANCE_ABORT_IDENTITY_CHANGED");
		return r;
	};
	const action = (id, kind) => get("SELECT * FROM acceptance_abort_actions WHERE operation_id=? AND kind=?", id, kind);
	const actionView = (r) => acceptanceAbortAction.parse({
		request: JSON.parse(String(r.request_json)),
		requestHash: r.request_hash,
		state: r.state,
		observation: r.observation_json ? JSON.parse(String(r.observation_json)) : null,
		createdAt: r.created_at,
		observedAt: r.observed_at
	});
	function original(r) {
		if (r.reservation_id === null) return null;
		const s = get("SELECT request_hash FROM acceptance_services WHERE reservation_id=?", r.reservation_id);
		return services.acceptanceServiceGet({
			controllerId: String(r.controller_id),
			reservationId: String(r.reservation_id),
			requestHash: String(s?.request_hash ?? fail$2("ACCEPTANCE_SERVICE_NOT_FOUND"))
		});
	}
	function view(r) {
		const reservation = original(r), actions = all("SELECT * FROM acceptance_abort_actions WHERE operation_id=? ORDER BY created_at,kind", r.operation_id).map(actionView), unsent = !reservation || reservation.state === "CANCELLED";
		return {
			controllerId: String(r.controller_id),
			record: {
				decision: acceptanceAbortDecision.parse(JSON.parse(String(r.decision_json))),
				decisionHash: String(r.decision_hash)
			},
			reservation,
			actions,
			serviceCleared: unsent || actions.some((a) => a.request.kind === "CONTAINER_REMOVE" && a.state === "OBSERVED"),
			networkCleared: unsent || actions.some((a) => a.request.kind === "NETWORK_REMOVE" && a.state === "OBSERVED")
		};
	}
	function eligible(i, kind) {
		const a = row(i), r = original(a) ?? fail$2("ACCEPTANCE_ABORT_NO_SERVICE"), j = services.acceptanceServiceJournal({
			controllerId: r.controllerId,
			reservationId: r.reservationId,
			requestHash: r.requestHash
		}) ?? fail$2("ACCEPTANCE_ABORT_ORIGINAL_UNKNOWN");
		if (!j.networkId || !j.actions.some((a) => a.request.kind === "NETWORK_CREATE" && a.state === "OBSERVED")) fail$2("ACCEPTANCE_ABORT_ORIGINAL_UNKNOWN");
		const created = j.actions.some((a) => a.request.kind === "CREATE");
		if (kind !== "NETWORK_REMOVE" && (!j.containerId || !j.actions.some((a) => a.request.kind === "CREATE" && a.state === "OBSERVED"))) fail$2("ACCEPTANCE_ABORT_ORIGINAL_UNKNOWN");
		if (kind === "CONTAINER_REMOVE" && action(i.operationId, "STOP")?.state !== "OBSERVED" || kind === "NETWORK_REMOVE" && created && action(i.operationId, "CONTAINER_REMOVE")?.state !== "OBSERVED") fail$2("ACCEPTANCE_ABORT_PREDECESSOR_UNKNOWN");
		return {
			a,
			r,
			j
		};
	}
	function release(r, state, instanceId) {
		if (r.releasedAt !== null) return;
		const at = (/* @__PURE__ */ new Date()).toISOString();
		exec("UPDATE acceptance_services SET state=?,instance_id=coalesce(instance_id,?),revision=revision+1,updated_at=?,released_at=? WHERE reservation_id=?", state, instanceId, at, at, r.reservationId);
		const current = services.acceptanceServiceGet({
			controllerId: r.controllerId,
			reservationId: r.reservationId,
			requestHash: r.requestHash
		});
		exec("INSERT INTO acceptance_service_events VALUES(?,?,?,?)", r.reservationId, current.revision, canonical(current), at);
	}
	return {
		acceptanceAbortEnroll(i) {
			return tx(() => {
				const d = i.decision, q = d.preparation;
				if (q.runnerId !== runnerId || i.decisionHash !== hash$2(d)) fail$2("ACCEPTANCE_ABORT_IDENTITY_CHANGED");
				if (get("SELECT 1 FROM release_retirements WHERE preparation_operation_id=?", q.operationId)) fail$2("RELEASE_RETIREMENT_ENROLLED");
				const old = get("SELECT * FROM acceptance_service_aborts WHERE operation_id=?", q.operationId);
				if (old) {
					if (old.controller_id !== i.controllerId || old.decision_hash !== i.decisionHash || old.decision_json !== canonical(d)) fail$2("ACCEPTANCE_ABORT_IDENTITY_CHANGED");
					return view(old);
				}
				if (get("SELECT 1 FROM acceptance_services WHERE operation_id=? AND controller_id<>?", q.operationId, i.controllerId)) fail$2("ACCEPTANCE_ABORT_IDENTITY_CHANGED");
				const service = get("SELECT * FROM acceptance_services WHERE controller_id=? AND operation_id=?", i.controllerId, q.operationId);
				if (service) {
					const r = JSON.parse(String(service.request_json));
					if (canonical(r.preparation) !== canonical(q) || r.acceptanceRequestHash !== d.preparationRequestHash) fail$2("ACCEPTANCE_ABORT_IDENTITY_CHANGED");
					if (d.preparedProofHash !== null && get("SELECT proof_hash FROM acceptance_service_proofs WHERE reservation_id=?", service.reservation_id)?.proof_hash !== d.preparedProofHash) fail$2("ACCEPTANCE_ABORT_PROOF_CHANGED");
				} else if (d.preparedProofHash !== null) fail$2("ACCEPTANCE_ABORT_PROOF_CHANGED");
				exec("INSERT INTO acceptance_service_aborts VALUES(?,?,?,?,?,?)", q.operationId, i.controllerId, service?.reservation_id ?? null, i.decisionHash, canonical(d), (/* @__PURE__ */ new Date()).toISOString());
				const stored = row({
					controllerId: i.controllerId,
					operationId: q.operationId,
					decisionHash: i.decisionHash
				}), r = original(stored);
				if (r && !get("SELECT 1 FROM acceptance_service_actions WHERE reservation_id=?", r.reservationId)) release(r, "CANCELLED", null);
				return view(stored);
			});
		},
		acceptanceAbortGet(i) {
			return view(row(i));
		},
		acceptanceAbortActionBegin(i) {
			return tx(() => {
				row(i);
				const old = action(i.operationId, i.kind);
				if (old) return {
					dispatch: false,
					action: actionView(old)
				};
				const { a, r, j } = eligible(i, i.kind), decision = acceptanceAbortDecision.parse(JSON.parse(String(a.decision_json))), request = acceptanceAbortActionRequest.parse({
					schemaVersion: "devmesh.acceptance-service-abort-action.v1",
					operationId: "op_" + hash$2("acceptance-abort:" + i.operationId + ":" + i.kind).slice(0, 32),
					preparationOperationId: i.operationId,
					abortOperationId: decision.operationId,
					decisionHash: i.decisionHash,
					reservationId: r.reservationId,
					serviceRequestHash: r.requestHash,
					profileHash: j.profileHash,
					kind: i.kind,
					containerId: j.containerId,
					networkId: j.networkId
				});
				exec("INSERT INTO acceptance_abort_actions VALUES(?,?,?,?,?,'SENT',NULL,?,NULL)", i.operationId, i.kind, j.profileHash, hash$2(request), canonical(request), (/* @__PURE__ */ new Date()).toISOString());
				return {
					dispatch: true,
					action: actionView(action(i.operationId, i.kind))
				};
			});
		},
		acceptanceAbortActionAuthorized(i) {
			row(i);
			const a = action(i.operationId, i.kind);
			try {
				eligible(i, i.kind);
				return { allowed: a?.state === "SENT" && a.request_hash === i.actionRequestHash };
			} catch (e) {
				if (e instanceof RunnerError) return { allowed: false };
				throw e;
			}
		},
		acceptanceAbortActionObserve(i) {
			return tx(() => {
				const { a, r, j } = eligible(i, i.kind), old = action(i.operationId, i.kind) ?? fail$2("ACCEPTANCE_ABORT_ACTION_NOT_FOUND", 404), o = i.observation;
				if (old.request_hash !== i.actionRequestHash || o.kind !== i.kind || o.objectId !== (i.kind === "NETWORK_REMOVE" ? j.networkId : j.containerId)) fail$2("ACCEPTANCE_ABORT_IDENTITY_CHANGED");
				if (old.state === "OBSERVED") {
					if (old.observation_json !== canonical(o)) fail$2("ACCEPTANCE_ABORT_ACTION_IMMUTABLE");
					return view(a);
				}
				if (Date.parse(o.checkedAt) < Date.parse(String(old.created_at)) || Date.parse(o.checkedAt) > Date.now()) fail$2("ACCEPTANCE_ABORT_OBSERVATION_STALE");
				exec("UPDATE acceptance_abort_actions SET state='OBSERVED',observation_json=?,observed_at=? WHERE operation_id=? AND kind=?", canonical(o), (/* @__PURE__ */ new Date()).toISOString(), i.operationId, i.kind);
				if (i.kind === "CONTAINER_REMOVE") release(r, "REMOVED", j.containerId);
				else if (i.kind === "NETWORK_REMOVE" && !j.actions.some((a) => a.request.kind === "CREATE")) release(r, "CANCELLED", null);
				return view(a);
			});
		}
	};
}
//#endregion
//#region src/release-retirement-migration.ts
const releaseRetirementMigration = `
ALTER TABLE runner_identity RENAME TO runner_identity_v9;
CREATE TABLE runner_identity(singleton INTEGER PRIMARY KEY CHECK(singleton=1),runner_id TEXT NOT NULL,version INTEGER NOT NULL CHECK(version=10)) STRICT;
INSERT INTO runner_identity SELECT singleton,runner_id,10 FROM runner_identity_v9;
DROP TABLE runner_identity_v9;
CREATE TABLE release_retirements(sequence INTEGER PRIMARY KEY,release_id TEXT NOT NULL UNIQUE,controller_id TEXT NOT NULL,preparation_operation_id TEXT NOT NULL UNIQUE,reservation_id TEXT NOT NULL UNIQUE REFERENCES acceptance_services(reservation_id),dataset_id TEXT NOT NULL UNIQUE,request_hash TEXT NOT NULL UNIQUE,request_json TEXT NOT NULL CHECK(json_valid(request_json)),original_json TEXT NOT NULL CHECK(json_valid(original_json)),created_at TEXT NOT NULL) STRICT;
CREATE TABLE release_retirement_actions(release_id TEXT NOT NULL REFERENCES release_retirements(release_id),kind TEXT NOT NULL CHECK(kind IN ('REVOKE_PREPARATION','STOP','CONTAINER_REMOVE','NETWORK_REMOVE')),request_hash TEXT NOT NULL,request_json TEXT NOT NULL CHECK(json_valid(request_json)),state TEXT NOT NULL CHECK(state IN ('SENT','OBSERVED')),observation_json TEXT CHECK(observation_json IS NULL OR json_valid(observation_json)),created_at TEXT NOT NULL,observed_at TEXT,PRIMARY KEY(release_id,kind),CHECK((state='OBSERVED')=(observation_json IS NOT NULL)),CHECK((state='OBSERVED')=(observed_at IS NOT NULL))) STRICT;
CREATE TRIGGER immutable_release_retirement BEFORE UPDATE ON release_retirements BEGIN SELECT RAISE(ABORT,'RELEASE_RETIREMENT_IMMUTABLE'); END;
CREATE TRIGGER preserve_release_retirement BEFORE DELETE ON release_retirements BEGIN SELECT RAISE(ABORT,'RELEASE_RETIREMENT_IMMUTABLE'); END;
CREATE TRIGGER immutable_release_retirement_action BEFORE UPDATE ON release_retirement_actions WHEN OLD.state='OBSERVED' OR NEW.release_id<>OLD.release_id OR NEW.kind<>OLD.kind OR NEW.request_hash<>OLD.request_hash OR NEW.request_json<>OLD.request_json OR NEW.created_at<>OLD.created_at BEGIN SELECT RAISE(ABORT,'RELEASE_RETIREMENT_ACTION_IMMUTABLE'); END;
CREATE TRIGGER preserve_release_retirement_action BEFORE DELETE ON release_retirement_actions BEGIN SELECT RAISE(ABORT,'RELEASE_RETIREMENT_ACTION_IMMUTABLE'); END;
CREATE TRIGGER publishing_acceptance_abort BEFORE INSERT ON acceptance_service_aborts WHEN EXISTS(SELECT 1 FROM release_retirements WHERE preparation_operation_id=NEW.operation_id) BEGIN SELECT RAISE(ABORT,'RELEASE_RETIREMENT_ENROLLED'); END;
CREATE TRIGGER aborting_release_retirement BEFORE INSERT ON release_retirements WHEN EXISTS(SELECT 1 FROM acceptance_service_aborts WHERE operation_id=NEW.preparation_operation_id) BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_ABORT_REQUESTED'); END;
CREATE TRIGGER publishing_acceptance_action BEFORE INSERT ON acceptance_service_actions WHEN EXISTS(SELECT 1 FROM release_retirements WHERE reservation_id=NEW.reservation_id) BEGIN SELECT RAISE(ABORT,'RELEASE_RETIREMENT_ENROLLED'); END;
CREATE TRIGGER publishing_acceptance_action_observation BEFORE UPDATE ON acceptance_service_actions WHEN EXISTS(SELECT 1 FROM release_retirements WHERE reservation_id=NEW.reservation_id) BEGIN SELECT RAISE(ABORT,'RELEASE_RETIREMENT_ENROLLED'); END;
CREATE TRIGGER publishing_acceptance_proof BEFORE INSERT ON acceptance_service_proofs WHEN EXISTS(SELECT 1 FROM release_retirements WHERE reservation_id=NEW.reservation_id) BEGIN SELECT RAISE(ABORT,'RELEASE_RETIREMENT_ENROLLED'); END;
CREATE TRIGGER publishing_acceptance_service BEFORE UPDATE ON acceptance_services WHEN EXISTS(SELECT 1 FROM release_retirements WHERE reservation_id=OLD.reservation_id) AND NOT (
 NEW.state='REMOVED' AND NEW.released_at IS NOT NULL AND EXISTS(SELECT 1 FROM release_retirements r JOIN release_retirement_actions a USING(release_id) WHERE r.reservation_id=OLD.reservation_id AND a.kind='CONTAINER_REMOVE' AND a.state='OBSERVED' AND json_extract(a.observation_json,'$.objectId')=OLD.instance_id AND json_extract(a.observation_json,'$.absenceVerified')=1)
) BEGIN SELECT RAISE(ABORT,'RELEASE_RETIREMENT_ENROLLED'); END;
CREATE TRIGGER publishing_preview_reservation BEFORE INSERT ON preview_reservations WHEN EXISTS(SELECT 1 FROM release_retirements WHERE dataset_id=NEW.dataset_id) BEGIN SELECT RAISE(ABORT,'RELEASE_DATASET_HANDOFF_HELD'); END;
CREATE TRIGGER publishing_acceptance_reservation BEFORE INSERT ON acceptance_services WHEN EXISTS(SELECT 1 FROM release_retirements WHERE dataset_id=NEW.dataset_id) BEGIN SELECT RAISE(ABORT,'RELEASE_DATASET_HANDOFF_HELD'); END;
PRAGMA user_version=10;`;
//#endregion
//#region src/release-retirement-domain.ts
const hash$1 = (v) => createHash("sha256").update(typeof v === "string" ? v : canonical(v)).digest("hex");
const fail$1 = (code, status = 409) => {
	throw new RunnerError(code, status);
};
const kinds = [
	"REVOKE_PREPARATION",
	"STOP",
	"CONTAINER_REMOVE",
	"NETWORK_REMOVE"
];
/** The same private SQLite writer releases capacity and records absence atomically. */
function createReleaseRetirementDomain(db, runnerId, services) {
	const get = (sql, ...p) => db.prepare(sql).get(...p);
	const all = (sql, ...p) => db.prepare(sql).all(...p);
	const exec = (sql, ...p) => db.prepare(sql).run(...p);
	const tx = (body) => {
		db.exec("BEGIN IMMEDIATE");
		try {
			const v = body();
			db.exec("COMMIT");
			return v;
		} catch (e) {
			db.exec("ROLLBACK");
			throw e;
		}
	};
	const version = Number(Object.values(db.prepare("PRAGMA user_version").get())[0]);
	if (version === 9) tx(() => {
		db.exec(releaseRetirementMigration);
		exec("INSERT INTO runner_schema_history VALUES(10,?,?)", hash$1(releaseRetirementMigration), (/* @__PURE__ */ new Date()).toISOString());
		if (db.prepare("PRAGMA foreign_key_check").all().length) fail$1("RUNNER_MIGRATION_FOREIGN_KEYS");
	});
	else if (![
		10,
		11,
		12
	].includes(version)) fail$1("RUNNER_STORE_IDENTITY_MISMATCH");
	if (get("SELECT sha256 FROM runner_schema_history WHERE version=10")?.sha256 !== hash$1(releaseRetirementMigration) || get("SELECT version FROM runner_identity")?.version !== (version === 9 ? 10 : version)) fail$1("RUNNER_MIGRATION_DRIFT");
	if (Number(Object.values(db.prepare("PRAGMA foreign_keys").get())[0]) !== 1) fail$1("RUNNER_MIGRATION_FOREIGN_KEYS");
	const row = (i) => {
		const r = get("SELECT * FROM release_retirements WHERE release_id=? AND controller_id=?", i.releaseId, i.controllerId) ?? fail$1("RELEASE_RETIREMENT_NOT_FOUND", 404);
		if (r.request_hash !== i.requestHash) fail$1("RELEASE_RETIREMENT_IDENTITY_CHANGED");
		return r;
	};
	const action = (id, kind) => get("SELECT * FROM release_retirement_actions WHERE release_id=? AND kind=?", id, kind);
	const actionView = (a) => releaseRetirementAction.parse({
		request: JSON.parse(String(a.request_json)),
		requestHash: a.request_hash,
		state: a.state,
		observation: a.observation_json ? JSON.parse(String(a.observation_json)) : null,
		createdAt: a.created_at,
		observedAt: a.observed_at
	});
	function view(r) {
		const original = JSON.parse(String(r.original_json));
		const reservation = services.acceptanceServiceGet({
			controllerId: String(r.controller_id),
			reservationId: String(r.reservation_id),
			requestHash: original.profile.requestHash
		});
		const actions = all("SELECT * FROM release_retirement_actions WHERE release_id=? ORDER BY created_at,kind", r.release_id).map(actionView);
		return {
			sequence: Number(r.sequence),
			controllerId: String(r.controller_id),
			request: releaseRetirementRequest.parse(JSON.parse(String(r.request_json))),
			requestHash: String(r.request_hash),
			original,
			reservation,
			actions,
			revoked: actions.some((a) => a.request.kind === "REVOKE_PREPARATION" && a.state === "OBSERVED"),
			containerCleared: actions.some((a) => a.request.kind === "CONTAINER_REMOVE" && a.state === "OBSERVED"),
			networkCleared: actions.some((a) => a.request.kind === "NETWORK_REMOVE" && a.state === "OBSERVED"),
			createdAt: String(r.created_at)
		};
	}
	function eligible(i, kind) {
		const r = row(i), index = kinds.indexOf(kind);
		if (index > 0 && action(i.releaseId, kinds[index - 1])?.state !== "OBSERVED") fail$1("RELEASE_RETIREMENT_PREDECESSOR_UNKNOWN");
		return r;
	}
	return {
		releaseRetirementEnroll(i) {
			return tx(() => {
				const p = i.request.promotion, q = p.preparation, proof = p.preparedProof, g = i.request.gates;
				if (q.runnerId !== runnerId || i.requestHash !== hash$1(i.request) || i.request.promotionRequestHash !== hash$1(p) || p.proofHash !== hash$1(proof)) fail$1("RELEASE_RETIREMENT_IDENTITY_CHANGED");
				const claim = proof.service.claim;
				if (claim.schemaVersion !== "devmesh.acceptance-service-claim.v1") throw new RunnerError("RELEASE_RETIREMENT_ORIGINAL_UNVERIFIED", 409);
				const old = get("SELECT * FROM release_retirements WHERE release_id=?", q.releaseId);
				if (old) {
					if (old.controller_id !== i.controllerId || old.request_hash !== i.requestHash || old.request_json !== canonical(i.request)) fail$1("RELEASE_RETIREMENT_IDENTITY_CHANGED");
					return {
						dispatch: false,
						journal: view(old)
					};
				}
				if (get("SELECT 1 FROM acceptance_service_aborts WHERE operation_id=?", q.operationId)) fail$1("ACCEPTANCE_ABORT_REQUESTED");
				if (g.targetGate.state !== "CLOSED" || g.targetGate.datasetId !== q.target.datasetId || g.targetGate.datasetOperationId !== q.operationId || g.targetGate.datasetRequestHash !== hash$1(q) || g.sourceGate?.state === "OPEN" || q.source === null !== (g.sourceGate === null) || q.expectedAcceptedReleaseId === null !== (g.previousRoute === null) || g.previousRoute && g.previousRoute.releaseId !== q.expectedAcceptedReleaseId) fail$1("RELEASE_RETIREMENT_GATES_CHANGED");
				if (q.source && (!g.sourceGate || g.sourceGate.datasetId !== q.source.datasetId || g.sourceGate.datasetOperationId !== q.source.datasetOperationId || g.sourceGate.closeOperationId !== q.operationId || g.sourceGate.closeRequestHash !== proof.sourceFence?.closeRequestHash)) fail$1("RELEASE_RETIREMENT_GATES_CHANGED");
				const b = {
					controllerId: i.controllerId,
					reservationId: proof.service.reservationId,
					requestHash: claim.serviceRequestHash
				}, r = services.acceptanceServiceGet(b), j = services.acceptanceServiceJournal(b), saved = get("SELECT * FROM acceptance_service_proofs WHERE reservation_id=?", b.reservationId);
				if (!j || !j.networkId || !j.containerId || r.state !== "ACTIVE" || r.releasedAt !== null || r.custodyState !== "RELEASE_HELD" || r.claimHash !== proof.service.claimHash || canonical(r.claim) !== canonical(proof.service.claim) || canonical(r.request.preparation) !== canonical(q) || r.request.acceptanceRequestHash !== hash$1(q) || j.profileHash !== proof.service.profileHash || j.profile.accessMode !== "READ_ONLY" || j.containerId !== proof.service.claim.instanceId || r.instanceId !== j.containerId || saved?.proof_hash !== p.proofHash || saved.proof_json !== canonical(proof) || !kinds.slice(1).every((_, n) => j.actions.some((a) => a.request.kind === [
					"NETWORK_CREATE",
					"CREATE",
					"START"
				][n] && a.state === "OBSERVED"))) fail$1("RELEASE_RETIREMENT_ORIGINAL_UNVERIFIED");
				exec("INSERT INTO release_retirements(release_id,controller_id,preparation_operation_id,reservation_id,dataset_id,request_hash,request_json,original_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)", q.releaseId, i.controllerId, q.operationId, r.reservationId, q.target.datasetId, i.requestHash, canonical(i.request), canonical(j), (/* @__PURE__ */ new Date()).toISOString());
				return {
					dispatch: true,
					journal: view(row({
						controllerId: i.controllerId,
						releaseId: q.releaseId,
						requestHash: i.requestHash
					}))
				};
			});
		},
		releaseRetirementGet(i) {
			return view(row(i));
		},
		releaseRetirementPage(i) {
			const rows = all("SELECT * FROM release_retirements r WHERE controller_id=? AND sequence>? AND NOT EXISTS(SELECT 1 FROM release_retirement_actions a WHERE a.release_id=r.release_id AND kind='NETWORK_REMOVE' AND state='OBSERVED') ORDER BY sequence LIMIT ?", i.controllerId, i.afterSequence ?? 0, (i.limit ?? 20) + 1), page = rows.slice(0, i.limit ?? 20);
			return {
				items: page.map(view),
				nextSequence: rows.length > page.length ? Number(page.at(-1).sequence) : null
			};
		},
		releaseRetirementActionBegin(i) {
			return tx(() => {
				const r = row(i), old = action(i.releaseId, i.kind);
				if (old) return {
					dispatch: false,
					action: actionView(old)
				};
				eligible(i, i.kind);
				const v = view(r), j = v.original, request = releaseRetirementActionRequest.parse({
					schemaVersion: "devmesh.release-retirement-action.v1",
					operationId: "op_" + hash$1("release-retirement:" + i.releaseId + ":" + i.kind).slice(0, 32),
					releaseId: i.releaseId,
					promotionRequestHash: v.request.promotionRequestHash,
					retirementRequestHash: i.requestHash,
					reservationId: v.reservation.reservationId,
					serviceRequestHash: j.profile.requestHash,
					profileHash: j.profileHash,
					networkId: j.networkId,
					containerId: j.containerId,
					kind: i.kind
				});
				exec("INSERT INTO release_retirement_actions VALUES(?,?,?,?,'SENT',NULL,?,NULL)", i.releaseId, i.kind, hash$1(request), canonical(request), (/* @__PURE__ */ new Date()).toISOString());
				return {
					dispatch: true,
					action: actionView(action(i.releaseId, i.kind))
				};
			});
		},
		releaseRetirementActionAuthorized(i) {
			row(i);
			const a = action(i.releaseId, i.kind);
			try {
				eligible(i, i.kind);
				return { allowed: a?.state === "SENT" && a.request_hash === i.actionRequestHash };
			} catch (e) {
				if (e instanceof RunnerError) return { allowed: false };
				throw e;
			}
		},
		releaseRetirementActionObserve(i) {
			return tx(() => {
				const r = eligible(i, i.kind), old = action(i.releaseId, i.kind) ?? fail$1("RELEASE_RETIREMENT_ACTION_NOT_FOUND", 404), o = i.observation, v = view(r), j = v.original;
				if (old.request_hash !== i.actionRequestHash || o.kind !== i.kind) fail$1("RELEASE_RETIREMENT_IDENTITY_CHANGED");
				if (old.state === "OBSERVED") {
					if (old.observation_json !== canonical(o)) fail$1("RELEASE_RETIREMENT_ACTION_IMMUTABLE");
					return v;
				}
				if (Date.parse(o.checkedAt) < Date.parse(String(old.created_at)) || Date.parse(o.checkedAt) > Date.now()) fail$1("RELEASE_RETIREMENT_OBSERVATION_STALE");
				if (o.kind === "REVOKE_PREPARATION") {
					const p = o.proof, q = v.request.promotion.preparation;
					if (p.promotionRequestHash !== v.request.promotionRequestHash || p.preparationOperationId !== q.operationId || p.releaseId !== i.releaseId || p.runnerId !== runnerId || p.controllerId !== i.controllerId) fail$1("RELEASE_RETIREMENT_REVOCATION_CHANGED");
				} else if (o.objectId !== (o.kind === "NETWORK_REMOVE" ? j.networkId : j.containerId)) fail$1("RELEASE_RETIREMENT_IDENTITY_CHANGED");
				const now = (/* @__PURE__ */ new Date()).toISOString();
				exec("UPDATE release_retirement_actions SET state='OBSERVED',observation_json=?,observed_at=? WHERE release_id=? AND kind=?", canonical(o), now, i.releaseId, i.kind);
				if (i.kind === "CONTAINER_REMOVE") {
					exec("UPDATE acceptance_services SET state='REMOVED',revision=revision+1,updated_at=?,released_at=? WHERE reservation_id=?", now, now, v.reservation.reservationId);
					const current = services.acceptanceServiceGet({
						controllerId: i.controllerId,
						reservationId: v.reservation.reservationId,
						requestHash: j.profile.requestHash
					});
					exec("INSERT INTO acceptance_service_events VALUES(?,?,?,?)", current.reservationId, current.revision, canonical(current), now);
				}
				return view(r);
			});
		}
	};
}
//#endregion
//#region src/release-service-migration.ts
const releaseServiceMigration = `
ALTER TABLE runner_identity RENAME TO runner_identity_v10;
CREATE TABLE runner_identity(singleton INTEGER PRIMARY KEY CHECK(singleton=1),runner_id TEXT NOT NULL,version INTEGER NOT NULL CHECK(version=11)) STRICT;
INSERT INTO runner_identity SELECT singleton,runner_id,11 FROM runner_identity_v10;
DROP TABLE runner_identity_v10;
CREATE TABLE release_service_handoffs(sequence INTEGER PRIMARY KEY,release_id TEXT NOT NULL UNIQUE REFERENCES release_retirements(release_id),controller_id TEXT NOT NULL,request_hash TEXT NOT NULL UNIQUE,request_json TEXT NOT NULL CHECK(json_valid(request_json)),limits_json TEXT NOT NULL CHECK(json_valid(limits_json)),source_release_id TEXT REFERENCES release_service_handoffs(release_id),created_at TEXT NOT NULL) STRICT;
CREATE UNIQUE INDEX one_release_service_successor ON release_service_handoffs(source_release_id) WHERE source_release_id IS NOT NULL;
CREATE TABLE release_service_reservations(release_id TEXT PRIMARY KEY REFERENCES release_service_handoffs(release_id),reservation_id TEXT NOT NULL UNIQUE,controller_id TEXT NOT NULL,dataset_id TEXT NOT NULL,request_hash TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('RESERVED','DISPATCHED','ACTIVE','UNKNOWN','EXITED','REMOVED')),revision INTEGER NOT NULL CHECK(revision>=0),instance_id TEXT,endpoint_json TEXT CHECK(endpoint_json IS NULL OR json_valid(endpoint_json)),fact_json TEXT CHECK(fact_json IS NULL OR json_valid(fact_json)),claim_json TEXT CHECK(claim_json IS NULL OR json_valid(claim_json)),claim_hash TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,released_at TEXT,CHECK((state IN ('EXITED','REMOVED'))=(released_at IS NOT NULL)),CHECK(state<>'RESERVED' OR (instance_id IS NULL AND fact_json IS NULL)),CHECK(state NOT IN ('EXITED','REMOVED') OR instance_id IS NOT NULL),CHECK((claim_json IS NULL)=(claim_hash IS NULL))) STRICT;
CREATE UNIQUE INDEX exclusive_release_service_dataset ON release_service_reservations(dataset_id) WHERE released_at IS NULL;
CREATE TABLE release_service_profiles(release_id TEXT PRIMARY KEY REFERENCES release_service_reservations(release_id),profile_hash TEXT NOT NULL,profile_json TEXT NOT NULL CHECK(json_valid(profile_json)),network_id TEXT,container_id TEXT,created_at TEXT NOT NULL) STRICT;
CREATE TABLE release_service_events(release_id TEXT NOT NULL REFERENCES release_service_reservations(release_id),revision INTEGER NOT NULL,snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),created_at TEXT NOT NULL,PRIMARY KEY(release_id,revision)) STRICT;
CREATE TABLE release_service_actions(release_id TEXT NOT NULL REFERENCES release_service_handoffs(release_id),kind TEXT NOT NULL CHECK(kind IN ('ARM_FENCES','SOURCE_STOP','SOURCE_CONTAINER_REMOVE','SOURCE_NETWORK_REMOVE','GUARD_ENFORCE','NETWORK_CREATE','CREATE','START','ROUTE_BIND')),request_hash TEXT NOT NULL,request_json TEXT NOT NULL CHECK(json_valid(request_json)),state TEXT NOT NULL CHECK(state IN ('SENT','OBSERVED')),observation_json TEXT CHECK(observation_json IS NULL OR json_valid(observation_json)),created_at TEXT NOT NULL,observed_at TEXT,PRIMARY KEY(release_id,kind),CHECK((state='OBSERVED')=(observation_json IS NOT NULL)),CHECK((state='OBSERVED')=(observed_at IS NOT NULL))) STRICT;
CREATE TABLE release_service_proofs(release_id TEXT PRIMARY KEY REFERENCES release_service_handoffs(release_id),proof_hash TEXT NOT NULL,proof_json TEXT NOT NULL CHECK(json_valid(proof_json)),created_at TEXT NOT NULL) STRICT;
CREATE TRIGGER immutable_release_service_handoff BEFORE UPDATE ON release_service_handoffs BEGIN SELECT RAISE(ABORT,'RELEASE_SERVICE_HANDOFF_IMMUTABLE'); END;
CREATE TRIGGER preserve_release_service_handoff BEFORE DELETE ON release_service_handoffs BEGIN SELECT RAISE(ABORT,'RELEASE_SERVICE_HANDOFF_IMMUTABLE'); END;
CREATE TRIGGER immutable_release_service BEFORE UPDATE ON release_service_reservations WHEN OLD.released_at IS NOT NULL OR NEW.release_id<>OLD.release_id OR NEW.reservation_id<>OLD.reservation_id OR NEW.controller_id<>OLD.controller_id OR NEW.dataset_id<>OLD.dataset_id OR NEW.request_hash<>OLD.request_hash OR NEW.created_at<>OLD.created_at OR (OLD.instance_id IS NOT NULL AND NEW.instance_id IS NOT OLD.instance_id) OR (OLD.endpoint_json IS NOT NULL AND NEW.endpoint_json IS NOT OLD.endpoint_json) OR (OLD.claim_json IS NOT NULL AND (NEW.claim_json IS NOT OLD.claim_json OR NEW.claim_hash IS NOT OLD.claim_hash)) BEGIN SELECT RAISE(ABORT,'RELEASE_SERVICE_IMMUTABLE'); END;
CREATE TRIGGER preserve_release_service BEFORE DELETE ON release_service_reservations BEGIN SELECT RAISE(ABORT,'RELEASE_SERVICE_IMMUTABLE'); END;
CREATE TRIGGER immutable_release_service_profile BEFORE UPDATE ON release_service_profiles WHEN NEW.release_id<>OLD.release_id OR NEW.profile_hash<>OLD.profile_hash OR NEW.profile_json<>OLD.profile_json OR NEW.created_at<>OLD.created_at OR (OLD.network_id IS NOT NULL AND NEW.network_id IS NOT OLD.network_id) OR (OLD.container_id IS NOT NULL AND NEW.container_id IS NOT OLD.container_id) BEGIN SELECT RAISE(ABORT,'RELEASE_SERVICE_PROFILE_IMMUTABLE'); END;
CREATE TRIGGER preserve_release_service_profile BEFORE DELETE ON release_service_profiles BEGIN SELECT RAISE(ABORT,'RELEASE_SERVICE_PROFILE_IMMUTABLE'); END;
CREATE TRIGGER immutable_release_service_event BEFORE UPDATE ON release_service_events BEGIN SELECT RAISE(ABORT,'RELEASE_SERVICE_EVENT_IMMUTABLE'); END;
CREATE TRIGGER preserve_release_service_event BEFORE DELETE ON release_service_events BEGIN SELECT RAISE(ABORT,'RELEASE_SERVICE_EVENT_IMMUTABLE'); END;
CREATE TRIGGER immutable_release_service_action BEFORE UPDATE ON release_service_actions WHEN OLD.state='OBSERVED' OR NEW.release_id<>OLD.release_id OR NEW.kind<>OLD.kind OR NEW.request_hash<>OLD.request_hash OR NEW.request_json<>OLD.request_json OR NEW.created_at<>OLD.created_at BEGIN SELECT RAISE(ABORT,'RELEASE_SERVICE_ACTION_IMMUTABLE'); END;
CREATE TRIGGER preserve_release_service_action BEFORE DELETE ON release_service_actions BEGIN SELECT RAISE(ABORT,'RELEASE_SERVICE_ACTION_IMMUTABLE'); END;
CREATE TRIGGER immutable_release_service_proof BEFORE UPDATE ON release_service_proofs BEGIN SELECT RAISE(ABORT,'RELEASE_SERVICE_PROOF_IMMUTABLE'); END;
CREATE TRIGGER preserve_release_service_proof BEFORE DELETE ON release_service_proofs BEGIN SELECT RAISE(ABORT,'RELEASE_SERVICE_PROOF_IMMUTABLE'); END;
CREATE TRIGGER retired_source_service BEFORE UPDATE ON release_service_reservations WHEN EXISTS(SELECT 1 FROM release_service_handoffs WHERE source_release_id=OLD.release_id) AND NOT (
 NEW.state='REMOVED' AND NEW.released_at IS NOT NULL AND EXISTS(SELECT 1 FROM release_service_handoffs h JOIN release_service_actions a ON h.release_id=a.release_id WHERE h.source_release_id=OLD.release_id AND a.kind='SOURCE_CONTAINER_REMOVE' AND a.state='OBSERVED' AND json_extract(a.observation_json,'$.objectId')=OLD.instance_id AND json_extract(a.observation_json,'$.absenceVerified')=1)
) BEGIN SELECT RAISE(ABORT,'RELEASE_SOURCE_RETIRING'); END;
PRAGMA user_version=11;`;
//#endregion
//#region src/release-continuation-migration.ts
const releaseContinuationMigration = `
ALTER TABLE runner_identity RENAME TO runner_identity_v11;
CREATE TABLE runner_identity(singleton INTEGER PRIMARY KEY CHECK(singleton=1),runner_id TEXT NOT NULL,version INTEGER NOT NULL CHECK(version=12)) STRICT;
INSERT INTO runner_identity SELECT singleton,runner_id,12 FROM runner_identity_v11;
DROP TABLE runner_identity_v11;
CREATE TABLE release_profile_preparations(release_id TEXT PRIMARY KEY REFERENCES release_service_profiles(release_id),mode TEXT NOT NULL CHECK(mode IN ('EXECUTE_ONCE','INSPECT_ONLY'))) STRICT;
INSERT INTO release_profile_preparations SELECT release_id,'INSPECT_ONLY' FROM release_service_profiles;
CREATE TRIGGER immutable_release_profile_preparation BEFORE UPDATE ON release_profile_preparations BEGIN SELECT RAISE(ABORT,'RELEASE_PROFILE_PREPARATION_IMMUTABLE'); END;
CREATE TRIGGER retained_release_profile_preparation BEFORE DELETE ON release_profile_preparations BEGIN SELECT RAISE(ABORT,'RELEASE_PROFILE_PREPARATION_IMMUTABLE'); END;
DROP TRIGGER retired_source_service;
CREATE TABLE release_service_actions_v12(release_id TEXT NOT NULL REFERENCES release_service_handoffs(release_id),kind TEXT NOT NULL CHECK(kind IN ('ARM_FENCES','SOURCE_STOP','SOURCE_CONTAINER_REMOVE','SOURCE_NETWORK_REMOVE','PROFILE_PREPARE','GUARD_ENFORCE','NETWORK_CREATE','CREATE','START','ROUTE_BIND')),request_hash TEXT NOT NULL,request_json TEXT NOT NULL CHECK(json_valid(request_json)),state TEXT NOT NULL CHECK(state IN ('SENT','OBSERVED')),observation_json TEXT CHECK(observation_json IS NULL OR json_valid(observation_json)),created_at TEXT NOT NULL,observed_at TEXT,PRIMARY KEY(release_id,kind),CHECK((state='OBSERVED')=(observation_json IS NOT NULL)),CHECK((state='OBSERVED')=(observed_at IS NOT NULL))) STRICT;
INSERT INTO release_service_actions_v12 SELECT * FROM release_service_actions;
DROP TABLE release_service_actions;
ALTER TABLE release_service_actions_v12 RENAME TO release_service_actions;
CREATE TRIGGER immutable_release_service_action BEFORE UPDATE ON release_service_actions WHEN OLD.state='OBSERVED' OR NEW.release_id<>OLD.release_id OR NEW.kind<>OLD.kind OR NEW.request_hash<>OLD.request_hash OR NEW.request_json<>OLD.request_json OR NEW.created_at<>OLD.created_at BEGIN SELECT RAISE(ABORT,'RELEASE_SERVICE_ACTION_IMMUTABLE'); END;
CREATE TRIGGER preserve_release_service_action BEFORE DELETE ON release_service_actions BEGIN SELECT RAISE(ABORT,'RELEASE_SERVICE_ACTION_IMMUTABLE'); END;
CREATE TRIGGER retired_source_service BEFORE UPDATE ON release_service_reservations WHEN EXISTS(SELECT 1 FROM release_service_handoffs WHERE source_release_id=OLD.release_id) AND NOT (
 NEW.state='REMOVED' AND NEW.released_at IS NOT NULL AND EXISTS(SELECT 1 FROM release_service_handoffs h JOIN release_service_actions a ON h.release_id=a.release_id WHERE h.source_release_id=OLD.release_id AND a.kind='SOURCE_CONTAINER_REMOVE' AND a.state='OBSERVED' AND json_extract(a.observation_json,'$.objectId')=OLD.instance_id AND json_extract(a.observation_json,'$.absenceVerified')=1)
) BEGIN SELECT RAISE(ABORT,'RELEASE_SOURCE_RETIRING'); END;
PRAGMA user_version=12;`;
//#endregion
//#region src/release-service-domain.ts
const hash = (v) => createHash("sha256").update(typeof v === "string" ? v : canonical(v)).digest("hex");
const fail = (code, status = 409) => {
	throw new RunnerError(code, status);
};
const now = () => (/* @__PURE__ */ new Date()).toISOString();
/** All state, source capacity retirement and observations share the Runner writer. */
function createReleaseServiceDomain(db, runnerId, retirements, fits) {
	const get = (sql, ...p) => db.prepare(sql).get(...p), all = (sql, ...p) => db.prepare(sql).all(...p), exec = (sql, ...p) => db.prepare(sql).run(...p);
	const tx = (body) => {
		db.exec("BEGIN IMMEDIATE");
		try {
			const v = body();
			db.exec("COMMIT");
			return v;
		} catch (e) {
			db.exec("ROLLBACK");
			throw e;
		}
	};
	const version = Number(Object.values(db.prepare("PRAGMA user_version").get())[0]);
	if (version === 10) tx(() => {
		db.exec(releaseServiceMigration);
		exec("INSERT INTO runner_schema_history VALUES(11,?,?)", hash(releaseServiceMigration), now());
		if (db.prepare("PRAGMA foreign_key_check").all().length) fail("RUNNER_MIGRATION_FOREIGN_KEYS");
	});
	else if (![11, 12].includes(version)) fail("RUNNER_STORE_IDENTITY_MISMATCH");
	if (Number(Object.values(db.prepare("PRAGMA user_version").get())[0]) === 11) tx(() => {
		db.exec(releaseContinuationMigration);
		exec("INSERT INTO runner_schema_history VALUES(12,?,?)", hash(releaseContinuationMigration), now());
		if (db.prepare("PRAGMA foreign_key_check").all().length) fail("RUNNER_MIGRATION_FOREIGN_KEYS");
	});
	if (get("SELECT sha256 FROM runner_schema_history WHERE version=11")?.sha256 !== hash(releaseServiceMigration) || get("SELECT sha256 FROM runner_schema_history WHERE version=12")?.sha256 !== hash(releaseContinuationMigration) || get("SELECT version FROM runner_identity")?.version !== 12) fail("RUNNER_MIGRATION_DRIFT");
	if (Number(Object.values(db.prepare("PRAGMA foreign_keys").get())[0]) !== 1) fail("RUNNER_MIGRATION_FOREIGN_KEYS");
	const row = (i) => {
		const r = get("SELECT * FROM release_service_handoffs WHERE release_id=? AND controller_id=?", i.releaseId, i.controllerId) ?? fail("RELEASE_SERVICE_NOT_FOUND", 404);
		if (r.request_hash !== i.requestHash) fail("RELEASE_SERVICE_IDENTITY_CHANGED");
		return r;
	};
	const reservation = (id) => get("SELECT * FROM release_service_reservations WHERE release_id=?", id);
	const profile = (id) => get("SELECT * FROM release_service_profiles WHERE release_id=?", id);
	const action = (id, kind) => get("SELECT * FROM release_service_actions WHERE release_id=? AND kind=?", id, kind);
	const seen = (id, kind) => action(id, kind)?.state === "OBSERVED";
	const actionView = (a) => releaseServiceAction.parse({
		request: JSON.parse(String(a.request_json)),
		requestHash: a.request_hash,
		state: a.state,
		observation: a.observation_json ? JSON.parse(String(a.observation_json)) : null,
		createdAt: a.created_at,
		observedAt: a.observed_at
	});
	function rview(r) {
		const h = get("SELECT limits_json FROM release_service_handoffs WHERE release_id=?", r.release_id);
		return releaseServiceReservation.parse({
			purpose: "RELEASE",
			releaseId: r.release_id,
			reservationId: r.reservation_id,
			controllerId: r.controller_id,
			requestHash: r.request_hash,
			resourceLimits: JSON.parse(String(h.limits_json)),
			state: r.state,
			revision: r.revision,
			instanceId: r.instance_id,
			endpoint: r.endpoint_json ? JSON.parse(String(r.endpoint_json)) : null,
			fact: r.fact_json ? JSON.parse(String(r.fact_json)) : null,
			claim: r.claim_json ? JSON.parse(String(r.claim_json)) : null,
			claimHash: r.claim_hash,
			createdAt: r.created_at,
			updatedAt: r.updated_at,
			releasedAt: r.released_at
		});
	}
	function original(id) {
		const h = get("SELECT * FROM release_service_handoffs WHERE release_id=?", id) ?? fail("RELEASE_SOURCE_UNAVAILABLE"), r = reservation(id), p = profile(id), proof = get("SELECT * FROM release_service_proofs WHERE release_id=?", id);
		if (!r || !p || !p.network_id || !p.container_id || !r.claim_hash || !proof) throw new RunnerError("RELEASE_SOURCE_UNAVAILABLE", 409);
		return {
			request: releaseServiceRequest.parse(JSON.parse(String(h.request_json))),
			requestHash: String(h.request_hash),
			reservation: rview(r),
			profile: releaseServiceProfile.parse(JSON.parse(String(p.profile_json))),
			profileHash: String(p.profile_hash),
			networkId: String(p.network_id),
			containerId: String(p.container_id),
			proof: releasePublicationProof.parse(JSON.parse(String(proof.proof_json)))
		};
	}
	function view(h) {
		const q = releaseServiceRequest.parse(JSON.parse(String(h.request_json))), id = String(h.release_id), p = profile(id), r = reservation(id), proof = get("SELECT * FROM release_service_proofs WHERE release_id=?", id), retirement = retirements.releaseRetirementGet({
			controllerId: String(h.controller_id),
			releaseId: id,
			requestHash: q.retirementRequestHash
		});
		return {
			sequence: Number(h.sequence),
			controllerId: String(h.controller_id),
			request: q,
			requestHash: String(h.request_hash),
			retirement,
			source: h.source_release_id ? original(String(h.source_release_id)) : null,
			profilePreparation: p ? String(get("SELECT mode FROM release_profile_preparations WHERE release_id=?", id)?.mode) : null,
			reservation: r ? rview(r) : null,
			profile: p ? releaseServiceProfile.parse(JSON.parse(String(p.profile_json))) : null,
			profileHash: p ? String(p.profile_hash) : null,
			networkId: p?.network_id ?? null,
			containerId: p?.container_id ?? null,
			actions: all("SELECT * FROM release_service_actions WHERE release_id=? ORDER BY created_at,kind", id).map(actionView),
			proof: proof ? releasePublicationProof.parse(JSON.parse(String(proof.proof_json))) : null,
			proofHash: proof ? String(proof.proof_hash) : null,
			createdAt: String(h.created_at)
		};
	}
	const event = (r) => exec("INSERT INTO release_service_events VALUES(?,?,?,?)", r.release_id, Number(r.revision), canonical(rview(r)), r.updated_at);
	const changed = (id) => {
		const r = reservation(id);
		event(r);
		return rview(r);
	};
	function fences(id) {
		const a = action(id, "ARM_FENCES");
		if (a?.state !== "OBSERVED") fail("RELEASE_SERVICE_PREDECESSOR_UNKNOWN");
		const o = actionView(a).observation;
		if (o?.kind !== "ARM_FENCES") throw new RunnerError("RELEASE_SERVICE_FENCES_UNVERIFIED", 409);
		return o.proof;
	}
	function readySource(h) {
		fences(String(h.release_id));
		if (h.source_release_id !== null && !seen(String(h.release_id), "SOURCE_NETWORK_REMOVE")) fail("RELEASE_SERVICE_SOURCE_NOT_CLEARED");
	}
	function live(h) {
		const r = reservation(String(h.release_id)) ?? fail("RELEASE_SERVICE_NOT_RESERVED");
		if (r.released_at !== null || get("SELECT 1 FROM release_service_handoffs WHERE source_release_id=?", h.release_id)) fail("RELEASE_SERVICE_EXECUTION_CLOSED");
		return r;
	}
	function healthy(h) {
		const v = rview(live(h)), age = v.fact ? Date.now() - Date.parse(v.fact.checkedAt) : -1;
		if (v.state !== "ACTIVE" || v.fact?.state !== "HEALTHY" || !v.endpoint || !v.instanceId || age < 0 || age > 3e4) fail("RELEASE_SERVICE_HEALTH_UNAVAILABLE");
		return v;
	}
	function eligible(i, kind) {
		const h = row(i), id = i.releaseId;
		if (kind === "ARM_FENCES") return h;
		fences(id);
		if (kind.startsWith("SOURCE_")) {
			if (h.source_release_id === null) fail("RELEASE_SERVICE_SOURCE_NOT_APPLICABLE");
			original(String(h.source_release_id));
			if (kind === "SOURCE_CONTAINER_REMOVE" && !seen(id, "SOURCE_STOP") || kind === "SOURCE_NETWORK_REMOVE" && !seen(id, "SOURCE_CONTAINER_REMOVE")) fail("RELEASE_SERVICE_PREDECESSOR_UNKNOWN");
			return h;
		}
		readySource(h);
		live(h);
		if (!profile(id)) fail("RELEASE_SERVICE_PROFILE_UNAVAILABLE");
		const previous = {
			GUARD_ENFORCE: "PROFILE_PREPARE",
			NETWORK_CREATE: "GUARD_ENFORCE",
			CREATE: "NETWORK_CREATE",
			START: "CREATE",
			ROUTE_BIND: "START"
		};
		if (previous[kind] && !seen(id, previous[kind])) fail("RELEASE_SERVICE_PREDECESSOR_UNKNOWN");
		if (kind === "ROUTE_BIND" && !healthy(h).claimHash) fail("RELEASE_SERVICE_CLAIM_UNAVAILABLE");
		return h;
	}
	const follows = (n, p) => n.fenceId === p.fenceId && n.generation > p.generation && n.previousHoldHash === p.proofHash;
	return {
		releaseServiceEnroll(i) {
			return tx(() => {
				const request = i.request, q = request.promotion.preparation;
				if (q.runnerId !== runnerId || i.requestHash !== hash(request)) fail("RELEASE_SERVICE_IDENTITY_CHANGED");
				const old = get("SELECT * FROM release_service_handoffs WHERE release_id=?", q.releaseId);
				if (old) {
					if (old.controller_id !== i.controllerId || old.request_hash !== i.requestHash || old.request_json !== canonical(request) || old.limits_json !== canonical(i.resourceLimits)) fail("RELEASE_SERVICE_IDENTITY_CHANGED");
					return {
						dispatch: false,
						journal: view(old)
					};
				}
				const retirement = retirements.releaseRetirementGet({
					controllerId: i.controllerId,
					releaseId: q.releaseId,
					requestHash: request.retirementRequestHash
				});
				if (q.source && get("SELECT 1 FROM release_service_handoffs WHERE source_release_id=?", q.source.releaseId)) fail("RELEASE_SERVICE_SOURCE_ALREADY_RETIRING");
				if (!retirement.networkCleared || !retirement.containerCleared || !retirement.revoked || canonical(retirement.request.promotion) !== canonical(request.promotion) || retirement.request.promotionRequestHash !== request.promotionRequestHash || canonical(retirement.request.gates) !== canonical(request.gates)) fail("RELEASE_SERVICE_RETIREMENT_UNVERIFIED");
				if (q.source) {
					const s = original(q.source.releaseId), oldq = s.request.promotion.preparation;
					if (s.reservation.controllerId !== i.controllerId || oldq.projectId !== q.projectId || oldq.target.datasetId !== q.source.datasetId || oldq.operationId !== q.source.datasetOperationId || oldq.target.storageKey !== q.source.storageKey || s.proof.routeHash !== request.gates.previousRoute?.routeHash || s.proof.route.generation !== request.gates.previousRoute?.generation || s.proof.releaseId !== q.source.releaseId || canonical(s.proof.service.claim) !== canonical(s.reservation.claim)) fail("RELEASE_SERVICE_SOURCE_CHANGED");
				}
				exec("INSERT INTO release_service_handoffs(release_id,controller_id,request_hash,request_json,limits_json,source_release_id,created_at) VALUES(?,?,?,?,?,?,?)", q.releaseId, i.controllerId, i.requestHash, canonical(request), canonical(i.resourceLimits), q.source?.releaseId ?? null, now());
				return {
					dispatch: true,
					journal: view(row({
						controllerId: i.controllerId,
						releaseId: q.releaseId,
						requestHash: i.requestHash
					}))
				};
			});
		},
		releaseServiceGet(i) {
			return view(row(i));
		},
		releaseServicePage(i) {
			const rows = all("SELECT * FROM release_service_handoffs h WHERE controller_id=? AND sequence>? AND NOT EXISTS(SELECT 1 FROM release_service_proofs p WHERE p.release_id=h.release_id) ORDER BY sequence LIMIT ?", i.controllerId, i.afterSequence ?? 0, (i.limit ?? 20) + 1), page = rows.slice(0, i.limit ?? 20);
			return {
				items: page.map(view),
				nextSequence: rows.length > page.length ? Number(page.at(-1).sequence) : null
			};
		},
		releaseServiceReserve(i) {
			return tx(() => {
				const h = row(i);
				if (reservation(i.releaseId)) return view(h);
				readySource(h);
				if (!fits(JSON.parse(String(h.limits_json)), i.capacity)) fail("RUNNER_CAPACITY_EXHAUSTED", 429);
				const q = JSON.parse(String(h.request_json)).promotion.preparation, at = now(), id = "release_service_" + randomUUID().replaceAll("-", "");
				exec("INSERT INTO release_service_reservations(release_id,reservation_id,controller_id,dataset_id,request_hash,state,revision,created_at,updated_at) VALUES(?,?,?,?,?,'RESERVED',0,?,?)", i.releaseId, id, i.controllerId, q.target.datasetId, i.requestHash, at, at);
				changed(i.releaseId);
				return view(h);
			});
		},
		releaseServiceProfilePrepare(i) {
			return tx(() => {
				const h = row(i), v = view(h), r = v.reservation ?? fail("RELEASE_SERVICE_NOT_RESERVED"), p = i.profile, old = profile(i.releaseId), names = releaseServiceNames(r.reservationId), f = fences(i.releaseId);
				if (p.reservationId !== r.reservationId || p.requestHash !== i.requestHash || p.datasetDirectory !== v.retirement.original.profile.datasetDirectory || p.datasetBytes !== v.retirement.original.profile.datasetBytes || canonical(p.resourceLimits) !== canonical(r.resourceLimits) || p.networkName !== names.networkName || p.containerName !== names.containerName || p.fenceProofHash !== f.target.proofHash || p.gateBindingHash !== releaseServiceGateBinding(v.request)) fail("RELEASE_SERVICE_PROFILE_CHANGED");
				if (old) {
					if (old.profile_json !== canonical(p)) fail("RELEASE_SERVICE_PROFILE_CHANGED");
					return v;
				}
				live(h);
				if (r.state !== "RESERVED") fail("RELEASE_SERVICE_ALREADY_DISPATCHED");
				exec("INSERT INTO release_service_profiles VALUES(?,?,?,NULL,NULL,?)", i.releaseId, hash(p), canonical(p), now());
				exec("INSERT INTO release_profile_preparations VALUES(?,'EXECUTE_ONCE')", i.releaseId);
				return view(h);
			});
		},
		releaseServiceActionBegin(i) {
			return tx(() => {
				const h = row(i), old = action(i.releaseId, i.kind);
				if (old) return {
					dispatch: false,
					action: actionView(old)
				};
				eligible(i, i.kind);
				const v = view(h), source = i.kind.startsWith("SOURCE_") ? v.source : null, r = source?.reservation ?? v.reservation;
				const request = releaseServiceActionRequest.parse({
					schemaVersion: "devmesh.release-service-action.v1",
					operationId: "op_" + hash("release-service:" + i.releaseId + ":" + i.kind).slice(0, 32),
					releaseId: i.releaseId,
					serviceRequestHash: i.requestHash,
					kind: i.kind,
					reservationId: i.kind === "ARM_FENCES" ? null : r?.reservationId ?? null,
					profileHash: i.kind === "ARM_FENCES" ? null : source?.profileHash ?? v.profileHash,
					containerId: i.kind === "ARM_FENCES" ? null : source?.containerId ?? v.containerId,
					networkId: i.kind === "ARM_FENCES" ? null : source?.networkId ?? v.networkId
				});
				exec("INSERT INTO release_service_actions VALUES(?,?,?,?,'SENT',NULL,?,NULL)", i.releaseId, i.kind, hash(request), canonical(request), now());
				if (i.kind === "GUARD_ENFORCE") {
					exec("UPDATE release_service_reservations SET state='DISPATCHED',revision=revision+1,updated_at=? WHERE release_id=?", now(), i.releaseId);
					changed(i.releaseId);
				}
				return {
					dispatch: true,
					action: actionView(action(i.releaseId, i.kind))
				};
			});
		},
		releaseServiceActionAuthorized(i) {
			row(i);
			const a = action(i.releaseId, i.kind);
			try {
				eligible(i, i.kind);
				return { allowed: a?.state === "SENT" && a.request_hash === i.actionRequestHash && (i.kind !== "PROFILE_PREPARE" || get("SELECT mode FROM release_profile_preparations WHERE release_id=?", i.releaseId)?.mode === "EXECUTE_ONCE") };
			} catch (e) {
				if (e instanceof RunnerError) return { allowed: false };
				throw e;
			}
		},
		releaseServiceActionObserve(i) {
			return tx(() => {
				const h = row(i), old = action(i.releaseId, i.kind) ?? fail("RELEASE_SERVICE_ACTION_NOT_FOUND", 404), o = i.observation;
				if (old.request_hash !== i.actionRequestHash || o.kind !== i.kind) fail("RELEASE_SERVICE_IDENTITY_CHANGED");
				if (old.state === "OBSERVED") {
					if (old.observation_json !== canonical(o)) fail("RELEASE_SERVICE_ACTION_IMMUTABLE");
					return view(h);
				}
				eligible(i, i.kind);
				if (Date.parse(o.checkedAt) < Date.parse(String(old.created_at)) || Date.parse(o.checkedAt) > Date.now()) fail("RELEASE_SERVICE_OBSERVATION_STALE");
				const v = view(h), q = v.request.promotion.preparation, a = actionView(old).request;
				if (o.kind === "ARM_FENCES") {
					const f = o.proof, p = v.request.promotion.preparedProof, revoke = v.retirement.actions.find((x) => x.observation?.kind === "REVOKE_PREPARATION")?.observation;
					if (revoke?.kind !== "REVOKE_PREPARATION" || f.releaseId !== q.releaseId || f.promotionRequestHash !== v.request.promotionRequestHash || f.retirementRequestHash !== v.request.retirementRequestHash || f.revocationProofHash !== revoke.proof.proofHash || f.target.datasetId !== q.target.datasetId || !follows(f.target, p.targetFence.physical)) fail("RELEASE_SERVICE_FENCES_CHANGED");
					if (q.source) {
						if (!f.source || !p.sourceFence || f.source.releaseId !== q.source.releaseId || f.source.datasetId !== q.source.datasetId || f.source.datasetOperationId !== q.source.datasetOperationId || !follows(f.source, p.sourceFence.physical)) fail("RELEASE_SERVICE_FENCES_CHANGED");
					} else if (f.source !== null) fail("RELEASE_SERVICE_FENCES_CHANGED");
				} else if (o.kind === "PROFILE_PREPARE") {
					if (o.profileHash !== v.profileHash) fail("RELEASE_SERVICE_PROFILE_CHANGED");
				} else if (o.kind === "GUARD_ENFORCE") {
					const g = o.proof, r = v.reservation, p = v.profile;
					if (g.releaseId !== q.releaseId || g.runnerId !== runnerId || g.controllerId !== i.controllerId || g.serviceRequestHash !== i.requestHash || g.reservationId !== r.reservationId || g.profileHash !== v.profileHash || g.datasetId !== q.target.datasetId || g.targetProofHash !== p.fenceProofHash || g.gateBindingHash !== p.gateBindingHash) fail("RELEASE_SERVICE_GUARD_CHANGED");
				} else if (o.kind === "ROUTE_BIND") {
					const r = o.route, c = v.reservation.claim;
					if (!c || r.routeId !== "release." + q.projectId || r.projectId !== q.projectId || r.releaseId !== q.releaseId || r.previousReleaseId !== q.expectedAcceptedReleaseId || r.generation !== (v.request.gates.previousRoute?.generation ?? 0) + 1 || r.datasetId !== q.target.datasetId || r.imageDigest !== q.image.imageDigest || r.instanceId !== c.instanceId || r.serviceClaimHash !== v.reservation.claimHash || canonical(r.endpoint) !== canonical(v.reservation.endpoint) || o.routeHash !== hash(r)) fail("RELEASE_SERVICE_ROUTE_CHANGED");
				} else if (o.kind.startsWith("SOURCE_")) {
					if (o.objectId !== (o.kind === "SOURCE_NETWORK_REMOVE" ? a.networkId : a.containerId) || o.kind === "SOURCE_STOP" && (!("state" in o) || !["CREATED", "EXITED"].includes(o.state))) fail("RELEASE_SERVICE_SOURCE_CHANGED");
				} else {
					const p = profile(i.releaseId);
					if (o.kind === "NETWORK_CREATE" && ("state" in o && o.state !== "CREATED" || p.network_id !== null && p.network_id !== o.objectId || o.objectId === v.retirement.original.networkId || o.objectId === v.source?.networkId) || o.kind === "CREATE" && ("state" in o && o.state !== "CREATED" || p.container_id !== null && p.container_id !== o.objectId || o.objectId === v.retirement.original.containerId || o.objectId === v.source?.containerId) || o.kind === "START" && (!("state" in o) || o.state === "CREATED" || p.container_id !== o.objectId)) fail("RELEASE_SERVICE_OBJECT_CHANGED");
					if (o.kind === "NETWORK_CREATE" || o.kind === "CREATE") exec("UPDATE release_service_profiles SET " + (o.kind === "NETWORK_CREATE" ? "network_id" : "container_id") + "=? WHERE release_id=?", o.objectId, i.releaseId);
				}
				exec("UPDATE release_service_actions SET state='OBSERVED',observation_json=?,observed_at=? WHERE release_id=? AND kind=?", canonical(o), now(), i.releaseId, i.kind);
				if (i.kind === "SOURCE_CONTAINER_REMOVE") {
					const s = v.source, r = reservation(s.request.promotion.preparation.releaseId);
					if (r.released_at === null) {
						const at = now();
						exec("UPDATE release_service_reservations SET state='REMOVED',revision=revision+1,updated_at=?,released_at=? WHERE release_id=?", at, at, r.release_id);
						changed(String(r.release_id));
					}
				}
				return view(h);
			});
		},
		releaseServiceRecord(i) {
			return tx(() => {
				const h = row(i), r = reservation(i.releaseId) ?? fail("RELEASE_SERVICE_NOT_RESERVED"), v = view(h), q = v.request.promotion.preparation, f = i.fact;
				if (f.releaseId !== q.releaseId || f.datasetId !== q.target.datasetId || f.imageDigest !== q.image.imageDigest) fail("RELEASE_SERVICE_IDENTITY_CHANGED");
				if (r.fact_json === canonical(f)) return v;
				live(h);
				if (i.expectedRevision !== r.revision) fail("RELEASE_SERVICE_REVISION_CHANGED");
				if (r.state === "RESERVED") fail("RELEASE_SERVICE_NOT_DISPATCHED");
				const p = profile(i.releaseId), at = Date.parse(f.checkedAt), previous = r.fact_json ? JSON.parse(String(r.fact_json)) : null;
				if (at > Date.now() || at < Date.parse(String(r.created_at)) || previous && at < Date.parse(previous.checkedAt)) fail("RELEASE_SERVICE_OBSERVATION_STALE");
				if (f.instanceId !== null && f.instanceId !== p.container_id || r.instance_id !== null && f.instanceId !== null && f.instanceId !== r.instance_id || r.endpoint_json !== null && f.endpoint !== null && canonical(f.endpoint) !== r.endpoint_json) fail("RELEASE_SERVICE_OBJECT_CHANGED");
				const started = action(i.releaseId, "START");
				if (f.state === "HEALTHY" && (!started || started.state !== "OBSERVED" || JSON.parse(String(started.observation_json)).state !== "RUNNING")) fail("RELEASE_SERVICE_START_UNVERIFIED");
				const state = f.state === "EXITED" ? "EXITED" : f.state === "UNKNOWN" ? "UNKNOWN" : f.state === "CREATED" ? "DISPATCHED" : "ACTIVE", n = now();
				exec("UPDATE release_service_reservations SET state=?,revision=revision+1,instance_id=coalesce(instance_id,?),endpoint_json=coalesce(endpoint_json,?),fact_json=?,updated_at=?,released_at=? WHERE release_id=?", state, f.instanceId, f.endpoint ? canonical(f.endpoint) : null, canonical(f), n, state === "EXITED" ? n : null, i.releaseId);
				changed(i.releaseId);
				return view(h);
			});
		},
		releaseServiceOwn(i) {
			return tx(() => {
				const h = row(i);
				if (reservation(i.releaseId)?.claim_hash) return view(h);
				const r = healthy(h), v = view(h), q = v.request.promotion.preparation, f = fences(i.releaseId).target;
				if (!seen(i.releaseId, "GUARD_ENFORCE") || !v.containerId || !v.networkId) fail("RELEASE_SERVICE_GUARD_UNVERIFIED");
				const claim = releaseServiceClaim.parse({
					schemaVersion: "devmesh.release-service-claim.v1",
					purpose: "RELEASE",
					releaseId: q.releaseId,
					projectId: q.projectId,
					runId: q.runId,
					candidateId: q.candidateId,
					acceptanceOperationId: v.request.promotion.acceptanceOperationId,
					preparationOperationId: q.operationId,
					promotionRequestHash: v.request.promotionRequestHash,
					preparedProofHash: v.request.promotion.proofHash,
					runnerId,
					datasetId: q.target.datasetId,
					imageDigest: q.image.imageDigest,
					reservationId: r.reservationId,
					profileHash: v.profileHash,
					serviceRequestHash: i.requestHash,
					instanceId: v.containerId,
					networkId: v.networkId,
					accessMode: "READ_WRITE",
					custodyState: "RELEASE_OWNED",
					writeAdmission: "CONTROL_GATE_FENCED",
					targetFence: Object.fromEntries([
						"fenceId",
						"generation",
						"proofHash",
						"previousHoldHash"
					].map((k) => [k, f[k]]))
				});
				exec("UPDATE release_service_reservations SET claim_json=?,claim_hash=?,revision=revision+1,updated_at=? WHERE release_id=?", canonical(claim), hash(claim), now(), i.releaseId);
				changed(i.releaseId);
				return view(h);
			});
		},
		releaseServicePrepareProof(i) {
			return tx(() => {
				const h = row(i);
				if (get("SELECT * FROM release_service_proofs WHERE release_id=?", i.releaseId)) return view(h);
				const r = healthy(h), v = view(h), q = v.request.promotion.preparation, f = fences(i.releaseId), route = actionView(action(i.releaseId, "ROUTE_BIND") ?? fail("RELEASE_SERVICE_ROUTE_UNAVAILABLE")).observation, revocation = v.retirement.actions.find((a) => a.observation?.kind === "REVOKE_PREPARATION")?.observation, retired = v.retirement.actions.find((a) => a.observation?.kind === "NETWORK_REMOVE")?.observation;
				if (!r.claim || !r.claimHash || route?.kind !== "ROUTE_BIND" || !seen(i.releaseId, "ROUTE_BIND") || revocation?.kind !== "REVOKE_PREPARATION" || !retired) throw new RunnerError("RELEASE_SERVICE_PROOF_UNAVAILABLE", 409);
				const old = v.retirement.reservation, j = v.retirement.original, proof = releasePublicationProof.parse({
					schemaVersion: "devmesh.release-published.v1",
					releaseId: i.releaseId,
					acceptanceOperationId: v.request.promotion.acceptanceOperationId,
					preparationOperationId: q.operationId,
					promotionRequestHash: v.request.promotionRequestHash,
					preparedProofHash: v.request.promotion.proofHash,
					controllerId: i.controllerId,
					runnerId,
					backendRef: q.backendRef,
					gates: v.request.gates,
					readonlyRetirement: {
						reservationId: old.reservationId,
						profileHash: j.profileHash,
						serviceRequestHash: j.profile.requestHash,
						instanceId: j.containerId,
						networkId: j.networkId,
						containerAbsent: true,
						networkAbsent: true,
						verifiedAt: retired.checkedAt
					},
					revocation: Object.fromEntries([
						"barrierId",
						"generation",
						"proofHash",
						"state"
					].map((k) => [k, revocation.kind === "REVOKE_PREPARATION" ? revocation.proof[k] : null])),
					target: f.target,
					source: f.source,
					service: {
						claim: r.claim,
						claimHash: r.claimHash,
						endpoint: r.endpoint
					},
					route: route.kind === "ROUTE_BIND" ? route.route : null,
					routeHash: route.kind === "ROUTE_BIND" ? route.routeHash : null,
					publishedAt: now()
				});
				exec("INSERT INTO release_service_proofs VALUES(?,?,?,?)", i.releaseId, hash(proof), canonical(proof), now());
				return view(h);
			});
		}
	};
}
//#endregion
//#region src/worker.ts
const port = parentPort;
if (!port) throw Error("Runner store requires its Worker");
const time = () => (/* @__PURE__ */ new Date()).toISOString();
const digest = (v) => createHash("sha256").update(canonical(v)).digest("hex");
let db;
try {
	const options = workerData;
	const exists = existsSync(options.databasePath);
	if (!exists && !options.initialize) throw new RunnerError("RUNNER_STORE_NOT_INITIALIZED", 409);
	db = new DatabaseSync(options.databasePath, { enableForeignKeyConstraints: true });
	db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;");
	const get = (sql, ...p) => db.prepare(sql).get(...p), all = (sql, ...p) => db.prepare(sql).all(...p), exec = (sql, ...p) => db.prepare(sql).run(...p);
	const required = (row) => {
		if (!row) throw new RunnerError("JOB_NOT_FOUND", 404);
		return row;
	};
	const tx = (f) => {
		db.exec("BEGIN IMMEDIATE");
		try {
			const value = f();
			if (value instanceof Promise) throw new RunnerError("ASYNC_TRANSACTION_FORBIDDEN", 500);
			db.exec("COMMIT");
			return value;
		} catch (e) {
			db.exec("ROLLBACK");
			throw e;
		}
	};
	if (!exists) tx(() => {
		db.exec(`
 CREATE TABLE runner_identity(singleton INTEGER PRIMARY KEY CHECK(singleton=1),runner_id TEXT NOT NULL,version INTEGER NOT NULL CHECK(version=1)) STRICT;
 CREATE TABLE jobs(job_id TEXT PRIMARY KEY,controller_id TEXT NOT NULL,operation_id TEXT NOT NULL,request_hash TEXT NOT NULL,request_json TEXT NOT NULL CHECK(json_valid(request_json)),execution_json TEXT NOT NULL CHECK(json_valid(execution_json)),owner_key TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('QUEUED','STARTING','RUNNING','STOPPING','EXITED','OUTCOME_UNKNOWN')),container_id TEXT,created_at TEXT NOT NULL,started_at TEXT,ended_at TEXT,exit_code INTEGER,stop_requested INTEGER NOT NULL CHECK(stop_requested IN (0,1)),stop_evidence TEXT CHECK(stop_evidence IS NULL OR json_valid(stop_evidence)),error_code TEXT,lease_sequence INTEGER NOT NULL CHECK(lease_sequence>=0),lease_hash TEXT NOT NULL,lease_permit_json TEXT NOT NULL CHECK(json_valid(lease_permit_json)),lease_renewed_at TEXT NOT NULL,log_cursor INTEGER NOT NULL DEFAULT 0,outputs_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(outputs_json)),UNIQUE(controller_id,operation_id),CHECK(state='EXITED' OR exit_code IS NULL)) STRICT;
 CREATE TABLE job_events(job_id TEXT NOT NULL REFERENCES jobs(job_id),sequence INTEGER NOT NULL,snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),created_at TEXT NOT NULL,PRIMARY KEY(job_id,sequence)) STRICT;
 CREATE TRIGGER immutable_job_identity BEFORE UPDATE ON jobs WHEN NEW.job_id<>OLD.job_id OR NEW.controller_id<>OLD.controller_id OR NEW.operation_id<>OLD.operation_id OR NEW.request_hash<>OLD.request_hash OR NEW.request_json<>OLD.request_json OR NEW.execution_json<>OLD.execution_json OR NEW.owner_key<>OLD.owner_key BEGIN SELECT RAISE(ABORT,'JOB_IDENTITY_IMMUTABLE'); END;
 CREATE TRIGGER immutable_job_terminal BEFORE UPDATE ON jobs WHEN OLD.state='EXITED' BEGIN SELECT RAISE(ABORT,'JOB_TERMINAL_IMMUTABLE'); END;
 PRAGMA user_version=1;`);
		exec("INSERT INTO runner_identity VALUES(1,?,1)", options.runnerId);
	});
	const identity = get("SELECT * FROM runner_identity WHERE singleton=1");
	if (identity?.runner_id !== options.runnerId || ![
		1,
		2,
		3,
		4,
		5,
		6,
		7,
		8,
		9,
		10,
		11,
		12
	].includes(Number(identity.version)) || Number(Object.values(db.prepare("PRAGMA user_version").get())[0]) !== identity.version) throw new RunnerError("RUNNER_STORE_IDENTITY_MISMATCH", 409);
	const fences = createRunnerFenceDomain(db);
	const capacity = createRunnerCapacityDomain(db, options.runnerId);
	let lifecycle;
	const containers = createPreviewContainerDomain(db, (input) => lifecycle.actionGuard(input));
	lifecycle = createPreviewLifecycleDomain(db);
	const cleanup = createPreviewCleanupDomain(db, (input, at) => capacity.recordRemoved(input, at));
	const acceptanceServices = createAcceptanceServiceDomain(db, options.runnerId, capacity.fits);
	const acceptanceProofs = createAcceptanceProofDomain(db, options.runnerId, acceptanceServices);
	const acceptanceAborts = createAcceptanceAbortDomain(db, options.runnerId, acceptanceServices);
	const releaseRetirements = createReleaseRetirementDomain(db, options.runnerId, acceptanceServices);
	const releaseServices = createReleaseServiceDomain(db, options.runnerId, releaseRetirements, capacity.fits);
	const row = (id) => required(get("SELECT * FROM jobs WHERE job_id=?", id));
	const owned = (controller, id) => {
		const r = row(id);
		if (r.controller_id !== controller) throw new RunnerError("JOB_NOT_FOUND", 404);
		return r;
	};
	const view = (r) => ({
		jobId: String(r.job_id),
		controllerId: String(r.controller_id),
		operationId: String(r.operation_id),
		requestHash: String(r.request_hash),
		request: JSON.parse(String(r.request_json)),
		executionProfile: {
			runnerId: options.runnerId,
			commandHash: digest(JSON.parse(String(r.execution_json)).argv)
		},
		state: r.state,
		containerId: r.container_id,
		createdAt: String(r.created_at),
		startedAt: r.started_at,
		endedAt: r.ended_at,
		exitCode: r.exit_code,
		stopRequested: r.stop_requested === 1,
		stopEvidence: r.stop_evidence ? JSON.parse(String(r.stop_evidence)) : null,
		errorCode: r.error_code,
		leaseSequence: Number(r.lease_sequence),
		lastHeartbeat: String(r.lease_renewed_at),
		logCursor: Number(r.log_cursor),
		outputRefs: JSON.parse(String(r.outputs_json))
	});
	const internal = (r) => ({
		job: view(r),
		execution: JSON.parse(String(r.execution_json)),
		leasePermit: JSON.parse(String(r.lease_permit_json)),
		leaseRenewedAt: String(r.lease_renewed_at)
	});
	const event = (r) => {
		const seq = Number(get("SELECT max(sequence) n FROM job_events WHERE job_id=?", String(r.job_id))?.n ?? 0) + 1;
		exec("INSERT INTO job_events VALUES(?,?,?,?)", String(r.job_id), seq, canonical(view(r)), time());
	};
	const methods = {
		...acceptanceServices,
		...acceptanceProofs,
		...acceptanceAborts,
		...releaseRetirements,
		...releaseServices,
		previewCleanupGet: cleanup.previewCleanupGet,
		previewCleanupPage: cleanup.previewCleanupPage,
		previewCleanupActionBegin: cleanup.previewCleanupActionBegin,
		previewCleanupActionAuthorized: cleanup.previewCleanupActionAuthorized,
		previewCleanupActionObserve(input) {
			const result = cleanup.previewCleanupActionObserve(input);
			if (result.request.kind === "CONTAINER_REMOVE") lifecycle.forgetClock(input.reservationId);
			return result;
		},
		previewLifecycleEnroll: lifecycle.previewLifecycleEnroll,
		previewLifecycleGet: lifecycle.previewLifecycleGet,
		previewExpiryPrepare: lifecycle.previewExpiryPrepare,
		previewExpiryAuthorized: lifecycle.previewExpiryAuthorized,
		previewLifecycleActionAuthorized: lifecycle.previewLifecycleActionAuthorized,
		previewReleaseHold: lifecycle.previewReleaseHold,
		previewReleaseCommit: lifecycle.previewReleaseCommit,
		previewContainerPrepare: containers.previewContainerPrepare,
		previewContainerGet: containers.previewContainerGet,
		previewContainerActionBegin: containers.previewContainerActionBegin,
		previewContainerActionObserve: containers.previewContainerActionObserve,
		capacityConfigure: capacity.capacityConfigure,
		capacityUsage: capacity.capacityUsage,
		previewReserve: capacity.previewReserve,
		previewReservationGet: capacity.previewReservationGet,
		previewReservationByOperation: capacity.previewReservationByOperation,
		previewReservationPage: capacity.previewReservationPage,
		previewReservationDispatch: capacity.previewReservationDispatch,
		previewReservationCancel(input) {
			const result = capacity.previewReservationCancel(input);
			if (result.releasedAt) lifecycle.forgetClock(result.reservationId);
			return result;
		},
		previewReservationRecord(input) {
			const result = capacity.previewReservationRecord(input);
			if (result.releasedAt) lifecycle.forgetClock(result.reservationId);
			return result;
		},
		fenceAcquire: fences.fenceAcquire,
		fenceGet: fences.fenceGet,
		fenceByOperation: fences.fenceByOperation,
		fenceActive: fences.fenceActive,
		fenceRelease: fences.fenceRelease,
		workspaceBinding: fences.workspaceBinding,
		register(i) {
			return tx(() => {
				const old = get("SELECT * FROM jobs WHERE controller_id=? AND operation_id=?", i.controllerId, i.request.operationId), hash = digest(i.request);
				if (old) {
					if (old.request_hash !== hash) throw new RunnerError("IDEMPOTENCY_KEY_REUSED", 409);
					return view(old);
				}
				fences.assertAvailable(i.execution.workspacePath);
				if (Number(get("SELECT count(*) n FROM jobs WHERE state='QUEUED'")?.n ?? 0) >= 100) throw new RunnerError("RUNNER_QUEUE_FULL", 429);
				const id = "job_" + randomUUID().replaceAll("-", ""), now = time();
				exec("INSERT INTO jobs(job_id,controller_id,operation_id,request_hash,request_json,execution_json,owner_key,state,created_at,stop_requested,lease_sequence,lease_hash,lease_permit_json,lease_renewed_at) VALUES(?,?,?,?,?,?,?,'QUEUED',?,0,0,?,?,?)", id, i.controllerId, i.request.operationId, hash, canonical(i.request), canonical(i.execution), ownerKey(i.request.permit), now, digest(i.request.permit), canonical(i.request.permit), now);
				const r = row(id);
				event(r);
				return view(r);
			});
		},
		get(i) {
			return view(owned(i.controllerId, i.jobId));
		},
		byOperation(i) {
			const r = get("SELECT * FROM jobs WHERE controller_id=? AND operation_id=?", i.controllerId, i.operationId);
			return r ? view(r) : null;
		},
		pending(i) {
			return all("SELECT * FROM jobs WHERE state='QUEUED' ORDER BY created_at,job_id LIMIT ?", i.limit).map(internal);
		},
		active() {
			return all("SELECT * FROM jobs WHERE state NOT IN ('QUEUED','EXITED') ORDER BY created_at,job_id").map(internal);
		},
		claim(i) {
			return tx(() => {
				const r = row(i.jobId);
				if (r.state !== "QUEUED" || r.stop_requested === 1) return null;
				fences.assertAvailable(String(JSON.parse(String(r.execution_json)).workspacePath));
				const jobs = all("SELECT * FROM jobs WHERE state NOT IN ('QUEUED','EXITED')"), request = JSON.parse(String(r.request_json)), limits = request.resourceLimits;
				if (!capacity.fits(limits, {
					maximumJobs: i.maximumJobs,
					cpu: i.cpu,
					memoryMiB: i.memoryMiB
				}) || jobs.some((j) => JSON.parse(String(j.execution_json)).workspacePath === JSON.parse(String(r.execution_json)).workspacePath) || Date.parse(JSON.parse(String(r.lease_permit_json)).expiresAt) <= Date.now() || jobs.filter((j) => j.owner_key === r.owner_key).length >= (request.permit.ownerKind === "workflowAttempt" ? 2 : 1)) return null;
				exec("UPDATE jobs SET state='STARTING',started_at=? WHERE job_id=?", time(), i.jobId);
				const changed = row(i.jobId);
				event(changed);
				return internal(changed);
			});
		},
		stop(i) {
			return tx(() => {
				const r = owned(i.controllerId, i.jobId);
				if (r.state === "EXITED" || r.stop_requested === 1) return view(r);
				const queued = r.state === "QUEUED";
				exec("UPDATE jobs SET stop_requested=1,state=?,ended_at=?,stop_evidence=? WHERE job_id=?", queued ? "EXITED" : "STOPPING", queued ? time() : null, queued ? canonical({
					neverDispatched: true,
					verifiedAt: time()
				}) : null, i.jobId);
				const changed = row(i.jobId);
				event(changed);
				return view(changed);
			});
		},
		renew(i) {
			return tx(() => {
				const r = owned(i.controllerId, i.jobId);
				if (r.state === "EXITED" || r.stop_requested === 1) throw new RunnerError("JOB_NOT_RENEWABLE", 409);
				const old = JSON.parse(String(r.request_json)), p = i.renewal.permit, hash = digest(p);
				const omitTime = (v) => {
					const { notBefore: _n, expiresAt: _e, ...identity } = v;
					return identity;
				};
				if (canonical(omitTime(p)) !== canonical(omitTime(old.permit))) throw new RunnerError("RUNNER_LEASE_OWNER_CHANGED", 403);
				if (i.renewal.sequence === r.lease_sequence && hash === r.lease_hash) return view(r);
				if (i.renewal.sequence <= Number(r.lease_sequence) || p.expiresAt <= time()) throw new RunnerError("RUNNER_LEASE_STALE", 409);
				exec("UPDATE jobs SET lease_sequence=?,lease_hash=?,lease_permit_json=?,lease_renewed_at=? WHERE job_id=?", i.renewal.sequence, hash, canonical(p), time(), i.jobId);
				const changed = row(i.jobId);
				event(changed);
				return view(changed);
			});
		},
		record(i) {
			return tx(() => {
				const r = row(i.jobId);
				if (r.state === "EXITED") return view(r);
				if (r.container_id !== null && i.containerId !== null && r.container_id !== i.containerId) throw new RunnerError("RUNNER_CONTAINER_IDENTITY_MISMATCH", 409);
				if (r.state === "QUEUED") throw new RunnerError("JOB_NOT_DISPATCHED", 409);
				if (i.state === "EXITED" && (!i.evidence || i.exitCode === null)) throw new RunnerError("JOB_EXIT_NOT_VERIFIED", 409);
				if (i.state !== "EXITED" && (i.exitCode !== null || i.materials)) throw new RunnerError("JOB_EXIT_NOT_VERIFIED", 409);
				if (r.stop_requested === 1 && i.state === "RUNNING") throw new RunnerError("JOB_STOPPING", 409);
				exec("UPDATE jobs SET state=?,container_id=coalesce(container_id,?),ended_at=?,exit_code=?,stop_evidence=?,error_code=?,log_cursor=?,outputs_json=? WHERE job_id=?", i.state, i.containerId, i.state === "EXITED" ? time() : null, i.exitCode, i.evidence ? canonical(i.evidence) : r.stop_evidence ?? null, i.errorCode, i.materials?.logCursor ?? Number(r.log_cursor), i.materials ? canonical(i.materials.outputRefs) : String(r.outputs_json), i.jobId);
				const changed = row(i.jobId);
				event(changed);
				return view(changed);
			});
		},
		inspect() {
			return {
				version: Number(get("PRAGMA user_version").user_version),
				runnerId: options.runnerId,
				jobs: Number(get("SELECT count(*) n FROM jobs")?.n ?? 0),
				foreignKeyErrors: db.prepare("PRAGMA foreign_key_check").all()
			};
		}
	};
	port.on("message", (m) => {
		try {
			if (m.method === "close") {
				db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
				db.close();
				port.close();
				return;
			}
			if (!Object.hasOwn(storeRequests, m.method)) throw new RunnerError("RUNNER_STORE_METHOD_INVALID", 422);
			const method = m.method, input = storeRequests[method].parse(m.input), value = methods[method](input);
			port.postMessage({
				id: m.id,
				value
			});
		} catch (error) {
			port.postMessage({
				id: m.id,
				error: {
					code: error instanceof RunnerError ? error.code : error instanceof ZodError ? "RUNNER_REQUEST_INVALID" : "RUNNER_STORE_FAILURE",
					status: error instanceof RunnerError ? error.status : error instanceof ZodError ? 422 : 500
				}
			});
		}
	});
	port.postMessage({ id: 0 });
} catch (error) {
	if (db?.isOpen) db.close();
	port.postMessage({
		id: 0,
		error: {
			code: error instanceof RunnerError ? error.code : "RUNNER_STORE_FAILURE",
			status: error instanceof RunnerError ? error.status : 500
		}
	});
	port.close();
}
//#endregion
export {};

//# sourceMappingURL=worker.mjs.map