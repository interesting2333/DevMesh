import { r as acceptanceDatasetReceipt, t as acceptanceDatasetFences } from "./dataset-journal-BxtC082T.mjs";
import { z } from "zod";
import { ids, opaqueKey, sha256, timestamp } from "@devmesh/contracts";
import { createHash } from "node:crypto";
import { isAbsolute } from "node:path";
import { acceptanceAbortDecision, acceptancePreparationRequest, acceptanceServiceClaim, canonical, previewAcceptanceReleaseClaim, previewRuntimeFact, previewStartRequest, previewStopRequest, releasePromotionRequest, releasePublicationBasis, releasePublicationProof, releaseRouteBinding, releaseServiceClaim } from "@devmesh/storage-sqlite";
//#region src/preview-reservation.ts
/** Trusted Runner configuration, never an admission budget supplied by a project user. */
const runnerCapacity = z.strictObject({
	maximumJobs: z.number().int().min(1).max(4),
	cpu: z.number().positive().max(64),
	memoryMiB: z.number().int().min(64).max(131072)
});
const previewResourceLimits = z.strictObject({
	cpu: z.number().positive().max(64),
	memoryMiB: z.number().int().min(64).max(131072),
	pids: z.number().int().min(16).max(256),
	temporaryMiB: z.number().int().min(16).max(10240)
});
const reservePreview = z.strictObject({
	request: previewStartRequest,
	requestHash: sha256,
	resourceLimits: previewResourceLimits,
	capacity: runnerCapacity
});
const previewReservationSchema = z.strictObject({
	reservationId: opaqueKey,
	controllerId: opaqueKey,
	request: previewStartRequest,
	requestHash: sha256,
	resourceLimits: previewResourceLimits,
	state: z.enum([
		"RESERVED",
		"DISPATCHED",
		"ACTIVE",
		"UNKNOWN",
		"EXITED",
		"CANCELLED",
		"REMOVED"
	]),
	revision: z.number().int().nonnegative(),
	instanceId: opaqueKey.nullable(),
	endpoint: z.strictObject({
		host: z.literal("127.0.0.1"),
		port: z.number().int().min(1024).max(65535)
	}).nullable(),
	fact: previewRuntimeFact.nullable(),
	createdAt: timestamp,
	updatedAt: timestamp,
	releasedAt: timestamp.nullable()
});
//#endregion
//#region src/preview-container.ts
const dockerObjectId = z.string().regex(/^[a-f0-9]{64}$/);
const previewRepository = z.string().max(256).regex(/^[a-z0-9][a-z0-9._:/-]*$/).refine((v) => !v.includes("..") && !v.endsWith("/") && !v.endsWith(":"));
const hostPath = z.string().min(1).max(2048).refine((v) => isAbsolute(v) && !/[\0\r\n,]/.test(v));
const previewContainerProfile = z.strictObject({
	schemaVersion: z.literal("devmesh.preview-container-profile.v1"),
	reservationId: opaqueKey,
	requestHash: sha256,
	repository: previewRepository,
	datasetDirectory: hostPath,
	datasetBytes: z.number().int().min(4096).max(256 * 1024 * 1024),
	resourceLimits: previewResourceLimits,
	networkName: opaqueKey,
	containerName: opaqueKey
});
const previewContainerAction = z.enum([
	"NETWORK_CREATE",
	"CREATE",
	"START",
	"STOP"
]);
const previewContainerActionRequest = z.strictObject({
	kind: previewContainerAction,
	requestHash: sha256,
	request: z.union([previewStartRequest, previewStopRequest])
});
const previewContainerObservation = z.strictObject({
	objectId: dockerObjectId,
	state: z.enum([
		"CREATED",
		"RUNNING",
		"EXITED"
	]),
	checkedAt: timestamp
});
const previewContainerActionSchema = z.strictObject({
	kind: previewContainerAction,
	operationId: opaqueKey,
	requestHash: sha256,
	request: z.union([previewStartRequest, previewStopRequest]),
	state: z.enum(["SENT", "OBSERVED"]),
	observation: previewContainerObservation.nullable(),
	createdAt: timestamp,
	observedAt: timestamp.nullable()
});
function previewContainerNames(reservationId) {
	opaqueKey.parse(reservationId);
	const key = createHash("sha256").update(reservationId).digest("hex").slice(0, 32);
	return {
		networkName: "devmesh-pn-" + key,
		containerName: "devmesh-pc-" + key
	};
}
//#endregion
//#region src/acceptance-service.ts
const acceptanceServiceRequest = z.strictObject({
	schemaVersion: z.literal("devmesh.acceptance-service-start.v1"),
	purpose: z.literal("ACCEPTANCE"),
	preparation: acceptancePreparationRequest,
	acceptanceRequestHash: sha256,
	dataReceipt: acceptanceDatasetReceipt,
	fences: acceptanceDatasetFences
}).superRefine((s, c) => {
	const r = s.preparation, d = s.dataReceipt, f = s.fences, hash = (v) => createHash("sha256").update(canonical(v)).digest("hex");
	if (s.acceptanceRequestHash !== hash(r) || r.dataPlanHash !== hash(r.dataPlan) || d.operationId !== r.operationId || d.requestHash !== s.acceptanceRequestHash || f.operationId !== r.operationId || f.requestHash !== s.acceptanceRequestHash || d.fencesHash !== createHash("sha256").update(canonical(f) + "\n").digest("hex") || d.data.datasetId !== r.target.datasetId || d.data.storageKey !== r.target.storageKey || d.data.schemaRevision !== r.target.schemaRevision || d.data.sourceReleaseId !== r.expectedAcceptedReleaseId || d.data.originDatasetId !== (r.dataPlan.strategy === "PRESERVE_MIGRATE" ? r.source?.datasetId ?? null : null) || canonical(d.data.migrationRef) !== canonical(r.dataPlan.migrationRef) || f.targetFence.datasetId !== r.target.datasetId || (r.source ? f.sourceFence?.datasetId !== r.source.datasetId || f.sourceFence.datasetOperationId !== r.source.datasetOperationId || f.sourceFence.closeOperationId !== r.operationId : f.sourceFence !== null)) c.addIssue({
		code: "custom",
		message: "Original acceptance request, materialized data and exact custody required"
	});
});
const acceptanceServiceProfile = previewContainerProfile.omit({ schemaVersion: true }).extend({
	schemaVersion: z.literal("devmesh.acceptance-service-profile.v1"),
	purpose: z.literal("ACCEPTANCE"),
	accessMode: z.literal("READ_ONLY")
});
const acceptanceServiceFact = z.strictObject({
	operationId: opaqueKey,
	releaseId: opaqueKey,
	datasetId: opaqueKey,
	imageDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
	state: z.enum([
		"CREATED",
		"HEALTHY",
		"UNHEALTHY",
		"UNKNOWN",
		"EXITED"
	]),
	instanceId: dockerObjectId.nullable(),
	endpoint: z.strictObject({
		host: z.literal("127.0.0.1"),
		port: z.number().int().min(1024).max(65535)
	}).nullable(),
	checkedAt: timestamp
}).superRefine((f, c) => {
	if (f.state !== "UNKNOWN" && f.instanceId === null || ["HEALTHY", "UNHEALTHY"].includes(f.state) && f.endpoint === null) c.addIssue({
		code: "custom",
		message: "Exact original instance and endpoint required"
	});
});
const acceptanceServiceReservation = z.strictObject({
	purpose: z.literal("ACCEPTANCE"),
	reservationId: opaqueKey,
	controllerId: opaqueKey,
	request: acceptanceServiceRequest,
	requestHash: sha256,
	resourceLimits: previewResourceLimits,
	state: z.enum([
		"RESERVED",
		"DISPATCHED",
		"ACTIVE",
		"UNKNOWN",
		"EXITED",
		"CANCELLED",
		"REMOVED"
	]),
	revision: z.number().int().nonnegative().safe(),
	instanceId: dockerObjectId.nullable(),
	endpoint: acceptanceServiceFact.shape.endpoint,
	fact: acceptanceServiceFact.nullable(),
	custodyState: z.enum(["PREPARING", "RELEASE_HELD"]),
	claim: acceptanceServiceClaim.nullable(),
	claimHash: sha256.nullable(),
	createdAt: timestamp,
	updatedAt: timestamp,
	releasedAt: timestamp.nullable()
});
const reserveAcceptanceService = z.strictObject({
	request: acceptanceServiceRequest,
	requestHash: sha256,
	resourceLimits: previewResourceLimits,
	capacity: runnerCapacity
});
const acceptanceServiceActionKind = z.enum([
	"NETWORK_CREATE",
	"CREATE",
	"START"
]);
const acceptanceServiceActionObservation = z.strictObject({
	objectId: dockerObjectId,
	state: z.enum([
		"CREATED",
		"RUNNING",
		"EXITED"
	]),
	checkedAt: timestamp
});
const acceptanceServiceActionRequest = z.strictObject({
	schemaVersion: z.literal("devmesh.acceptance-service-action.v1"),
	purpose: z.literal("ACCEPTANCE"),
	operationId: opaqueKey,
	reservationId: opaqueKey,
	serviceRequestHash: sha256,
	profileHash: sha256,
	kind: acceptanceServiceActionKind,
	networkId: dockerObjectId.nullable(),
	containerId: dockerObjectId.nullable()
});
const acceptanceServiceActionRecord = z.strictObject({
	request: acceptanceServiceActionRequest,
	requestHash: sha256,
	state: z.enum(["SENT", "OBSERVED"]),
	observation: acceptanceServiceActionObservation.nullable(),
	createdAt: timestamp,
	observedAt: timestamp.nullable()
});
function acceptanceServiceNames(reservationId) {
	opaqueKey.parse(reservationId);
	const key = createHash("sha256").update(reservationId).digest("hex").slice(0, 32);
	return {
		networkName: "devmesh-an-" + key,
		containerName: "devmesh-ac-" + key
	};
}
//#endregion
//#region src/release-retirement.ts
/** Private trusted handoff, not a public caller-supplied cleanup permission. */
const releaseRetirementRequest = z.strictObject({
	schemaVersion: z.literal("devmesh.release-retirement.v1"),
	promotion: releasePromotionRequest,
	promotionRequestHash: sha256,
	gates: releasePublicationBasis
});
const releaseRetirementKind = z.enum([
	"REVOKE_PREPARATION",
	"STOP",
	"CONTAINER_REMOVE",
	"NETWORK_REMOVE"
]);
const releaseRetirementRevocation = z.strictObject({
	schemaVersion: z.literal("devmesh.release-preparation-revoked.v1"),
	promotionRequestHash: sha256,
	preparationOperationId: ids.operation,
	releaseId: ids.release,
	runnerId: opaqueKey,
	controllerId: opaqueKey,
	barrierId: opaqueKey,
	generation: z.number().int().positive().safe(),
	proofHash: sha256,
	state: z.literal("PERMANENTLY_REVOKED")
});
const releaseRetirementActionRequest = z.strictObject({
	schemaVersion: z.literal("devmesh.release-retirement-action.v1"),
	operationId: ids.operation,
	releaseId: ids.release,
	promotionRequestHash: sha256,
	retirementRequestHash: sha256,
	reservationId: opaqueKey,
	serviceRequestHash: sha256,
	profileHash: sha256,
	networkId: dockerObjectId,
	containerId: dockerObjectId,
	kind: releaseRetirementKind
});
const releaseRetirementObservation = z.discriminatedUnion("kind", [
	z.strictObject({
		kind: z.literal("REVOKE_PREPARATION"),
		proof: releaseRetirementRevocation,
		checkedAt: timestamp
	}),
	z.strictObject({
		kind: z.literal("STOP"),
		objectId: dockerObjectId,
		state: z.enum(["CREATED", "EXITED"]),
		checkedAt: timestamp
	}),
	z.strictObject({
		kind: z.enum(["CONTAINER_REMOVE", "NETWORK_REMOVE"]),
		objectId: dockerObjectId,
		absenceVerified: z.literal(true),
		checkedAt: timestamp
	})
]);
const releaseRetirementAction = z.strictObject({
	request: releaseRetirementActionRequest,
	requestHash: sha256,
	state: z.enum(["SENT", "OBSERVED"]),
	observation: releaseRetirementObservation.nullable(),
	createdAt: timestamp,
	observedAt: timestamp.nullable()
});
const bound$2 = {
	controllerId: opaqueKey,
	releaseId: ids.release,
	requestHash: sha256
};
const releaseRetirementStoreRequests = {
	releaseRetirementEnroll: z.strictObject({
		controllerId: opaqueKey,
		request: releaseRetirementRequest,
		requestHash: sha256
	}),
	releaseRetirementGet: z.strictObject(bound$2),
	releaseRetirementPage: z.strictObject({
		controllerId: opaqueKey,
		afterSequence: z.number().int().nonnegative().safe().default(0),
		limit: z.number().int().min(1).max(100).default(20)
	}),
	releaseRetirementActionBegin: z.strictObject({
		...bound$2,
		kind: releaseRetirementKind
	}),
	releaseRetirementActionAuthorized: z.strictObject({
		...bound$2,
		kind: releaseRetirementKind,
		actionRequestHash: sha256
	}),
	releaseRetirementActionObserve: z.strictObject({
		...bound$2,
		kind: releaseRetirementKind,
		actionRequestHash: sha256,
		observation: releaseRetirementObservation
	})
};
//#endregion
//#region src/acceptance-abort.ts
const acceptanceAbortKind = z.enum([
	"STOP",
	"CONTAINER_REMOVE",
	"NETWORK_REMOVE"
]);
const acceptanceAbortActionRequest = z.strictObject({
	schemaVersion: z.literal("devmesh.acceptance-service-abort-action.v1"),
	operationId: ids.operation,
	preparationOperationId: ids.operation,
	abortOperationId: ids.operation,
	decisionHash: sha256,
	reservationId: opaqueKey,
	serviceRequestHash: sha256,
	profileHash: sha256,
	kind: acceptanceAbortKind,
	containerId: dockerObjectId.nullable(),
	networkId: dockerObjectId
});
const acceptanceAbortObservation = z.discriminatedUnion("kind", [z.strictObject({
	kind: z.literal("STOP"),
	objectId: dockerObjectId,
	state: z.enum(["CREATED", "EXITED"]),
	checkedAt: timestamp
}), z.strictObject({
	kind: z.enum(["CONTAINER_REMOVE", "NETWORK_REMOVE"]),
	objectId: dockerObjectId,
	absenceVerified: z.literal(true),
	checkedAt: timestamp
})]);
const acceptanceAbortAction = z.strictObject({
	request: acceptanceAbortActionRequest,
	requestHash: sha256,
	state: z.enum(["SENT", "OBSERVED"]),
	observation: acceptanceAbortObservation.nullable(),
	createdAt: timestamp,
	observedAt: timestamp.nullable()
});
const bound$1 = {
	controllerId: opaqueKey,
	operationId: ids.operation,
	decisionHash: sha256
};
const acceptanceAbortStoreRequests = {
	acceptanceAbortEnroll: z.strictObject({
		controllerId: opaqueKey,
		decision: acceptanceAbortDecision,
		decisionHash: sha256
	}),
	acceptanceAbortGet: z.strictObject(bound$1),
	acceptanceAbortActionBegin: z.strictObject({
		...bound$1,
		kind: acceptanceAbortKind
	}),
	acceptanceAbortActionAuthorized: z.strictObject({
		...bound$1,
		kind: acceptanceAbortKind,
		actionRequestHash: sha256
	}),
	acceptanceAbortActionObserve: z.strictObject({
		...bound$1,
		kind: acceptanceAbortKind,
		actionRequestHash: sha256,
		observation: acceptanceAbortObservation
	})
};
//#endregion
//#region src/preview-lifecycle.ts
const previewReleaseClaim = previewAcceptanceReleaseClaim;
const runnerPreviewLifecycle = z.strictObject({
	reservationId: opaqueKey,
	requestHash: sha256,
	state: z.enum([
		"PREVIEW",
		"STOPPING",
		"RELEASE_HELD",
		"RELEASE_OWNED"
	]),
	revision: z.number().int().nonnegative(),
	expiresAt: timestamp,
	expiredAt: timestamp.nullable(),
	lastWallAt: timestamp,
	releaseClaim: previewReleaseClaim.nullable(),
	releaseClaimHash: sha256.nullable(),
	expiryRequest: previewStopRequest.nullable(),
	expiryRequestHash: sha256.nullable(),
	createdAt: timestamp,
	updatedAt: timestamp
});
//#endregion
//#region src/preview-cleanup.ts
const previewCleanupKind = z.enum(["CONTAINER_REMOVE", "NETWORK_REMOVE"]);
const previewCleanupRequest = z.strictObject({
	schemaVersion: z.literal("devmesh.preview-cleanup.v1"),
	operationId: ids.operation,
	reservationId: opaqueKey,
	startRequestHash: sha256,
	profileHash: sha256,
	stopRequestHash: sha256,
	containerId: dockerObjectId,
	networkId: dockerObjectId,
	kind: previewCleanupKind
});
const previewCleanupObservation = z.strictObject({
	objectId: dockerObjectId,
	absenceVerified: z.literal(true),
	checkedAt: timestamp
});
const previewCleanupAction = z.strictObject({
	request: previewCleanupRequest,
	requestHash: sha256,
	state: z.enum(["SENT", "OBSERVED"]),
	observation: previewCleanupObservation.nullable(),
	createdAt: timestamp,
	observedAt: timestamp.nullable()
});
//#endregion
//#region src/release-service.ts
const releaseServiceRequest = releaseRetirementRequest.extend({
	schemaVersion: z.literal("devmesh.release-service-start.v1"),
	purpose: z.literal("RELEASE"),
	retirementRequestHash: sha256
});
const releaseServiceFences = z.strictObject({
	schemaVersion: z.literal("devmesh.release-service-fences.v1"),
	releaseId: ids.release,
	promotionRequestHash: sha256,
	retirementRequestHash: sha256,
	revocationProofHash: sha256,
	target: releasePublicationProof.shape.target,
	source: releasePublicationProof.shape.source
});
const releaseServiceProfile = previewContainerProfile.omit({ schemaVersion: true }).extend({
	schemaVersion: z.literal("devmesh.release-service-profile.v1"),
	purpose: z.literal("RELEASE"),
	accessMode: z.literal("READ_WRITE"),
	writeAdmission: z.literal("CONTROL_GATE_FENCED"),
	fenceProofHash: sha256,
	gateBindingHash: sha256
});
const releaseServiceGuardProof = z.strictObject({
	schemaVersion: z.literal("devmesh.release-service-guard.v1"),
	releaseId: ids.release,
	runnerId: opaqueKey,
	controllerId: opaqueKey,
	serviceRequestHash: sha256,
	reservationId: opaqueKey,
	profileHash: sha256,
	datasetId: ids.dataset,
	targetProofHash: sha256,
	gateBindingHash: sha256,
	guardId: opaqueKey,
	proofHash: sha256,
	scope: z.literal("ALL_DATASET_WRITES"),
	writeAdmission: z.literal("CONTROL_GATE_FENCED"),
	state: z.literal("ENFORCED")
});
const releaseServiceKind = z.enum([
	"ARM_FENCES",
	"SOURCE_STOP",
	"SOURCE_CONTAINER_REMOVE",
	"SOURCE_NETWORK_REMOVE",
	"PROFILE_PREPARE",
	"GUARD_ENFORCE",
	"NETWORK_CREATE",
	"CREATE",
	"START",
	"ROUTE_BIND"
]);
const releaseServiceActionRequest = z.strictObject({
	schemaVersion: z.literal("devmesh.release-service-action.v1"),
	operationId: ids.operation,
	releaseId: ids.release,
	serviceRequestHash: sha256,
	kind: releaseServiceKind,
	reservationId: opaqueKey.nullable(),
	profileHash: sha256.nullable(),
	containerId: dockerObjectId.nullable(),
	networkId: dockerObjectId.nullable()
});
const releaseServiceObservation = z.discriminatedUnion("kind", [
	z.strictObject({
		kind: z.literal("ARM_FENCES"),
		proof: releaseServiceFences,
		checkedAt: timestamp
	}),
	z.strictObject({
		kind: z.literal("PROFILE_PREPARE"),
		profileHash: sha256,
		checkedAt: timestamp
	}),
	z.strictObject({
		kind: z.literal("GUARD_ENFORCE"),
		proof: releaseServiceGuardProof,
		checkedAt: timestamp
	}),
	z.strictObject({
		kind: z.enum([
			"NETWORK_CREATE",
			"CREATE",
			"START",
			"SOURCE_STOP"
		]),
		objectId: dockerObjectId,
		state: z.enum([
			"CREATED",
			"RUNNING",
			"EXITED"
		]),
		checkedAt: timestamp
	}),
	z.strictObject({
		kind: z.enum(["SOURCE_CONTAINER_REMOVE", "SOURCE_NETWORK_REMOVE"]),
		objectId: dockerObjectId,
		absenceVerified: z.literal(true),
		checkedAt: timestamp
	}),
	z.strictObject({
		kind: z.literal("ROUTE_BIND"),
		route: releaseRouteBinding,
		routeHash: sha256,
		checkedAt: timestamp
	})
]);
const releaseServiceAction = z.strictObject({
	request: releaseServiceActionRequest,
	requestHash: sha256,
	state: z.enum(["SENT", "OBSERVED"]),
	observation: releaseServiceObservation.nullable(),
	createdAt: timestamp,
	observedAt: timestamp.nullable()
});
const endpoint = z.strictObject({
	host: z.literal("127.0.0.1"),
	port: z.number().int().min(1024).max(65535)
});
const releaseServiceFact = z.strictObject({
	releaseId: ids.release,
	datasetId: ids.dataset,
	imageDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
	state: z.enum([
		"CREATED",
		"HEALTHY",
		"UNHEALTHY",
		"UNKNOWN",
		"EXITED"
	]),
	instanceId: dockerObjectId.nullable(),
	endpoint: endpoint.nullable(),
	checkedAt: timestamp
}).superRefine((f, c) => {
	if (f.state !== "UNKNOWN" && f.instanceId === null || ["HEALTHY", "UNHEALTHY"].includes(f.state) && f.endpoint === null) c.addIssue({
		code: "custom",
		message: "Exact original instance and endpoint required"
	});
});
const releaseServiceReservation = z.strictObject({
	purpose: z.literal("RELEASE"),
	releaseId: ids.release,
	reservationId: opaqueKey,
	controllerId: opaqueKey,
	requestHash: sha256,
	resourceLimits: previewResourceLimits,
	state: z.enum([
		"RESERVED",
		"DISPATCHED",
		"ACTIVE",
		"UNKNOWN",
		"EXITED",
		"REMOVED"
	]),
	revision: z.number().int().nonnegative().safe(),
	instanceId: dockerObjectId.nullable(),
	endpoint: endpoint.nullable(),
	fact: releaseServiceFact.nullable(),
	claim: releaseServiceClaim.nullable(),
	claimHash: sha256.nullable(),
	createdAt: timestamp,
	updatedAt: timestamp,
	releasedAt: timestamp.nullable()
});
const bound = {
	controllerId: opaqueKey,
	releaseId: ids.release,
	requestHash: sha256
};
const releaseServiceStoreRequests = {
	releaseServiceEnroll: z.strictObject({
		controllerId: opaqueKey,
		request: releaseServiceRequest,
		requestHash: sha256,
		resourceLimits: previewResourceLimits
	}),
	releaseServiceGet: z.strictObject(bound),
	releaseServicePage: z.strictObject({
		controllerId: opaqueKey,
		afterSequence: z.number().int().nonnegative().safe().default(0),
		limit: z.number().int().min(1).max(100).default(20)
	}),
	releaseServiceReserve: z.strictObject({
		...bound,
		capacity: runnerCapacity
	}),
	releaseServiceProfilePrepare: z.strictObject({
		...bound,
		profile: releaseServiceProfile
	}),
	releaseServiceActionBegin: z.strictObject({
		...bound,
		kind: releaseServiceKind
	}),
	releaseServiceActionAuthorized: z.strictObject({
		...bound,
		kind: releaseServiceKind,
		actionRequestHash: sha256
	}),
	releaseServiceActionObserve: z.strictObject({
		...bound,
		kind: releaseServiceKind,
		actionRequestHash: sha256,
		observation: releaseServiceObservation
	}),
	releaseServiceRecord: z.strictObject({
		...bound,
		expectedRevision: z.number().int().nonnegative().safe(),
		fact: releaseServiceFact
	}),
	releaseServiceOwn: z.strictObject(bound),
	releaseServicePrepareProof: z.strictObject(bound)
};
function releaseServiceNames(id) {
	opaqueKey.parse(id);
	const key = createHash("sha256").update(id).digest("hex").slice(0, 32);
	return {
		networkName: "devmesh-rn-" + key,
		containerName: "devmesh-rc-" + key
	};
}
function releaseServiceGateBinding(r) {
	return createHash("sha256").update(canonical({
		releaseId: r.promotion.preparation.releaseId,
		promotionRequestHash: r.promotionRequestHash,
		gate: r.gates.targetGate
	})).digest("hex");
}
//#endregion
export { acceptanceServiceActionRecord as A, previewContainerActionRequest as B, releaseRetirementActionRequest as C, releaseRetirementStoreRequests as D, releaseRetirementRevocation as E, acceptanceServiceRequest as F, previewRepository as G, previewContainerNames as H, acceptanceServiceReservation as I, reservePreview as J, previewReservationSchema as K, reserveAcceptanceService as L, acceptanceServiceFact as M, acceptanceServiceNames as N, acceptanceServiceActionKind as O, acceptanceServiceProfile as P, dockerObjectId as R, releaseRetirementAction as S, releaseRetirementRequest as T, previewContainerObservation as U, previewContainerActionSchema as V, previewContainerProfile as W, runnerCapacity as Y, runnerPreviewLifecycle as _, releaseServiceGateBinding as a, acceptanceAbortObservation as b, releaseServiceProfile as c, releaseServiceStoreRequests as d, previewCleanupAction as f, previewReleaseClaim as g, previewCleanupRequest as h, releaseServiceFences as i, acceptanceServiceActionRequest as j, acceptanceServiceActionObservation as k, releaseServiceRequest as l, previewCleanupObservation as m, releaseServiceActionRequest as n, releaseServiceGuardProof as o, previewCleanupKind as p, previewResourceLimits as q, releaseServiceFact as r, releaseServiceNames as s, releaseServiceAction as t, releaseServiceReservation as u, acceptanceAbortAction as v, releaseRetirementObservation as w, acceptanceAbortStoreRequests as x, acceptanceAbortActionRequest as y, previewContainerAction as z };

//# sourceMappingURL=release-service-CQfgXb3J.mjs.map