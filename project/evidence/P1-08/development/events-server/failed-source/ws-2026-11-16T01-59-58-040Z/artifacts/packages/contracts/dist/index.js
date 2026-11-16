import { z } from "zod";
//#region src/primitives.ts
const id = (prefix) => z.string().regex(new RegExp(`^${prefix}_[A-Za-z0-9][A-Za-z0-9_-]{0,127}$`)).brand();
const ids = {
	project: id("prj"),
	userTask: id("task"),
	run: id("run"),
	work: id("work"),
	attempt: id("attempt"),
	invocation: id("invocation"),
	invocationAttempt: id("iattempt"),
	activation: id("activation"),
	grant: id("grant"),
	operation: id("op"),
	event: id("evt"),
	request: id("req"),
	artifact: id("artifact"),
	manifest: id("manifest"),
	roleSnapshot: id("role"),
	definitionSnapshot: id("definition"),
	candidate: id("candidate"),
	release: id("release"),
	question: id("question"),
	requirement: id("requirement"),
	session: id("session"),
	job: id("job"),
	attachment: id("attachment"),
	message: id("message"),
	change: id("change"),
	decision: id("decision"),
	preview: id("preview"),
	dataset: id("dataset"),
	export: id("export"),
	analysis: id("analysis"),
	check: id("check")
};
const revision = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const epoch = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const gitCommit = z.string().regex(/^[a-f0-9]{40}$/);
const timestamp = z.iso.datetime({ precision: 3 });
const role = z.enum([
	"product",
	"architect",
	"developer",
	"tester"
]);
const opaqueKey = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/);
const protocolTaskId = z.string().min(1).max(512);
const nonemptyText = z.string().min(1).max(2e4);
const inputText = z.string().regex(/^[\s\S]{1,20000}$/u);
const projectName = z.string().regex(/^[\s\S]{1,80}$/u);
const taskTitle = z.string().regex(/^[\s\S]{1,120}$/u);
const artifactRef = z.strictObject({
	artifactId: ids.artifact,
	sha256
});
const runPhase = z.enum([
	"PREPARING",
	"UNDERSTANDING",
	"PLANNING",
	"EXECUTING",
	"VERIFYING",
	"REVIEW"
]);
const controlGate = z.enum([
	"OPEN",
	"PAUSING",
	"PAUSED",
	"CANCELLING"
]);
const terminalOutcome = z.enum([
	"COMPLETED",
	"FAILED",
	"CANCELLED"
]);
const runState = z.strictObject({
	phase: runPhase,
	controlGate,
	terminalOutcome: terminalOutcome.nullable()
});
const attemptState = z.enum([
	"RESERVED",
	"SUBMITTED",
	"WORKING",
	"INPUT_REQUIRED",
	"VERIFYING",
	"OUTCOME_UNKNOWN",
	"STOPPING",
	"SUCCEEDED",
	"FAILED",
	"INTERRUPTED",
	"CANCELLED"
]);
const invocationState = z.enum([
	"QUEUED",
	"RUNNING",
	"INPUT_REQUIRED",
	"VERIFYING",
	"STOPPING",
	"OUTCOME_UNKNOWN",
	"SUCCEEDED",
	"FAILED",
	"CANCELLED"
]);
const operationStatus = z.enum([
	"ACCEPTED",
	"RUNNING",
	"WAITING",
	"SUCCEEDED",
	"FAILED",
	"OUTCOME_UNKNOWN"
]);
const jobState = z.enum([
	"QUEUED",
	"STARTING",
	"RUNNING",
	"STOPPING",
	"EXITED",
	"OUTCOME_UNKNOWN"
]);
const a2aTaskState = z.enum([
	"submitted",
	"working",
	"input-required",
	"auth-required",
	"completed",
	"failed",
	"canceled",
	"rejected"
]);
//#endregion
//#region src/errors.ts
const errorCode = z.enum([
	"SCHEMA_INVALID",
	"PRECONDITION_REQUIRED",
	"PRECONDITION_FAILED",
	"BASIS_SUPERSEDED",
	"PLAN_SUPERSEDED",
	"PERMIT_REVOKED",
	"PERMIT_EXPIRED",
	"PERMIT_SCOPE_DENIED",
	"IDEMPOTENCY_KEY_REUSED",
	"AUTHENTICATION_REQUIRED",
	"FORBIDDEN",
	"RESOURCE_NOT_FOUND",
	"ACTIVE_RUN_EXISTS",
	"LIMIT_EXCEEDED",
	"OUTCOME_UNKNOWN",
	"SERVICE_UNAVAILABLE",
	"PLAN_INVALID",
	"PLAN_ALREADY_CONFIRMED",
	"RUN_TERMINAL",
	"ADMISSION_CLOSED",
	"PREVIEW_ACCESS_NOT_CONFIGURED",
	"PREVIEW_UNAVAILABLE",
	"RELEASE_ACCESS_NOT_CONFIGURED",
	"RELEASE_UNAVAILABLE",
	"RANGE_NOT_SUPPORTED",
	"EXPORT_UNAVAILABLE",
	"ACCEPTANCE_UNAVAILABLE",
	"REVIEW_UNAVAILABLE",
	"CONTENT_CORRUPT",
	"CONTENT_TOO_LARGE",
	"IDENTITY_NOT_CONFIGURED",
	"REQUEST_ORIGIN_INVALID",
	"REQUEST_HEADERS_INVALID",
	"REQUEST_HOST_INVALID",
	"COOKIE_AUTH_NOT_CONFIGURED",
	"SERVICE_STOPPING",
	"CONTENT_TYPE_INVALID",
	"REQUEST_TOO_LARGE",
	"JSON_INVALID",
	"UPLOAD_CAPACITY",
	"UPLOAD_IN_PROGRESS",
	"UPLOAD_FAILED",
	"UPLOAD_TIMEOUT",
	"UPLOAD_INTERRUPTED",
	"UPLOAD_TOO_LARGE",
	"UPLOAD_INVALID",
	"UPLOAD_RESULT_INVALID",
	"MULTIPART_INVALID",
	"ATTACHMENT_TYPE_INVALID",
	"ATTACHMENT_ENCODING_INVALID",
	"ATTACHMENT_EMPTY",
	"ATTACHMENT_BOUND",
	"UPLOAD_CONTENT_CONFLICT",
	"UPLOAD_HASH_INVALID",
	"UPLOAD_CLAIM_INVALID",
	"OPERATION_SCOPE_INVALID",
	"ACCEPTED_RELEASE_CHANGED",
	"MESSAGE_KEY_REUSED",
	"RUN_NOT_WRITABLE",
	"EVENT_CURSOR_INVALID",
	"CONTENT_UNAVAILABLE",
	"QUESTION_SUPERSEDED",
	"ANSWER_INVALID",
	"INTERPRETATION_NOT_FAILED",
	"REQUIRED_QUESTIONS_UNANSWERED",
	"INTERPRETATION_PENDING"
]);
const errorEnvelope = z.strictObject({ error: z.strictObject({
	code: errorCode,
	message: z.string().min(1),
	requestId: ids.request,
	retryable: z.boolean(),
	details: z.record(z.string(), z.json())
}) });
var ContractError = class extends Error {
	code;
	status;
	details;
	constructor(code, status, message, details = {}) {
		super(message);
		this.code = code;
		this.status = status;
		this.details = details;
		this.name = "ContractError";
	}
	toEnvelope(requestId) {
		return errorEnvelope.parse({ error: {
			code: this.code,
			message: this.message,
			requestId,
			retryable: false,
			details: this.details
		} });
	}
};
function parseContract(schema, input) {
	const result = schema.safeParse(input);
	if (result.success) return result.data;
	throw new ContractError("SCHEMA_INVALID", 422, "请求不符合契约。", { issues: result.error.issues.map((issue) => ({
		path: issue.path.map(String).join("."),
		code: issue.code,
		message: issue.message
	})) });
}
//#endregion
//#region src/permits.ts
const resourceFields = {
	resourceId: opaqueKey,
	access: z.enum(["read", "write"])
};
const workflowResource = z.strictObject({
	kind: z.enum([
		"snapshot",
		"workspace",
		"projectRepository",
		"dataset"
	]),
	...resourceFields
});
const invocationResource = z.discriminatedUnion("kind", [z.strictObject({
	kind: z.literal("snapshot"),
	resourceId: opaqueKey,
	access: z.literal("read")
}), z.strictObject({
	kind: z.literal("workspace"),
	...resourceFields
})]);
const common = {
	schemaVersion: z.literal("devmesh.permit.v1"),
	grantId: ids.grant,
	activationId: ids.activation,
	notBefore: timestamp,
	expiresAt: timestamp
};
const workflowOwner = z.strictObject({
	ownerKind: z.literal("workflowAttempt"),
	runId: ids.run,
	runEpoch: epoch,
	workId: ids.work,
	workEpoch: epoch,
	attemptId: ids.attempt
});
const invocationOwner = z.strictObject({
	ownerKind: z.literal("invocationAttempt"),
	invocationId: ids.invocation,
	invocationEpoch: epoch,
	invocationAttemptId: ids.invocationAttempt
});
const executionOwner = z.discriminatedUnion("ownerKind", [workflowOwner, invocationOwner]);
const executionPermit = z.discriminatedUnion("ownerKind", [workflowOwner.extend({
	...common,
	resources: z.array(workflowResource).min(1).max(64)
}), invocationOwner.extend({
	...common,
	resources: z.array(invocationResource).min(1).max(64)
})]).superRefine((permit, ctx) => {
	if (Date.parse(permit.expiresAt) <= Date.parse(permit.notBefore)) ctx.addIssue({
		code: "custom",
		path: ["expiresAt"],
		message: "expiresAt must follow notBefore"
	});
});
const includes = (scopes, requested) => scopes.some((scope) => scope.kind === requested.kind && scope.resourceId === requested.resourceId && (scope.access === "write" || requested.access === "read"));
/** authority is read from authenticated, committed grant/host facts, never caller JSON. */
function assertPermit(input, authority, requested, nowMs) {
	const permit = parseContract(executionPermit, input);
	const current = parseContract(executionPermit, authority);
	parseContract(workflowResource, requested);
	if (!Number.isFinite(nowMs)) throw new TypeError("A trusted finite clock is required");
	const ownerKeys = current.ownerKind === "workflowAttempt" ? [
		"ownerKind",
		"runId",
		"runEpoch",
		"workId",
		"workEpoch",
		"attemptId",
		"activationId",
		"grantId"
	] : [
		"ownerKind",
		"invocationId",
		"invocationEpoch",
		"invocationAttemptId",
		"activationId",
		"grantId"
	];
	const actual = permit;
	const expected = current;
	if (ownerKeys.some((key) => actual[key] !== expected[key])) throw new ContractError("PERMIT_REVOKED", 403, "执行宿主或许可代际已变化。");
	if ([permit, current].some((p) => nowMs < Date.parse(p.notBefore) || nowMs >= Date.parse(p.expiresAt))) throw new ContractError("PERMIT_EXPIRED", 403, "许可尚未生效或已过期。");
	if (Date.parse(permit.notBefore) < Date.parse(current.notBefore) || Date.parse(permit.expiresAt) > Date.parse(current.expiresAt)) throw new ContractError("PERMIT_REVOKED", 403, "许可有效期超出当前授权。");
	if (permit.resources.some((scope) => !includes(current.resources, scope)) || !includes(permit.resources, requested)) throw new ContractError("PERMIT_SCOPE_DENIED", 403, "请求资源超出许可范围。");
	return permit;
}
//#endregion
//#region src/versions.ts
const strongETag = z.string().regex(/^"r[1-9][0-9]*"$/).refine((value) => Number.isSafeInteger(Number(value.slice(2, -1))), "Revision must be a safe integer");
const contentBasis = z.strictObject({
	revision,
	reviewHash: sha256
});
/** Invoke only for NEW operations, after authentication, ACL and idempotency lookup. */
function assertResourceVersion(ifMatch, currentRevision) {
	parseContract(revision, currentRevision);
	if (ifMatch === void 0) throw new ContractError("PRECONDITION_REQUIRED", 428, "请提供 If-Match。");
	if (!strongETag.safeParse(ifMatch).success) throw new ContractError("PRECONDITION_FAILED", 412, "需要单一强版本 ETag。");
	const submittedRevision = Number(ifMatch.slice(2, -1));
	if (submittedRevision !== currentRevision) throw new ContractError("PRECONDITION_FAILED", 412, "对象已经更新，请重新获取。", {
		submittedRevision,
		currentRevision
	});
}
function assertContentBasis(submitted, current, kind = "content") {
	parseContract(contentBasis, submitted);
	parseContract(contentBasis, current);
	if (submitted.revision !== current.revision || submitted.reviewHash !== current.reviewHash) throw new ContractError(kind === "plan" ? "PLAN_SUPERSEDED" : "BASIS_SUPERSEDED", 409, "确认依据已经失效。", {
		submittedRevision: submitted.revision,
		currentRevision: current.revision
	});
}
//#endregion
//#region src/outputs.ts
const relativeFile = z.string().min(1).max(512).refine((path) => !path.startsWith("/") && !path.includes("\\") && !path.includes(":") && path.split("/").every((part) => part !== "" && part !== "." && part !== ".."), "Expected a relative workspace file");
const sourceRef = z.discriminatedUnion("kind", [
	artifactRef.extend({ kind: z.literal("artifact") }),
	z.strictObject({
		kind: z.literal("message"),
		messageId: ids.message
	}),
	z.strictObject({
		kind: z.literal("requirement"),
		requirementId: ids.requirement,
		requirementRevision: revision
	})
]);
const requirement = z.strictObject({
	id: ids.requirement,
	statement: nonemptyText,
	sourceRefs: z.array(sourceRef).min(1),
	acceptance: z.array(nonemptyText).min(1)
});
const question = z.strictObject({
	id: ids.question,
	required: z.boolean(),
	reason: nonemptyText,
	blockingScope: z.array(ids.work),
	defaultOption: nonemptyText.optional()
});
const completionCheck = z.discriminatedUnion("kind", [
	z.strictObject({
		kind: z.literal("artifact-exists"),
		outputSlot: opaqueKey
	}),
	z.strictObject({
		kind: z.literal("schema-valid"),
		outputSlot: opaqueKey,
		schemaId: opaqueKey
	}),
	z.strictObject({
		kind: z.literal("commit-resolved"),
		outputSlot: opaqueKey
	}),
	z.strictObject({
		kind: z.literal("command-exit-zero"),
		checkId: ids.check
	}),
	z.strictObject({
		kind: z.literal("required-tests-pass"),
		checkId: ids.check
	}),
	z.strictObject({
		kind: z.literal("coverage-threshold"),
		lines: z.number().min(80).max(100),
		branches: z.number().min(70).max(100)
	}),
	z.strictObject({
		kind: z.literal("human-decision"),
		checkId: ids.check
	})
]);
const workRevision = z.strictObject({
	workId: ids.work,
	workRevision: revision,
	role,
	goal: nonemptyText,
	inputRefs: z.array(z.discriminatedUnion("kind", [artifactRef.extend({ kind: z.literal("artifact") }), z.strictObject({
		kind: z.literal("output"),
		workId: ids.work,
		outputSlot: opaqueKey
	})])).max(64),
	outputSpec: z.array(z.strictObject({
		slot: opaqueKey,
		schemaId: opaqueKey
	})).min(1).max(64),
	completionChecks: z.array(completionCheck).min(1).max(64),
	dependencies: z.array(z.strictObject({
		workId: ids.work,
		requiredOutcome: z.enum(["success", "completed-with-findings"])
	})).max(29),
	writeScope: z.array(relativeFile).max(64),
	estimatedResources: z.strictObject({
		cpu: z.number().positive().max(64),
		memoryMiB: revision,
		timeoutMs: revision
	}),
	requirementIds: z.array(ids.requirement).min(1).max(200)
});
const planDraft = z.strictObject({
	requirementRevision: revision,
	works: z.array(workRevision).min(1).max(30)
});
const productOutput = z.strictObject({
	schemaVersion: z.literal("devmesh.requirements.v1"),
	role: z.literal("product"),
	requirements: z.array(requirement).min(1),
	assumptions: z.array(nonemptyText),
	questions: z.array(question)
});
const architectOutput = z.strictObject({
	schemaVersion: z.literal("devmesh.architecture.v1"),
	role: z.literal("architect"),
	interfaces: z.array(z.strictObject({
		name: opaqueKey,
		specificationRef: artifactRef
	})),
	planDraft,
	risks: z.array(nonemptyText),
	capabilityFit: z.strictObject({
		supported: z.boolean(),
		gaps: z.array(nonemptyText)
	})
});
const developerOutput = z.strictObject({
	schemaVersion: z.literal("devmesh.development-result.v1"),
	role: z.literal("developer"),
	baseCommit: gitCommit,
	resultCommit: gitCommit,
	changedFiles: z.array(relativeFile),
	checkRefs: z.array(artifactRef),
	unverified: z.array(nonemptyText),
	handoffProposal: z.strictObject({
		targetRole: role,
		goal: nonemptyText,
		artifactRefs: z.array(artifactRef),
		reason: nonemptyText
	}).nullable()
});
const commitReportRef = artifactRef.extend({ targetCommit: gitCommit });
const testerOutput = z.strictObject({
	schemaVersion: z.literal("devmesh.test-result.v1"),
	role: z.literal("tester"),
	targetCommit: gitCommit,
	caseResults: z.array(z.strictObject({
		checkId: ids.check,
		requirementIds: z.array(ids.requirement).min(1),
		status: z.enum([
			"PASSED",
			"FAILED",
			"SKIPPED",
			"MISSING"
		]),
		reportRef: commitReportRef
	})).min(1),
	coverageRef: commitReportRef,
	defects: z.array(z.strictObject({
		id: opaqueKey,
		severity: z.enum([
			"LOW",
			"MEDIUM",
			"HIGH",
			"CRITICAL"
		]),
		description: nonemptyText,
		evidenceRefs: z.array(artifactRef).min(1)
	})),
	buildRef: commitReportRef,
	previewRef: commitReportRef.optional()
}).superRefine((result, ctx) => {
	if ([
		result.coverageRef,
		result.buildRef,
		...result.previewRef ? [result.previewRef] : [],
		...result.caseResults.map((c) => c.reportRef)
	].some((report) => report.targetCommit !== result.targetCommit)) ctx.addIssue({
		code: "custom",
		path: ["targetCommit"],
		message: "All reports must bind the exact targetCommit"
	});
});
const roleOutput = z.discriminatedUnion("role", [
	productOutput,
	architectOutput,
	developerOutput,
	testerOutput
]);
const workDelegation = z.strictObject({
	schemaVersion: z.literal("devmesh.work.v1"),
	operationId: ids.operation,
	runId: ids.run,
	workId: ids.work,
	workRevision: revision,
	attemptId: ids.attempt,
	endpointId: opaqueKey,
	endpointRevision: revision,
	grantId: ids.grant,
	activationId: ids.activation,
	runEpoch: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
	workEpoch: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
	requirementRevision: revision,
	planRevision: revision,
	inputManifestId: ids.manifest,
	roleSnapshotId: ids.roleSnapshot,
	originRole: role,
	targetRole: role,
	requestedOutputSchema: opaqueKey
});
const invocationDelegation = z.strictObject({
	schemaVersion: z.literal("devmesh.invocation.v1"),
	operationId: ids.operation,
	invocationId: ids.invocation,
	invocationAttemptId: ids.invocationAttempt,
	invocationEpoch: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
	activationId: ids.activation,
	grantId: ids.grant,
	endpointId: opaqueKey,
	endpointRevision: revision,
	inputManifestRef: artifactRef,
	definitionSnapshotRef: artifactRef
});
const inputManifest = z.strictObject({
	schemaVersion: z.literal("devmesh.input-manifest.v1"),
	requirements: z.array(z.strictObject({
		requirementId: ids.requirement,
		sha256
	})),
	interfaces: z.array(artifactRef),
	artifacts: z.array(artifactRef),
	codeCommit: gitCommit.nullable(),
	templateVersion: opaqueKey,
	checkConfigHash: sha256,
	decisionIds: z.array(ids.decision)
});
//#endregion
//#region src/input.ts
const workbenchSourceView = z.strictObject({
	runId: ids.run,
	ref: sourceRef,
	label: z.string().min(1).max(512),
	body: z.discriminatedUnion("kind", [z.strictObject({
		kind: z.literal("text"),
		text: z.string().max(2 * 1024 * 1024)
	}), z.strictObject({
		kind: z.literal("requirement"),
		requirement
	})])
}).superRefine((v, c) => {
	if (v.ref.kind === "requirement" ? v.body.kind !== "requirement" || v.body.requirement.id !== v.ref.requirementId : v.body.kind !== "text") c.addIssue({
		code: "custom",
		message: "Source body does not match reference"
	});
});
const inputLimits = Object.freeze({
	textCodePoints: 2e4,
	attachments: 3,
	attachmentBytes: 2 * 1024 * 1024,
	jsonBytes: 256 * 1024
});
const attachmentIds = z.array(ids.attachment).max(inputLimits.attachments).refine((v) => new Set(v).size === v.length, "Duplicate attachment IDs");
const attachmentName = z.string().regex(/^[^\x00-\x1f\x7f/\\:]{1,80}$/u).refine((v) => v.trim().length > 0 && v !== "." && v !== "..", "Invalid display name");
const initialInput = z.strictObject({
	text: z.union([inputText, z.literal("")]),
	attachmentIds
});
const createProjectInput = z.strictObject({
	initialRequest: initialInput,
	clientDraftId: z.uuid(),
	name: projectName.optional()
}).refine((v) => v.initialRequest.text.trim().length > 0 || v.initialRequest.attachmentIds.length > 0, "Input requires text or an attachment");
const createTaskInput = z.strictObject({
	kind: z.enum(["ITERATION", "FIX"]),
	title: taskTitle,
	goal: initialInput,
	baseAcceptedReleaseId: ids.release,
	clientDraftId: z.uuid()
}).refine((v) => v.goal.text.trim().length > 0 || v.goal.attachmentIds.length > 0, "Input requires text or an attachment");
const saveMessageInput = z.strictObject({
	text: inputText.refine((v) => v.trim().length > 0, "Message cannot be blank"),
	attachmentIds,
	clientMessageId: z.uuid(),
	intentHint: z.enum([
		"query",
		"change",
		"unsure"
	]).optional()
});
const uploadMetadata = z.strictObject({
	clientAttachmentId: z.uuid(),
	name: attachmentName
});
const attachmentView = z.strictObject({
	attachmentId: ids.attachment,
	clientAttachmentId: z.uuid(),
	name: attachmentName,
	byteSize: z.number().int().min(1).max(inputLimits.attachmentBytes),
	state: z.enum(["READY", "REMOVED"]),
	createdAt: timestamp
});
const inputOperation = z.strictObject({
	operationId: ids.operation,
	status: operationStatus,
	result: z.record(z.string(), z.json()).nullable()
});
const inputOperationLookup = z.strictObject({
	principalId: opaqueKey,
	scope: opaqueKey,
	key: z.uuid(),
	operation: inputOperation.nullable()
});
const workspaceView = z.strictObject({
	project: z.strictObject({
		projectId: ids.project,
		name: projectName,
		revision,
		acceptedReleaseId: ids.release.nullable()
	}),
	run: z.strictObject({
		runId: ids.run,
		projectId: ids.project,
		taskId: ids.userTask,
		resourceRevision: revision,
		runEpoch: revision,
		controlRevision: revision,
		phase: z.string(),
		controlGate: z.string(),
		terminalOutcome: z.string().nullable(),
		currentPlanRevision: revision.nullable(),
		currentRequirementRevision: revision.nullable(),
		eventSeq: epoch
	}),
	mode: z.enum(["current", "history"]),
	membership: z.enum([
		"owner",
		"operator",
		"viewer"
	]),
	allowedActions: z.array(z.enum([
		"saveMessage",
		"createTask",
		"answerQuestions"
	])),
	preparation: z.strictObject({
		understandingAvailable: z.boolean(),
		requiredOpenQuestions: epoch,
		pending: z.boolean()
	}),
	eventCursor: epoch,
	messages: z.array(z.strictObject({
		messageId: ids.message,
		author: opaqueKey,
		bodyArtifactId: ids.artifact,
		clientMessageId: z.string(),
		createdAt: timestamp,
		attachmentIds,
		intentHint: z.enum([
			"query",
			"change",
			"unsure"
		]).nullable(),
		text: z.union([inputText, z.literal("")])
	})).max(200),
	nextMessageCursor: z.string().nullable(),
	templateBaseline: z.strictObject({
		version: opaqueKey,
		baseCommit: z.string().regex(/^[a-f0-9]{40}$/)
	})
});
//#endregion
//#region src/preparation.ts
const unique = (values) => new Set(values).size === values.length;
const preparationRole = z.enum(["product", "architect"]);
const preparationQuestion = question.extend({
	prompt: inputText,
	sourceRefs: z.array(sourceRef).min(1).max(64),
	options: z.array(z.strictObject({
		id: opaqueKey,
		label: inputText
	})).max(32).default([])
}).superRefine((q, ctx) => {
	if (!unique(q.options.map((o) => o.id))) ctx.addIssue({
		code: "custom",
		path: ["options"],
		message: "Options must have unique IDs"
	});
	if (q.defaultOption !== void 0 && !q.options.some((o) => o.id === q.defaultOption)) ctx.addIssue({
		code: "custom",
		path: ["defaultOption"],
		message: "Default must name an available option"
	});
});
const understandingOutput = z.strictObject({
	schemaVersion: z.literal("devmesh.understanding.v1"),
	role: z.literal("product"),
	requirements: z.array(requirement).min(1).max(200),
	assumptions: z.array(inputText).max(100),
	questions: z.array(preparationQuestion).max(100),
	conflicts: z.array(z.strictObject({
		id: opaqueKey,
		description: inputText,
		sourceRefs: z.array(sourceRef).min(2).max(64),
		questionId: ids.question
	})).max(100)
}).superRefine((v, ctx) => {
	if (!unique(v.requirements.map((r) => r.id))) ctx.addIssue({
		code: "custom",
		path: ["requirements"],
		message: "Requirement IDs must be unique"
	});
	if (!unique(v.questions.map((q) => q.id))) ctx.addIssue({
		code: "custom",
		path: ["questions"],
		message: "Question IDs must be unique"
	});
	if (!unique(v.conflicts.map((c) => c.id))) ctx.addIssue({
		code: "custom",
		path: ["conflicts"],
		message: "Conflict IDs must be unique"
	});
	for (const [i, c] of v.conflicts.entries()) {
		if (!v.questions.some((q) => q.id === c.questionId && q.required)) ctx.addIssue({
			code: "custom",
			path: [
				"conflicts",
				i,
				"questionId"
			],
			message: "Conflicting sources require an explicit required question"
		});
		if (new Set(c.sourceRefs.map((ref) => ref.kind === "message" ? ref.messageId : ref.kind === "artifact" ? ref.artifactId : `${ref.requirementId}:${ref.requirementRevision}`)).size < 2) ctx.addIssue({
			code: "custom",
			path: [
				"conflicts",
				i,
				"sourceRefs"
			],
			message: "A conflict requires two distinct sources"
		});
	}
});
const answerQuestionsInput = z.strictObject({ answers: z.array(z.strictObject({
	questionId: ids.question,
	questionRevision: revision,
	value: z.json()
})).min(1).max(100) }).superRefine((v, ctx) => {
	if (!unique(v.answers.map((a) => a.questionId))) ctx.addIssue({
		code: "custom",
		path: ["answers"],
		message: "An answer batch must contain each question once"
	});
	if (new TextEncoder().encode(JSON.stringify(v)).byteLength > 128 * 1024) ctx.addIssue({
		code: "custom",
		message: "Answer batch exceeds 128 KiB"
	});
});
const retryUnderstandingInput = z.strictObject({ failedInterpretationOperationId: ids.operation });
const understandingView = z.strictObject({
	runId: ids.run,
	requirementRevision: revision.nullable(),
	understanding: understandingOutput.nullable(),
	questions: z.array(z.strictObject({
		questionId: ids.question,
		questionRevision: revision,
		requirementBasis: revision,
		state: z.enum([
			"OPEN",
			"ANSWERED",
			"SUPERSEDED"
		]),
		content: preparationQuestion,
		answer: z.strictObject({
			answerId: opaqueKey,
			value: z.json(),
			actor: opaqueKey,
			createdAt: timestamp
		}).nullable()
	})).max(100),
	jobs: z.array(z.strictObject({
		jobId: ids.job,
		operationId: ids.operation,
		purpose: z.enum([
			"UNDERSTAND",
			"INTERPRET",
			"PLAN"
		]),
		role: preparationRole,
		state: opaqueKey,
		retryOf: ids.job.nullable(),
		errorCode: opaqueKey.nullable(),
		resultArtifactId: ids.artifact.nullable()
	})).max(50),
	pendingInputCount: epoch,
	answerInterventions: epoch
});
const preparationProfile = z.strictObject({
	providerId: opaqueKey,
	model: opaqueKey,
	promptHash: sha256,
	providerHash: sha256,
	maxOutputTokens: z.number().int().positive().max(32768),
	tokenLimit: z.number().int().positive(),
	maxInputBytes: z.number().int().min(1024).max(2 * 1024 * 1024)
});
const preparationDelegation = z.strictObject({
	schemaVersion: z.literal("devmesh.preparation.v1"),
	operationId: ids.operation,
	jobId: ids.job,
	preparationAttemptId: opaqueKey,
	runId: ids.run,
	runEpoch: epoch,
	activationId: ids.activation,
	grantId: ids.grant,
	endpointId: opaqueKey,
	endpointRevision: revision,
	role: preparationRole,
	inputHash: sha256,
	profileHash: sha256,
	basisHash: sha256
});
const preparationSource = z.strictObject({
	ref: sourceRef,
	contentHash: sha256,
	byteSize: z.number().int().nonnegative().max(2 * 1024 * 1024),
	label: z.string().min(1).max(512)
});
const preparationInput = z.strictObject({
	schemaVersion: z.literal("devmesh.preparation-input.v1"),
	runId: ids.run,
	role: preparationRole,
	basisHash: sha256,
	requirementRevision: revision.nullable(),
	baseCommit: gitCommit,
	sources: z.array(preparationSource).min(1).max(256),
	answerIds: z.array(opaqueKey).max(1e3)
});
//#endregion
//#region src/source-path.ts
const unsafeQualityPath = (v) => [...v].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) || v.includes("\\") || v.includes(":");
const qualityPath = z.string().min(1).max(512).refine((v) => !unsafeQualityPath(v) && v.normalize("NFC") === v && v.split("/").every((p) => p !== "" && p !== "." && p !== ".." && !/[. ]$/.test(p)), "Canonical relative source path required");
//#endregion
//#region src/delivery.ts
const previewImageLimits = {
	manifestBytes: 1024 * 1024,
	configBytes: 1024 * 1024,
	blobBytes: 64 * 1024 * 1024,
	totalBytes: 256 * 1024 * 1024,
	layers: 16
};
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const size = z.number().int().min(0).max(previewImageLimits.blobBytes);
const descriptor = z.object({
	mediaType: z.string(),
	digest,
	size
});
const previewImageManifest = z.object({
	schemaVersion: z.literal(2),
	mediaType: z.literal("application/vnd.oci.image.manifest.v1+json"),
	config: descriptor.extend({ mediaType: z.literal("application/vnd.oci.image.config.v1+json") }),
	layers: z.array(descriptor.extend({ mediaType: z.enum(["application/vnd.oci.image.layer.v1.tar", "application/vnd.oci.image.layer.v1.tar+gzip"]) })).min(1).max(previewImageLimits.layers)
});
const previewImageConfig = z.object({
	os: z.literal("linux"),
	architecture: z.enum(["amd64", "arm64"]),
	config: z.object({ Labels: z.record(z.string(), z.string()) }),
	rootfs: z.object({
		type: z.literal("layers"),
		diff_ids: z.array(digest).min(1).max(previewImageLimits.layers)
	})
});
const previewImageIdentity = z.strictObject({
	schemaVersion: z.literal("devmesh.preview-image-identity.v1"),
	imageDigest: digest,
	configDigest: digest,
	targetCommit: gitCommit,
	buildArtifactHash: sha256,
	os: z.literal("linux"),
	architecture: z.enum(["amd64", "arm64"]),
	layers: z.array(z.strictObject({
		digest,
		diffId: digest,
		byteSize: size,
		expandedByteSize: size
	})).min(1).max(previewImageLimits.layers)
});
const baseData = {
	schemaVersion: z.literal("devmesh.data-plan.v1"),
	runId: ids.run,
	codeCommit: gitCommit,
	requirementRevision: revision,
	planRevision: revision,
	templateVersion: opaqueKey,
	checkConfigHash: sha256
};
const initialData = z.enum(["EMPTY", "DEMO"]);
const deliveryDataPlan = z.discriminatedUnion("strategy", [
	z.strictObject({
		...baseData,
		strategy: z.literal("INITIAL"),
		initialData,
		sourceReleaseId: z.null(),
		migrationRef: z.null(),
		replacementDecisionId: z.null()
	}),
	z.strictObject({
		...baseData,
		strategy: z.literal("PRESERVE_MIGRATE"),
		initialData: z.null(),
		sourceReleaseId: ids.release,
		migrationRef: artifactRef,
		replacementDecisionId: z.null()
	}),
	z.strictObject({
		...baseData,
		strategy: z.literal("REPLACE"),
		initialData,
		sourceReleaseId: ids.release,
		migrationRef: z.null(),
		replacementDecisionId: ids.decision
	})
]);
const coreKeys = [
	"build",
	"image.manifest",
	"image.config",
	"data.plan",
	"run.instructions",
	"collaboration.record",
	"role.configuration"
];
const deliveryProfileFields = {
	producerId: opaqueKey,
	architecture: z.enum(["amd64", "arm64"]),
	materials: z.array(z.strictObject({
		key: opaqueKey,
		path: qualityPath
	})).min(8).max(coreKeys.length + previewImageLimits.layers)
};
function validateProfile(p, c) {
	const fail = (message) => c.addIssue({
		code: "custom",
		message
	}), keys = p.materials.map((m) => m.key), paths = p.materials.map((m) => m.path.toLowerCase());
	if (new Set(keys).size !== keys.length || new Set(paths).size !== paths.length) fail("Unique delivery material keys and paths required");
	if (coreKeys.some((key) => !keys.includes(key))) fail("All fixed delivery materials required");
	const layers = keys.filter((key) => !coreKeys.includes(key)).sort((a, b) => Number(a.slice(12)) - Number(b.slice(12)));
	if (!layers.length || layers.some((key, index) => key !== "image.layer." + index)) fail("Contiguous bounded image layer outputs required");
}
function profileSchema() {
	return z.strictObject(deliveryProfileFields);
}
const releaseDeliveryProfile = profileSchema().superRefine(validateProfile);
const releaseDeliveryPolicy = z.strictObject({
	schemaVersion: z.literal("devmesh.delivery-policy.v1"),
	templateVersion: opaqueKey,
	checkConfigHash: sha256,
	...deliveryProfileFields
}).superRefine(validateProfile);
//#endregion
//#region src/release-acceptance.ts
const acceptanceCandidateBasis = z.strictObject({
	candidateRevision: revision,
	manifestHash: sha256,
	reviewHash: sha256,
	expectedAcceptedReleaseId: ids.release.nullable(),
	dataPlanHash: sha256
});
const beginAcceptanceInput = acceptanceCandidateBasis.extend({ policyHash: sha256 });
const confirmAcceptanceReplacementInput = acceptanceCandidateBasis.extend({
	decisionId: ids.decision,
	confirmation: z.literal("REPLACE_ACCEPTED_DATA")
});
const closeUnsentAcceptanceInput = z.strictObject({ requestHash: sha256 });
const abortAcceptanceInput = z.strictObject({
	requestHash: sha256,
	expectedPreparationRevision: revision,
	reason: z.string().trim().min(1).max(2e3),
	confirmation: z.literal("ABORT_ACCEPTANCE_PREPARATION")
});
const acceptCandidateInput = acceptanceCandidateBasis.extend({
	runId: ids.run,
	preparationOperationId: ids.operation,
	requestHash: sha256,
	expectedPreparationRevision: revision,
	expectedObservationSequence: revision,
	proofHash: sha256,
	confirmation: z.literal("ACCEPT_RELEASE")
});
const acceptanceBasisView = acceptanceCandidateBasis.extend({
	projectId: ids.project,
	runId: ids.run,
	candidateId: ids.candidate,
	codeCommit: gitCommit,
	dataPlan: deliveryDataPlan,
	currentAcceptedReleaseId: ids.release.nullable(),
	resourceRevision: revision,
	qualification: z.enum(["CURRENT", "STALE"]),
	configured: z.boolean(),
	policyHash: sha256.nullable(),
	replacementConfirmed: z.boolean(),
	blockedByPreparationOperationId: ids.operation.nullable(),
	canManage: z.boolean(),
	canPrepare: z.boolean(),
	canConfirmReplacement: z.boolean(),
	reason: z.enum([
		"NOT_OWNER",
		"REVIEW_REQUIRED",
		"CANDIDATE_STALE",
		"SOURCE_CHANGED",
		"BACKEND_UNAVAILABLE",
		"REPLACEMENT_CONFIRMATION_REQUIRED",
		"PREPARATION_UNRESOLVED",
		"EFFECT_UNRESOLVED"
	]).nullable()
});
const acceptancePreparationView = z.strictObject({
	operationId: ids.operation,
	runId: ids.run,
	candidateId: ids.candidate,
	releaseId: ids.release,
	requestHash: sha256,
	revision,
	state: z.enum([
		"PREPARED",
		"SENT",
		"UNKNOWN",
		"FAILED"
	]),
	resolution: z.enum([
		"UNRESOLVED",
		"UNSENT_FAILED",
		"COMMITTED",
		"ABORTING",
		"ABORTED"
	]),
	qualification: z.enum(["CURRENT", "STALE"]),
	basis: acceptanceCandidateBasis,
	createdAt: timestamp,
	updatedAt: timestamp,
	acceptanceOperationId: ids.operation.nullable(),
	readiness: z.strictObject({
		state: z.enum([
			"UNPREPARED",
			"READY",
			"UNAVAILABLE",
			"STALE"
		]),
		sequence: z.number().int().nonnegative().safe(),
		proofHash: sha256.nullable(),
		checkedAt: timestamp.nullable()
	}),
	resourceRevision: revision,
	canCommit: z.boolean(),
	canCloseUnsent: z.boolean(),
	canAbort: z.boolean()
});
const acceptancePreparationList = z.strictObject({
	items: z.array(z.strictObject({
		sequence: revision,
		preparation: acceptancePreparationView
	})).max(100),
	nextSequence: revision.nullable()
});
const acceptanceReplacementReceipt = z.strictObject({
	decisionId: ids.decision,
	operationId: ids.operation
});
const acceptanceAbortReceipt = z.strictObject({
	operationId: ids.operation,
	preparationOperationId: ids.operation,
	decisionHash: sha256,
	reason: z.string().min(1).max(2e3),
	decidedAt: timestamp,
	decisionState: z.literal("RECORDED")
});
const acceptedReleaseView = z.strictObject({
	releaseId: ids.release,
	projectId: ids.project,
	runId: ids.run,
	candidateId: ids.candidate,
	candidateRevision: revision,
	manifestHash: sha256,
	reviewHash: sha256,
	preparationOperationId: ids.operation,
	acceptanceOperationId: ids.operation,
	requestHash: sha256,
	proofHash: sha256,
	datasetId: ids.dataset,
	previousReleaseId: ids.release.nullable(),
	acceptedBy: opaqueKey,
	acceptedAt: timestamp,
	acceptanceState: z.literal("ACCEPTED"),
	publicationState: z.literal("PENDING")
});
const acceptanceCommitReceipt = z.strictObject({
	operationId: ids.operation,
	status: z.literal("SUCCEEDED"),
	result: acceptedReleaseView,
	links: z.strictObject({ preparation: z.string().regex(/^\/api\/v1\/runs\/run_[A-Za-z0-9_-]+\/candidates\/candidate_[A-Za-z0-9_-]+\/acceptance\/preparations\/op_[A-Za-z0-9_-]+$/) })
});
//#endregion
//#region src/commands.ts
const idempotencyKey = z.uuid();
const commandBodies = {
	CreateProject: createProjectInput,
	SaveMessage: saveMessageInput,
	AnswerQuestions: answerQuestionsInput,
	ConfirmPlan: z.strictObject({
		requirementRevision: revision,
		reviewHash: sha256,
		carryForwardHash: sha256.optional()
	}),
	PlanFeedback: z.strictObject({
		text: inputText,
		workIds: z.array(ids.work).optional()
	}),
	ProposeChange: z.strictObject({
		proposedText: inputText,
		sourceMessageId: ids.message
	}),
	DecideChange: z.strictObject({
		action: z.enum(["confirm", "reject"]),
		analysisId: ids.analysis,
		basisHash: sha256
	}),
	PauseRun: z.strictObject({ reason: nonemptyText.optional() }),
	ResumeRun: z.strictObject({
		controlRevision: revision,
		recoveryReviewHash: sha256
	}),
	CancelRun: z.strictObject({ impactReviewHash: sha256 }),
	RetryWork: z.strictObject({
		runId: ids.run,
		failedAttemptId: ids.attempt,
		retryReviewHash: sha256
	}),
	RedoRun: z.strictObject({ redoReviewHash: sha256 }),
	AcceptCandidate: acceptCandidateInput
};
const targets = {
	creation: z.strictObject({
		kind: z.literal("creation"),
		namespace: opaqueKey
	}),
	run: z.strictObject({
		kind: z.literal("run"),
		projectId: ids.project,
		runId: ids.run
	}),
	plan: z.strictObject({
		kind: z.literal("plan"),
		projectId: ids.project,
		runId: ids.run,
		planRevision: revision
	}),
	work: z.strictObject({
		kind: z.literal("work"),
		projectId: ids.project,
		workId: ids.work
	}),
	change: z.strictObject({
		kind: z.literal("change"),
		projectId: ids.project,
		changeId: ids.change
	}),
	candidate: z.strictObject({
		kind: z.literal("candidate"),
		projectId: ids.project,
		candidateId: ids.candidate
	})
};
const commandTarget = z.discriminatedUnion("kind", [
	targets.creation,
	targets.run,
	targets.plan,
	targets.work,
	targets.change,
	targets.candidate
]);
const envelope = (type, target) => z.strictObject({
	schemaVersion: z.literal(1),
	type: z.literal(type),
	idempotencyKey,
	target: targets[target],
	payload: commandBodies[type]
});
const command = z.discriminatedUnion("type", [
	envelope("CreateProject", "creation"),
	envelope("SaveMessage", "run"),
	envelope("AnswerQuestions", "run"),
	envelope("ConfirmPlan", "plan"),
	envelope("PlanFeedback", "plan"),
	envelope("ProposeChange", "run"),
	envelope("DecideChange", "change"),
	envelope("PauseRun", "run"),
	envelope("ResumeRun", "run"),
	envelope("CancelRun", "run"),
	envelope("RetryWork", "work"),
	envelope("RedoRun", "run"),
	envelope("AcceptCandidate", "candidate")
]);
const operationReceipt = z.strictObject({
	operationId: ids.operation,
	status: operationStatus,
	resource: z.strictObject({
		projectId: ids.project,
		runId: ids.run,
		revision
	}),
	links: z.strictObject({ operation: z.string().regex(/^\/api\/v1\/operations\/op_[A-Za-z0-9_-]+$/) }),
	result: z.record(z.string(), z.json()).optional()
});
//#endregion
//#region src/workbench-delivery.ts
const workbenchCandidateSummary = z.strictObject({
	candidateId: ids.candidate,
	revision,
	manifestHash: sha256,
	codeCommit: gitCommit,
	createdAt: timestamp,
	qualification: z.enum(["CURRENT", "STALE"]),
	automaticStatus: z.literal("PASS"),
	reviewStatus: z.enum(["PENDING", "NOT_REQUIRED"])
});
const workbenchDeliveryView = z.strictObject({
	projectId: ids.project,
	runId: ids.run,
	resourceRevision: revision,
	projectRevision: revision,
	eventCursor: epoch,
	mode: z.enum(["current", "history"]),
	membership: z.enum([
		"owner",
		"operator",
		"viewer"
	]),
	candidates: z.array(workbenchCandidateSummary).max(20),
	nextRevision: revision.nullable(),
	selectedCandidate: workbenchCandidateSummary.nullable(),
	acceptedRelease: z.strictObject({
		releaseId: ids.release,
		runId: ids.run,
		candidateId: ids.candidate,
		codeCommit: gitCommit,
		acceptedAt: timestamp,
		isCurrentAccepted: z.literal(true)
	}).nullable()
}).superRefine((value, ctx) => {
	if (new Set(value.candidates.map((item) => item.candidateId)).size !== value.candidates.length || value.candidates.some((item, index) => index > 0 && item.revision <= value.candidates[index - 1].revision)) ctx.addIssue({
		code: "custom",
		message: "Candidate page must be unique and ordered by its exact revision"
	});
	if (value.nextRevision !== null && value.nextRevision !== value.candidates.at(-1)?.revision) ctx.addIssue({
		code: "custom",
		message: "Candidate cursor must refer to the end of this page"
	});
});
//#endregion
//#region src/plans.ts
const planIssue = z.strictObject({
	code: opaqueKey,
	path: z.string().min(1).max(512),
	workId: ids.work.optional(),
	relatedWorkId: ids.work.optional(),
	requirementId: ids.requirement.optional()
});
const planReviewView = z.strictObject({
	projectId: ids.project,
	runId: ids.run,
	resourceRevision: revision,
	planRevision: revision,
	requirementRevision: revision,
	reviewHash: sha256,
	baseCommit: gitCommit,
	plan: planDraft,
	mode: z.enum(["current", "history"]),
	canConfirm: z.boolean(),
	confirmation: z.strictObject({
		actor: opaqueKey,
		operationId: ids.operation,
		confirmedAt: timestamp
	}).nullable(),
	issues: z.array(planIssue),
	topology: z.array(z.strictObject({
		workId: ids.work,
		layer: z.number().int().min(0).max(29)
	})).max(30),
	carryForward: z.strictObject({
		sha256,
		round: z.number().int().min(1).max(2),
		sourcePlanRevision: revision,
		results: z.array(z.strictObject({
			workId: ids.work,
			workRevision: revision,
			attemptId: ids.attempt,
			sourcePlanRevision: revision,
			outcome: z.enum(["success", "completed-with-findings"]),
			codeCommit: gitCommit.nullable(),
			evidence: artifactRef,
			checkConfigHash: sha256,
			templateVersion: opaqueKey,
			inputManifestSha256: sha256,
			snapshotSha256: sha256,
			origin: z.enum(["FORMAL", "HISTORICAL"])
		})).max(30)
	}).optional()
});
const intersects = (a, b) => a === b || a.startsWith(b + "/") || b.startsWith(a + "/");
const sortKey = (a, b) => a < b ? -1 : a > b ? 1 : 0;
/** Validate a bounded declarative graph; capability and content facts come from the caller's snapshot. */
function inspectPlan(plan, facts) {
	const issues = [], works = /* @__PURE__ */ new Map(), order = /* @__PURE__ */ new Map();
	const used = /* @__PURE__ */ new Set(), verified = /* @__PURE__ */ new Set();
	const add = (code, path, workId, relatedWorkId) => {
		issues.push({
			code,
			path,
			...workId ? { workId } : {},
			...relatedWorkId ? { relatedWorkId } : {}
		});
	};
	for (const [i, w] of plan.works.entries()) if (works.has(w.workId)) add("WORK_ID_DUPLICATE", `works.${i}.workId`, w.workId);
	else {
		works.set(w.workId, w);
		order.set(w.workId, i);
	}
	for (const [i, w] of plan.works.entries()) {
		const path = `works.${i}`, deps = /* @__PURE__ */ new Set(), slots = /* @__PURE__ */ new Map(), requires = /* @__PURE__ */ new Set();
		for (const [j, dep] of w.dependencies.entries()) {
			if (!works.has(dep.workId) || dep.workId === w.workId) add("DEPENDENCY_INVALID", `${path}.dependencies.${j}`, w.workId, dep.workId);
			if (deps.has(dep.workId)) add("DEPENDENCY_DUPLICATE", `${path}.dependencies.${j}`, w.workId, dep.workId);
			deps.add(dep.workId);
		}
		for (const [j, slot] of w.outputSpec.entries()) {
			if (slots.has(slot.slot)) add("OUTPUT_SLOT_DUPLICATE", `${path}.outputSpec.${j}`, w.workId);
			slots.set(slot.slot, slot.schemaId);
		}
		for (const [j, input] of w.inputRefs.entries()) if (input.kind === "artifact" ? !facts.hasArtifact(input) : !deps.has(input.workId) || !works.get(input.workId)?.outputSpec.some((s) => s.slot === input.outputSlot)) add("WORK_INPUT_UNRESOLVED", `${path}.inputRefs.${j}`, w.workId, input.kind === "output" ? input.workId : void 0);
		for (const [j, check] of w.completionChecks.entries()) if ("outputSlot" in check && (!slots.has(check.outputSlot) || check.kind === "schema-valid" && slots.get(check.outputSlot) !== check.schemaId)) add("CHECK_OUTPUT_INVALID", `${path}.completionChecks.${j}`, w.workId);
		const tests = w.role === "tester" && w.completionChecks.some((check) => check.kind === "required-tests-pass");
		for (const [j, req] of w.requirementIds.entries()) {
			if (!facts.requirementIds.has(req) || requires.has(req)) add("WORK_REQUIREMENT_INVALID", `${path}.requirementIds.${j}`, w.workId);
			requires.add(req);
			used.add(req);
			if (tests) verified.add(req);
		}
		if (w.role !== "developer" && w.writeScope.length) add("ROLE_WRITE_DENIED", `${path}.writeScope`, w.workId);
		const limit = facts.roleLimits?.get(w.role), r = w.estimatedResources;
		if (facts.roleLimits && (!limit || r.cpu > limit.cpu || r.memoryMiB > limit.memoryMiB || r.timeoutMs > limit.timeoutMs)) add("ROLE_RESOURCE_UNAVAILABLE", `${path}.estimatedResources`, w.workId);
	}
	const layers = /* @__PURE__ */ new Map(), ancestors = /* @__PURE__ */ new Map(), active = /* @__PURE__ */ new Set();
	function visit(w) {
		if (active.has(w.workId)) {
			add("DAG_CYCLE", `works.${order.get(w.workId)}.dependencies`, w.workId);
			return;
		}
		if (layers.has(w.workId)) return;
		active.add(w.workId);
		const dependencies = /* @__PURE__ */ new Set();
		let layer = 0;
		for (const edge of w.dependencies) {
			const parent = works.get(edge.workId);
			if (!parent) continue;
			visit(parent);
			dependencies.add(edge.workId);
			for (const id of ancestors.get(edge.workId) ?? []) dependencies.add(id);
			layer = Math.max(layer, (layers.get(edge.workId) ?? -1) + 1);
		}
		active.delete(w.workId);
		layers.set(w.workId, layer);
		ancestors.set(w.workId, dependencies);
	}
	for (const w of works.values()) visit(w);
	for (const [i, a] of plan.works.entries()) for (const b of plan.works.slice(i + 1)) if (!ancestors.get(a.workId)?.has(b.workId) && !ancestors.get(b.workId)?.has(a.workId) && a.writeScope.some((x) => b.writeScope.some((y) => intersects(x.toLowerCase(), y.toLowerCase())))) add("WRITE_SCOPE_OVERLAP", `works.${i}.writeScope`, a.workId, b.workId);
	if (facts.requireDelivery) {
		for (const [i, w] of plan.works.entries()) if (w.role === "tester" && w.completionChecks.some((c) => c.kind === "required-tests-pass")) {
			if (!w.dependencies.some((d) => d.requiredOutcome === "success" && works.get(d.workId)?.completionChecks.some((c) => c.kind === "commit-resolved"))) add("VERIFICATION_BASIS_MISSING", `works.${i}.dependencies`, w.workId);
		}
	}
	for (const requirementId of facts.requirementIds) {
		if (!used.has(requirementId)) issues.push({
			code: "REQUIREMENT_UNCOVERED",
			path: "works",
			requirementId
		});
		if (facts.requireDelivery && !verified.has(requirementId)) issues.push({
			code: "REQUIRED_TEST_MISSING",
			path: "works",
			requirementId
		});
	}
	if (facts.requireDelivery && plan.works.some((w) => w.writeScope.length) && !plan.works.some((w) => w.role === "developer" && w.completionChecks.some((c) => c.kind === "commit-resolved"))) add("INTEGRATION_OUTPUT_MISSING", "works");
	return {
		issues,
		topology: issues.some((i) => i.code === "DAG_CYCLE") ? [] : [...works.values()].map((w) => ({
			workId: w.workId,
			layer: layers.get(w.workId) ?? 0
		})).sort((a, b) => a.layer - b.layer || sortKey(a.workId, b.workId))
	};
}
//#endregion
//#region src/pipeline.ts
const pipelineStage = z.strictObject({
	stageId: opaqueKey,
	kind: z.enum([
		"install",
		"unit",
		"e2e",
		"build",
		"preview"
	]),
	imageDigest: z.string().regex(/^[a-z0-9][a-z0-9._/:~-]*@sha256:[a-f0-9]{64}$/),
	resourceLimits: z.strictObject({
		cpu: z.number().positive().max(64),
		memoryMiB: z.number().int().min(64).max(131072),
		pids: z.number().int().min(16).max(256),
		temporaryMiB: z.number().int().min(16).max(10240),
		timeoutMs: z.number().int().min(100).max(6e5)
	}),
	networkPolicyRef: z.literal("none"),
	outputSpec: z.array(relativeFile).max(32)
});
const pipelineDefinition = z.strictObject({
	definitionId: opaqueKey,
	version: opaqueKey,
	stages: z.array(pipelineStage).min(1).max(8)
}).superRefine((v, ctx) => {
	if (new Set(v.stages.map((s) => s.stageId)).size !== v.stages.length) ctx.addIssue({
		code: "custom",
		path: ["stages"],
		message: "Stage identities must be unique"
	});
});
//#endregion
//#region src/quality.ts
const qualityLimits = {
	reportBytes: 8 * 1024 * 1024,
	files: 2048,
	positions: 2e5,
	tests: 2e4,
	jsonDepth: 48,
	jsonNodes: 5e5
};
const pattern = z.string().min(1).max(512).refine((v) => !unsafeQualityPath(v) && !v.startsWith("/") && !v.split("/").some((p) => p === ".." || p === "." || !p), "Relative bounded glob required");
const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const qualityLocation = z.strictObject({
	start: z.strictObject({
		line: count.min(1),
		column: count
	}),
	end: z.strictObject({
		line: count.min(1),
		column: count
	})
}).refine((v) => v.start.line < v.end.line || v.start.line === v.end.line && v.start.column <= v.end.column, "Location must be ordered");
const qualityBranch = z.strictObject({
	type: opaqueKey,
	loc: qualityLocation,
	locations: z.array(qualityLocation.nullable()).min(1).max(128)
});
const image = z.string().regex(/^[a-z0-9][a-z0-9._/:~-]*@sha256:[a-f0-9]{64}$/);
const qualityTestIdentity = z.strictObject({
	path: qualityPath,
	fullName: z.string().min(1).max(4096),
	requirementIds: z.array(ids.requirement).min(1).max(128)
});
const qualityProducer = z.strictObject({
	producerId: opaqueKey,
	command: z.array(z.string().min(1).max(1024)).min(1).max(32),
	imageDigest: image,
	pathPrefixes: z.array(z.string().min(1).max(1024).refine((v) => !v.includes("\\") && !v.endsWith("/") && !v.includes("/../") && !v.includes("/./") && (/^[A-Za-z]:\//.test(v) || v.startsWith("/")), "Fixed absolute normalized prefix required")).max(8)
});
const qualityPolicy = z.strictObject({
	schemaVersion: z.literal("devmesh.quality-policy.v1"),
	templateVersion: opaqueKey,
	delivery: releaseDeliveryProfile.optional(),
	producers: z.array(qualityProducer).min(1).max(16),
	reports: z.array(z.strictObject({
		reportId: opaqueKey,
		producerId: opaqueKey,
		format: z.enum(["istanbul-v1", "vitest-json-v1"]),
		path: qualityPath,
		sourceInclude: z.array(pattern).max(32)
	})).min(1).max(32),
	checks: z.array(z.strictObject({
		checkId: opaqueKey,
		kind: z.enum([
			"command",
			"tests",
			"coverage",
			"human"
		]),
		producerIds: z.array(opaqueKey).max(16),
		reportIds: z.array(opaqueKey).max(32),
		requiredTests: z.array(qualityTestIdentity).max(qualityLimits.tests)
	})).min(1).max(64),
	business: z.strictObject({
		include: z.array(pattern).min(1).max(32),
		exclude: z.array(z.strictObject({
			glob: pattern,
			reason: z.string().min(1).max(1024)
		})).max(32)
	}),
	thresholds: z.strictObject({
		lines: z.number().int().min(80).max(100),
		branches: z.number().int().min(70).max(100)
	}),
	zeroBranches: z.enum(["reject", "complete-map-proves-none"])
}).superRefine((v, c) => {
	const fail = (message) => c.addIssue({
		code: "custom",
		message
	});
	for (const [label, values] of [
		["producer", v.producers.map((x) => x.producerId)],
		["report", v.reports.map((x) => x.reportId)],
		["check", v.checks.map((x) => x.checkId)]
	]) if (new Set(values).size !== values.length) fail("Duplicate " + label);
	const producers = new Set(v.producers.map((x) => x.producerId)), reports = new Map(v.reports.map((x) => [x.reportId, x]));
	for (const r of v.reports) {
		if (!producers.has(r.producerId)) fail("Unknown report producer");
		if (r.format === "istanbul-v1" !== Boolean(r.sourceInclude.length)) fail("Coverage source scope is required; tests cannot define coverage");
	}
	for (const check of v.checks) {
		if (new Set(check.producerIds).size !== check.producerIds.length || new Set(check.reportIds).size !== check.reportIds.length) fail("Duplicate check input");
		if (check.producerIds.some((p) => !producers.has(p)) || check.reportIds.some((r) => !reports.has(r))) fail("Unknown check input");
		if (check.reportIds.some((r) => !check.producerIds.includes(reports.get(r).producerId))) fail("Report outside check producer scope");
		if (check.kind === "human" && (check.producerIds.length || check.reportIds.length || check.requiredTests.length)) fail("Human check cannot claim automatic evidence");
		if (check.kind !== "human" && !check.producerIds.length) fail("Automatic check requires original producer");
		if (check.kind === "tests" && (!check.requiredTests.length || !check.reportIds.length || check.reportIds.some((r) => reports.get(r)?.format !== "vitest-json-v1"))) fail("Test check needs explicit test identities and raw test reports");
		if (check.kind === "coverage" && (!check.reportIds.length || check.reportIds.some((r) => reports.get(r)?.format !== "istanbul-v1"))) fail("Coverage check needs raw coverage reports");
		if (check.kind === "coverage" && v.reports.some((r) => r.format === "istanbul-v1" && !check.reportIds.includes(r.reportId))) fail("Overall coverage requires all configured producers");
		if (check.kind !== "tests" && check.requiredTests.length) fail("Unexpected test identities");
		if (check.kind === "command" && check.reportIds.length) fail("Command check uses execution facts only");
		const tests = check.requiredTests.map((t) => t.path + "\0" + t.fullName);
		if (new Set(tests).size !== tests.length) fail("Duplicate required test");
	}
	if (!v.checks.some((x) => x.kind === "coverage") || !v.checks.some((x) => x.kind === "tests")) fail("Policy requires independent test and coverage checks");
	for (const r of v.reports) if (!v.checks.some((x) => x.reportIds.includes(r.reportId))) fail("Unused required report");
	for (const p of v.producers) if (!v.checks.some((x) => x.producerIds.includes(p.producerId))) fail("Unused producer");
	if (v.delivery && (!producers.has(v.delivery.producerId) || !v.checks.some((x) => x.kind === "command" && x.producerIds.includes(v.delivery.producerId)))) fail("Delivery requires an original approved command check producer");
});
const qualitySourceFile = z.strictObject({
	path: qualityPath,
	sha256,
	lineLengths: z.array(count.max(1024 * 1024)).min(1).max(1e5)
});
const qualitySourceScope = z.strictObject({
	schemaVersion: z.literal("devmesh.quality-source.v1"),
	targetCommit: gitCommit,
	checkConfigHash: sha256,
	sourceManifestSha256: sha256,
	topologySha256: sha256,
	gitManifest: z.array(qualitySourceFile).max(qualityLimits.files),
	businessFiles: z.array(z.strictObject({
		path: qualityPath,
		statements: z.array(qualityLocation).max(qualityLimits.positions),
		branches: z.array(qualityBranch).max(qualityLimits.positions)
	})).max(qualityLimits.files)
});
const qualityExecution = z.strictObject({
	producerId: opaqueKey,
	attemptId: ids.attempt,
	runnerId: opaqueKey,
	jobId: ids.job,
	operationId: ids.operation,
	requestHash: sha256,
	targetCommit: gitCommit,
	checkConfigHash: sha256,
	commandHash: sha256,
	imageDigest: image,
	state: z.enum([
		"QUEUED",
		"STARTING",
		"RUNNING",
		"STOPPING",
		"EXITED",
		"OUTCOME_UNKNOWN"
	]),
	exitCode: z.number().int().min(-2147483648).max(2147483647).nullable(),
	errorCode: z.string().min(1).max(128).nullable(),
	stopRequested: z.boolean(),
	startedAt: timestamp.nullable(),
	finishedAt: timestamp.nullable(),
	log: z.strictObject({
		sha256,
		size: count.max(16 * 1024 * 1024)
	})
});
const qualityReport = z.strictObject({
	reportId: opaqueKey,
	execution: qualityExecution,
	outputPath: qualityPath,
	sha256,
	size: count.max(qualityLimits.reportBytes)
});
const qualityCheckStatus = z.enum([
	"PASS",
	"FAIL",
	"MISSING",
	"STALE",
	"NOT_APPLICABLE",
	"PENDING"
]);
const metric = z.strictObject({
	covered: count,
	total: count,
	minimum: z.number().int().min(0).max(100),
	status: qualityCheckStatus
}).refine((v) => v.covered <= v.total, "Covered cannot exceed total");
const qualityEvaluation = z.strictObject({
	schemaVersion: z.literal("devmesh.quality-evaluation.v1"),
	targetCommit: gitCommit,
	checkConfigHash: sha256,
	sourceManifestSha256: sha256,
	topologySha256: sha256,
	automaticStatus: z.enum([
		"PASS",
		"FAIL",
		"MISSING",
		"STALE"
	]),
	reviewStatus: z.enum(["PENDING", "NOT_REQUIRED"]),
	checks: z.array(z.strictObject({
		checkId: opaqueKey,
		status: qualityCheckStatus,
		codes: z.array(opaqueKey).max(128),
		reportIds: z.array(opaqueKey).max(32),
		tests: z.strictObject({
			passed: count,
			failed: count,
			skipped: count,
			missing: count
		}).optional(),
		coverage: z.strictObject({
			lines: metric,
			branches: metric
		}).optional()
	})).max(64)
});
//#endregion
//#region src/events.ts
const eventPayloads = {
	InputSaved: z.strictObject({ messageId: ids.message }),
	UnderstandingUpdated: z.strictObject({ understandingRef: artifactRef }),
	QuestionAnswered: z.strictObject({
		questionId: ids.question,
		questionRevision: revision
	}),
	PlanPublished: z.strictObject({
		planRevision: revision,
		planRef: artifactRef
	}),
	PlanConfirmed: z.strictObject({
		planRevision: revision,
		decisionId: ids.decision
	}),
	WorkAdmitted: z.strictObject({
		workId: ids.work,
		attemptId: ids.attempt,
		activationId: ids.activation
	}),
	AttemptStateChanged: z.strictObject({
		attemptId: ids.attempt,
		state: attemptState
	}),
	A2ATaskObserved: z.strictObject({
		attemptId: ids.attempt,
		endpointId: opaqueKey,
		taskId: protocolTaskId,
		state: a2aTaskState
	}),
	ToolOperationUpdated: z.strictObject({
		toolOperationId: ids.operation,
		status: operationStatus
	}),
	IssueChanged: z.strictObject({
		issueId: opaqueKey,
		issueRevision: revision,
		toolOperationId: ids.operation,
		toolName: z.enum([
			"issues.create",
			"issues.linkFix",
			"issues.recordVerification"
		])
	}),
	PipelineChanged: z.strictObject({
		pipelineId: opaqueKey,
		toolOperationId: ids.operation,
		state: z.enum([
			"QUEUED",
			"RUNNING",
			"SUCCEEDED",
			"FAILED",
			"STOPPING",
			"CANCELLED",
			"OUTCOME_UNKNOWN"
		])
	}),
	ArtifactRegistered: z.strictObject({ artifact: artifactRef }),
	ChangeApplied: z.strictObject({
		changeId: ids.change,
		requirementRevision: revision,
		planRevision: revision
	}),
	DecisionSaved: z.strictObject({ decisionId: ids.decision }),
	ControlProgress: z.strictObject({
		state: runState,
		controlRevision: revision,
		runEpoch: epoch
	}),
	ConfigurationApplied: z.strictObject({ configurationRef: artifactRef }),
	CandidateUpdated: z.strictObject({
		candidateId: ids.candidate,
		state: z.enum([
			"PREPARING",
			"READY",
			"BLOCKED",
			"SUPERSEDED"
		])
	}),
	CandidateReviewRecorded: z.strictObject({
		candidateId: ids.candidate,
		resultId: opaqueKey
	}),
	CandidateRejected: z.strictObject({
		candidateId: ids.candidate,
		rejectionId: opaqueKey,
		resultId: opaqueKey,
		state: z.enum(["OPEN", "WITHDRAWN"])
	}),
	DatasetStateChanged: z.strictObject({
		datasetId: ids.dataset,
		state: z.enum([
			"PREPARING",
			"READY",
			"WRITE_FROZEN",
			"RETIRED",
			"MISSING"
		])
	}),
	PreviewOperationChanged: z.strictObject({
		previewId: ids.preview,
		state: z.enum([
			"STARTING",
			"READY",
			"STOPPING",
			"STOPPED",
			"EXPIRED",
			"UNKNOWN"
		])
	}),
	AcceptancePreparationChanged: z.strictObject({
		preparationId: ids.operation,
		state: z.enum([
			"PREPARED",
			"SENT",
			"UNKNOWN",
			"FAILED"
		])
	}),
	AcceptanceReadinessObserved: z.strictObject({
		preparationId: ids.operation,
		sequence: revision,
		state: z.enum(["READY", "UNKNOWN"])
	}),
	AcceptanceAbortRequested: z.strictObject({
		preparationId: ids.operation,
		abortOperationId: ids.operation
	}),
	AcceptanceAbortCompleted: z.strictObject({
		preparationId: ids.operation,
		abortOperationId: ids.operation
	}),
	DatasetWriteGateClosed: z.strictObject({
		datasetId: ids.dataset,
		preparationId: ids.operation,
		fence: revision
	}),
	ReleaseAccepted: z.strictObject({
		candidateId: ids.candidate,
		releaseId: ids.release
	}),
	ReleasePublicationChanged: z.strictObject({
		releaseId: ids.release,
		state: z.enum([
			"PENDING",
			"SENT",
			"UNKNOWN",
			"PUBLISHED"
		]),
		publicationRevision: revision,
		observationSequence: epoch,
		errorCode: opaqueKey.nullable()
	}),
	PreviewStateChanged: z.strictObject({
		previewId: ids.preview,
		state: z.enum([
			"PREPARING",
			"RUNNING",
			"STOPPING",
			"STOPPED",
			"FAILED",
			"OUTCOME_UNKNOWN"
		])
	}),
	ExportUpdated: z.strictObject({
		exportId: ids.export,
		status: operationStatus
	})
};
const base = {
	schemaVersion: z.literal(1),
	eventId: ids.event,
	projectId: ids.project,
	runId: ids.run,
	seq: revision,
	occurredAt: timestamp,
	observedAt: timestamp,
	timeSource: z.enum(["producer", "observed"]),
	resourceRevision: revision,
	requirementRevision: revision.nullable(),
	planRevision: revision.nullable(),
	operationId: ids.operation,
	workId: ids.work.optional(),
	attemptId: ids.attempt.optional()
};
const eventOf = (type) => z.strictObject({
	...base,
	type: z.literal(type),
	payload: eventPayloads[type]
});
const domainEvent = z.discriminatedUnion("type", [
	eventOf("ReleasePublicationChanged"),
	eventOf("AcceptanceAbortRequested"),
	eventOf("AcceptanceAbortCompleted"),
	eventOf("InputSaved"),
	eventOf("UnderstandingUpdated"),
	eventOf("QuestionAnswered"),
	eventOf("PlanPublished"),
	eventOf("PlanConfirmed"),
	eventOf("WorkAdmitted"),
	eventOf("AttemptStateChanged"),
	eventOf("A2ATaskObserved"),
	eventOf("ToolOperationUpdated"),
	eventOf("ArtifactRegistered"),
	eventOf("ChangeApplied"),
	eventOf("DecisionSaved"),
	eventOf("ControlProgress"),
	eventOf("ConfigurationApplied"),
	eventOf("CandidateUpdated"),
	eventOf("ReleaseAccepted"),
	eventOf("PreviewStateChanged"),
	eventOf("ExportUpdated"),
	eventOf("IssueChanged"),
	eventOf("PipelineChanged"),
	eventOf("CandidateReviewRecorded"),
	eventOf("CandidateRejected"),
	eventOf("DatasetStateChanged"),
	eventOf("PreviewOperationChanged"),
	eventOf("AcceptancePreparationChanged"),
	eventOf("AcceptanceReadinessObserved"),
	eventOf("DatasetWriteGateClosed")
]).superRefine((event, ctx) => {
	if (event.timeSource === "observed" && event.occurredAt !== event.observedAt) ctx.addIssue({
		code: "custom",
		path: ["occurredAt"],
		message: "Observed time must equal occurredAt when no producer time exists"
	});
	const payload = event.payload;
	for (const key of [
		"attemptId",
		"workId",
		"planRevision",
		"requirementRevision"
	]) if (payload[key] !== void 0 && event[key] !== void 0 && payload[key] !== event[key]) ctx.addIssue({
		code: "custom",
		path: ["payload", key],
		message: "Payload and persisted envelope must agree"
	});
});
const ephemeralTokenDelta = z.strictObject({
	kind: z.literal("token-delta"),
	streamId: opaqueKey,
	text: z.string()
});
//#endregion
//#region src/candidate-review.ts
const text = z.string().trim().min(1).max(4096);
const status = z.enum([
	"PASS",
	"FAIL",
	"MISSING",
	"STALE"
]);
const candidateReviewItem = z.strictObject({
	itemId: opaqueKey,
	itemHash: sha256,
	kind: z.enum([
		"requirement",
		"work-human",
		"quality-human"
	]),
	requirementIds: z.array(ids.requirement),
	subjectId: opaqueKey,
	checkId: opaqueKey,
	expected: z.string().min(1).max(32768)
});
const candidateHumanResult = z.strictObject({
	resultId: opaqueKey,
	operationId: ids.operation,
	candidateId: ids.candidate,
	candidateRevision: revision,
	manifestHash: sha256,
	item: candidateReviewItem,
	previousResultId: opaqueKey.nullable(),
	principalId: opaqueKey,
	verdict: z.enum(["PASS", "FAIL"]),
	procedure: text,
	expected: z.string().min(1).max(32768),
	observed: text,
	evidence: z.array(artifactRef).max(16),
	createdAt: timestamp
});
const candidateRejectionResult = z.strictObject({
	resultId: opaqueKey,
	operationId: ids.operation,
	candidateId: ids.candidate,
	candidateRevision: revision,
	manifestHash: sha256,
	rejectionId: opaqueKey,
	previousResultId: opaqueKey.nullable(),
	classification: z.enum(["IN_SCOPE_DEFECT", "SCOPE_CHANGE"]),
	state: z.enum(["OPEN", "WITHDRAWN"]),
	item: candidateReviewItem.nullable(),
	description: text,
	reason: text,
	evidence: z.array(artifactRef).max(16),
	principalId: opaqueKey,
	createdAt: timestamp,
	nextAction: z.enum([
		"REPAIR_REVIEW_REQUIRED",
		"CHANGE_REVIEW_REQUIRED",
		"NONE"
	]),
	applicationState: z.literal("NOT_APPLIED")
});
const candidateReviewView = z.strictObject({
	candidateId: ids.candidate,
	candidateRevision: revision,
	manifestHash: sha256,
	qualification: z.enum(["CURRENT", "STALE"]),
	resourceRevision: revision,
	automaticStatus: z.literal("PASS"),
	humanStatus: status,
	reviewHash: sha256,
	items: z.array(candidateReviewItem.extend({
		status,
		result: candidateHumanResult.nullable()
	})).min(1).max(2048),
	automaticChecks: z.array(z.strictObject({
		operationId: ids.operation,
		checkId: opaqueKey,
		status: z.string(),
		codes: z.array(z.string())
	})),
	rejections: z.array(candidateRejectionResult).max(100),
	rejectionStatus: z.enum(["OPEN", "NONE"]),
	canRecord: z.boolean(),
	canPrepareAcceptance: z.boolean(),
	canWithdrawRejections: z.boolean()
});
const candidateReviewEntry = z.strictObject({
	runId: ids.run,
	codeCommit: gitCommit,
	review: candidateReviewView
});
const recordCandidateReviewInput = candidateHumanResult.pick({
	manifestHash: true,
	previousResultId: true,
	verdict: true,
	procedure: true,
	expected: true,
	observed: true,
	evidence: true
}).extend({
	itemId: opaqueKey,
	itemHash: sha256
});
const recordCandidateRejectionInput = candidateRejectionResult.pick({
	manifestHash: true,
	rejectionId: true,
	previousResultId: true,
	classification: true,
	state: true,
	description: true,
	reason: true,
	evidence: true
}).extend({
	itemId: opaqueKey.nullable(),
	itemHash: sha256.nullable()
});
const candidateReviewHistory = z.strictObject({
	items: z.array(z.strictObject({
		sequence: revision,
		result: candidateHumanResult
	})).max(100),
	nextSequence: revision.nullable()
});
const candidateRejectionHistory = z.strictObject({
	items: z.array(z.strictObject({
		sequence: revision,
		result: candidateRejectionResult
	})).max(100),
	nextSequence: revision.nullable()
});
//#endregion
//#region src/release-export.ts
const createReleaseExportInput = z.strictObject({ format: z.literal("zip") });
const retryReleaseExportInput = z.strictObject({ expectedGeneration: z.number().int().nonnegative() });
const releaseExportView = z.strictObject({
	exportId: opaqueKey,
	releaseId: opaqueKey,
	runId: opaqueKey,
	candidateId: opaqueKey,
	codeCommit: gitCommit,
	cutoffSeq: z.number().int().nonnegative(),
	snapshotHash: sha256,
	state: z.enum([
		"QUEUED",
		"PACKING",
		"FAILED",
		"READY"
	]),
	generation: z.number().int().nonnegative(),
	leaseUntil: timestamp.nullable(),
	archiveHash: sha256.nullable(),
	archiveSize: z.number().int().nonnegative().nullable(),
	errorCode: z.string().nullable(),
	createdAt: timestamp,
	updatedAt: timestamp,
	canRetry: z.boolean()
}).superRefine((v, ctx) => {
	if (v.archiveHash === null !== (v.archiveSize === null) || v.state === "READY" && v.archiveHash === null) ctx.addIssue({
		code: "custom",
		message: "Ready export requires exact archive metadata"
	});
});
const releaseExportListView = z.strictObject({
	jobs: z.array(releaseExportView).max(200),
	nextCursor: opaqueKey.nullable()
});
const releaseExportEntryView = z.strictObject({
	releaseId: opaqueKey,
	runId: opaqueKey,
	candidateId: opaqueKey,
	codeCommit: gitCommit,
	acceptedAt: timestamp,
	isCurrentAccepted: z.boolean()
});
//#endregion
//#region src/release-access.ts
const secureOrigin$1 = z.url().refine((value) => {
	try {
		const u = new URL(value);
		return u.protocol === "https:" && u.origin === value;
	} catch {
		return false;
	}
}, { message: "Expected canonical HTTPS origin" });
const releaseAccessInput = z.strictObject({});
const releaseAccessTicket = z.strictObject({
	ticket: z.string().regex(/^dmr_ticket\.[A-Za-z0-9_-]{43}$/),
	releaseOrigin: secureOrigin$1,
	expiresAt: timestamp,
	sessionExpiresAt: timestamp
});
const releaseEntryView = z.strictObject({
	release: z.strictObject({
		releaseId: ids.release,
		runId: ids.run,
		candidateId: ids.candidate,
		datasetId: ids.dataset,
		revision,
		state: z.enum([
			"PENDING",
			"SENT",
			"UNKNOWN",
			"PUBLISHED"
		]),
		isCurrentAccepted: z.boolean(),
		publishedAt: timestamp.nullable()
	}),
	access: z.strictObject({
		state: z.enum([
			"AVAILABLE",
			"NOT_CONFIGURED",
			"RECOVERING",
			"NOT_CURRENT"
		]),
		canWrite: z.boolean(),
		releaseOrigin: secureOrigin$1.nullable(),
		checkedAt: timestamp.nullable()
	})
}).superRefine((v, ctx) => {
	if (v.access.state === "AVAILABLE" !== (v.access.releaseOrigin !== null) || v.access.state === "AVAILABLE" !== (v.access.checkedAt !== null) || v.access.canWrite && v.access.state !== "AVAILABLE" || v.access.state === "AVAILABLE" && (!v.release.isCurrentAccepted || v.release.state !== "PUBLISHED")) ctx.addIssue({
		code: "custom",
		message: "Available access requires current published identity and a live check"
	});
});
//#endregion
//#region src/preview.ts
const secureOrigin = z.url().refine((value) => {
	try {
		const u = new URL(value);
		return u.protocol === "https:" && u.origin === value;
	} catch {
		return false;
	}
}, { message: "Expected canonical HTTPS origin" });
const previewAccessInput = z.strictObject({});
const previewAccessTicket = z.strictObject({
	ticket: z.string().regex(/^dmp_ticket\.[A-Za-z0-9_-]{43}$/),
	previewOrigin: secureOrigin,
	expiresAt: timestamp,
	sessionExpiresAt: timestamp
});
const previewEntryView = z.strictObject({
	preview: z.strictObject({
		previewId: ids.preview,
		runId: ids.run,
		candidateId: ids.candidate,
		datasetId: ids.dataset,
		revision,
		state: z.enum([
			"STARTING",
			"READY",
			"STOPPING",
			"STOPPED",
			"EXPIRED",
			"UNKNOWN"
		]),
		expiresAt: timestamp,
		healthState: z.enum([
			"HEALTHY",
			"UNHEALTHY",
			"CREATED",
			"EXITED",
			"REMOVED",
			"UNKNOWN"
		]),
		healthCheckedAt: timestamp.nullable()
	}),
	access: z.strictObject({
		state: z.enum([
			"AVAILABLE",
			"NOT_CONFIGURED",
			"RECOVERING",
			"STARTING",
			"STOPPING",
			"STOPPED",
			"EXPIRED",
			"UNKNOWN"
		]),
		canWrite: z.boolean(),
		previewOrigin: secureOrigin.nullable()
	})
}).superRefine((value, ctx) => {
	if (value.access.state === "AVAILABLE" !== (value.access.previewOrigin !== null) || value.access.canWrite && value.access.state !== "AVAILABLE") ctx.addIssue({
		code: "custom",
		message: "Only available access has a preview origin or write authority"
	});
});
const createPreviewDatasetInput = z.strictObject({
	manifestHash: sha256,
	policyHash: sha256
});
const createPreviewIntentInput = z.strictObject({
	manifestHash: sha256,
	datasetId: ids.dataset,
	expiresAt: timestamp
});
const stopPreviewIntentInput = z.strictObject({
	previewRevision: revision,
	impactReviewHash: sha256,
	confirmation: z.literal("STOP_PREVIEW")
});
const previewDatasetManagement = z.strictObject({
	datasetId: ids.dataset,
	runId: ids.run,
	candidateId: ids.candidate,
	operationId: ids.operation,
	state: z.enum([
		"PREPARING",
		"READY",
		"WRITE_FROZEN",
		"RETIRED",
		"MISSING"
	]),
	operationState: z.enum([
		"PREPARED",
		"SENT",
		"UNKNOWN",
		"SUCCEEDED",
		"FAILED"
	]),
	revision,
	sourceDatasetId: ids.dataset.nullable(),
	sourceReleaseId: ids.release.nullable(),
	schemaRevision: opaqueKey,
	snapshotAt: timestamp.nullable(),
	retentionUntil: timestamp,
	createdAt: timestamp,
	canStart: z.boolean()
});
const previewManagement = previewEntryView.shape.preview.extend({
	operationId: ids.operation,
	impactReviewHash: sha256,
	stopOperationId: ids.operation.nullable(),
	canStop: z.boolean()
});
const candidatePreviewWorkspace = z.strictObject({
	projectId: ids.project,
	runId: ids.run,
	candidateId: ids.candidate,
	candidateRevision: revision,
	manifestHash: sha256,
	qualification: z.enum(["CURRENT", "STALE"]),
	resourceRevision: revision,
	dataPlan: deliveryDataPlan,
	canManage: z.boolean(),
	configured: z.boolean(),
	policyHash: sha256.nullable(),
	canCreateDataset: z.boolean(),
	hasPendingEffects: z.boolean(),
	datasets: z.array(z.strictObject({
		sequence: revision,
		dataset: previewDatasetManagement
	})).max(20),
	nextDatasetSequence: revision.nullable(),
	previews: z.array(z.strictObject({
		sequence: revision,
		preview: previewManagement
	})).max(20),
	nextPreviewSequence: revision.nullable()
});
//#endregion
//#region src/openapi.ts
const schemas = {
	BeginAcceptance: beginAcceptanceInput,
	ConfirmAcceptanceReplacement: confirmAcceptanceReplacementInput,
	CloseUnsentAcceptance: closeUnsentAcceptanceInput,
	AbortAcceptance: abortAcceptanceInput,
	AcceptanceBasis: acceptanceBasisView,
	AcceptancePreparation: acceptancePreparationView,
	AcceptancePreparationList: acceptancePreparationList,
	AcceptanceReplacementReceipt: acceptanceReplacementReceipt,
	AcceptanceAbortReceipt: acceptanceAbortReceipt,
	AcceptanceCommitReceipt: acceptanceCommitReceipt,
	CandidateReviewEntry: candidateReviewEntry,
	CandidateHumanResult: candidateHumanResult,
	CandidateRejectionResult: candidateRejectionResult,
	CandidateReviewHistory: candidateReviewHistory,
	CandidateRejectionHistory: candidateRejectionHistory,
	RecordCandidateReview: recordCandidateReviewInput,
	RecordCandidateRejection: recordCandidateRejectionInput,
	CreateReleaseExport: createReleaseExportInput,
	RetryReleaseExport: retryReleaseExportInput,
	ReleaseExport: releaseExportView,
	ReleaseExportList: releaseExportListView,
	Command: command,
	DomainEvent: domainEvent,
	EphemeralTokenDelta: ephemeralTokenDelta,
	ExecutionPermit: executionPermit,
	ExecutionOwner: executionOwner,
	RoleOutput: roleOutput,
	ProductOutput: productOutput,
	ArchitectOutput: architectOutput,
	DeveloperOutput: developerOutput,
	TesterOutput: testerOutput,
	WorkRevision: workRevision,
	PlanDraft: planDraft,
	WorkDelegation: workDelegation,
	InvocationDelegation: invocationDelegation,
	InputManifest: inputManifest,
	RunState: runState,
	AttemptState: attemptState,
	InvocationState: invocationState,
	JobState: jobState,
	OperationStatus: operationStatus,
	A2ATaskState: a2aTaskState,
	OperationReceipt: operationReceipt,
	ErrorEnvelope: errorEnvelope,
	StrongETag: strongETag,
	ContentBasis: contentBasis,
	InputText: inputText,
	ProjectName: projectName,
	TaskTitle: taskTitle,
	CreateTask: createTaskInput,
	UploadMetadata: uploadMetadata,
	Attachment: attachmentView,
	InputOperation: inputOperation,
	InputOperationLookup: inputOperationLookup,
	Workspace: workspaceView,
	Understanding: understandingView,
	UnderstandingOutput: understandingOutput,
	RetryUnderstanding: retryUnderstandingInput,
	PreparationDelegation: preparationDelegation,
	PreparationInput: preparationInput,
	PlanReview: planReviewView,
	WorkbenchSource: workbenchSourceView,
	WorkbenchDelivery: workbenchDeliveryView,
	ReleaseAccessInput: releaseAccessInput,
	ReleaseAccessTicket: releaseAccessTicket,
	ReleaseEntryView: releaseEntryView,
	PreviewAccessInput: previewAccessInput,
	PreviewAccessTicket: previewAccessTicket,
	PreviewEntryView: previewEntryView,
	CandidatePreviewWorkspace: candidatePreviewWorkspace,
	PreviewDatasetManagement: previewDatasetManagement,
	PreviewManagement: previewManagement,
	CreatePreviewDataset: createPreviewDatasetInput,
	CreatePreviewIntent: createPreviewIntentInput,
	StopPreviewIntent: stopPreviewIntentInput,
	...commandBodies
};
const commandRoutes = [
	{
		name: "CreateProject",
		path: "/api/v1/projects",
		parameters: {},
		conditional: false,
		success: ["201"]
	},
	{
		name: "SaveMessage",
		path: "/api/v1/runs/{runId}/messages",
		parameters: { runId: ids.run },
		conditional: true,
		success: ["202"]
	},
	{
		name: "AnswerQuestions",
		path: "/api/v1/runs/{runId}/questions:answer",
		parameters: { runId: ids.run },
		conditional: true,
		success: ["202"]
	},
	{
		name: "ConfirmPlan",
		path: "/api/v1/runs/{runId}/plans/{revision}:confirm",
		parameters: {
			runId: ids.run,
			revision
		},
		conditional: true,
		success: ["202"]
	},
	{
		name: "PlanFeedback",
		path: "/api/v1/runs/{runId}/plans/{revision}:feedback",
		parameters: {
			runId: ids.run,
			revision
		},
		conditional: true,
		success: ["202"]
	},
	{
		name: "ProposeChange",
		path: "/api/v1/runs/{runId}/changes",
		parameters: { runId: ids.run },
		conditional: true,
		success: ["202"]
	},
	{
		name: "DecideChange",
		path: "/api/v1/changes/{changeId}:decide",
		parameters: { changeId: ids.change },
		conditional: true,
		success: ["200", "202"]
	},
	{
		name: "PauseRun",
		path: "/api/v1/runs/{runId}:pause",
		parameters: { runId: ids.run },
		conditional: true,
		success: ["202"]
	},
	{
		name: "ResumeRun",
		path: "/api/v1/runs/{runId}:resume",
		parameters: { runId: ids.run },
		conditional: true,
		success: ["202"]
	},
	{
		name: "CancelRun",
		path: "/api/v1/runs/{runId}:cancel",
		parameters: { runId: ids.run },
		conditional: true,
		success: ["202"]
	},
	{
		name: "RetryWork",
		path: "/api/v1/works/{workId}:retry",
		parameters: { workId: ids.work },
		conditional: true,
		success: ["202"]
	},
	{
		name: "RedoRun",
		path: "/api/v1/runs/{runId}:redo",
		parameters: { runId: ids.run },
		conditional: true,
		success: ["202"]
	},
	{
		name: "AcceptCandidate",
		path: "/api/v1/candidates/{candidateId}:accept",
		parameters: { candidateId: ids.candidate },
		conditional: true,
		success: ["202"]
	}
];
const jsonSchema = (schema, componentName) => {
	const { $schema: _dialect, ...value } = z.toJSONSchema(schema, {
		target: "draft-2020-12",
		io: "input"
	});
	const rebase = (node) => {
		if (!node || typeof node !== "object") return;
		const record = node;
		if (typeof record.$ref === "string" && record.$ref.startsWith("#/$defs/")) {
			if (!componentName) throw new Error("Recursive schema requires a named OpenAPI component");
			record.$ref = `#/components/schemas/${componentName}/${record.$ref.slice(2)}`;
		}
		for (const child of Object.values(node)) rebase(child);
	};
	rebase(value);
	return value;
};
const content = (name) => ({ "application/json": { schema: { $ref: `#/components/schemas/${name}` } } });
function createOpenApiDocument() {
	const paths = Object.fromEntries(commandRoutes.map((route) => [route.path, { post: {
		operationId: route.name,
		"x-implementation-status": "planned",
		description: "P0-02 契约。业务 handler 尚未实现。先认证、权限和原操作去重，再校验新操作版本；202 仅为持久受理。",
		security: [{ browserSession: [] }],
		parameters: [
			...Object.entries(route.parameters).map(([name, schema]) => ({
				name,
				in: "path",
				required: true,
				schema: jsonSchema(schema)
			})),
			{
				name: "Idempotency-Key",
				in: "header",
				required: true,
				schema: jsonSchema(idempotencyKey)
			},
			...route.conditional ? [{
				name: "If-Match",
				in: "header",
				required: true,
				schema: jsonSchema(strongETag)
			}] : []
		],
		requestBody: {
			required: true,
			content: content(route.name)
		},
		responses: Object.fromEntries([...route.success.map((status) => [status, {
			description: status === "201" ? "创建事务提交" : status === "202" ? "持久受理，后台结果另查" : "已保存结果",
			content: content("OperationReceipt")
		}]), ...[
			"401",
			"403",
			"404",
			"409",
			"412",
			"422",
			"428",
			"429",
			"503"
		].filter((status) => route.conditional || !["412", "428"].includes(status)).map((status) => [status, {
			description: {
				"401": "未认证",
				"403": "权限不足",
				"404": "资源不存在或不可见",
				"409": "业务依据或原操作冲突",
				"412": "资源版本不匹配",
				"422": "非法 schema",
				"428": "缺失版本条件",
				"429": "限流",
				"503": "暂不可用，先查询原操作键"
			}[status],
			content: content("ErrorEnvelope")
		}])])
	} }]));
	const errors = Object.fromEntries([
		"400",
		"401",
		"403",
		"404",
		"409",
		"412",
		"413",
		"415",
		"422",
		"428",
		"429",
		"500",
		"503"
	].map((code) => [code, {
		description: "公共错误；未知提交结果先按原操作键查询",
		content: content("ErrorEnvelope")
	}]));
	const add = (path, method, operationId, responseSchema, parameters = [], requestSchema, status = method === "post" ? "201" : "200") => {
		paths[path] ??= {};
		paths[path][method] = {
			operationId,
			"x-implementation-status": "implemented-offline",
			security: [{ trustedIdentity: [] }],
			parameters,
			...requestSchema ? { requestBody: {
				required: true,
				content: content(requestSchema)
			} } : {},
			responses: {
				[status]: {
					description: "已提交的输入事实或当前权限下的读取",
					...responseSchema ? { content: content(responseSchema) } : {}
				},
				...errors
			}
		};
	};
	const parameter = (name, schema, location = "path", required = true) => ({
		name,
		in: location,
		required,
		schema: jsonSchema(schema)
	});
	const key = parameter("Idempotency-Key", idempotencyKey, "header");
	const page = [{
		name: "limit",
		in: "query",
		schema: {
			type: "integer",
			minimum: 1,
			maximum: 200,
			default: 50
		}
	}];
	for (const [suffix, operationId, mime] of [
		[
			"view",
			"ReadWorkbenchPage",
			"text/html"
		],
		[
			"client.js",
			"ReadWorkbenchClient",
			"application/javascript"
		],
		[
			"return-client.js",
			"ReadWorkbenchReturnClient",
			"application/javascript"
		]
	]) {
		const path = "/api/v1/workbench/" + suffix;
		add(path, "get", operationId, void 0, suffix === "view" ? [parameter("projectId", ids.project, "query", false), parameter("runId", ids.run, "query", false)] : []);
		paths[path].get.responses["200"] = {
			description: "受保护工作台；runId须同时指定projectId，选中上下文按当前成员检查；GET无写入副作用",
			content: { [mime]: { schema: { type: "string" } } }
		};
	}
	add("/api/v1/projects", "get", "ListProjects", void 0, [{
		name: "limit",
		in: "query",
		schema: {
			type: "integer",
			minimum: 1,
			maximum: 100,
			default: 20
		}
	}, {
		name: "cursor",
		in: "query",
		schema: {
			type: "string",
			maxLength: 1024
		}
	}]);
	add("/api/v1/projects/{projectId}/tasks", "post", "CreateTask", "OperationReceipt", [
		parameter("projectId", ids.project),
		key,
		parameter("If-Match", strongETag, "header")
	], "CreateTask");
	add("/api/v1/projects/{projectId}/workspace", "get", "ReadWorkspace", "Workspace", [
		parameter("projectId", ids.project),
		parameter("runId", ids.run, "query", false),
		{
			name: "afterMessageId",
			in: "query",
			schema: {
				type: "string",
				maxLength: 256
			}
		},
		...page
	]);
	add("/api/v1/projects/{projectId}/runs/{runId}/delivery", "get", "ReadWorkbenchDelivery", "WorkbenchDelivery", [
		parameter("projectId", ids.project),
		parameter("runId", ids.run),
		{
			name: "afterRevision",
			in: "query",
			schema: {
				type: "integer",
				minimum: 0,
				maximum: Number.MAX_SAFE_INTEGER,
				default: 0
			}
		},
		parameter("selectedCandidateId", ids.candidate, "query", false),
		{
			name: "limit",
			in: "query",
			schema: {
				type: "integer",
				minimum: 1,
				maximum: 20,
				default: 20
			}
		}
	]);
	add("/api/v1/runs/{runId}/sources", "get", "ReadWorkbenchSource", "WorkbenchSource", [parameter("runId", ids.run), {
		name: "ref",
		in: "query",
		required: true,
		description: "严格sourceRef的JSON；消息属于准确Run，材料为已保存依据中的同ID/hash引用，需求按准确版本。最多2 MiB纯文本，无下载或写入副作用。",
		schema: {
			type: "string",
			minLength: 1,
			maxLength: 4096
		}
	}]);
	add("/api/v1/projects/{projectId}/runs/{runId}/events", "get", "ReadEvents", void 0, [
		parameter("projectId", ids.project),
		parameter("runId", ids.run),
		{
			name: "afterSeq",
			in: "query",
			schema: {
				type: "integer",
				minimum: 0,
				default: 0
			}
		},
		...page
	]);
	add("/api/v1/operations/lookup", "get", "LookupInputOperation", "InputOperation", [
		{
			name: "scope",
			in: "query",
			required: true,
			schema: {
				type: "string",
				maxLength: 128
			}
		},
		parameter("key", idempotencyKey, "query"),
		{
			name: "includeAbsence",
			in: "query",
			required: false,
			schema: {
				type: "boolean",
				default: false
			},
			description: "true时返回准确主体／scope／key和operation（明确不存在为null）；权限失败仍为错误，404不构成不存在证明。"
		}
	]);
	paths["/api/v1/operations/lookup"].get.responses["200"] = {
		description: "默认返回原InputOperation；includeAbsence=true返回受保护的明确查询结果。",
		content: { "application/json": { schema: { oneOf: [{ $ref: "#/components/schemas/InputOperation" }, { $ref: "#/components/schemas/InputOperationLookup" }] } } }
	};
	add("/api/v1/operations/{operationId}", "get", "ReadInputOperation", "InputOperation", [parameter("operationId", ids.operation)]);
	add("/api/v1/attachments", "post", "UploadAttachment", void 0, [key]);
	paths["/api/v1/attachments"].post.requestBody = {
		required: true,
		content: { "multipart/form-data": { schema: {
			type: "object",
			additionalProperties: false,
			required: ["clientAttachmentId", "file"],
			properties: {
				clientAttachmentId: {
					type: "string",
					format: "uuid"
				},
				file: {
					type: "string",
					format: "binary",
					description: "非空 UTF-8 .md/.markdown/.txt；每文件最多 2 MiB，单次只接收一个文件"
				}
			}
		} } }
	};
	add("/api/v1/attachments/{attachmentId}", "get", "ReadAttachment", "Attachment", [parameter("attachmentId", ids.attachment)]);
	add("/api/v1/attachments/{attachmentId}", "delete", "RemoveAttachment", "Attachment", [parameter("attachmentId", ids.attachment)]);
	add("/api/v1/attachments/{attachmentId}/content", "get", "ReadAttachmentContent", void 0, [parameter("attachmentId", ids.attachment)]);
	add("/api/v1/runs/{runId}/understanding", "get", "ReadUnderstanding", "Understanding", [parameter("runId", ids.run), parameter("requirementRevision", revision, "query", false)]);
	add("/api/v1/runs/{runId}/understanding:retry", "post", "RetryUnderstanding", "OperationReceipt", [
		parameter("runId", ids.run),
		key,
		parameter("If-Match", strongETag, "header")
	], "RetryUnderstanding", "202");
	add("/api/v1/runs/{runId}/plans", "get", "ReadPlan", "PlanReview", [parameter("runId", ids.run), parameter("revision", revision, "query", false)]);
	const acceptancePath = "/api/v1/runs/{runId}/candidates/{candidateId}/acceptance", acceptanceParameters = [parameter("runId", ids.run), parameter("candidateId", ids.candidate)], conditionalAcceptance = [
		...acceptanceParameters,
		key,
		parameter("If-Match", strongETag, "header")
	];
	add(acceptancePath, "get", "ReadAcceptanceBasis", "AcceptanceBasis", acceptanceParameters);
	for (const [suffix, operationId, mime] of [[
		"view",
		"ReadAcceptancePage",
		"text/html"
	], [
		"client.js",
		"ReadAcceptanceClient",
		"application/javascript"
	]]) {
		const path = "/api/v1/runs/{runId}/candidates/{candidateId}/acceptance/" + suffix;
		add(path, "get", operationId, void 0, acceptanceParameters);
		paths[path].get.responses["200"] = {
			description: "当前成员准确候选接受入口；GET不准备、确认、接受或签发应用访问",
			content: { [mime]: { schema: { type: "string" } } }
		};
	}
	add("/api/v1/runs/{runId}/candidates/{candidateId}/acceptance/preparations", "get", "ListCandidateAcceptancePreparations", "AcceptancePreparationList", [
		...acceptanceParameters,
		{
			name: "afterSequence",
			in: "query",
			schema: {
				type: "integer",
				minimum: 0,
				default: 0
			}
		},
		{
			name: "limit",
			in: "query",
			schema: {
				type: "integer",
				minimum: 1,
				maximum: 100,
				default: 20
			}
		}
	]);
	add("/api/v1/runs/{runId}/candidates/{candidateId}/acceptance/preparations", "post", "BeginAcceptance", "AcceptancePreparation", conditionalAcceptance, "BeginAcceptance", "202");
	add("/api/v1/runs/{runId}/candidates/{candidateId}/acceptance/replacement-confirmations", "post", "ConfirmAcceptanceReplacement", "AcceptanceReplacementReceipt", conditionalAcceptance, "ConfirmAcceptanceReplacement");
	const preparationPath = "/api/v1/runs/{runId}/candidates/{candidateId}/acceptance/preparations/{operationId}", preparationParameters = [...acceptanceParameters, parameter("operationId", ids.operation)];
	add(preparationPath, "get", "ReadAcceptancePreparation", "AcceptancePreparation", preparationParameters);
	add("/api/v1/runs/{runId}/candidates/{candidateId}/acceptance/preparations/{operationId}/close-unsent", "post", "CloseUnsentAcceptance", "AcceptancePreparation", [
		...preparationParameters,
		key,
		parameter("If-Match", strongETag, "header")
	], "CloseUnsentAcceptance", "200");
	add("/api/v1/runs/{runId}/candidates/{candidateId}/acceptance/preparations/{operationId}/abort", "post", "AbortAcceptance", "AcceptanceAbortReceipt", [
		...preparationParameters,
		key,
		parameter("If-Match", strongETag, "header")
	], "AbortAcceptance", "202");
	add("/api/v1/candidates/{candidateId}:accept", "post", "AcceptCandidate", "AcceptanceCommitReceipt", [
		parameter("candidateId", ids.candidate),
		key,
		parameter("If-Match", strongETag, "header")
	], "AcceptCandidate", "202");
	paths["/api/v1/candidates/{candidateId}:accept"].post.description = "准确两阶段T5提交，先实际复核冻结材料字节；成功回执固定ACCEPTED及当时PENDING，当前发布另查。原UUID／正文恢复先于新版本和配置检查。默认新接受关闭。";
	const reviewPath = "/api/v1/runs/{runId}/candidates/{candidateId}/review", reviewParameters = [parameter("runId", ids.run), parameter("candidateId", ids.candidate)];
	add(reviewPath, "get", "ReadCandidateReview", "CandidateReviewEntry", reviewParameters);
	add("/api/v1/runs/{runId}/candidates/{candidateId}/review/results", "post", "RecordCandidateReview", "CandidateHumanResult", [
		...reviewParameters,
		key,
		parameter("If-Match", strongETag, "header")
	], "RecordCandidateReview");
	add("/api/v1/runs/{runId}/candidates/{candidateId}/review/rejections", "post", "RecordCandidateRejection", "CandidateRejectionResult", [
		...reviewParameters,
		key,
		parameter("If-Match", strongETag, "header")
	], "RecordCandidateRejection");
	const reviewHistoryPage = [{
		name: "afterSequence",
		in: "query",
		schema: {
			type: "integer",
			minimum: 0,
			default: 0
		}
	}, {
		name: "limit",
		in: "query",
		schema: {
			type: "integer",
			minimum: 1,
			maximum: 100,
			default: 20
		}
	}];
	add("/api/v1/runs/{runId}/candidates/{candidateId}/review/history", "get", "ReadCandidateReviewHistory", "CandidateReviewHistory", [
		...reviewParameters,
		parameter("itemId", opaqueKey, "query", false),
		...reviewHistoryPage
	]);
	add("/api/v1/runs/{runId}/candidates/{candidateId}/review/rejections/history", "get", "ReadCandidateRejectionHistory", "CandidateRejectionHistory", [
		...reviewParameters,
		parameter("rejectionId", opaqueKey, "query", false),
		...reviewHistoryPage
	]);
	for (const [suffix, operationId, mime] of [[
		"view",
		"ReadCandidateReviewPage",
		"text/html"
	], [
		"client.js",
		"ReadCandidateReviewClient",
		"application/javascript"
	]]) {
		const path = "/api/v1/runs/{runId}/candidates/{candidateId}/review/" + suffix;
		add(path, "get", operationId, void 0, reviewParameters);
		paths[path].get.responses["200"] = {
			description: "当前成员准确候选审查入口；GET无写入副作用",
			content: { [mime]: { schema: { type: "string" } } }
		};
	}
	const releasePath = "/api/v1/runs/{runId}/releases/{releaseId}", releaseParameters = [parameter("runId", ids.run), parameter("releaseId", ids.release)];
	add("/api/v1/releases/{releaseId}/exports", "post", "CreateReleaseExport", "ReleaseExport", [parameter("releaseId", ids.release), key], "CreateReleaseExport", "202");
	add("/api/v1/releases/{releaseId}/exports", "get", "ListReleaseExports", "ReleaseExportList", [
		parameter("releaseId", ids.release),
		parameter("afterExportId", opaqueKey, "query", false),
		...page
	]);
	for (const [suffix, operationId, mime, description] of [[
		"view",
		"ReadReleaseExportPage",
		"text/html",
		"当前成员React交付入口；GET不创建或重试"
	], [
		"client.js",
		"ReadReleaseExportClient",
		"application/javascript",
		"当前成员读取固定本地React资产；不从CDN加载"
	]]) {
		const path = "/api/v1/releases/{releaseId}/exports/" + suffix;
		add(path, "get", operationId, void 0, [parameter("releaseId", ids.release)]);
		paths[path].get.responses["200"] = {
			description,
			content: { [mime]: { schema: { type: "string" } } }
		};
	}
	add("/api/v1/exports/{exportId}", "get", "ReadReleaseExport", "ReleaseExport", [parameter("exportId", opaqueKey)]);
	add("/api/v1/exports/{exportId}/retry", "post", "RetryReleaseExport", "ReleaseExport", [parameter("exportId", opaqueKey)], "RetryReleaseExport", "202");
	add("/api/v1/exports/{exportId}/download", "get", "DownloadReleaseExport", void 0, [parameter("exportId", opaqueKey)]);
	const exportDownload = paths["/api/v1/exports/{exportId}/download"].get;
	exportDownload.responses["200"] = {
		description: "固定 READY 作业的 ZIP attachment；每次当前成员鉴权；不重新生成或改动验收",
		content: { "application/zip": { schema: {
			type: "string",
			format: "binary"
		} } }
	};
	exportDownload.responses["416"] = {
		description: "不支持 Range",
		content: content("ErrorEnvelope")
	};
	add(releasePath, "get", "ReadReleaseEntry", "ReleaseEntryView", releaseParameters);
	add("/api/v1/runs/{runId}/releases/{releaseId}/access", "post", "IssueReleaseAccess", "ReleaseAccessTicket", [...releaseParameters, parameter("Origin", z.url(), "header")], "ReleaseAccessInput", "200");
	add("/api/v1/runs/{runId}/releases/{releaseId}/view", "get", "ReadReleasePage", void 0, releaseParameters);
	const releasePage = paths["/api/v1/runs/{runId}/releases/{releaseId}/view"].get;
	releasePage.responses["200"] = {
		description: "当前成员访问已接受应用；GET 不签票据",
		content: { "text/html": { schema: { type: "string" } } }
	};
	const previewPath = "/api/v1/runs/{runId}/previews/{previewId}", previewParameters = [parameter("runId", ids.run), parameter("previewId", ids.preview)];
	add(previewPath, "get", "ReadPreviewEntry", "PreviewEntryView", previewParameters);
	const previewManagementPath = "/api/v1/runs/{runId}/candidates/{candidateId}/preview-management", previewManagementParameters = [parameter("runId", ids.run), parameter("candidateId", ids.candidate)], previewManagementConditional = [
		...previewManagementParameters,
		key,
		parameter("If-Match", strongETag, "header")
	];
	add(previewManagementPath, "get", "ReadCandidatePreviewWorkspace", "CandidatePreviewWorkspace", [
		...previewManagementParameters,
		...["afterDatasetSequence", "afterPreviewSequence"].map((name) => ({
			name,
			in: "query",
			schema: {
				type: "integer",
				minimum: 0,
				default: 0
			}
		})),
		{
			name: "limit",
			in: "query",
			schema: {
				type: "integer",
				minimum: 1,
				maximum: 20,
				default: 10
			}
		}
	]);
	add("/api/v1/runs/{runId}/candidates/{candidateId}/preview-management/view", "get", "ReadCandidatePreviewManagementPage", void 0, previewManagementParameters);
	add("/api/v1/runs/{runId}/candidates/{candidateId}/preview-management/client.js", "get", "ReadCandidatePreviewManagementClient", void 0, previewManagementParameters);
	for (const [suffix, mime, description] of [[
		"/view",
		"text/html",
		"当前成员预览管理页；GET不准备数据、启动、停止、签票据或接受"
	], [
		"/client.js",
		"application/javascript",
		"当前成员预览管理React脚本"
	]]) {
		const operation = paths[previewManagementPath + suffix].get;
		operation.responses["200"] = {
			description,
			content: { [mime]: { schema: { type: "string" } } }
		};
	}
	add("/api/v1/runs/{runId}/candidates/{candidateId}/preview-management/datasets", "post", "CreatePreviewDataset", "PreviewDatasetManagement", previewManagementConditional, "CreatePreviewDataset", "202");
	add("/api/v1/runs/{runId}/candidates/{candidateId}/preview-management/datasets/{datasetId}", "get", "ReadCandidatePreviewDataset", "PreviewDatasetManagement", [...previewManagementParameters, parameter("datasetId", ids.dataset)]);
	add("/api/v1/runs/{runId}/candidates/{candidateId}/preview-management/previews", "post", "CreatePreviewIntent", "PreviewManagement", previewManagementConditional, "CreatePreviewIntent", "202");
	add("/api/v1/runs/{runId}/candidates/{candidateId}/preview-management/previews/{previewId}", "get", "ReadCandidateManagedPreview", "PreviewManagement", [...previewManagementParameters, parameter("previewId", ids.preview)]);
	add("/api/v1/runs/{runId}/candidates/{candidateId}/preview-management/previews/{previewId}/stop", "post", "StopPreviewIntent", "PreviewManagement", [
		...previewManagementParameters,
		parameter("previewId", ids.preview),
		key
	], "StopPreviewIntent", "202");
	add("/api/v1/runs/{runId}/previews/{previewId}/access", "post", "IssuePreviewAccess", "PreviewAccessTicket", [...previewParameters, parameter("Origin", z.url(), "header")], "PreviewAccessInput", "200");
	add("/api/v1/runs/{runId}/previews/{previewId}/view", "get", "ReadPreviewPage", void 0, previewParameters);
	const previewPage = paths["/api/v1/runs/{runId}/previews/{previewId}/view"].get;
	previewPage.responses["200"] = {
		description: "当前成员只读预览页；受限 iframe，GET 不签票据、不接受版本",
		content: { "text/html": { schema: { type: "string" } } }
	};
	const downloadPath = "/api/v1/runs/{runId}/candidates/{candidateId}/materials/{materialKey}/download";
	add(downloadPath, "get", "DownloadFrozenMaterial", void 0, [
		parameter("runId", ids.run),
		parameter("candidateId", ids.candidate),
		parameter("materialKey", opaqueKey)
	]);
	const download = paths[downloadPath].get;
	download.responses["200"] = {
		description: "原冻结材料的 inert attachment；权限和实际内容复核；不接受或重新生成",
		headers: {
			"Content-Disposition": {
				schema: { type: "string" },
				description: "attachment"
			},
			"X-Content-Type-Options": { schema: {
				type: "string",
				const: "nosniff"
			} }
		},
		content: { "application/octet-stream": { schema: {
			type: "string",
			format: "binary"
		} } }
	};
	download.responses["416"] = {
		description: "此材料入口不支持 Range；原下载授权及内容保持不变",
		content: content("ErrorEnvelope")
	};
	for (const path of [
		"/api/v1/projects",
		"/api/v1/runs/{runId}/messages",
		"/api/v1/runs/{runId}/questions:answer"
	]) {
		const post = paths[path].post;
		post["x-implementation-status"] = "implemented-offline";
		post.security = [{ trustedIdentity: [] }];
		post.description = "已实现持久输入与当前成员授权；默认无身份接入点时拒绝请求。保存成功不表示真实模型处理完成。";
	}
	const confirm = paths["/api/v1/runs/{runId}/plans/{revision}:confirm"].post;
	confirm["x-implementation-status"] = "implemented-offline";
	confirm.security = [{ trustedIdentity: [] }];
	confirm.description = "按当前成员、原操作键、版本、审阅哈希和计划校验记录明确确认；后台执行另行准入。";
	for (const [path, item] of Object.entries(paths)) if (path.startsWith("/api/v1/")) for (const operation of Object.values(item)) operation.parameters.push({
		...parameter("X-DevMesh-Principal", opaqueKey, "header", false),
		description: "可选页面主体绑定；须与可信身份解析结果相同，不同则403且不执行副作用；不可用此头建立身份，重复头400。"
	});
	return {
		openapi: "3.1.0",
		jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema",
		info: {
			title: "DevMesh 核心契约",
			version: "0.3.0",
			description: "共享命令、输入与需求理解 API。逐路由标记实现范围；离线代码与测试不代表企业身份、模型或产品全链路验收。其余 D3 API 随工作包增量补齐。"
		},
		"x-runtime-constraints": [
			"permit 有效期顺序、宿主当前代际及资源范围",
			"测试成果所有报告绑定相同 SHA",
			"事件 envelope 与 payload 版本和归属一致",
			"ETag 安全整数范围",
			"DAG 无环、来源存在、ACL、幂等及事务由后续服务负责"
		],
		paths,
		components: {
			securitySchemes: {
				trustedIdentity: {
					type: "http",
					scheme: "bearer",
					description: "可信 IdentityResolver 接入点；默认未配置，不签发测试 token、匿名用户或企业登录。CLI 当前没有企业 resolver。"
				},
				browserSession: {
					type: "apiKey",
					in: "cookie",
					name: "devmesh_session",
					description: "后续企业浏览器 Session；当前 Cookie 认证未接入，必须另行完成 Origin/CSRF。"
				}
			},
			schemas: Object.fromEntries(Object.entries(schemas).map(([name, schema]) => [name, jsonSchema(schema, name)]))
		}
	};
}
//#endregion
//#region src/workbench-events.ts
const workbenchEventSubscription = z.strictObject({
	schemaVersion: z.literal(1),
	principalId: opaqueKey,
	projectId: ids.project,
	runId: ids.run,
	afterSeq: epoch
});
const context = {
	schemaVersion: z.literal(1),
	projectId: ids.project,
	runId: ids.run
};
const workbenchEventFrame = z.discriminatedUnion("kind", [
	z.strictObject({
		...context,
		kind: z.literal("subscribed"),
		afterSeq: epoch
	}),
	z.strictObject({
		...context,
		kind: z.literal("domain-event"),
		event: domainEvent
	}).superRefine((v, ctx) => {
		if (v.projectId !== v.event.projectId || v.runId !== v.event.runId) ctx.addIssue({
			code: "custom",
			message: "Event context must match its envelope"
		});
	}),
	z.strictObject({
		...context,
		kind: z.literal("caught-up"),
		throughSeq: epoch
	}),
	z.strictObject({
		...context,
		kind: z.literal("resync-required"),
		afterSeq: epoch,
		reason: z.enum([
			"RETAINED_GAP",
			"CURSOR_AHEAD",
			"BUFFER_OVERFLOW",
			"SLOW_CLIENT",
			"CATCHUP_LIMIT",
			"STORAGE_UNAVAILABLE",
			"PROTOCOL_INVALID"
		])
	}),
	z.strictObject({
		...context,
		kind: z.literal("authorization-lost")
	}),
	z.strictObject({
		...context,
		kind: z.literal("service-stopping")
	})
]);
//#endregion
export { ContractError, a2aTaskState, abortAcceptanceInput, acceptCandidateInput, acceptanceAbortReceipt, acceptanceBasisView, acceptanceCandidateBasis, acceptanceCommitReceipt, acceptancePreparationList, acceptancePreparationView, acceptanceReplacementReceipt, acceptedReleaseView, answerQuestionsInput, architectOutput, artifactRef, assertContentBasis, assertPermit, assertResourceVersion, attachmentIds, attachmentName, attachmentView, attemptState, beginAcceptanceInput, candidateHumanResult, candidatePreviewWorkspace, candidateRejectionHistory, candidateRejectionResult, candidateReviewEntry, candidateReviewHistory, candidateReviewItem, candidateReviewView, closeUnsentAcceptanceInput, command, commandBodies, commandRoutes, commandTarget, completionCheck, confirmAcceptanceReplacementInput, contentBasis, controlGate, createOpenApiDocument, createPreviewDatasetInput, createPreviewIntentInput, createProjectInput, createReleaseExportInput, createTaskInput, deliveryDataPlan, developerOutput, domainEvent, ephemeralTokenDelta, epoch, errorCode, errorEnvelope, eventPayloads, executionOwner, executionPermit, gitCommit, idempotencyKey, ids, initialInput, inputLimits, inputManifest, inputOperation, inputOperationLookup, inputText, inspectPlan, invocationDelegation, invocationOwner, invocationState, jobState, nonemptyText, opaqueKey, operationReceipt, operationStatus, parseContract, pipelineDefinition, pipelineStage, planDraft, planIssue, planReviewView, preparationDelegation, preparationInput, preparationProfile, preparationQuestion, preparationRole, preparationSource, previewAccessInput, previewAccessTicket, previewDatasetManagement, previewEntryView, previewImageConfig, previewImageIdentity, previewImageLimits, previewImageManifest, previewManagement, productOutput, projectName, protocolTaskId, qualityBranch, qualityCheckStatus, qualityEvaluation, qualityExecution, qualityLimits, qualityLocation, qualityPath, qualityPolicy, qualityProducer, qualityReport, qualitySourceFile, qualitySourceScope, qualityTestIdentity, question, recordCandidateRejectionInput, recordCandidateReviewInput, relativeFile, releaseAccessInput, releaseAccessTicket, releaseDeliveryPolicy, releaseDeliveryProfile, releaseEntryView, releaseExportEntryView, releaseExportListView, releaseExportView, requirement, retryReleaseExportInput, retryUnderstandingInput, revision, role, roleOutput, runPhase, runState, saveMessageInput, schemas, sha256, sourceRef, stopPreviewIntentInput, strongETag, taskTitle, terminalOutcome, testerOutput, timestamp, understandingOutput, understandingView, uploadMetadata, workDelegation, workRevision, workbenchCandidateSummary, workbenchDeliveryView, workbenchEventFrame, workbenchEventSubscription, workbenchSourceView, workflowOwner, workspaceView };

//# sourceMappingURL=index.js.map