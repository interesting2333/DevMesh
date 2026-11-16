import { z } from "zod";
import { executionPermit, ids, opaqueKey, relativeFile, sha256, timestamp } from "@devmesh/contracts";
//#region src/protocol.ts
var RunnerError = class extends Error {
	code;
	status;
	outcome;
	constructor(code, status, outcome = "known") {
		super(code);
		this.code = code;
		this.status = status;
		this.outcome = outcome;
	}
};
const imageDigest = z.string().regex(/^[a-z0-9][a-z0-9._/:~-]*@sha256:[a-f0-9]{64}$/);
const commandSpec = z.strictObject({ kind: z.enum([
	"install",
	"build",
	"unit",
	"e2e",
	"preview"
]) });
const resourceLimits = z.strictObject({
	cpu: z.number().positive().max(64),
	memoryMiB: z.number().int().min(64).max(131072),
	pids: z.number().int().min(16).max(256),
	temporaryMiB: z.number().int().min(16).max(10240),
	timeoutMs: z.number().int().min(100).max(6e5)
});
const startJob = z.strictObject({
	schemaVersion: z.literal("devmesh.runner-job.v1"),
	operationId: ids.operation,
	permit: executionPermit,
	imageDigest,
	workspaceRef: opaqueKey,
	commandSpec,
	resourceLimits,
	networkPolicyRef: opaqueKey,
	outputSpec: z.array(relativeFile).max(32)
});
const renewJob = z.strictObject({
	permit: executionPermit,
	sequence: z.number().int().positive()
});
const jobSchema = z.strictObject({
	jobId: ids.job,
	controllerId: opaqueKey,
	operationId: ids.operation,
	requestHash: sha256,
	request: startJob,
	executionProfile: z.strictObject({
		runnerId: opaqueKey,
		commandHash: sha256
	}).nullable().default(null),
	state: z.enum([
		"QUEUED",
		"STARTING",
		"RUNNING",
		"STOPPING",
		"EXITED",
		"OUTCOME_UNKNOWN"
	]),
	containerId: z.string().min(1).nullable(),
	createdAt: timestamp,
	startedAt: timestamp.nullable(),
	endedAt: timestamp.nullable(),
	exitCode: z.number().int().nullable(),
	stopRequested: z.boolean(),
	stopEvidence: z.record(z.string(), z.json()).nullable(),
	errorCode: opaqueKey.nullable(),
	leaseSequence: z.number().int().nonnegative(),
	lastHeartbeat: timestamp,
	logCursor: z.number().int().nonnegative(),
	outputRefs: z.array(z.strictObject({
		path: relativeFile,
		sha256,
		byteSize: z.number().int().nonnegative()
	}))
});
const ownerKey = (p) => p.ownerKind === "workflowAttempt" ? "run:" + p.runId : "invocation:" + p.invocationId;
const attemptKey = (p) => p.ownerKind === "workflowAttempt" ? p.attemptId : p.invocationAttemptId;
//#endregion
export { jobSchema as a, resourceLimits as c, imageDigest as i, startJob as l, attemptKey as n, ownerKey as o, commandSpec as r, renewJob as s, RunnerError as t };

//# sourceMappingURL=protocol-CrzCRB9P.mjs.map