import { z } from "zod";

//#region src/primitives.d.ts
declare const ids: {
  readonly project: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  readonly userTask: z.core.$ZodBranded<z.ZodString, "task", "out">;
  readonly run: z.core.$ZodBranded<z.ZodString, "run", "out">;
  readonly work: z.core.$ZodBranded<z.ZodString, "work", "out">;
  readonly attempt: z.core.$ZodBranded<z.ZodString, "attempt", "out">;
  readonly invocation: z.core.$ZodBranded<z.ZodString, "invocation", "out">;
  readonly invocationAttempt: z.core.$ZodBranded<z.ZodString, "iattempt", "out">;
  readonly activation: z.core.$ZodBranded<z.ZodString, "activation", "out">;
  readonly grant: z.core.$ZodBranded<z.ZodString, "grant", "out">;
  readonly operation: z.core.$ZodBranded<z.ZodString, "op", "out">;
  readonly event: z.core.$ZodBranded<z.ZodString, "evt", "out">;
  readonly request: z.core.$ZodBranded<z.ZodString, "req", "out">;
  readonly artifact: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
  readonly manifest: z.core.$ZodBranded<z.ZodString, "manifest", "out">;
  readonly roleSnapshot: z.core.$ZodBranded<z.ZodString, "role", "out">;
  readonly definitionSnapshot: z.core.$ZodBranded<z.ZodString, "definition", "out">;
  readonly candidate: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
  readonly release: z.core.$ZodBranded<z.ZodString, "release", "out">;
  readonly question: z.core.$ZodBranded<z.ZodString, "question", "out">;
  readonly requirement: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
  readonly session: z.core.$ZodBranded<z.ZodString, "session", "out">;
  readonly job: z.core.$ZodBranded<z.ZodString, "job", "out">;
  readonly attachment: z.core.$ZodBranded<z.ZodString, "attachment", "out">;
  readonly message: z.core.$ZodBranded<z.ZodString, "message", "out">;
  readonly change: z.core.$ZodBranded<z.ZodString, "change", "out">;
  readonly decision: z.core.$ZodBranded<z.ZodString, "decision", "out">;
  readonly preview: z.core.$ZodBranded<z.ZodString, "preview", "out">;
  readonly dataset: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
  readonly export: z.core.$ZodBranded<z.ZodString, "export", "out">;
  readonly analysis: z.core.$ZodBranded<z.ZodString, "analysis", "out">;
  readonly check: z.core.$ZodBranded<z.ZodString, "check", "out">;
};
type ProjectId = z.infer<typeof ids.project>;
type RunId = z.infer<typeof ids.run>;
type AttemptId = z.infer<typeof ids.attempt>;
type InvocationId = z.infer<typeof ids.invocation>;
type InvocationAttemptId = z.infer<typeof ids.invocationAttempt>;
declare const revision: z.ZodNumber;
declare const epoch: z.ZodNumber;
declare const sha256: z.ZodString;
declare const gitCommit: z.ZodString;
declare const timestamp: z.ZodISODateTime;
declare const role: z.ZodEnum<{
  product: "product";
  architect: "architect";
  developer: "developer";
  tester: "tester";
}>;
declare const opaqueKey: z.ZodString;
declare const protocolTaskId: z.ZodString;
declare const nonemptyText: z.ZodString;
declare const inputText: z.ZodString;
declare const projectName: z.ZodString;
declare const taskTitle: z.ZodString;
declare const artifactRef: z.ZodObject<{
  artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
  sha256: z.ZodString;
}, z.core.$strict>;
declare const runPhase: z.ZodEnum<{
  PREPARING: "PREPARING";
  UNDERSTANDING: "UNDERSTANDING";
  PLANNING: "PLANNING";
  EXECUTING: "EXECUTING";
  VERIFYING: "VERIFYING";
  REVIEW: "REVIEW";
}>;
declare const controlGate: z.ZodEnum<{
  OPEN: "OPEN";
  PAUSING: "PAUSING";
  PAUSED: "PAUSED";
  CANCELLING: "CANCELLING";
}>;
declare const terminalOutcome: z.ZodEnum<{
  COMPLETED: "COMPLETED";
  FAILED: "FAILED";
  CANCELLED: "CANCELLED";
}>;
declare const runState: z.ZodObject<{
  phase: z.ZodEnum<{
    PREPARING: "PREPARING";
    UNDERSTANDING: "UNDERSTANDING";
    PLANNING: "PLANNING";
    EXECUTING: "EXECUTING";
    VERIFYING: "VERIFYING";
    REVIEW: "REVIEW";
  }>;
  controlGate: z.ZodEnum<{
    OPEN: "OPEN";
    PAUSING: "PAUSING";
    PAUSED: "PAUSED";
    CANCELLING: "CANCELLING";
  }>;
  terminalOutcome: z.ZodNullable<z.ZodEnum<{
    COMPLETED: "COMPLETED";
    FAILED: "FAILED";
    CANCELLED: "CANCELLED";
  }>>;
}, z.core.$strict>;
declare const attemptState: z.ZodEnum<{
  VERIFYING: "VERIFYING";
  FAILED: "FAILED";
  CANCELLED: "CANCELLED";
  RESERVED: "RESERVED";
  SUBMITTED: "SUBMITTED";
  WORKING: "WORKING";
  INPUT_REQUIRED: "INPUT_REQUIRED";
  OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN";
  STOPPING: "STOPPING";
  SUCCEEDED: "SUCCEEDED";
  INTERRUPTED: "INTERRUPTED";
}>;
declare const invocationState: z.ZodEnum<{
  VERIFYING: "VERIFYING";
  FAILED: "FAILED";
  CANCELLED: "CANCELLED";
  INPUT_REQUIRED: "INPUT_REQUIRED";
  OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN";
  STOPPING: "STOPPING";
  SUCCEEDED: "SUCCEEDED";
  QUEUED: "QUEUED";
  RUNNING: "RUNNING";
}>;
declare const operationStatus: z.ZodEnum<{
  FAILED: "FAILED";
  OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN";
  SUCCEEDED: "SUCCEEDED";
  RUNNING: "RUNNING";
  ACCEPTED: "ACCEPTED";
  WAITING: "WAITING";
}>;
declare const jobState: z.ZodEnum<{
  OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN";
  STOPPING: "STOPPING";
  QUEUED: "QUEUED";
  RUNNING: "RUNNING";
  STARTING: "STARTING";
  EXITED: "EXITED";
}>;
declare const a2aTaskState: z.ZodEnum<{
  submitted: "submitted";
  working: "working";
  "input-required": "input-required";
  "auth-required": "auth-required";
  completed: "completed";
  failed: "failed";
  canceled: "canceled";
  rejected: "rejected";
}>;
//#endregion
//#region src/errors.d.ts
declare const errorCode: z.ZodEnum<{
  OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN";
  SCHEMA_INVALID: "SCHEMA_INVALID";
  PRECONDITION_REQUIRED: "PRECONDITION_REQUIRED";
  PRECONDITION_FAILED: "PRECONDITION_FAILED";
  BASIS_SUPERSEDED: "BASIS_SUPERSEDED";
  PLAN_SUPERSEDED: "PLAN_SUPERSEDED";
  PERMIT_REVOKED: "PERMIT_REVOKED";
  PERMIT_EXPIRED: "PERMIT_EXPIRED";
  PERMIT_SCOPE_DENIED: "PERMIT_SCOPE_DENIED";
  IDEMPOTENCY_KEY_REUSED: "IDEMPOTENCY_KEY_REUSED";
  AUTHENTICATION_REQUIRED: "AUTHENTICATION_REQUIRED";
  FORBIDDEN: "FORBIDDEN";
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND";
  ACTIVE_RUN_EXISTS: "ACTIVE_RUN_EXISTS";
  LIMIT_EXCEEDED: "LIMIT_EXCEEDED";
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE";
  PLAN_INVALID: "PLAN_INVALID";
  PLAN_ALREADY_CONFIRMED: "PLAN_ALREADY_CONFIRMED";
  RUN_TERMINAL: "RUN_TERMINAL";
  ADMISSION_CLOSED: "ADMISSION_CLOSED";
  PREVIEW_ACCESS_NOT_CONFIGURED: "PREVIEW_ACCESS_NOT_CONFIGURED";
  PREVIEW_UNAVAILABLE: "PREVIEW_UNAVAILABLE";
  RELEASE_ACCESS_NOT_CONFIGURED: "RELEASE_ACCESS_NOT_CONFIGURED";
  RELEASE_UNAVAILABLE: "RELEASE_UNAVAILABLE";
  RANGE_NOT_SUPPORTED: "RANGE_NOT_SUPPORTED";
  EXPORT_UNAVAILABLE: "EXPORT_UNAVAILABLE";
  ACCEPTANCE_UNAVAILABLE: "ACCEPTANCE_UNAVAILABLE";
  REVIEW_UNAVAILABLE: "REVIEW_UNAVAILABLE";
  CONTENT_CORRUPT: "CONTENT_CORRUPT";
  CONTENT_TOO_LARGE: "CONTENT_TOO_LARGE";
  IDENTITY_NOT_CONFIGURED: "IDENTITY_NOT_CONFIGURED";
  REQUEST_ORIGIN_INVALID: "REQUEST_ORIGIN_INVALID";
  REQUEST_HEADERS_INVALID: "REQUEST_HEADERS_INVALID";
  REQUEST_HOST_INVALID: "REQUEST_HOST_INVALID";
  COOKIE_AUTH_NOT_CONFIGURED: "COOKIE_AUTH_NOT_CONFIGURED";
  SERVICE_STOPPING: "SERVICE_STOPPING";
  CONTENT_TYPE_INVALID: "CONTENT_TYPE_INVALID";
  REQUEST_TOO_LARGE: "REQUEST_TOO_LARGE";
  JSON_INVALID: "JSON_INVALID";
  UPLOAD_CAPACITY: "UPLOAD_CAPACITY";
  UPLOAD_IN_PROGRESS: "UPLOAD_IN_PROGRESS";
  UPLOAD_FAILED: "UPLOAD_FAILED";
  UPLOAD_TIMEOUT: "UPLOAD_TIMEOUT";
  UPLOAD_INTERRUPTED: "UPLOAD_INTERRUPTED";
  UPLOAD_TOO_LARGE: "UPLOAD_TOO_LARGE";
  UPLOAD_INVALID: "UPLOAD_INVALID";
  UPLOAD_RESULT_INVALID: "UPLOAD_RESULT_INVALID";
  MULTIPART_INVALID: "MULTIPART_INVALID";
  ATTACHMENT_TYPE_INVALID: "ATTACHMENT_TYPE_INVALID";
  ATTACHMENT_ENCODING_INVALID: "ATTACHMENT_ENCODING_INVALID";
  ATTACHMENT_EMPTY: "ATTACHMENT_EMPTY";
  ATTACHMENT_BOUND: "ATTACHMENT_BOUND";
  UPLOAD_CONTENT_CONFLICT: "UPLOAD_CONTENT_CONFLICT";
  UPLOAD_HASH_INVALID: "UPLOAD_HASH_INVALID";
  UPLOAD_CLAIM_INVALID: "UPLOAD_CLAIM_INVALID";
  OPERATION_SCOPE_INVALID: "OPERATION_SCOPE_INVALID";
  ACCEPTED_RELEASE_CHANGED: "ACCEPTED_RELEASE_CHANGED";
  MESSAGE_KEY_REUSED: "MESSAGE_KEY_REUSED";
  RUN_NOT_WRITABLE: "RUN_NOT_WRITABLE";
  EVENT_CURSOR_INVALID: "EVENT_CURSOR_INVALID";
  CONTENT_UNAVAILABLE: "CONTENT_UNAVAILABLE";
  QUESTION_SUPERSEDED: "QUESTION_SUPERSEDED";
  ANSWER_INVALID: "ANSWER_INVALID";
  INTERPRETATION_NOT_FAILED: "INTERPRETATION_NOT_FAILED";
  REQUIRED_QUESTIONS_UNANSWERED: "REQUIRED_QUESTIONS_UNANSWERED";
  INTERPRETATION_PENDING: "INTERPRETATION_PENDING";
}>;
type ErrorCode = z.infer<typeof errorCode>;
declare const errorEnvelope: z.ZodObject<{
  error: z.ZodObject<{
    code: z.ZodEnum<{
      OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN";
      SCHEMA_INVALID: "SCHEMA_INVALID";
      PRECONDITION_REQUIRED: "PRECONDITION_REQUIRED";
      PRECONDITION_FAILED: "PRECONDITION_FAILED";
      BASIS_SUPERSEDED: "BASIS_SUPERSEDED";
      PLAN_SUPERSEDED: "PLAN_SUPERSEDED";
      PERMIT_REVOKED: "PERMIT_REVOKED";
      PERMIT_EXPIRED: "PERMIT_EXPIRED";
      PERMIT_SCOPE_DENIED: "PERMIT_SCOPE_DENIED";
      IDEMPOTENCY_KEY_REUSED: "IDEMPOTENCY_KEY_REUSED";
      AUTHENTICATION_REQUIRED: "AUTHENTICATION_REQUIRED";
      FORBIDDEN: "FORBIDDEN";
      RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND";
      ACTIVE_RUN_EXISTS: "ACTIVE_RUN_EXISTS";
      LIMIT_EXCEEDED: "LIMIT_EXCEEDED";
      SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE";
      PLAN_INVALID: "PLAN_INVALID";
      PLAN_ALREADY_CONFIRMED: "PLAN_ALREADY_CONFIRMED";
      RUN_TERMINAL: "RUN_TERMINAL";
      ADMISSION_CLOSED: "ADMISSION_CLOSED";
      PREVIEW_ACCESS_NOT_CONFIGURED: "PREVIEW_ACCESS_NOT_CONFIGURED";
      PREVIEW_UNAVAILABLE: "PREVIEW_UNAVAILABLE";
      RELEASE_ACCESS_NOT_CONFIGURED: "RELEASE_ACCESS_NOT_CONFIGURED";
      RELEASE_UNAVAILABLE: "RELEASE_UNAVAILABLE";
      RANGE_NOT_SUPPORTED: "RANGE_NOT_SUPPORTED";
      EXPORT_UNAVAILABLE: "EXPORT_UNAVAILABLE";
      ACCEPTANCE_UNAVAILABLE: "ACCEPTANCE_UNAVAILABLE";
      REVIEW_UNAVAILABLE: "REVIEW_UNAVAILABLE";
      CONTENT_CORRUPT: "CONTENT_CORRUPT";
      CONTENT_TOO_LARGE: "CONTENT_TOO_LARGE";
      IDENTITY_NOT_CONFIGURED: "IDENTITY_NOT_CONFIGURED";
      REQUEST_ORIGIN_INVALID: "REQUEST_ORIGIN_INVALID";
      REQUEST_HEADERS_INVALID: "REQUEST_HEADERS_INVALID";
      REQUEST_HOST_INVALID: "REQUEST_HOST_INVALID";
      COOKIE_AUTH_NOT_CONFIGURED: "COOKIE_AUTH_NOT_CONFIGURED";
      SERVICE_STOPPING: "SERVICE_STOPPING";
      CONTENT_TYPE_INVALID: "CONTENT_TYPE_INVALID";
      REQUEST_TOO_LARGE: "REQUEST_TOO_LARGE";
      JSON_INVALID: "JSON_INVALID";
      UPLOAD_CAPACITY: "UPLOAD_CAPACITY";
      UPLOAD_IN_PROGRESS: "UPLOAD_IN_PROGRESS";
      UPLOAD_FAILED: "UPLOAD_FAILED";
      UPLOAD_TIMEOUT: "UPLOAD_TIMEOUT";
      UPLOAD_INTERRUPTED: "UPLOAD_INTERRUPTED";
      UPLOAD_TOO_LARGE: "UPLOAD_TOO_LARGE";
      UPLOAD_INVALID: "UPLOAD_INVALID";
      UPLOAD_RESULT_INVALID: "UPLOAD_RESULT_INVALID";
      MULTIPART_INVALID: "MULTIPART_INVALID";
      ATTACHMENT_TYPE_INVALID: "ATTACHMENT_TYPE_INVALID";
      ATTACHMENT_ENCODING_INVALID: "ATTACHMENT_ENCODING_INVALID";
      ATTACHMENT_EMPTY: "ATTACHMENT_EMPTY";
      ATTACHMENT_BOUND: "ATTACHMENT_BOUND";
      UPLOAD_CONTENT_CONFLICT: "UPLOAD_CONTENT_CONFLICT";
      UPLOAD_HASH_INVALID: "UPLOAD_HASH_INVALID";
      UPLOAD_CLAIM_INVALID: "UPLOAD_CLAIM_INVALID";
      OPERATION_SCOPE_INVALID: "OPERATION_SCOPE_INVALID";
      ACCEPTED_RELEASE_CHANGED: "ACCEPTED_RELEASE_CHANGED";
      MESSAGE_KEY_REUSED: "MESSAGE_KEY_REUSED";
      RUN_NOT_WRITABLE: "RUN_NOT_WRITABLE";
      EVENT_CURSOR_INVALID: "EVENT_CURSOR_INVALID";
      CONTENT_UNAVAILABLE: "CONTENT_UNAVAILABLE";
      QUESTION_SUPERSEDED: "QUESTION_SUPERSEDED";
      ANSWER_INVALID: "ANSWER_INVALID";
      INTERPRETATION_NOT_FAILED: "INTERPRETATION_NOT_FAILED";
      REQUIRED_QUESTIONS_UNANSWERED: "REQUIRED_QUESTIONS_UNANSWERED";
      INTERPRETATION_PENDING: "INTERPRETATION_PENDING";
    }>;
    message: z.ZodString;
    requestId: z.core.$ZodBranded<z.ZodString, "req", "out">;
    retryable: z.ZodBoolean;
    details: z.ZodRecord<z.ZodString, z.ZodJSONSchema>;
  }, z.core.$strict>;
}, z.core.$strict>;
declare class ContractError extends Error {
  readonly code: ErrorCode;
  readonly status: 400 | 401 | 403 | 404 | 409 | 412 | 422 | 428 | 429 | 503;
  readonly details: Record<string, z.infer<ReturnType<typeof z.json>>>;
  constructor(code: ErrorCode, status: 400 | 401 | 403 | 404 | 409 | 412 | 422 | 428 | 429 | 503, message: string, details?: Record<string, z.infer<ReturnType<typeof z.json>>>);
  toEnvelope(requestId: string): z.infer<typeof errorEnvelope>;
}
declare function parseContract<S extends z.ZodType>(schema: S, input: unknown): z.output<S>;
//#endregion
//#region src/permits.d.ts
declare const workflowResource: z.ZodObject<{
  resourceId: z.ZodString;
  access: z.ZodEnum<{
    read: "read";
    write: "write";
  }>;
  kind: z.ZodEnum<{
    dataset: "dataset";
    snapshot: "snapshot";
    workspace: "workspace";
    projectRepository: "projectRepository";
  }>;
}, z.core.$strict>;
declare const workflowOwner: z.ZodObject<{
  ownerKind: z.ZodLiteral<"workflowAttempt">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  runEpoch: z.ZodNumber;
  workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
  workEpoch: z.ZodNumber;
  attemptId: z.core.$ZodBranded<z.ZodString, "attempt", "out">;
}, z.core.$strict>;
declare const invocationOwner: z.ZodObject<{
  ownerKind: z.ZodLiteral<"invocationAttempt">;
  invocationId: z.core.$ZodBranded<z.ZodString, "invocation", "out">;
  invocationEpoch: z.ZodNumber;
  invocationAttemptId: z.core.$ZodBranded<z.ZodString, "iattempt", "out">;
}, z.core.$strict>;
declare const executionOwner: z.ZodDiscriminatedUnion<[z.ZodObject<{
  ownerKind: z.ZodLiteral<"workflowAttempt">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  runEpoch: z.ZodNumber;
  workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
  workEpoch: z.ZodNumber;
  attemptId: z.core.$ZodBranded<z.ZodString, "attempt", "out">;
}, z.core.$strict>, z.ZodObject<{
  ownerKind: z.ZodLiteral<"invocationAttempt">;
  invocationId: z.core.$ZodBranded<z.ZodString, "invocation", "out">;
  invocationEpoch: z.ZodNumber;
  invocationAttemptId: z.core.$ZodBranded<z.ZodString, "iattempt", "out">;
}, z.core.$strict>], "ownerKind">;
declare const executionPermit: z.ZodDiscriminatedUnion<[z.ZodObject<{
  ownerKind: z.ZodLiteral<"workflowAttempt">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  runEpoch: z.ZodNumber;
  workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
  workEpoch: z.ZodNumber;
  attemptId: z.core.$ZodBranded<z.ZodString, "attempt", "out">;
  resources: z.ZodArray<z.ZodObject<{
    resourceId: z.ZodString;
    access: z.ZodEnum<{
      read: "read";
      write: "write";
    }>;
    kind: z.ZodEnum<{
      dataset: "dataset";
      snapshot: "snapshot";
      workspace: "workspace";
      projectRepository: "projectRepository";
    }>;
  }, z.core.$strict>>;
  schemaVersion: z.ZodLiteral<"devmesh.permit.v1">;
  grantId: z.core.$ZodBranded<z.ZodString, "grant", "out">;
  activationId: z.core.$ZodBranded<z.ZodString, "activation", "out">;
  notBefore: z.ZodISODateTime;
  expiresAt: z.ZodISODateTime;
}, z.core.$strict>, z.ZodObject<{
  ownerKind: z.ZodLiteral<"invocationAttempt">;
  invocationId: z.core.$ZodBranded<z.ZodString, "invocation", "out">;
  invocationEpoch: z.ZodNumber;
  invocationAttemptId: z.core.$ZodBranded<z.ZodString, "iattempt", "out">;
  resources: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
    kind: z.ZodLiteral<"snapshot">;
    resourceId: z.ZodString;
    access: z.ZodLiteral<"read">;
  }, z.core.$strict>, z.ZodObject<{
    resourceId: z.ZodString;
    access: z.ZodEnum<{
      read: "read";
      write: "write";
    }>;
    kind: z.ZodLiteral<"workspace">;
  }, z.core.$strict>], "kind">>;
  schemaVersion: z.ZodLiteral<"devmesh.permit.v1">;
  grantId: z.core.$ZodBranded<z.ZodString, "grant", "out">;
  activationId: z.core.$ZodBranded<z.ZodString, "activation", "out">;
  notBefore: z.ZodISODateTime;
  expiresAt: z.ZodISODateTime;
}, z.core.$strict>], "ownerKind">;
type ExecutionOwner = z.infer<typeof executionOwner>;
type ExecutionPermit = z.infer<typeof executionPermit>;
type ResourceRequest = z.infer<typeof workflowResource>;
/** authority is read from authenticated, committed grant/host facts, never caller JSON. */
declare function assertPermit(input: unknown, authority: ExecutionPermit, requested: ResourceRequest, nowMs: number): ExecutionPermit;
//#endregion
//#region src/versions.d.ts
declare const strongETag: z.ZodString;
declare const contentBasis: z.ZodObject<{
  revision: z.ZodNumber;
  reviewHash: z.ZodString;
}, z.core.$strict>;
type ContentBasis = z.infer<typeof contentBasis>;
/** Invoke only for NEW operations, after authentication, ACL and idempotency lookup. */
declare function assertResourceVersion(ifMatch: string | undefined, currentRevision: number): void;
declare function assertContentBasis(submitted: ContentBasis, current: ContentBasis, kind?: 'plan' | 'content'): void;
//#endregion
//#region src/outputs.d.ts
declare const relativeFile: z.ZodString;
declare const sourceRef: z.ZodDiscriminatedUnion<[z.ZodObject<{
  artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
  sha256: z.ZodString;
  kind: z.ZodLiteral<"artifact">;
}, z.core.$strict>, z.ZodObject<{
  kind: z.ZodLiteral<"message">;
  messageId: z.core.$ZodBranded<z.ZodString, "message", "out">;
}, z.core.$strict>, z.ZodObject<{
  kind: z.ZodLiteral<"requirement">;
  requirementId: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
  requirementRevision: z.ZodNumber;
}, z.core.$strict>], "kind">;
declare const requirement: z.ZodObject<{
  id: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
  statement: z.ZodString;
  sourceRefs: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
    artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
    sha256: z.ZodString;
    kind: z.ZodLiteral<"artifact">;
  }, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"message">;
    messageId: z.core.$ZodBranded<z.ZodString, "message", "out">;
  }, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"requirement">;
    requirementId: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
    requirementRevision: z.ZodNumber;
  }, z.core.$strict>], "kind">>;
  acceptance: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
declare const question: z.ZodObject<{
  id: z.core.$ZodBranded<z.ZodString, "question", "out">;
  required: z.ZodBoolean;
  reason: z.ZodString;
  blockingScope: z.ZodArray<z.core.$ZodBranded<z.ZodString, "work", "out">>;
  defaultOption: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
declare const completionCheck: z.ZodDiscriminatedUnion<[z.ZodObject<{
  kind: z.ZodLiteral<"artifact-exists">;
  outputSlot: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
  kind: z.ZodLiteral<"schema-valid">;
  outputSlot: z.ZodString;
  schemaId: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
  kind: z.ZodLiteral<"commit-resolved">;
  outputSlot: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
  kind: z.ZodLiteral<"command-exit-zero">;
  checkId: z.core.$ZodBranded<z.ZodString, "check", "out">;
}, z.core.$strict>, z.ZodObject<{
  kind: z.ZodLiteral<"required-tests-pass">;
  checkId: z.core.$ZodBranded<z.ZodString, "check", "out">;
}, z.core.$strict>, z.ZodObject<{
  kind: z.ZodLiteral<"coverage-threshold">;
  lines: z.ZodNumber;
  branches: z.ZodNumber;
}, z.core.$strict>, z.ZodObject<{
  kind: z.ZodLiteral<"human-decision">;
  checkId: z.core.$ZodBranded<z.ZodString, "check", "out">;
}, z.core.$strict>], "kind">;
declare const workRevision: z.ZodObject<{
  workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
  workRevision: z.ZodNumber;
  role: z.ZodEnum<{
    product: "product";
    architect: "architect";
    developer: "developer";
    tester: "tester";
  }>;
  goal: z.ZodString;
  inputRefs: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
    artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
    sha256: z.ZodString;
    kind: z.ZodLiteral<"artifact">;
  }, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"output">;
    workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
    outputSlot: z.ZodString;
  }, z.core.$strict>], "kind">>;
  outputSpec: z.ZodArray<z.ZodObject<{
    slot: z.ZodString;
    schemaId: z.ZodString;
  }, z.core.$strict>>;
  completionChecks: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
    kind: z.ZodLiteral<"artifact-exists">;
    outputSlot: z.ZodString;
  }, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"schema-valid">;
    outputSlot: z.ZodString;
    schemaId: z.ZodString;
  }, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"commit-resolved">;
    outputSlot: z.ZodString;
  }, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"command-exit-zero">;
    checkId: z.core.$ZodBranded<z.ZodString, "check", "out">;
  }, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"required-tests-pass">;
    checkId: z.core.$ZodBranded<z.ZodString, "check", "out">;
  }, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"coverage-threshold">;
    lines: z.ZodNumber;
    branches: z.ZodNumber;
  }, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"human-decision">;
    checkId: z.core.$ZodBranded<z.ZodString, "check", "out">;
  }, z.core.$strict>], "kind">>;
  dependencies: z.ZodArray<z.ZodObject<{
    workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
    requiredOutcome: z.ZodEnum<{
      success: "success";
      "completed-with-findings": "completed-with-findings";
    }>;
  }, z.core.$strict>>;
  writeScope: z.ZodArray<z.ZodString>;
  estimatedResources: z.ZodObject<{
    cpu: z.ZodNumber;
    memoryMiB: z.ZodNumber;
    timeoutMs: z.ZodNumber;
  }, z.core.$strict>;
  requirementIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "requirement", "out">>;
}, z.core.$strict>;
declare const planDraft: z.ZodObject<{
  requirementRevision: z.ZodNumber;
  works: z.ZodArray<z.ZodObject<{
    workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
    workRevision: z.ZodNumber;
    role: z.ZodEnum<{
      product: "product";
      architect: "architect";
      developer: "developer";
      tester: "tester";
    }>;
    goal: z.ZodString;
    inputRefs: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
      kind: z.ZodLiteral<"artifact">;
    }, z.core.$strict>, z.ZodObject<{
      kind: z.ZodLiteral<"output">;
      workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
      outputSlot: z.ZodString;
    }, z.core.$strict>], "kind">>;
    outputSpec: z.ZodArray<z.ZodObject<{
      slot: z.ZodString;
      schemaId: z.ZodString;
    }, z.core.$strict>>;
    completionChecks: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
      kind: z.ZodLiteral<"artifact-exists">;
      outputSlot: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
      kind: z.ZodLiteral<"schema-valid">;
      outputSlot: z.ZodString;
      schemaId: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
      kind: z.ZodLiteral<"commit-resolved">;
      outputSlot: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
      kind: z.ZodLiteral<"command-exit-zero">;
      checkId: z.core.$ZodBranded<z.ZodString, "check", "out">;
    }, z.core.$strict>, z.ZodObject<{
      kind: z.ZodLiteral<"required-tests-pass">;
      checkId: z.core.$ZodBranded<z.ZodString, "check", "out">;
    }, z.core.$strict>, z.ZodObject<{
      kind: z.ZodLiteral<"coverage-threshold">;
      lines: z.ZodNumber;
      branches: z.ZodNumber;
    }, z.core.$strict>, z.ZodObject<{
      kind: z.ZodLiteral<"human-decision">;
      checkId: z.core.$ZodBranded<z.ZodString, "check", "out">;
    }, z.core.$strict>], "kind">>;
    dependencies: z.ZodArray<z.ZodObject<{
      workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
      requiredOutcome: z.ZodEnum<{
        success: "success";
        "completed-with-findings": "completed-with-findings";
      }>;
    }, z.core.$strict>>;
    writeScope: z.ZodArray<z.ZodString>;
    estimatedResources: z.ZodObject<{
      cpu: z.ZodNumber;
      memoryMiB: z.ZodNumber;
      timeoutMs: z.ZodNumber;
    }, z.core.$strict>;
    requirementIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "requirement", "out">>;
  }, z.core.$strict>>;
}, z.core.$strict>;
declare const productOutput: z.ZodObject<{
  schemaVersion: z.ZodLiteral<"devmesh.requirements.v1">;
  role: z.ZodLiteral<"product">;
  requirements: z.ZodArray<z.ZodObject<{
    id: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
    statement: z.ZodString;
    sourceRefs: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
      kind: z.ZodLiteral<"artifact">;
    }, z.core.$strict>, z.ZodObject<{
      kind: z.ZodLiteral<"message">;
      messageId: z.core.$ZodBranded<z.ZodString, "message", "out">;
    }, z.core.$strict>, z.ZodObject<{
      kind: z.ZodLiteral<"requirement">;
      requirementId: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
      requirementRevision: z.ZodNumber;
    }, z.core.$strict>], "kind">>;
    acceptance: z.ZodArray<z.ZodString>;
  }, z.core.$strict>>;
  assumptions: z.ZodArray<z.ZodString>;
  questions: z.ZodArray<z.ZodObject<{
    id: z.core.$ZodBranded<z.ZodString, "question", "out">;
    required: z.ZodBoolean;
    reason: z.ZodString;
    blockingScope: z.ZodArray<z.core.$ZodBranded<z.ZodString, "work", "out">>;
    defaultOption: z.ZodOptional<z.ZodString>;
  }, z.core.$strict>>;
}, z.core.$strict>;
declare const architectOutput: z.ZodObject<{
  schemaVersion: z.ZodLiteral<"devmesh.architecture.v1">;
  role: z.ZodLiteral<"architect">;
  interfaces: z.ZodArray<z.ZodObject<{
    name: z.ZodString;
    specificationRef: z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
    }, z.core.$strict>;
  }, z.core.$strict>>;
  planDraft: z.ZodObject<{
    requirementRevision: z.ZodNumber;
    works: z.ZodArray<z.ZodObject<{
      workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
      workRevision: z.ZodNumber;
      role: z.ZodEnum<{
        product: "product";
        architect: "architect";
        developer: "developer";
        tester: "tester";
      }>;
      goal: z.ZodString;
      inputRefs: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
        sha256: z.ZodString;
        kind: z.ZodLiteral<"artifact">;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"output">;
        workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
        outputSlot: z.ZodString;
      }, z.core.$strict>], "kind">>;
      outputSpec: z.ZodArray<z.ZodObject<{
        slot: z.ZodString;
        schemaId: z.ZodString;
      }, z.core.$strict>>;
      completionChecks: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"artifact-exists">;
        outputSlot: z.ZodString;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"schema-valid">;
        outputSlot: z.ZodString;
        schemaId: z.ZodString;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"commit-resolved">;
        outputSlot: z.ZodString;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"command-exit-zero">;
        checkId: z.core.$ZodBranded<z.ZodString, "check", "out">;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"required-tests-pass">;
        checkId: z.core.$ZodBranded<z.ZodString, "check", "out">;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"coverage-threshold">;
        lines: z.ZodNumber;
        branches: z.ZodNumber;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"human-decision">;
        checkId: z.core.$ZodBranded<z.ZodString, "check", "out">;
      }, z.core.$strict>], "kind">>;
      dependencies: z.ZodArray<z.ZodObject<{
        workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
        requiredOutcome: z.ZodEnum<{
          success: "success";
          "completed-with-findings": "completed-with-findings";
        }>;
      }, z.core.$strict>>;
      writeScope: z.ZodArray<z.ZodString>;
      estimatedResources: z.ZodObject<{
        cpu: z.ZodNumber;
        memoryMiB: z.ZodNumber;
        timeoutMs: z.ZodNumber;
      }, z.core.$strict>;
      requirementIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "requirement", "out">>;
    }, z.core.$strict>>;
  }, z.core.$strict>;
  risks: z.ZodArray<z.ZodString>;
  capabilityFit: z.ZodObject<{
    supported: z.ZodBoolean;
    gaps: z.ZodArray<z.ZodString>;
  }, z.core.$strict>;
}, z.core.$strict>;
declare const developerOutput: z.ZodObject<{
  schemaVersion: z.ZodLiteral<"devmesh.development-result.v1">;
  role: z.ZodLiteral<"developer">;
  baseCommit: z.ZodString;
  resultCommit: z.ZodString;
  changedFiles: z.ZodArray<z.ZodString>;
  checkRefs: z.ZodArray<z.ZodObject<{
    artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
    sha256: z.ZodString;
  }, z.core.$strict>>;
  unverified: z.ZodArray<z.ZodString>;
  handoffProposal: z.ZodNullable<z.ZodObject<{
    targetRole: z.ZodEnum<{
      product: "product";
      architect: "architect";
      developer: "developer";
      tester: "tester";
    }>;
    goal: z.ZodString;
    artifactRefs: z.ZodArray<z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
    }, z.core.$strict>>;
    reason: z.ZodString;
  }, z.core.$strict>>;
}, z.core.$strict>;
declare const testerOutput: z.ZodObject<{
  schemaVersion: z.ZodLiteral<"devmesh.test-result.v1">;
  role: z.ZodLiteral<"tester">;
  targetCommit: z.ZodString;
  caseResults: z.ZodArray<z.ZodObject<{
    checkId: z.core.$ZodBranded<z.ZodString, "check", "out">;
    requirementIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "requirement", "out">>;
    status: z.ZodEnum<{
      FAILED: "FAILED";
      PASSED: "PASSED";
      SKIPPED: "SKIPPED";
      MISSING: "MISSING";
    }>;
    reportRef: z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
      targetCommit: z.ZodString;
    }, z.core.$strict>;
  }, z.core.$strict>>;
  coverageRef: z.ZodObject<{
    artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
    sha256: z.ZodString;
    targetCommit: z.ZodString;
  }, z.core.$strict>;
  defects: z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    severity: z.ZodEnum<{
      LOW: "LOW";
      MEDIUM: "MEDIUM";
      HIGH: "HIGH";
      CRITICAL: "CRITICAL";
    }>;
    description: z.ZodString;
    evidenceRefs: z.ZodArray<z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
    }, z.core.$strict>>;
  }, z.core.$strict>>;
  buildRef: z.ZodObject<{
    artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
    sha256: z.ZodString;
    targetCommit: z.ZodString;
  }, z.core.$strict>;
  previewRef: z.ZodOptional<z.ZodObject<{
    artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
    sha256: z.ZodString;
    targetCommit: z.ZodString;
  }, z.core.$strict>>;
}, z.core.$strict>;
declare const roleOutput: z.ZodDiscriminatedUnion<[z.ZodObject<{
  schemaVersion: z.ZodLiteral<"devmesh.requirements.v1">;
  role: z.ZodLiteral<"product">;
  requirements: z.ZodArray<z.ZodObject<{
    id: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
    statement: z.ZodString;
    sourceRefs: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
      kind: z.ZodLiteral<"artifact">;
    }, z.core.$strict>, z.ZodObject<{
      kind: z.ZodLiteral<"message">;
      messageId: z.core.$ZodBranded<z.ZodString, "message", "out">;
    }, z.core.$strict>, z.ZodObject<{
      kind: z.ZodLiteral<"requirement">;
      requirementId: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
      requirementRevision: z.ZodNumber;
    }, z.core.$strict>], "kind">>;
    acceptance: z.ZodArray<z.ZodString>;
  }, z.core.$strict>>;
  assumptions: z.ZodArray<z.ZodString>;
  questions: z.ZodArray<z.ZodObject<{
    id: z.core.$ZodBranded<z.ZodString, "question", "out">;
    required: z.ZodBoolean;
    reason: z.ZodString;
    blockingScope: z.ZodArray<z.core.$ZodBranded<z.ZodString, "work", "out">>;
    defaultOption: z.ZodOptional<z.ZodString>;
  }, z.core.$strict>>;
}, z.core.$strict>, z.ZodObject<{
  schemaVersion: z.ZodLiteral<"devmesh.architecture.v1">;
  role: z.ZodLiteral<"architect">;
  interfaces: z.ZodArray<z.ZodObject<{
    name: z.ZodString;
    specificationRef: z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
    }, z.core.$strict>;
  }, z.core.$strict>>;
  planDraft: z.ZodObject<{
    requirementRevision: z.ZodNumber;
    works: z.ZodArray<z.ZodObject<{
      workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
      workRevision: z.ZodNumber;
      role: z.ZodEnum<{
        product: "product";
        architect: "architect";
        developer: "developer";
        tester: "tester";
      }>;
      goal: z.ZodString;
      inputRefs: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
        sha256: z.ZodString;
        kind: z.ZodLiteral<"artifact">;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"output">;
        workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
        outputSlot: z.ZodString;
      }, z.core.$strict>], "kind">>;
      outputSpec: z.ZodArray<z.ZodObject<{
        slot: z.ZodString;
        schemaId: z.ZodString;
      }, z.core.$strict>>;
      completionChecks: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"artifact-exists">;
        outputSlot: z.ZodString;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"schema-valid">;
        outputSlot: z.ZodString;
        schemaId: z.ZodString;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"commit-resolved">;
        outputSlot: z.ZodString;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"command-exit-zero">;
        checkId: z.core.$ZodBranded<z.ZodString, "check", "out">;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"required-tests-pass">;
        checkId: z.core.$ZodBranded<z.ZodString, "check", "out">;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"coverage-threshold">;
        lines: z.ZodNumber;
        branches: z.ZodNumber;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"human-decision">;
        checkId: z.core.$ZodBranded<z.ZodString, "check", "out">;
      }, z.core.$strict>], "kind">>;
      dependencies: z.ZodArray<z.ZodObject<{
        workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
        requiredOutcome: z.ZodEnum<{
          success: "success";
          "completed-with-findings": "completed-with-findings";
        }>;
      }, z.core.$strict>>;
      writeScope: z.ZodArray<z.ZodString>;
      estimatedResources: z.ZodObject<{
        cpu: z.ZodNumber;
        memoryMiB: z.ZodNumber;
        timeoutMs: z.ZodNumber;
      }, z.core.$strict>;
      requirementIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "requirement", "out">>;
    }, z.core.$strict>>;
  }, z.core.$strict>;
  risks: z.ZodArray<z.ZodString>;
  capabilityFit: z.ZodObject<{
    supported: z.ZodBoolean;
    gaps: z.ZodArray<z.ZodString>;
  }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
  schemaVersion: z.ZodLiteral<"devmesh.development-result.v1">;
  role: z.ZodLiteral<"developer">;
  baseCommit: z.ZodString;
  resultCommit: z.ZodString;
  changedFiles: z.ZodArray<z.ZodString>;
  checkRefs: z.ZodArray<z.ZodObject<{
    artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
    sha256: z.ZodString;
  }, z.core.$strict>>;
  unverified: z.ZodArray<z.ZodString>;
  handoffProposal: z.ZodNullable<z.ZodObject<{
    targetRole: z.ZodEnum<{
      product: "product";
      architect: "architect";
      developer: "developer";
      tester: "tester";
    }>;
    goal: z.ZodString;
    artifactRefs: z.ZodArray<z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
    }, z.core.$strict>>;
    reason: z.ZodString;
  }, z.core.$strict>>;
}, z.core.$strict>, z.ZodObject<{
  schemaVersion: z.ZodLiteral<"devmesh.test-result.v1">;
  role: z.ZodLiteral<"tester">;
  targetCommit: z.ZodString;
  caseResults: z.ZodArray<z.ZodObject<{
    checkId: z.core.$ZodBranded<z.ZodString, "check", "out">;
    requirementIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "requirement", "out">>;
    status: z.ZodEnum<{
      FAILED: "FAILED";
      PASSED: "PASSED";
      SKIPPED: "SKIPPED";
      MISSING: "MISSING";
    }>;
    reportRef: z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
      targetCommit: z.ZodString;
    }, z.core.$strict>;
  }, z.core.$strict>>;
  coverageRef: z.ZodObject<{
    artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
    sha256: z.ZodString;
    targetCommit: z.ZodString;
  }, z.core.$strict>;
  defects: z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    severity: z.ZodEnum<{
      LOW: "LOW";
      MEDIUM: "MEDIUM";
      HIGH: "HIGH";
      CRITICAL: "CRITICAL";
    }>;
    description: z.ZodString;
    evidenceRefs: z.ZodArray<z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
    }, z.core.$strict>>;
  }, z.core.$strict>>;
  buildRef: z.ZodObject<{
    artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
    sha256: z.ZodString;
    targetCommit: z.ZodString;
  }, z.core.$strict>;
  previewRef: z.ZodOptional<z.ZodObject<{
    artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
    sha256: z.ZodString;
    targetCommit: z.ZodString;
  }, z.core.$strict>>;
}, z.core.$strict>], "role">;
type RoleOutput = z.infer<typeof roleOutput>;
type WorkRevision = z.infer<typeof workRevision>;
declare const workDelegation: z.ZodObject<{
  schemaVersion: z.ZodLiteral<"devmesh.work.v1">;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
  workRevision: z.ZodNumber;
  attemptId: z.core.$ZodBranded<z.ZodString, "attempt", "out">;
  endpointId: z.ZodString;
  endpointRevision: z.ZodNumber;
  grantId: z.core.$ZodBranded<z.ZodString, "grant", "out">;
  activationId: z.core.$ZodBranded<z.ZodString, "activation", "out">;
  runEpoch: z.ZodNumber;
  workEpoch: z.ZodNumber;
  requirementRevision: z.ZodNumber;
  planRevision: z.ZodNumber;
  inputManifestId: z.core.$ZodBranded<z.ZodString, "manifest", "out">;
  roleSnapshotId: z.core.$ZodBranded<z.ZodString, "role", "out">;
  originRole: z.ZodEnum<{
    product: "product";
    architect: "architect";
    developer: "developer";
    tester: "tester";
  }>;
  targetRole: z.ZodEnum<{
    product: "product";
    architect: "architect";
    developer: "developer";
    tester: "tester";
  }>;
  requestedOutputSchema: z.ZodString;
}, z.core.$strict>;
declare const invocationDelegation: z.ZodObject<{
  schemaVersion: z.ZodLiteral<"devmesh.invocation.v1">;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  invocationId: z.core.$ZodBranded<z.ZodString, "invocation", "out">;
  invocationAttemptId: z.core.$ZodBranded<z.ZodString, "iattempt", "out">;
  invocationEpoch: z.ZodNumber;
  activationId: z.core.$ZodBranded<z.ZodString, "activation", "out">;
  grantId: z.core.$ZodBranded<z.ZodString, "grant", "out">;
  endpointId: z.ZodString;
  endpointRevision: z.ZodNumber;
  inputManifestRef: z.ZodObject<{
    artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
    sha256: z.ZodString;
  }, z.core.$strict>;
  definitionSnapshotRef: z.ZodObject<{
    artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
    sha256: z.ZodString;
  }, z.core.$strict>;
}, z.core.$strict>;
declare const inputManifest: z.ZodObject<{
  schemaVersion: z.ZodLiteral<"devmesh.input-manifest.v1">;
  requirements: z.ZodArray<z.ZodObject<{
    requirementId: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
    sha256: z.ZodString;
  }, z.core.$strict>>;
  interfaces: z.ZodArray<z.ZodObject<{
    artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
    sha256: z.ZodString;
  }, z.core.$strict>>;
  artifacts: z.ZodArray<z.ZodObject<{
    artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
    sha256: z.ZodString;
  }, z.core.$strict>>;
  codeCommit: z.ZodNullable<z.ZodString>;
  templateVersion: z.ZodString;
  checkConfigHash: z.ZodString;
  decisionIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "decision", "out">>;
}, z.core.$strict>;
//#endregion
//#region src/commands.d.ts
declare const idempotencyKey: z.ZodUUID;
declare const commandBodies: {
  readonly CreateProject: z.ZodObject<{
    initialRequest: z.ZodObject<{
      text: z.ZodUnion<readonly [z.ZodString, z.ZodLiteral<"">]>;
      attachmentIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "attachment", "out">>;
    }, z.core.$strict>;
    clientDraftId: z.ZodUUID;
    name: z.ZodOptional<z.ZodString>;
  }, z.core.$strict>;
  readonly SaveMessage: z.ZodObject<{
    text: z.ZodString;
    attachmentIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "attachment", "out">>;
    clientMessageId: z.ZodUUID;
    intentHint: z.ZodOptional<z.ZodEnum<{
      change: "change";
      query: "query";
      unsure: "unsure";
    }>>;
  }, z.core.$strict>;
  readonly AnswerQuestions: z.ZodObject<{
    answers: z.ZodArray<z.ZodObject<{
      questionId: z.core.$ZodBranded<z.ZodString, "question", "out">;
      questionRevision: z.ZodNumber;
      value: z.ZodJSONSchema;
    }, z.core.$strict>>;
  }, z.core.$strict>;
  readonly ConfirmPlan: z.ZodObject<{
    requirementRevision: z.ZodNumber;
    reviewHash: z.ZodString;
    carryForwardHash: z.ZodOptional<z.ZodString>;
  }, z.core.$strict>;
  readonly PlanFeedback: z.ZodObject<{
    text: z.ZodString;
    workIds: z.ZodOptional<z.ZodArray<z.core.$ZodBranded<z.ZodString, "work", "out">>>;
  }, z.core.$strict>;
  readonly ProposeChange: z.ZodObject<{
    proposedText: z.ZodString;
    sourceMessageId: z.core.$ZodBranded<z.ZodString, "message", "out">;
  }, z.core.$strict>;
  readonly DecideChange: z.ZodObject<{
    action: z.ZodEnum<{
      confirm: "confirm";
      reject: "reject";
    }>;
    analysisId: z.core.$ZodBranded<z.ZodString, "analysis", "out">;
    basisHash: z.ZodString;
  }, z.core.$strict>;
  readonly PauseRun: z.ZodObject<{
    reason: z.ZodOptional<z.ZodString>;
  }, z.core.$strict>;
  readonly ResumeRun: z.ZodObject<{
    controlRevision: z.ZodNumber;
    recoveryReviewHash: z.ZodString;
  }, z.core.$strict>;
  readonly CancelRun: z.ZodObject<{
    impactReviewHash: z.ZodString;
  }, z.core.$strict>;
  readonly RetryWork: z.ZodObject<{
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    failedAttemptId: z.core.$ZodBranded<z.ZodString, "attempt", "out">;
    retryReviewHash: z.ZodString;
  }, z.core.$strict>;
  readonly RedoRun: z.ZodObject<{
    redoReviewHash: z.ZodString;
  }, z.core.$strict>;
  readonly AcceptCandidate: z.ZodObject<{
    candidateRevision: z.ZodNumber;
    manifestHash: z.ZodString;
    reviewHash: z.ZodString;
    expectedAcceptedReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
    dataPlanHash: z.ZodString;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    preparationOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    requestHash: z.ZodString;
    expectedPreparationRevision: z.ZodNumber;
    expectedObservationSequence: z.ZodNumber;
    proofHash: z.ZodString;
    confirmation: z.ZodLiteral<"ACCEPT_RELEASE">;
  }, z.core.$strict>;
};
declare const commandTarget: z.ZodDiscriminatedUnion<[z.ZodObject<{
  kind: z.ZodLiteral<"creation">;
  namespace: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
  kind: z.ZodLiteral<"run">;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
}, z.core.$strict>, z.ZodObject<{
  kind: z.ZodLiteral<"plan">;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  planRevision: z.ZodNumber;
}, z.core.$strict>, z.ZodObject<{
  kind: z.ZodLiteral<"work">;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
}, z.core.$strict>, z.ZodObject<{
  kind: z.ZodLiteral<"change">;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  changeId: z.core.$ZodBranded<z.ZodString, "change", "out">;
}, z.core.$strict>, z.ZodObject<{
  kind: z.ZodLiteral<"candidate">;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
}, z.core.$strict>], "kind">;
declare const command: z.ZodDiscriminatedUnion<[z.ZodObject<{
  schemaVersion: z.ZodLiteral<1>;
  type: z.ZodLiteral<"CreateProject">;
  idempotencyKey: z.ZodUUID;
  target: z.ZodObject<{
    kind: z.ZodLiteral<"creation">;
    namespace: z.ZodString;
  }, z.core.$strict>;
  payload: z.ZodObject<{
    initialRequest: z.ZodObject<{
      text: z.ZodUnion<readonly [z.ZodString, z.ZodLiteral<"">]>;
      attachmentIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "attachment", "out">>;
    }, z.core.$strict>;
    clientDraftId: z.ZodUUID;
    name: z.ZodOptional<z.ZodString>;
  }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
  schemaVersion: z.ZodLiteral<1>;
  type: z.ZodLiteral<"SaveMessage">;
  idempotencyKey: z.ZodUUID;
  target: z.ZodObject<{
    kind: z.ZodLiteral<"run">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  }, z.core.$strict>;
  payload: z.ZodObject<{
    text: z.ZodString;
    attachmentIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "attachment", "out">>;
    clientMessageId: z.ZodUUID;
    intentHint: z.ZodOptional<z.ZodEnum<{
      change: "change";
      query: "query";
      unsure: "unsure";
    }>>;
  }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
  schemaVersion: z.ZodLiteral<1>;
  type: z.ZodLiteral<"AnswerQuestions">;
  idempotencyKey: z.ZodUUID;
  target: z.ZodObject<{
    kind: z.ZodLiteral<"run">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  }, z.core.$strict>;
  payload: z.ZodObject<{
    answers: z.ZodArray<z.ZodObject<{
      questionId: z.core.$ZodBranded<z.ZodString, "question", "out">;
      questionRevision: z.ZodNumber;
      value: z.ZodJSONSchema;
    }, z.core.$strict>>;
  }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
  schemaVersion: z.ZodLiteral<1>;
  type: z.ZodLiteral<"ConfirmPlan">;
  idempotencyKey: z.ZodUUID;
  target: z.ZodObject<{
    kind: z.ZodLiteral<"plan">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    planRevision: z.ZodNumber;
  }, z.core.$strict>;
  payload: z.ZodObject<{
    requirementRevision: z.ZodNumber;
    reviewHash: z.ZodString;
    carryForwardHash: z.ZodOptional<z.ZodString>;
  }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
  schemaVersion: z.ZodLiteral<1>;
  type: z.ZodLiteral<"PlanFeedback">;
  idempotencyKey: z.ZodUUID;
  target: z.ZodObject<{
    kind: z.ZodLiteral<"plan">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    planRevision: z.ZodNumber;
  }, z.core.$strict>;
  payload: z.ZodObject<{
    text: z.ZodString;
    workIds: z.ZodOptional<z.ZodArray<z.core.$ZodBranded<z.ZodString, "work", "out">>>;
  }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
  schemaVersion: z.ZodLiteral<1>;
  type: z.ZodLiteral<"ProposeChange">;
  idempotencyKey: z.ZodUUID;
  target: z.ZodObject<{
    kind: z.ZodLiteral<"run">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  }, z.core.$strict>;
  payload: z.ZodObject<{
    proposedText: z.ZodString;
    sourceMessageId: z.core.$ZodBranded<z.ZodString, "message", "out">;
  }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
  schemaVersion: z.ZodLiteral<1>;
  type: z.ZodLiteral<"DecideChange">;
  idempotencyKey: z.ZodUUID;
  target: z.ZodObject<{
    kind: z.ZodLiteral<"change">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    changeId: z.core.$ZodBranded<z.ZodString, "change", "out">;
  }, z.core.$strict>;
  payload: z.ZodObject<{
    action: z.ZodEnum<{
      confirm: "confirm";
      reject: "reject";
    }>;
    analysisId: z.core.$ZodBranded<z.ZodString, "analysis", "out">;
    basisHash: z.ZodString;
  }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
  schemaVersion: z.ZodLiteral<1>;
  type: z.ZodLiteral<"PauseRun">;
  idempotencyKey: z.ZodUUID;
  target: z.ZodObject<{
    kind: z.ZodLiteral<"run">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  }, z.core.$strict>;
  payload: z.ZodObject<{
    reason: z.ZodOptional<z.ZodString>;
  }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
  schemaVersion: z.ZodLiteral<1>;
  type: z.ZodLiteral<"ResumeRun">;
  idempotencyKey: z.ZodUUID;
  target: z.ZodObject<{
    kind: z.ZodLiteral<"run">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  }, z.core.$strict>;
  payload: z.ZodObject<{
    controlRevision: z.ZodNumber;
    recoveryReviewHash: z.ZodString;
  }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
  schemaVersion: z.ZodLiteral<1>;
  type: z.ZodLiteral<"CancelRun">;
  idempotencyKey: z.ZodUUID;
  target: z.ZodObject<{
    kind: z.ZodLiteral<"run">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  }, z.core.$strict>;
  payload: z.ZodObject<{
    impactReviewHash: z.ZodString;
  }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
  schemaVersion: z.ZodLiteral<1>;
  type: z.ZodLiteral<"RetryWork">;
  idempotencyKey: z.ZodUUID;
  target: z.ZodObject<{
    kind: z.ZodLiteral<"work">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
  }, z.core.$strict>;
  payload: z.ZodObject<{
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    failedAttemptId: z.core.$ZodBranded<z.ZodString, "attempt", "out">;
    retryReviewHash: z.ZodString;
  }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
  schemaVersion: z.ZodLiteral<1>;
  type: z.ZodLiteral<"RedoRun">;
  idempotencyKey: z.ZodUUID;
  target: z.ZodObject<{
    kind: z.ZodLiteral<"run">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  }, z.core.$strict>;
  payload: z.ZodObject<{
    redoReviewHash: z.ZodString;
  }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
  schemaVersion: z.ZodLiteral<1>;
  type: z.ZodLiteral<"AcceptCandidate">;
  idempotencyKey: z.ZodUUID;
  target: z.ZodObject<{
    kind: z.ZodLiteral<"candidate">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
  }, z.core.$strict>;
  payload: z.ZodObject<{
    candidateRevision: z.ZodNumber;
    manifestHash: z.ZodString;
    reviewHash: z.ZodString;
    expectedAcceptedReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
    dataPlanHash: z.ZodString;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    preparationOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    requestHash: z.ZodString;
    expectedPreparationRevision: z.ZodNumber;
    expectedObservationSequence: z.ZodNumber;
    proofHash: z.ZodString;
    confirmation: z.ZodLiteral<"ACCEPT_RELEASE">;
  }, z.core.$strict>;
}, z.core.$strict>], "type">;
type Command = z.infer<typeof command>;
declare const operationReceipt: z.ZodObject<{
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  status: z.ZodEnum<{
    FAILED: "FAILED";
    OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN";
    SUCCEEDED: "SUCCEEDED";
    RUNNING: "RUNNING";
    ACCEPTED: "ACCEPTED";
    WAITING: "WAITING";
  }>;
  resource: z.ZodObject<{
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    revision: z.ZodNumber;
  }, z.core.$strict>;
  links: z.ZodObject<{
    operation: z.ZodString;
  }, z.core.$strict>;
  result: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodJSONSchema>>;
}, z.core.$strict>;
//#endregion
//#region src/input.d.ts
declare const workbenchSourceView: z.ZodObject<{
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  ref: z.ZodDiscriminatedUnion<[z.ZodObject<{
    artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
    sha256: z.ZodString;
    kind: z.ZodLiteral<"artifact">;
  }, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"message">;
    messageId: z.core.$ZodBranded<z.ZodString, "message", "out">;
  }, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"requirement">;
    requirementId: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
    requirementRevision: z.ZodNumber;
  }, z.core.$strict>], "kind">;
  label: z.ZodString;
  body: z.ZodDiscriminatedUnion<[z.ZodObject<{
    kind: z.ZodLiteral<"text">;
    text: z.ZodString;
  }, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"requirement">;
    requirement: z.ZodObject<{
      id: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
      statement: z.ZodString;
      sourceRefs: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
        sha256: z.ZodString;
        kind: z.ZodLiteral<"artifact">;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"message">;
        messageId: z.core.$ZodBranded<z.ZodString, "message", "out">;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"requirement">;
        requirementId: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
        requirementRevision: z.ZodNumber;
      }, z.core.$strict>], "kind">>;
      acceptance: z.ZodArray<z.ZodString>;
    }, z.core.$strict>;
  }, z.core.$strict>], "kind">;
}, z.core.$strict>;
declare const inputLimits: Readonly<{
  textCodePoints: 20000;
  attachments: 3;
  attachmentBytes: number;
  jsonBytes: number;
}>;
declare const attachmentIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "attachment", "out">>;
declare const attachmentName: z.ZodString;
declare const initialInput: z.ZodObject<{
  text: z.ZodUnion<readonly [z.ZodString, z.ZodLiteral<"">]>;
  attachmentIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "attachment", "out">>;
}, z.core.$strict>;
declare const createProjectInput: z.ZodObject<{
  initialRequest: z.ZodObject<{
    text: z.ZodUnion<readonly [z.ZodString, z.ZodLiteral<"">]>;
    attachmentIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "attachment", "out">>;
  }, z.core.$strict>;
  clientDraftId: z.ZodUUID;
  name: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
declare const createTaskInput: z.ZodObject<{
  kind: z.ZodEnum<{
    ITERATION: "ITERATION";
    FIX: "FIX";
  }>;
  title: z.ZodString;
  goal: z.ZodObject<{
    text: z.ZodUnion<readonly [z.ZodString, z.ZodLiteral<"">]>;
    attachmentIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "attachment", "out">>;
  }, z.core.$strict>;
  baseAcceptedReleaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
  clientDraftId: z.ZodUUID;
}, z.core.$strict>;
declare const saveMessageInput: z.ZodObject<{
  text: z.ZodString;
  attachmentIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "attachment", "out">>;
  clientMessageId: z.ZodUUID;
  intentHint: z.ZodOptional<z.ZodEnum<{
    change: "change";
    query: "query";
    unsure: "unsure";
  }>>;
}, z.core.$strict>;
declare const uploadMetadata: z.ZodObject<{
  clientAttachmentId: z.ZodUUID;
  name: z.ZodString;
}, z.core.$strict>;
declare const attachmentView: z.ZodObject<{
  attachmentId: z.core.$ZodBranded<z.ZodString, "attachment", "out">;
  clientAttachmentId: z.ZodUUID;
  name: z.ZodString;
  byteSize: z.ZodNumber;
  state: z.ZodEnum<{
    READY: "READY";
    REMOVED: "REMOVED";
  }>;
  createdAt: z.ZodISODateTime;
}, z.core.$strict>;
declare const inputOperation: z.ZodObject<{
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  status: z.ZodEnum<{
    FAILED: "FAILED";
    OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN";
    SUCCEEDED: "SUCCEEDED";
    RUNNING: "RUNNING";
    ACCEPTED: "ACCEPTED";
    WAITING: "WAITING";
  }>;
  result: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodJSONSchema>>;
}, z.core.$strict>;
declare const inputOperationLookup: z.ZodObject<{
  principalId: z.ZodString;
  scope: z.ZodString;
  key: z.ZodUUID;
  operation: z.ZodNullable<z.ZodObject<{
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    status: z.ZodEnum<{
      FAILED: "FAILED";
      OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN";
      SUCCEEDED: "SUCCEEDED";
      RUNNING: "RUNNING";
      ACCEPTED: "ACCEPTED";
      WAITING: "WAITING";
    }>;
    result: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodJSONSchema>>;
  }, z.core.$strict>>;
}, z.core.$strict>;
declare const workspaceView: z.ZodObject<{
  project: z.ZodObject<{
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    name: z.ZodString;
    revision: z.ZodNumber;
    acceptedReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
  }, z.core.$strict>;
  run: z.ZodObject<{
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    taskId: z.core.$ZodBranded<z.ZodString, "task", "out">;
    resourceRevision: z.ZodNumber;
    runEpoch: z.ZodNumber;
    controlRevision: z.ZodNumber;
    phase: z.ZodString;
    controlGate: z.ZodString;
    terminalOutcome: z.ZodNullable<z.ZodString>;
    currentPlanRevision: z.ZodNullable<z.ZodNumber>;
    currentRequirementRevision: z.ZodNullable<z.ZodNumber>;
    eventSeq: z.ZodNumber;
  }, z.core.$strict>;
  mode: z.ZodEnum<{
    current: "current";
    history: "history";
  }>;
  membership: z.ZodEnum<{
    owner: "owner";
    operator: "operator";
    viewer: "viewer";
  }>;
  allowedActions: z.ZodArray<z.ZodEnum<{
    saveMessage: "saveMessage";
    createTask: "createTask";
    answerQuestions: "answerQuestions";
  }>>;
  preparation: z.ZodObject<{
    understandingAvailable: z.ZodBoolean;
    requiredOpenQuestions: z.ZodNumber;
    pending: z.ZodBoolean;
  }, z.core.$strict>;
  eventCursor: z.ZodNumber;
  messages: z.ZodArray<z.ZodObject<{
    messageId: z.core.$ZodBranded<z.ZodString, "message", "out">;
    author: z.ZodString;
    bodyArtifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
    clientMessageId: z.ZodString;
    createdAt: z.ZodISODateTime;
    attachmentIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "attachment", "out">>;
    intentHint: z.ZodNullable<z.ZodEnum<{
      change: "change";
      query: "query";
      unsure: "unsure";
    }>>;
    text: z.ZodUnion<readonly [z.ZodString, z.ZodLiteral<"">]>;
  }, z.core.$strict>>;
  nextMessageCursor: z.ZodNullable<z.ZodString>;
  templateBaseline: z.ZodObject<{
    version: z.ZodString;
    baseCommit: z.ZodString;
  }, z.core.$strict>;
}, z.core.$strict>;
//#endregion
//#region src/workbench-delivery.d.ts
declare const workbenchCandidateSummary: z.ZodObject<{
  candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
  revision: z.ZodNumber;
  manifestHash: z.ZodString;
  codeCommit: z.ZodString;
  createdAt: z.ZodISODateTime;
  qualification: z.ZodEnum<{
    CURRENT: "CURRENT";
    STALE: "STALE";
  }>;
  automaticStatus: z.ZodLiteral<"PASS">;
  reviewStatus: z.ZodEnum<{
    PENDING: "PENDING";
    NOT_REQUIRED: "NOT_REQUIRED";
  }>;
}, z.core.$strict>;
declare const workbenchDeliveryView: z.ZodObject<{
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  resourceRevision: z.ZodNumber;
  projectRevision: z.ZodNumber;
  eventCursor: z.ZodNumber;
  mode: z.ZodEnum<{
    current: "current";
    history: "history";
  }>;
  membership: z.ZodEnum<{
    owner: "owner";
    operator: "operator";
    viewer: "viewer";
  }>;
  candidates: z.ZodArray<z.ZodObject<{
    candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
    revision: z.ZodNumber;
    manifestHash: z.ZodString;
    codeCommit: z.ZodString;
    createdAt: z.ZodISODateTime;
    qualification: z.ZodEnum<{
      CURRENT: "CURRENT";
      STALE: "STALE";
    }>;
    automaticStatus: z.ZodLiteral<"PASS">;
    reviewStatus: z.ZodEnum<{
      PENDING: "PENDING";
      NOT_REQUIRED: "NOT_REQUIRED";
    }>;
  }, z.core.$strict>>;
  nextRevision: z.ZodNullable<z.ZodNumber>;
  selectedCandidate: z.ZodNullable<z.ZodObject<{
    candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
    revision: z.ZodNumber;
    manifestHash: z.ZodString;
    codeCommit: z.ZodString;
    createdAt: z.ZodISODateTime;
    qualification: z.ZodEnum<{
      CURRENT: "CURRENT";
      STALE: "STALE";
    }>;
    automaticStatus: z.ZodLiteral<"PASS">;
    reviewStatus: z.ZodEnum<{
      PENDING: "PENDING";
      NOT_REQUIRED: "NOT_REQUIRED";
    }>;
  }, z.core.$strict>>;
  acceptedRelease: z.ZodNullable<z.ZodObject<{
    releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
    codeCommit: z.ZodString;
    acceptedAt: z.ZodISODateTime;
    isCurrentAccepted: z.ZodLiteral<true>;
  }, z.core.$strict>>;
}, z.core.$strict>;
//#endregion
//#region src/preparation.d.ts
declare const preparationRole: z.ZodEnum<{
  product: "product";
  architect: "architect";
}>;
declare const preparationQuestion: z.ZodObject<{
  id: z.core.$ZodBranded<z.ZodString, "question", "out">;
  required: z.ZodBoolean;
  reason: z.ZodString;
  blockingScope: z.ZodArray<z.core.$ZodBranded<z.ZodString, "work", "out">>;
  defaultOption: z.ZodOptional<z.ZodString>;
  prompt: z.ZodString;
  sourceRefs: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
    artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
    sha256: z.ZodString;
    kind: z.ZodLiteral<"artifact">;
  }, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"message">;
    messageId: z.core.$ZodBranded<z.ZodString, "message", "out">;
  }, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"requirement">;
    requirementId: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
    requirementRevision: z.ZodNumber;
  }, z.core.$strict>], "kind">>;
  options: z.ZodDefault<z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
  }, z.core.$strict>>>;
}, z.core.$strict>;
declare const understandingOutput: z.ZodObject<{
  schemaVersion: z.ZodLiteral<"devmesh.understanding.v1">;
  role: z.ZodLiteral<"product">;
  requirements: z.ZodArray<z.ZodObject<{
    id: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
    statement: z.ZodString;
    sourceRefs: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
      kind: z.ZodLiteral<"artifact">;
    }, z.core.$strict>, z.ZodObject<{
      kind: z.ZodLiteral<"message">;
      messageId: z.core.$ZodBranded<z.ZodString, "message", "out">;
    }, z.core.$strict>, z.ZodObject<{
      kind: z.ZodLiteral<"requirement">;
      requirementId: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
      requirementRevision: z.ZodNumber;
    }, z.core.$strict>], "kind">>;
    acceptance: z.ZodArray<z.ZodString>;
  }, z.core.$strict>>;
  assumptions: z.ZodArray<z.ZodString>;
  questions: z.ZodArray<z.ZodObject<{
    id: z.core.$ZodBranded<z.ZodString, "question", "out">;
    required: z.ZodBoolean;
    reason: z.ZodString;
    blockingScope: z.ZodArray<z.core.$ZodBranded<z.ZodString, "work", "out">>;
    defaultOption: z.ZodOptional<z.ZodString>;
    prompt: z.ZodString;
    sourceRefs: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
      kind: z.ZodLiteral<"artifact">;
    }, z.core.$strict>, z.ZodObject<{
      kind: z.ZodLiteral<"message">;
      messageId: z.core.$ZodBranded<z.ZodString, "message", "out">;
    }, z.core.$strict>, z.ZodObject<{
      kind: z.ZodLiteral<"requirement">;
      requirementId: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
      requirementRevision: z.ZodNumber;
    }, z.core.$strict>], "kind">>;
    options: z.ZodDefault<z.ZodArray<z.ZodObject<{
      id: z.ZodString;
      label: z.ZodString;
    }, z.core.$strict>>>;
  }, z.core.$strict>>;
  conflicts: z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    description: z.ZodString;
    sourceRefs: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
      kind: z.ZodLiteral<"artifact">;
    }, z.core.$strict>, z.ZodObject<{
      kind: z.ZodLiteral<"message">;
      messageId: z.core.$ZodBranded<z.ZodString, "message", "out">;
    }, z.core.$strict>, z.ZodObject<{
      kind: z.ZodLiteral<"requirement">;
      requirementId: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
      requirementRevision: z.ZodNumber;
    }, z.core.$strict>], "kind">>;
    questionId: z.core.$ZodBranded<z.ZodString, "question", "out">;
  }, z.core.$strict>>;
}, z.core.$strict>;
declare const answerQuestionsInput: z.ZodObject<{
  answers: z.ZodArray<z.ZodObject<{
    questionId: z.core.$ZodBranded<z.ZodString, "question", "out">;
    questionRevision: z.ZodNumber;
    value: z.ZodJSONSchema;
  }, z.core.$strict>>;
}, z.core.$strict>;
declare const retryUnderstandingInput: z.ZodObject<{
  failedInterpretationOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
}, z.core.$strict>;
declare const understandingView: z.ZodObject<{
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  requirementRevision: z.ZodNullable<z.ZodNumber>;
  understanding: z.ZodNullable<z.ZodObject<{
    schemaVersion: z.ZodLiteral<"devmesh.understanding.v1">;
    role: z.ZodLiteral<"product">;
    requirements: z.ZodArray<z.ZodObject<{
      id: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
      statement: z.ZodString;
      sourceRefs: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
        sha256: z.ZodString;
        kind: z.ZodLiteral<"artifact">;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"message">;
        messageId: z.core.$ZodBranded<z.ZodString, "message", "out">;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"requirement">;
        requirementId: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
        requirementRevision: z.ZodNumber;
      }, z.core.$strict>], "kind">>;
      acceptance: z.ZodArray<z.ZodString>;
    }, z.core.$strict>>;
    assumptions: z.ZodArray<z.ZodString>;
    questions: z.ZodArray<z.ZodObject<{
      id: z.core.$ZodBranded<z.ZodString, "question", "out">;
      required: z.ZodBoolean;
      reason: z.ZodString;
      blockingScope: z.ZodArray<z.core.$ZodBranded<z.ZodString, "work", "out">>;
      defaultOption: z.ZodOptional<z.ZodString>;
      prompt: z.ZodString;
      sourceRefs: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
        sha256: z.ZodString;
        kind: z.ZodLiteral<"artifact">;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"message">;
        messageId: z.core.$ZodBranded<z.ZodString, "message", "out">;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"requirement">;
        requirementId: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
        requirementRevision: z.ZodNumber;
      }, z.core.$strict>], "kind">>;
      options: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
      }, z.core.$strict>>>;
    }, z.core.$strict>>;
    conflicts: z.ZodArray<z.ZodObject<{
      id: z.ZodString;
      description: z.ZodString;
      sourceRefs: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
        sha256: z.ZodString;
        kind: z.ZodLiteral<"artifact">;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"message">;
        messageId: z.core.$ZodBranded<z.ZodString, "message", "out">;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"requirement">;
        requirementId: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
        requirementRevision: z.ZodNumber;
      }, z.core.$strict>], "kind">>;
      questionId: z.core.$ZodBranded<z.ZodString, "question", "out">;
    }, z.core.$strict>>;
  }, z.core.$strict>>;
  questions: z.ZodArray<z.ZodObject<{
    questionId: z.core.$ZodBranded<z.ZodString, "question", "out">;
    questionRevision: z.ZodNumber;
    requirementBasis: z.ZodNumber;
    state: z.ZodEnum<{
      OPEN: "OPEN";
      ANSWERED: "ANSWERED";
      SUPERSEDED: "SUPERSEDED";
    }>;
    content: z.ZodObject<{
      id: z.core.$ZodBranded<z.ZodString, "question", "out">;
      required: z.ZodBoolean;
      reason: z.ZodString;
      blockingScope: z.ZodArray<z.core.$ZodBranded<z.ZodString, "work", "out">>;
      defaultOption: z.ZodOptional<z.ZodString>;
      prompt: z.ZodString;
      sourceRefs: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
        sha256: z.ZodString;
        kind: z.ZodLiteral<"artifact">;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"message">;
        messageId: z.core.$ZodBranded<z.ZodString, "message", "out">;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"requirement">;
        requirementId: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
        requirementRevision: z.ZodNumber;
      }, z.core.$strict>], "kind">>;
      options: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
      }, z.core.$strict>>>;
    }, z.core.$strict>;
    answer: z.ZodNullable<z.ZodObject<{
      answerId: z.ZodString;
      value: z.ZodJSONSchema;
      actor: z.ZodString;
      createdAt: z.ZodISODateTime;
    }, z.core.$strict>>;
  }, z.core.$strict>>;
  jobs: z.ZodArray<z.ZodObject<{
    jobId: z.core.$ZodBranded<z.ZodString, "job", "out">;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    purpose: z.ZodEnum<{
      UNDERSTAND: "UNDERSTAND";
      INTERPRET: "INTERPRET";
      PLAN: "PLAN";
    }>;
    role: z.ZodEnum<{
      product: "product";
      architect: "architect";
    }>;
    state: z.ZodString;
    retryOf: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "job", "out">>;
    errorCode: z.ZodNullable<z.ZodString>;
    resultArtifactId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "artifact", "out">>;
  }, z.core.$strict>>;
  pendingInputCount: z.ZodNumber;
  answerInterventions: z.ZodNumber;
}, z.core.$strict>;
declare const preparationProfile: z.ZodObject<{
  providerId: z.ZodString;
  model: z.ZodString;
  promptHash: z.ZodString;
  providerHash: z.ZodString;
  maxOutputTokens: z.ZodNumber;
  tokenLimit: z.ZodNumber;
  maxInputBytes: z.ZodNumber;
}, z.core.$strict>;
declare const preparationDelegation: z.ZodObject<{
  schemaVersion: z.ZodLiteral<"devmesh.preparation.v1">;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  jobId: z.core.$ZodBranded<z.ZodString, "job", "out">;
  preparationAttemptId: z.ZodString;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  runEpoch: z.ZodNumber;
  activationId: z.core.$ZodBranded<z.ZodString, "activation", "out">;
  grantId: z.core.$ZodBranded<z.ZodString, "grant", "out">;
  endpointId: z.ZodString;
  endpointRevision: z.ZodNumber;
  role: z.ZodEnum<{
    product: "product";
    architect: "architect";
  }>;
  inputHash: z.ZodString;
  profileHash: z.ZodString;
  basisHash: z.ZodString;
}, z.core.$strict>;
declare const preparationSource: z.ZodObject<{
  ref: z.ZodDiscriminatedUnion<[z.ZodObject<{
    artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
    sha256: z.ZodString;
    kind: z.ZodLiteral<"artifact">;
  }, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"message">;
    messageId: z.core.$ZodBranded<z.ZodString, "message", "out">;
  }, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"requirement">;
    requirementId: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
    requirementRevision: z.ZodNumber;
  }, z.core.$strict>], "kind">;
  contentHash: z.ZodString;
  byteSize: z.ZodNumber;
  label: z.ZodString;
}, z.core.$strict>;
declare const preparationInput: z.ZodObject<{
  schemaVersion: z.ZodLiteral<"devmesh.preparation-input.v1">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  role: z.ZodEnum<{
    product: "product";
    architect: "architect";
  }>;
  basisHash: z.ZodString;
  requirementRevision: z.ZodNullable<z.ZodNumber>;
  baseCommit: z.ZodString;
  sources: z.ZodArray<z.ZodObject<{
    ref: z.ZodDiscriminatedUnion<[z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
      kind: z.ZodLiteral<"artifact">;
    }, z.core.$strict>, z.ZodObject<{
      kind: z.ZodLiteral<"message">;
      messageId: z.core.$ZodBranded<z.ZodString, "message", "out">;
    }, z.core.$strict>, z.ZodObject<{
      kind: z.ZodLiteral<"requirement">;
      requirementId: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
      requirementRevision: z.ZodNumber;
    }, z.core.$strict>], "kind">;
    contentHash: z.ZodString;
    byteSize: z.ZodNumber;
    label: z.ZodString;
  }, z.core.$strict>>;
  answerIds: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
type UnderstandingOutput = z.infer<typeof understandingOutput>;
type PreparationProfile = z.infer<typeof preparationProfile>;
//#endregion
//#region src/plans.d.ts
declare const planIssue: z.ZodObject<{
  code: z.ZodString;
  path: z.ZodString;
  workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
  relatedWorkId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
  requirementId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "requirement", "out">>;
}, z.core.$strict>;
type PlanIssue = z.output<typeof planIssue>;
declare const planReviewView: z.ZodObject<{
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  resourceRevision: z.ZodNumber;
  planRevision: z.ZodNumber;
  requirementRevision: z.ZodNumber;
  reviewHash: z.ZodString;
  baseCommit: z.ZodString;
  plan: z.ZodObject<{
    requirementRevision: z.ZodNumber;
    works: z.ZodArray<z.ZodObject<{
      workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
      workRevision: z.ZodNumber;
      role: z.ZodEnum<{
        product: "product";
        architect: "architect";
        developer: "developer";
        tester: "tester";
      }>;
      goal: z.ZodString;
      inputRefs: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
        sha256: z.ZodString;
        kind: z.ZodLiteral<"artifact">;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"output">;
        workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
        outputSlot: z.ZodString;
      }, z.core.$strict>], "kind">>;
      outputSpec: z.ZodArray<z.ZodObject<{
        slot: z.ZodString;
        schemaId: z.ZodString;
      }, z.core.$strict>>;
      completionChecks: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"artifact-exists">;
        outputSlot: z.ZodString;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"schema-valid">;
        outputSlot: z.ZodString;
        schemaId: z.ZodString;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"commit-resolved">;
        outputSlot: z.ZodString;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"command-exit-zero">;
        checkId: z.core.$ZodBranded<z.ZodString, "check", "out">;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"required-tests-pass">;
        checkId: z.core.$ZodBranded<z.ZodString, "check", "out">;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"coverage-threshold">;
        lines: z.ZodNumber;
        branches: z.ZodNumber;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"human-decision">;
        checkId: z.core.$ZodBranded<z.ZodString, "check", "out">;
      }, z.core.$strict>], "kind">>;
      dependencies: z.ZodArray<z.ZodObject<{
        workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
        requiredOutcome: z.ZodEnum<{
          success: "success";
          "completed-with-findings": "completed-with-findings";
        }>;
      }, z.core.$strict>>;
      writeScope: z.ZodArray<z.ZodString>;
      estimatedResources: z.ZodObject<{
        cpu: z.ZodNumber;
        memoryMiB: z.ZodNumber;
        timeoutMs: z.ZodNumber;
      }, z.core.$strict>;
      requirementIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "requirement", "out">>;
    }, z.core.$strict>>;
  }, z.core.$strict>;
  mode: z.ZodEnum<{
    current: "current";
    history: "history";
  }>;
  canConfirm: z.ZodBoolean;
  confirmation: z.ZodNullable<z.ZodObject<{
    actor: z.ZodString;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    confirmedAt: z.ZodISODateTime;
  }, z.core.$strict>>;
  issues: z.ZodArray<z.ZodObject<{
    code: z.ZodString;
    path: z.ZodString;
    workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
    relatedWorkId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
    requirementId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "requirement", "out">>;
  }, z.core.$strict>>;
  topology: z.ZodArray<z.ZodObject<{
    workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
    layer: z.ZodNumber;
  }, z.core.$strict>>;
  carryForward: z.ZodOptional<z.ZodObject<{
    sha256: z.ZodString;
    round: z.ZodNumber;
    sourcePlanRevision: z.ZodNumber;
    results: z.ZodArray<z.ZodObject<{
      workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
      workRevision: z.ZodNumber;
      attemptId: z.core.$ZodBranded<z.ZodString, "attempt", "out">;
      sourcePlanRevision: z.ZodNumber;
      outcome: z.ZodEnum<{
        success: "success";
        "completed-with-findings": "completed-with-findings";
      }>;
      codeCommit: z.ZodNullable<z.ZodString>;
      evidence: z.ZodObject<{
        artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
        sha256: z.ZodString;
      }, z.core.$strict>;
      checkConfigHash: z.ZodString;
      templateVersion: z.ZodString;
      inputManifestSha256: z.ZodString;
      snapshotSha256: z.ZodString;
      origin: z.ZodEnum<{
        FORMAL: "FORMAL";
        HISTORICAL: "HISTORICAL";
      }>;
    }, z.core.$strict>>;
  }, z.core.$strict>>;
}, z.core.$strict>;
type Draft = z.output<typeof planDraft>;
interface PlanFacts {
  requirementIds: ReadonlySet<string>;
  hasArtifact(ref: {
    artifactId: string;
    sha256: string;
  }): boolean;
  /** Older trusted snapshots can be inspected even before delivery checks are available. */
  requireDelivery?: boolean;
  roleLimits?: ReadonlyMap<string, {
    cpu: number;
    memoryMiB: number;
    timeoutMs: number;
  }>;
}
/** Validate a bounded declarative graph; capability and content facts come from the caller's snapshot. */
declare function inspectPlan(plan: Draft, facts: PlanFacts): {
  issues: {
    code: string;
    path: string;
    workId?: (string & z.core.$brand<"work">) | undefined;
    relatedWorkId?: (string & z.core.$brand<"work">) | undefined;
    requirementId?: (string & z.core.$brand<"requirement">) | undefined;
  }[];
  topology: {
    workId: string & z.core.$brand<"work">;
    layer: number;
  }[];
};
//#endregion
//#region src/pipeline.d.ts
declare const pipelineStage: z.ZodObject<{
  stageId: z.ZodString;
  kind: z.ZodEnum<{
    preview: "preview";
    build: "build";
    install: "install";
    unit: "unit";
    e2e: "e2e";
  }>;
  imageDigest: z.ZodString;
  resourceLimits: z.ZodObject<{
    cpu: z.ZodNumber;
    memoryMiB: z.ZodNumber;
    pids: z.ZodNumber;
    temporaryMiB: z.ZodNumber;
    timeoutMs: z.ZodNumber;
  }, z.core.$strict>;
  networkPolicyRef: z.ZodLiteral<"none">;
  outputSpec: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
declare const pipelineDefinition: z.ZodObject<{
  definitionId: z.ZodString;
  version: z.ZodString;
  stages: z.ZodArray<z.ZodObject<{
    stageId: z.ZodString;
    kind: z.ZodEnum<{
      preview: "preview";
      build: "build";
      install: "install";
      unit: "unit";
      e2e: "e2e";
    }>;
    imageDigest: z.ZodString;
    resourceLimits: z.ZodObject<{
      cpu: z.ZodNumber;
      memoryMiB: z.ZodNumber;
      pids: z.ZodNumber;
      temporaryMiB: z.ZodNumber;
      timeoutMs: z.ZodNumber;
    }, z.core.$strict>;
    networkPolicyRef: z.ZodLiteral<"none">;
    outputSpec: z.ZodArray<z.ZodString>;
  }, z.core.$strict>>;
}, z.core.$strict>;
type PipelineDefinition = z.output<typeof pipelineDefinition>;
//#endregion
//#region src/source-path.d.ts
declare const qualityPath: z.ZodString;
//#endregion
//#region src/quality.d.ts
declare const qualityLimits: {
  readonly reportBytes: number;
  readonly files: 2048;
  readonly positions: 200000;
  readonly tests: 20000;
  readonly jsonDepth: 48;
  readonly jsonNodes: 500000;
};
declare const qualityLocation: z.ZodObject<{
  start: z.ZodObject<{
    line: z.ZodNumber;
    column: z.ZodNumber;
  }, z.core.$strict>;
  end: z.ZodObject<{
    line: z.ZodNumber;
    column: z.ZodNumber;
  }, z.core.$strict>;
}, z.core.$strict>;
declare const qualityBranch: z.ZodObject<{
  type: z.ZodString;
  loc: z.ZodObject<{
    start: z.ZodObject<{
      line: z.ZodNumber;
      column: z.ZodNumber;
    }, z.core.$strict>;
    end: z.ZodObject<{
      line: z.ZodNumber;
      column: z.ZodNumber;
    }, z.core.$strict>;
  }, z.core.$strict>;
  locations: z.ZodArray<z.ZodNullable<z.ZodObject<{
    start: z.ZodObject<{
      line: z.ZodNumber;
      column: z.ZodNumber;
    }, z.core.$strict>;
    end: z.ZodObject<{
      line: z.ZodNumber;
      column: z.ZodNumber;
    }, z.core.$strict>;
  }, z.core.$strict>>>;
}, z.core.$strict>;
declare const qualityTestIdentity: z.ZodObject<{
  path: z.ZodString;
  fullName: z.ZodString;
  requirementIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "requirement", "out">>;
}, z.core.$strict>;
declare const qualityProducer: z.ZodObject<{
  producerId: z.ZodString;
  command: z.ZodArray<z.ZodString>;
  imageDigest: z.ZodString;
  pathPrefixes: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
declare const qualityPolicy: z.ZodObject<{
  schemaVersion: z.ZodLiteral<"devmesh.quality-policy.v1">;
  templateVersion: z.ZodString;
  delivery: z.ZodOptional<z.ZodObject<{
    producerId: z.ZodString;
    architecture: z.ZodEnum<{
      amd64: "amd64";
      arm64: "arm64";
    }>;
    materials: z.ZodArray<z.ZodObject<{
      key: z.ZodString;
      path: z.ZodString;
    }, z.core.$strict>>;
  }, z.core.$strict>>;
  producers: z.ZodArray<z.ZodObject<{
    producerId: z.ZodString;
    command: z.ZodArray<z.ZodString>;
    imageDigest: z.ZodString;
    pathPrefixes: z.ZodArray<z.ZodString>;
  }, z.core.$strict>>;
  reports: z.ZodArray<z.ZodObject<{
    reportId: z.ZodString;
    producerId: z.ZodString;
    format: z.ZodEnum<{
      "istanbul-v1": "istanbul-v1";
      "vitest-json-v1": "vitest-json-v1";
    }>;
    path: z.ZodString;
    sourceInclude: z.ZodArray<z.ZodString>;
  }, z.core.$strict>>;
  checks: z.ZodArray<z.ZodObject<{
    checkId: z.ZodString;
    kind: z.ZodEnum<{
      command: "command";
      tests: "tests";
      coverage: "coverage";
      human: "human";
    }>;
    producerIds: z.ZodArray<z.ZodString>;
    reportIds: z.ZodArray<z.ZodString>;
    requiredTests: z.ZodArray<z.ZodObject<{
      path: z.ZodString;
      fullName: z.ZodString;
      requirementIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "requirement", "out">>;
    }, z.core.$strict>>;
  }, z.core.$strict>>;
  business: z.ZodObject<{
    include: z.ZodArray<z.ZodString>;
    exclude: z.ZodArray<z.ZodObject<{
      glob: z.ZodString;
      reason: z.ZodString;
    }, z.core.$strict>>;
  }, z.core.$strict>;
  thresholds: z.ZodObject<{
    lines: z.ZodNumber;
    branches: z.ZodNumber;
  }, z.core.$strict>;
  zeroBranches: z.ZodEnum<{
    reject: "reject";
    "complete-map-proves-none": "complete-map-proves-none";
  }>;
}, z.core.$strict>;
type QualityPolicy = z.output<typeof qualityPolicy>;
declare const qualitySourceFile: z.ZodObject<{
  path: z.ZodString;
  sha256: z.ZodString;
  lineLengths: z.ZodArray<z.ZodNumber>;
}, z.core.$strict>;
declare const qualitySourceScope: z.ZodObject<{
  schemaVersion: z.ZodLiteral<"devmesh.quality-source.v1">;
  targetCommit: z.ZodString;
  checkConfigHash: z.ZodString;
  sourceManifestSha256: z.ZodString;
  topologySha256: z.ZodString;
  gitManifest: z.ZodArray<z.ZodObject<{
    path: z.ZodString;
    sha256: z.ZodString;
    lineLengths: z.ZodArray<z.ZodNumber>;
  }, z.core.$strict>>;
  businessFiles: z.ZodArray<z.ZodObject<{
    path: z.ZodString;
    statements: z.ZodArray<z.ZodObject<{
      start: z.ZodObject<{
        line: z.ZodNumber;
        column: z.ZodNumber;
      }, z.core.$strict>;
      end: z.ZodObject<{
        line: z.ZodNumber;
        column: z.ZodNumber;
      }, z.core.$strict>;
    }, z.core.$strict>>;
    branches: z.ZodArray<z.ZodObject<{
      type: z.ZodString;
      loc: z.ZodObject<{
        start: z.ZodObject<{
          line: z.ZodNumber;
          column: z.ZodNumber;
        }, z.core.$strict>;
        end: z.ZodObject<{
          line: z.ZodNumber;
          column: z.ZodNumber;
        }, z.core.$strict>;
      }, z.core.$strict>;
      locations: z.ZodArray<z.ZodNullable<z.ZodObject<{
        start: z.ZodObject<{
          line: z.ZodNumber;
          column: z.ZodNumber;
        }, z.core.$strict>;
        end: z.ZodObject<{
          line: z.ZodNumber;
          column: z.ZodNumber;
        }, z.core.$strict>;
      }, z.core.$strict>>>;
    }, z.core.$strict>>;
  }, z.core.$strict>>;
}, z.core.$strict>;
type QualitySourceScope = z.output<typeof qualitySourceScope>;
declare const qualityExecution: z.ZodObject<{
  producerId: z.ZodString;
  attemptId: z.core.$ZodBranded<z.ZodString, "attempt", "out">;
  runnerId: z.ZodString;
  jobId: z.core.$ZodBranded<z.ZodString, "job", "out">;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  requestHash: z.ZodString;
  targetCommit: z.ZodString;
  checkConfigHash: z.ZodString;
  commandHash: z.ZodString;
  imageDigest: z.ZodString;
  state: z.ZodEnum<{
    OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN";
    STOPPING: "STOPPING";
    QUEUED: "QUEUED";
    RUNNING: "RUNNING";
    STARTING: "STARTING";
    EXITED: "EXITED";
  }>;
  exitCode: z.ZodNullable<z.ZodNumber>;
  errorCode: z.ZodNullable<z.ZodString>;
  stopRequested: z.ZodBoolean;
  startedAt: z.ZodNullable<z.ZodISODateTime>;
  finishedAt: z.ZodNullable<z.ZodISODateTime>;
  log: z.ZodObject<{
    sha256: z.ZodString;
    size: z.ZodNumber;
  }, z.core.$strict>;
}, z.core.$strict>;
type QualityExecution = z.output<typeof qualityExecution>;
declare const qualityReport: z.ZodObject<{
  reportId: z.ZodString;
  execution: z.ZodObject<{
    producerId: z.ZodString;
    attemptId: z.core.$ZodBranded<z.ZodString, "attempt", "out">;
    runnerId: z.ZodString;
    jobId: z.core.$ZodBranded<z.ZodString, "job", "out">;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    requestHash: z.ZodString;
    targetCommit: z.ZodString;
    checkConfigHash: z.ZodString;
    commandHash: z.ZodString;
    imageDigest: z.ZodString;
    state: z.ZodEnum<{
      OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN";
      STOPPING: "STOPPING";
      QUEUED: "QUEUED";
      RUNNING: "RUNNING";
      STARTING: "STARTING";
      EXITED: "EXITED";
    }>;
    exitCode: z.ZodNullable<z.ZodNumber>;
    errorCode: z.ZodNullable<z.ZodString>;
    stopRequested: z.ZodBoolean;
    startedAt: z.ZodNullable<z.ZodISODateTime>;
    finishedAt: z.ZodNullable<z.ZodISODateTime>;
    log: z.ZodObject<{
      sha256: z.ZodString;
      size: z.ZodNumber;
    }, z.core.$strict>;
  }, z.core.$strict>;
  outputPath: z.ZodString;
  sha256: z.ZodString;
  size: z.ZodNumber;
}, z.core.$strict>;
type QualityReport = z.output<typeof qualityReport>;
declare const qualityCheckStatus: z.ZodEnum<{
  STALE: "STALE";
  PASS: "PASS";
  PENDING: "PENDING";
  MISSING: "MISSING";
  FAIL: "FAIL";
  NOT_APPLICABLE: "NOT_APPLICABLE";
}>;
declare const qualityEvaluation: z.ZodObject<{
  schemaVersion: z.ZodLiteral<"devmesh.quality-evaluation.v1">;
  targetCommit: z.ZodString;
  checkConfigHash: z.ZodString;
  sourceManifestSha256: z.ZodString;
  topologySha256: z.ZodString;
  automaticStatus: z.ZodEnum<{
    STALE: "STALE";
    PASS: "PASS";
    MISSING: "MISSING";
    FAIL: "FAIL";
  }>;
  reviewStatus: z.ZodEnum<{
    PENDING: "PENDING";
    NOT_REQUIRED: "NOT_REQUIRED";
  }>;
  checks: z.ZodArray<z.ZodObject<{
    checkId: z.ZodString;
    status: z.ZodEnum<{
      STALE: "STALE";
      PASS: "PASS";
      PENDING: "PENDING";
      MISSING: "MISSING";
      FAIL: "FAIL";
      NOT_APPLICABLE: "NOT_APPLICABLE";
    }>;
    codes: z.ZodArray<z.ZodString>;
    reportIds: z.ZodArray<z.ZodString>;
    tests: z.ZodOptional<z.ZodObject<{
      passed: z.ZodNumber;
      failed: z.ZodNumber;
      skipped: z.ZodNumber;
      missing: z.ZodNumber;
    }, z.core.$strict>>;
    coverage: z.ZodOptional<z.ZodObject<{
      lines: z.ZodObject<{
        covered: z.ZodNumber;
        total: z.ZodNumber;
        minimum: z.ZodNumber;
        status: z.ZodEnum<{
          STALE: "STALE";
          PASS: "PASS";
          PENDING: "PENDING";
          MISSING: "MISSING";
          FAIL: "FAIL";
          NOT_APPLICABLE: "NOT_APPLICABLE";
        }>;
      }, z.core.$strict>;
      branches: z.ZodObject<{
        covered: z.ZodNumber;
        total: z.ZodNumber;
        minimum: z.ZodNumber;
        status: z.ZodEnum<{
          STALE: "STALE";
          PASS: "PASS";
          PENDING: "PENDING";
          MISSING: "MISSING";
          FAIL: "FAIL";
          NOT_APPLICABLE: "NOT_APPLICABLE";
        }>;
      }, z.core.$strict>;
    }, z.core.$strict>>;
  }, z.core.$strict>>;
}, z.core.$strict>;
type QualityEvaluation = z.output<typeof qualityEvaluation>;
//#endregion
//#region src/delivery.d.ts
declare const previewImageLimits: {
  readonly manifestBytes: number;
  readonly configBytes: number;
  readonly blobBytes: number;
  readonly totalBytes: number;
  readonly layers: 16;
};
declare const previewImageManifest: z.ZodObject<{
  schemaVersion: z.ZodLiteral<2>;
  mediaType: z.ZodLiteral<"application/vnd.oci.image.manifest.v1+json">;
  config: z.ZodObject<{
    digest: z.ZodString;
    size: z.ZodNumber;
    mediaType: z.ZodLiteral<"application/vnd.oci.image.config.v1+json">;
  }, z.core.$strip>;
  layers: z.ZodArray<z.ZodObject<{
    digest: z.ZodString;
    size: z.ZodNumber;
    mediaType: z.ZodEnum<{
      "application/vnd.oci.image.layer.v1.tar": "application/vnd.oci.image.layer.v1.tar";
      "application/vnd.oci.image.layer.v1.tar+gzip": "application/vnd.oci.image.layer.v1.tar+gzip";
    }>;
  }, z.core.$strip>>;
}, z.core.$strip>;
declare const previewImageConfig: z.ZodObject<{
  os: z.ZodLiteral<"linux">;
  architecture: z.ZodEnum<{
    amd64: "amd64";
    arm64: "arm64";
  }>;
  config: z.ZodObject<{
    Labels: z.ZodRecord<z.ZodString, z.ZodString>;
  }, z.core.$strip>;
  rootfs: z.ZodObject<{
    type: z.ZodLiteral<"layers">;
    diff_ids: z.ZodArray<z.ZodString>;
  }, z.core.$strip>;
}, z.core.$strip>;
declare const previewImageIdentity: z.ZodObject<{
  schemaVersion: z.ZodLiteral<"devmesh.preview-image-identity.v1">;
  imageDigest: z.ZodString;
  configDigest: z.ZodString;
  targetCommit: z.ZodString;
  buildArtifactHash: z.ZodString;
  os: z.ZodLiteral<"linux">;
  architecture: z.ZodEnum<{
    amd64: "amd64";
    arm64: "arm64";
  }>;
  layers: z.ZodArray<z.ZodObject<{
    digest: z.ZodString;
    diffId: z.ZodString;
    byteSize: z.ZodNumber;
    expandedByteSize: z.ZodNumber;
  }, z.core.$strict>>;
}, z.core.$strict>;
declare const deliveryDataPlan: z.ZodDiscriminatedUnion<[z.ZodObject<{
  strategy: z.ZodLiteral<"INITIAL">;
  initialData: z.ZodEnum<{
    EMPTY: "EMPTY";
    DEMO: "DEMO";
  }>;
  sourceReleaseId: z.ZodNull;
  migrationRef: z.ZodNull;
  replacementDecisionId: z.ZodNull;
  schemaVersion: z.ZodLiteral<"devmesh.data-plan.v1">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  codeCommit: z.ZodString;
  requirementRevision: z.ZodNumber;
  planRevision: z.ZodNumber;
  templateVersion: z.ZodString;
  checkConfigHash: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
  strategy: z.ZodLiteral<"PRESERVE_MIGRATE">;
  initialData: z.ZodNull;
  sourceReleaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
  migrationRef: z.ZodObject<{
    artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
    sha256: z.ZodString;
  }, z.core.$strict>;
  replacementDecisionId: z.ZodNull;
  schemaVersion: z.ZodLiteral<"devmesh.data-plan.v1">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  codeCommit: z.ZodString;
  requirementRevision: z.ZodNumber;
  planRevision: z.ZodNumber;
  templateVersion: z.ZodString;
  checkConfigHash: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
  strategy: z.ZodLiteral<"REPLACE">;
  initialData: z.ZodEnum<{
    EMPTY: "EMPTY";
    DEMO: "DEMO";
  }>;
  sourceReleaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
  migrationRef: z.ZodNull;
  replacementDecisionId: z.core.$ZodBranded<z.ZodString, "decision", "out">;
  schemaVersion: z.ZodLiteral<"devmesh.data-plan.v1">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  codeCommit: z.ZodString;
  requirementRevision: z.ZodNumber;
  planRevision: z.ZodNumber;
  templateVersion: z.ZodString;
  checkConfigHash: z.ZodString;
}, z.core.$strict>], "strategy">;
declare const releaseDeliveryProfile: z.ZodObject<{
  producerId: z.ZodString;
  architecture: z.ZodEnum<{
    amd64: "amd64";
    arm64: "arm64";
  }>;
  materials: z.ZodArray<z.ZodObject<{
    key: z.ZodString;
    path: z.ZodString;
  }, z.core.$strict>>;
}, z.core.$strict>;
declare const releaseDeliveryPolicy: z.ZodObject<{
  producerId: z.ZodString;
  architecture: z.ZodEnum<{
    amd64: "amd64";
    arm64: "arm64";
  }>;
  materials: z.ZodArray<z.ZodObject<{
    key: z.ZodString;
    path: z.ZodString;
  }, z.core.$strict>>;
  schemaVersion: z.ZodLiteral<"devmesh.delivery-policy.v1">;
  templateVersion: z.ZodString;
  checkConfigHash: z.ZodString;
}, z.core.$strict>;
type ReleaseDeliveryPolicy = z.output<typeof releaseDeliveryPolicy>;
type DeliveryDataPlan = z.output<typeof deliveryDataPlan>;
//#endregion
//#region src/events.d.ts
declare const eventPayloads: {
  readonly InputSaved: z.ZodObject<{
    messageId: z.core.$ZodBranded<z.ZodString, "message", "out">;
  }, z.core.$strict>;
  readonly UnderstandingUpdated: z.ZodObject<{
    understandingRef: z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
    }, z.core.$strict>;
  }, z.core.$strict>;
  readonly QuestionAnswered: z.ZodObject<{
    questionId: z.core.$ZodBranded<z.ZodString, "question", "out">;
    questionRevision: z.ZodNumber;
  }, z.core.$strict>;
  readonly PlanPublished: z.ZodObject<{
    planRevision: z.ZodNumber;
    planRef: z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
    }, z.core.$strict>;
  }, z.core.$strict>;
  readonly PlanConfirmed: z.ZodObject<{
    planRevision: z.ZodNumber;
    decisionId: z.core.$ZodBranded<z.ZodString, "decision", "out">;
  }, z.core.$strict>;
  readonly WorkAdmitted: z.ZodObject<{
    workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
    attemptId: z.core.$ZodBranded<z.ZodString, "attempt", "out">;
    activationId: z.core.$ZodBranded<z.ZodString, "activation", "out">;
  }, z.core.$strict>;
  readonly AttemptStateChanged: z.ZodObject<{
    attemptId: z.core.$ZodBranded<z.ZodString, "attempt", "out">;
    state: z.ZodEnum<{
      VERIFYING: "VERIFYING";
      FAILED: "FAILED";
      CANCELLED: "CANCELLED";
      RESERVED: "RESERVED";
      SUBMITTED: "SUBMITTED";
      WORKING: "WORKING";
      INPUT_REQUIRED: "INPUT_REQUIRED";
      OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN";
      STOPPING: "STOPPING";
      SUCCEEDED: "SUCCEEDED";
      INTERRUPTED: "INTERRUPTED";
    }>;
  }, z.core.$strict>;
  readonly A2ATaskObserved: z.ZodObject<{
    attemptId: z.core.$ZodBranded<z.ZodString, "attempt", "out">;
    endpointId: z.ZodString;
    taskId: z.ZodString;
    state: z.ZodEnum<{
      submitted: "submitted";
      working: "working";
      "input-required": "input-required";
      "auth-required": "auth-required";
      completed: "completed";
      failed: "failed";
      canceled: "canceled";
      rejected: "rejected";
    }>;
  }, z.core.$strict>;
  readonly ToolOperationUpdated: z.ZodObject<{
    toolOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    status: z.ZodEnum<{
      FAILED: "FAILED";
      OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN";
      SUCCEEDED: "SUCCEEDED";
      RUNNING: "RUNNING";
      ACCEPTED: "ACCEPTED";
      WAITING: "WAITING";
    }>;
  }, z.core.$strict>;
  readonly IssueChanged: z.ZodObject<{
    issueId: z.ZodString;
    issueRevision: z.ZodNumber;
    toolOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    toolName: z.ZodEnum<{
      "issues.create": "issues.create";
      "issues.linkFix": "issues.linkFix";
      "issues.recordVerification": "issues.recordVerification";
    }>;
  }, z.core.$strict>;
  readonly PipelineChanged: z.ZodObject<{
    pipelineId: z.ZodString;
    toolOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    state: z.ZodEnum<{
      FAILED: "FAILED";
      CANCELLED: "CANCELLED";
      OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN";
      STOPPING: "STOPPING";
      SUCCEEDED: "SUCCEEDED";
      QUEUED: "QUEUED";
      RUNNING: "RUNNING";
    }>;
  }, z.core.$strict>;
  readonly ArtifactRegistered: z.ZodObject<{
    artifact: z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
    }, z.core.$strict>;
  }, z.core.$strict>;
  readonly ChangeApplied: z.ZodObject<{
    changeId: z.core.$ZodBranded<z.ZodString, "change", "out">;
    requirementRevision: z.ZodNumber;
    planRevision: z.ZodNumber;
  }, z.core.$strict>;
  readonly DecisionSaved: z.ZodObject<{
    decisionId: z.core.$ZodBranded<z.ZodString, "decision", "out">;
  }, z.core.$strict>;
  readonly ControlProgress: z.ZodObject<{
    state: z.ZodObject<{
      phase: z.ZodEnum<{
        PREPARING: "PREPARING";
        UNDERSTANDING: "UNDERSTANDING";
        PLANNING: "PLANNING";
        EXECUTING: "EXECUTING";
        VERIFYING: "VERIFYING";
        REVIEW: "REVIEW";
      }>;
      controlGate: z.ZodEnum<{
        OPEN: "OPEN";
        PAUSING: "PAUSING";
        PAUSED: "PAUSED";
        CANCELLING: "CANCELLING";
      }>;
      terminalOutcome: z.ZodNullable<z.ZodEnum<{
        COMPLETED: "COMPLETED";
        FAILED: "FAILED";
        CANCELLED: "CANCELLED";
      }>>;
    }, z.core.$strict>;
    controlRevision: z.ZodNumber;
    runEpoch: z.ZodNumber;
  }, z.core.$strict>;
  readonly ConfigurationApplied: z.ZodObject<{
    configurationRef: z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
    }, z.core.$strict>;
  }, z.core.$strict>;
  readonly CandidateUpdated: z.ZodObject<{
    candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
    state: z.ZodEnum<{
      PREPARING: "PREPARING";
      SUPERSEDED: "SUPERSEDED";
      READY: "READY";
      BLOCKED: "BLOCKED";
    }>;
  }, z.core.$strict>;
  readonly CandidateReviewRecorded: z.ZodObject<{
    candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
    resultId: z.ZodString;
  }, z.core.$strict>;
  readonly CandidateRejected: z.ZodObject<{
    candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
    rejectionId: z.ZodString;
    resultId: z.ZodString;
    state: z.ZodEnum<{
      OPEN: "OPEN";
      WITHDRAWN: "WITHDRAWN";
    }>;
  }, z.core.$strict>;
  readonly DatasetStateChanged: z.ZodObject<{
    datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
    state: z.ZodEnum<{
      PREPARING: "PREPARING";
      MISSING: "MISSING";
      READY: "READY";
      WRITE_FROZEN: "WRITE_FROZEN";
      RETIRED: "RETIRED";
    }>;
  }, z.core.$strict>;
  readonly PreviewOperationChanged: z.ZodObject<{
    previewId: z.core.$ZodBranded<z.ZodString, "preview", "out">;
    state: z.ZodEnum<{
      STOPPING: "STOPPING";
      STARTING: "STARTING";
      READY: "READY";
      UNKNOWN: "UNKNOWN";
      STOPPED: "STOPPED";
      EXPIRED: "EXPIRED";
    }>;
  }, z.core.$strict>;
  readonly AcceptancePreparationChanged: z.ZodObject<{
    preparationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    state: z.ZodEnum<{
      FAILED: "FAILED";
      PREPARED: "PREPARED";
      SENT: "SENT";
      UNKNOWN: "UNKNOWN";
    }>;
  }, z.core.$strict>;
  readonly AcceptanceReadinessObserved: z.ZodObject<{
    preparationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    sequence: z.ZodNumber;
    state: z.ZodEnum<{
      READY: "READY";
      UNKNOWN: "UNKNOWN";
    }>;
  }, z.core.$strict>;
  readonly AcceptanceAbortRequested: z.ZodObject<{
    preparationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    abortOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  }, z.core.$strict>;
  readonly AcceptanceAbortCompleted: z.ZodObject<{
    preparationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    abortOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  }, z.core.$strict>;
  readonly DatasetWriteGateClosed: z.ZodObject<{
    datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
    preparationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    fence: z.ZodNumber;
  }, z.core.$strict>;
  readonly ReleaseAccepted: z.ZodObject<{
    candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
    releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
  }, z.core.$strict>;
  readonly ReleasePublicationChanged: z.ZodObject<{
    releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
    state: z.ZodEnum<{
      PENDING: "PENDING";
      SENT: "SENT";
      UNKNOWN: "UNKNOWN";
      PUBLISHED: "PUBLISHED";
    }>;
    publicationRevision: z.ZodNumber;
    observationSequence: z.ZodNumber;
    errorCode: z.ZodNullable<z.ZodString>;
  }, z.core.$strict>;
  readonly PreviewStateChanged: z.ZodObject<{
    previewId: z.core.$ZodBranded<z.ZodString, "preview", "out">;
    state: z.ZodEnum<{
      PREPARING: "PREPARING";
      FAILED: "FAILED";
      OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN";
      STOPPING: "STOPPING";
      RUNNING: "RUNNING";
      STOPPED: "STOPPED";
    }>;
  }, z.core.$strict>;
  readonly ExportUpdated: z.ZodObject<{
    exportId: z.core.$ZodBranded<z.ZodString, "export", "out">;
    status: z.ZodEnum<{
      FAILED: "FAILED";
      OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN";
      SUCCEEDED: "SUCCEEDED";
      RUNNING: "RUNNING";
      ACCEPTED: "ACCEPTED";
      WAITING: "WAITING";
    }>;
  }, z.core.$strict>;
};
declare const domainEvent: z.ZodDiscriminatedUnion<[z.ZodObject<{
  type: z.ZodLiteral<"ReleasePublicationChanged">;
  payload: z.ZodObject<{
    releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
    state: z.ZodEnum<{
      PENDING: "PENDING";
      SENT: "SENT";
      UNKNOWN: "UNKNOWN";
      PUBLISHED: "PUBLISHED";
    }>;
    publicationRevision: z.ZodNumber;
    observationSequence: z.ZodNumber;
    errorCode: z.ZodNullable<z.ZodString>;
  }, z.core.$strict>;
  schemaVersion: z.ZodLiteral<1>;
  eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  seq: z.ZodNumber;
  occurredAt: z.ZodISODateTime;
  observedAt: z.ZodISODateTime;
  timeSource: z.ZodEnum<{
    observed: "observed";
    producer: "producer";
  }>;
  resourceRevision: z.ZodNumber;
  requirementRevision: z.ZodNullable<z.ZodNumber>;
  planRevision: z.ZodNullable<z.ZodNumber>;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
  attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
}, z.core.$strict>, z.ZodObject<{
  type: z.ZodLiteral<"AcceptanceAbortRequested">;
  payload: z.ZodObject<{
    preparationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    abortOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  }, z.core.$strict>;
  schemaVersion: z.ZodLiteral<1>;
  eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  seq: z.ZodNumber;
  occurredAt: z.ZodISODateTime;
  observedAt: z.ZodISODateTime;
  timeSource: z.ZodEnum<{
    observed: "observed";
    producer: "producer";
  }>;
  resourceRevision: z.ZodNumber;
  requirementRevision: z.ZodNullable<z.ZodNumber>;
  planRevision: z.ZodNullable<z.ZodNumber>;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
  attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
}, z.core.$strict>, z.ZodObject<{
  type: z.ZodLiteral<"AcceptanceAbortCompleted">;
  payload: z.ZodObject<{
    preparationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    abortOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  }, z.core.$strict>;
  schemaVersion: z.ZodLiteral<1>;
  eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  seq: z.ZodNumber;
  occurredAt: z.ZodISODateTime;
  observedAt: z.ZodISODateTime;
  timeSource: z.ZodEnum<{
    observed: "observed";
    producer: "producer";
  }>;
  resourceRevision: z.ZodNumber;
  requirementRevision: z.ZodNullable<z.ZodNumber>;
  planRevision: z.ZodNullable<z.ZodNumber>;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
  attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
}, z.core.$strict>, z.ZodObject<{
  type: z.ZodLiteral<"InputSaved">;
  payload: z.ZodObject<{
    messageId: z.core.$ZodBranded<z.ZodString, "message", "out">;
  }, z.core.$strict>;
  schemaVersion: z.ZodLiteral<1>;
  eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  seq: z.ZodNumber;
  occurredAt: z.ZodISODateTime;
  observedAt: z.ZodISODateTime;
  timeSource: z.ZodEnum<{
    observed: "observed";
    producer: "producer";
  }>;
  resourceRevision: z.ZodNumber;
  requirementRevision: z.ZodNullable<z.ZodNumber>;
  planRevision: z.ZodNullable<z.ZodNumber>;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
  attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
}, z.core.$strict>, z.ZodObject<{
  type: z.ZodLiteral<"UnderstandingUpdated">;
  payload: z.ZodObject<{
    understandingRef: z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
    }, z.core.$strict>;
  }, z.core.$strict>;
  schemaVersion: z.ZodLiteral<1>;
  eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  seq: z.ZodNumber;
  occurredAt: z.ZodISODateTime;
  observedAt: z.ZodISODateTime;
  timeSource: z.ZodEnum<{
    observed: "observed";
    producer: "producer";
  }>;
  resourceRevision: z.ZodNumber;
  requirementRevision: z.ZodNullable<z.ZodNumber>;
  planRevision: z.ZodNullable<z.ZodNumber>;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
  attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
}, z.core.$strict>, z.ZodObject<{
  type: z.ZodLiteral<"QuestionAnswered">;
  payload: z.ZodObject<{
    questionId: z.core.$ZodBranded<z.ZodString, "question", "out">;
    questionRevision: z.ZodNumber;
  }, z.core.$strict>;
  schemaVersion: z.ZodLiteral<1>;
  eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  seq: z.ZodNumber;
  occurredAt: z.ZodISODateTime;
  observedAt: z.ZodISODateTime;
  timeSource: z.ZodEnum<{
    observed: "observed";
    producer: "producer";
  }>;
  resourceRevision: z.ZodNumber;
  requirementRevision: z.ZodNullable<z.ZodNumber>;
  planRevision: z.ZodNullable<z.ZodNumber>;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
  attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
}, z.core.$strict>, z.ZodObject<{
  type: z.ZodLiteral<"PlanPublished">;
  payload: z.ZodObject<{
    planRevision: z.ZodNumber;
    planRef: z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
    }, z.core.$strict>;
  }, z.core.$strict>;
  schemaVersion: z.ZodLiteral<1>;
  eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  seq: z.ZodNumber;
  occurredAt: z.ZodISODateTime;
  observedAt: z.ZodISODateTime;
  timeSource: z.ZodEnum<{
    observed: "observed";
    producer: "producer";
  }>;
  resourceRevision: z.ZodNumber;
  requirementRevision: z.ZodNullable<z.ZodNumber>;
  planRevision: z.ZodNullable<z.ZodNumber>;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
  attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
}, z.core.$strict>, z.ZodObject<{
  type: z.ZodLiteral<"PlanConfirmed">;
  payload: z.ZodObject<{
    planRevision: z.ZodNumber;
    decisionId: z.core.$ZodBranded<z.ZodString, "decision", "out">;
  }, z.core.$strict>;
  schemaVersion: z.ZodLiteral<1>;
  eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  seq: z.ZodNumber;
  occurredAt: z.ZodISODateTime;
  observedAt: z.ZodISODateTime;
  timeSource: z.ZodEnum<{
    observed: "observed";
    producer: "producer";
  }>;
  resourceRevision: z.ZodNumber;
  requirementRevision: z.ZodNullable<z.ZodNumber>;
  planRevision: z.ZodNullable<z.ZodNumber>;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
  attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
}, z.core.$strict>, z.ZodObject<{
  type: z.ZodLiteral<"WorkAdmitted">;
  payload: z.ZodObject<{
    workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
    attemptId: z.core.$ZodBranded<z.ZodString, "attempt", "out">;
    activationId: z.core.$ZodBranded<z.ZodString, "activation", "out">;
  }, z.core.$strict>;
  schemaVersion: z.ZodLiteral<1>;
  eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  seq: z.ZodNumber;
  occurredAt: z.ZodISODateTime;
  observedAt: z.ZodISODateTime;
  timeSource: z.ZodEnum<{
    observed: "observed";
    producer: "producer";
  }>;
  resourceRevision: z.ZodNumber;
  requirementRevision: z.ZodNullable<z.ZodNumber>;
  planRevision: z.ZodNullable<z.ZodNumber>;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
  attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
}, z.core.$strict>, z.ZodObject<{
  type: z.ZodLiteral<"AttemptStateChanged">;
  payload: z.ZodObject<{
    attemptId: z.core.$ZodBranded<z.ZodString, "attempt", "out">;
    state: z.ZodEnum<{
      VERIFYING: "VERIFYING";
      FAILED: "FAILED";
      CANCELLED: "CANCELLED";
      RESERVED: "RESERVED";
      SUBMITTED: "SUBMITTED";
      WORKING: "WORKING";
      INPUT_REQUIRED: "INPUT_REQUIRED";
      OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN";
      STOPPING: "STOPPING";
      SUCCEEDED: "SUCCEEDED";
      INTERRUPTED: "INTERRUPTED";
    }>;
  }, z.core.$strict>;
  schemaVersion: z.ZodLiteral<1>;
  eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  seq: z.ZodNumber;
  occurredAt: z.ZodISODateTime;
  observedAt: z.ZodISODateTime;
  timeSource: z.ZodEnum<{
    observed: "observed";
    producer: "producer";
  }>;
  resourceRevision: z.ZodNumber;
  requirementRevision: z.ZodNullable<z.ZodNumber>;
  planRevision: z.ZodNullable<z.ZodNumber>;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
  attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
}, z.core.$strict>, z.ZodObject<{
  type: z.ZodLiteral<"A2ATaskObserved">;
  payload: z.ZodObject<{
    attemptId: z.core.$ZodBranded<z.ZodString, "attempt", "out">;
    endpointId: z.ZodString;
    taskId: z.ZodString;
    state: z.ZodEnum<{
      submitted: "submitted";
      working: "working";
      "input-required": "input-required";
      "auth-required": "auth-required";
      completed: "completed";
      failed: "failed";
      canceled: "canceled";
      rejected: "rejected";
    }>;
  }, z.core.$strict>;
  schemaVersion: z.ZodLiteral<1>;
  eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  seq: z.ZodNumber;
  occurredAt: z.ZodISODateTime;
  observedAt: z.ZodISODateTime;
  timeSource: z.ZodEnum<{
    observed: "observed";
    producer: "producer";
  }>;
  resourceRevision: z.ZodNumber;
  requirementRevision: z.ZodNullable<z.ZodNumber>;
  planRevision: z.ZodNullable<z.ZodNumber>;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
  attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
}, z.core.$strict>, z.ZodObject<{
  type: z.ZodLiteral<"ToolOperationUpdated">;
  payload: z.ZodObject<{
    toolOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    status: z.ZodEnum<{
      FAILED: "FAILED";
      OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN";
      SUCCEEDED: "SUCCEEDED";
      RUNNING: "RUNNING";
      ACCEPTED: "ACCEPTED";
      WAITING: "WAITING";
    }>;
  }, z.core.$strict>;
  schemaVersion: z.ZodLiteral<1>;
  eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  seq: z.ZodNumber;
  occurredAt: z.ZodISODateTime;
  observedAt: z.ZodISODateTime;
  timeSource: z.ZodEnum<{
    observed: "observed";
    producer: "producer";
  }>;
  resourceRevision: z.ZodNumber;
  requirementRevision: z.ZodNullable<z.ZodNumber>;
  planRevision: z.ZodNullable<z.ZodNumber>;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
  attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
}, z.core.$strict>, z.ZodObject<{
  type: z.ZodLiteral<"ArtifactRegistered">;
  payload: z.ZodObject<{
    artifact: z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
    }, z.core.$strict>;
  }, z.core.$strict>;
  schemaVersion: z.ZodLiteral<1>;
  eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  seq: z.ZodNumber;
  occurredAt: z.ZodISODateTime;
  observedAt: z.ZodISODateTime;
  timeSource: z.ZodEnum<{
    observed: "observed";
    producer: "producer";
  }>;
  resourceRevision: z.ZodNumber;
  requirementRevision: z.ZodNullable<z.ZodNumber>;
  planRevision: z.ZodNullable<z.ZodNumber>;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
  attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
}, z.core.$strict>, z.ZodObject<{
  type: z.ZodLiteral<"ChangeApplied">;
  payload: z.ZodObject<{
    changeId: z.core.$ZodBranded<z.ZodString, "change", "out">;
    requirementRevision: z.ZodNumber;
    planRevision: z.ZodNumber;
  }, z.core.$strict>;
  schemaVersion: z.ZodLiteral<1>;
  eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  seq: z.ZodNumber;
  occurredAt: z.ZodISODateTime;
  observedAt: z.ZodISODateTime;
  timeSource: z.ZodEnum<{
    observed: "observed";
    producer: "producer";
  }>;
  resourceRevision: z.ZodNumber;
  requirementRevision: z.ZodNullable<z.ZodNumber>;
  planRevision: z.ZodNullable<z.ZodNumber>;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
  attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
}, z.core.$strict>, z.ZodObject<{
  type: z.ZodLiteral<"DecisionSaved">;
  payload: z.ZodObject<{
    decisionId: z.core.$ZodBranded<z.ZodString, "decision", "out">;
  }, z.core.$strict>;
  schemaVersion: z.ZodLiteral<1>;
  eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  seq: z.ZodNumber;
  occurredAt: z.ZodISODateTime;
  observedAt: z.ZodISODateTime;
  timeSource: z.ZodEnum<{
    observed: "observed";
    producer: "producer";
  }>;
  resourceRevision: z.ZodNumber;
  requirementRevision: z.ZodNullable<z.ZodNumber>;
  planRevision: z.ZodNullable<z.ZodNumber>;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
  attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
}, z.core.$strict>, z.ZodObject<{
  type: z.ZodLiteral<"ControlProgress">;
  payload: z.ZodObject<{
    state: z.ZodObject<{
      phase: z.ZodEnum<{
        PREPARING: "PREPARING";
        UNDERSTANDING: "UNDERSTANDING";
        PLANNING: "PLANNING";
        EXECUTING: "EXECUTING";
        VERIFYING: "VERIFYING";
        REVIEW: "REVIEW";
      }>;
      controlGate: z.ZodEnum<{
        OPEN: "OPEN";
        PAUSING: "PAUSING";
        PAUSED: "PAUSED";
        CANCELLING: "CANCELLING";
      }>;
      terminalOutcome: z.ZodNullable<z.ZodEnum<{
        COMPLETED: "COMPLETED";
        FAILED: "FAILED";
        CANCELLED: "CANCELLED";
      }>>;
    }, z.core.$strict>;
    controlRevision: z.ZodNumber;
    runEpoch: z.ZodNumber;
  }, z.core.$strict>;
  schemaVersion: z.ZodLiteral<1>;
  eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  seq: z.ZodNumber;
  occurredAt: z.ZodISODateTime;
  observedAt: z.ZodISODateTime;
  timeSource: z.ZodEnum<{
    observed: "observed";
    producer: "producer";
  }>;
  resourceRevision: z.ZodNumber;
  requirementRevision: z.ZodNullable<z.ZodNumber>;
  planRevision: z.ZodNullable<z.ZodNumber>;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
  attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
}, z.core.$strict>, z.ZodObject<{
  type: z.ZodLiteral<"ConfigurationApplied">;
  payload: z.ZodObject<{
    configurationRef: z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
    }, z.core.$strict>;
  }, z.core.$strict>;
  schemaVersion: z.ZodLiteral<1>;
  eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  seq: z.ZodNumber;
  occurredAt: z.ZodISODateTime;
  observedAt: z.ZodISODateTime;
  timeSource: z.ZodEnum<{
    observed: "observed";
    producer: "producer";
  }>;
  resourceRevision: z.ZodNumber;
  requirementRevision: z.ZodNullable<z.ZodNumber>;
  planRevision: z.ZodNullable<z.ZodNumber>;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
  attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
}, z.core.$strict>, z.ZodObject<{
  type: z.ZodLiteral<"CandidateUpdated">;
  payload: z.ZodObject<{
    candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
    state: z.ZodEnum<{
      PREPARING: "PREPARING";
      SUPERSEDED: "SUPERSEDED";
      READY: "READY";
      BLOCKED: "BLOCKED";
    }>;
  }, z.core.$strict>;
  schemaVersion: z.ZodLiteral<1>;
  eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  seq: z.ZodNumber;
  occurredAt: z.ZodISODateTime;
  observedAt: z.ZodISODateTime;
  timeSource: z.ZodEnum<{
    observed: "observed";
    producer: "producer";
  }>;
  resourceRevision: z.ZodNumber;
  requirementRevision: z.ZodNullable<z.ZodNumber>;
  planRevision: z.ZodNullable<z.ZodNumber>;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
  attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
}, z.core.$strict>, z.ZodObject<{
  type: z.ZodLiteral<"ReleaseAccepted">;
  payload: z.ZodObject<{
    candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
    releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
  }, z.core.$strict>;
  schemaVersion: z.ZodLiteral<1>;
  eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  seq: z.ZodNumber;
  occurredAt: z.ZodISODateTime;
  observedAt: z.ZodISODateTime;
  timeSource: z.ZodEnum<{
    observed: "observed";
    producer: "producer";
  }>;
  resourceRevision: z.ZodNumber;
  requirementRevision: z.ZodNullable<z.ZodNumber>;
  planRevision: z.ZodNullable<z.ZodNumber>;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
  attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
}, z.core.$strict>, z.ZodObject<{
  type: z.ZodLiteral<"PreviewStateChanged">;
  payload: z.ZodObject<{
    previewId: z.core.$ZodBranded<z.ZodString, "preview", "out">;
    state: z.ZodEnum<{
      PREPARING: "PREPARING";
      FAILED: "FAILED";
      OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN";
      STOPPING: "STOPPING";
      RUNNING: "RUNNING";
      STOPPED: "STOPPED";
    }>;
  }, z.core.$strict>;
  schemaVersion: z.ZodLiteral<1>;
  eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  seq: z.ZodNumber;
  occurredAt: z.ZodISODateTime;
  observedAt: z.ZodISODateTime;
  timeSource: z.ZodEnum<{
    observed: "observed";
    producer: "producer";
  }>;
  resourceRevision: z.ZodNumber;
  requirementRevision: z.ZodNullable<z.ZodNumber>;
  planRevision: z.ZodNullable<z.ZodNumber>;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
  attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
}, z.core.$strict>, z.ZodObject<{
  type: z.ZodLiteral<"ExportUpdated">;
  payload: z.ZodObject<{
    exportId: z.core.$ZodBranded<z.ZodString, "export", "out">;
    status: z.ZodEnum<{
      FAILED: "FAILED";
      OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN";
      SUCCEEDED: "SUCCEEDED";
      RUNNING: "RUNNING";
      ACCEPTED: "ACCEPTED";
      WAITING: "WAITING";
    }>;
  }, z.core.$strict>;
  schemaVersion: z.ZodLiteral<1>;
  eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  seq: z.ZodNumber;
  occurredAt: z.ZodISODateTime;
  observedAt: z.ZodISODateTime;
  timeSource: z.ZodEnum<{
    observed: "observed";
    producer: "producer";
  }>;
  resourceRevision: z.ZodNumber;
  requirementRevision: z.ZodNullable<z.ZodNumber>;
  planRevision: z.ZodNullable<z.ZodNumber>;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
  attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
}, z.core.$strict>, z.ZodObject<{
  type: z.ZodLiteral<"IssueChanged">;
  payload: z.ZodObject<{
    issueId: z.ZodString;
    issueRevision: z.ZodNumber;
    toolOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    toolName: z.ZodEnum<{
      "issues.create": "issues.create";
      "issues.linkFix": "issues.linkFix";
      "issues.recordVerification": "issues.recordVerification";
    }>;
  }, z.core.$strict>;
  schemaVersion: z.ZodLiteral<1>;
  eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  seq: z.ZodNumber;
  occurredAt: z.ZodISODateTime;
  observedAt: z.ZodISODateTime;
  timeSource: z.ZodEnum<{
    observed: "observed";
    producer: "producer";
  }>;
  resourceRevision: z.ZodNumber;
  requirementRevision: z.ZodNullable<z.ZodNumber>;
  planRevision: z.ZodNullable<z.ZodNumber>;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
  attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
}, z.core.$strict>, z.ZodObject<{
  type: z.ZodLiteral<"PipelineChanged">;
  payload: z.ZodObject<{
    pipelineId: z.ZodString;
    toolOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    state: z.ZodEnum<{
      FAILED: "FAILED";
      CANCELLED: "CANCELLED";
      OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN";
      STOPPING: "STOPPING";
      SUCCEEDED: "SUCCEEDED";
      QUEUED: "QUEUED";
      RUNNING: "RUNNING";
    }>;
  }, z.core.$strict>;
  schemaVersion: z.ZodLiteral<1>;
  eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  seq: z.ZodNumber;
  occurredAt: z.ZodISODateTime;
  observedAt: z.ZodISODateTime;
  timeSource: z.ZodEnum<{
    observed: "observed";
    producer: "producer";
  }>;
  resourceRevision: z.ZodNumber;
  requirementRevision: z.ZodNullable<z.ZodNumber>;
  planRevision: z.ZodNullable<z.ZodNumber>;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
  attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
}, z.core.$strict>, z.ZodObject<{
  type: z.ZodLiteral<"CandidateReviewRecorded">;
  payload: z.ZodObject<{
    candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
    resultId: z.ZodString;
  }, z.core.$strict>;
  schemaVersion: z.ZodLiteral<1>;
  eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  seq: z.ZodNumber;
  occurredAt: z.ZodISODateTime;
  observedAt: z.ZodISODateTime;
  timeSource: z.ZodEnum<{
    observed: "observed";
    producer: "producer";
  }>;
  resourceRevision: z.ZodNumber;
  requirementRevision: z.ZodNullable<z.ZodNumber>;
  planRevision: z.ZodNullable<z.ZodNumber>;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
  attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
}, z.core.$strict>, z.ZodObject<{
  type: z.ZodLiteral<"CandidateRejected">;
  payload: z.ZodObject<{
    candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
    rejectionId: z.ZodString;
    resultId: z.ZodString;
    state: z.ZodEnum<{
      OPEN: "OPEN";
      WITHDRAWN: "WITHDRAWN";
    }>;
  }, z.core.$strict>;
  schemaVersion: z.ZodLiteral<1>;
  eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  seq: z.ZodNumber;
  occurredAt: z.ZodISODateTime;
  observedAt: z.ZodISODateTime;
  timeSource: z.ZodEnum<{
    observed: "observed";
    producer: "producer";
  }>;
  resourceRevision: z.ZodNumber;
  requirementRevision: z.ZodNullable<z.ZodNumber>;
  planRevision: z.ZodNullable<z.ZodNumber>;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
  attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
}, z.core.$strict>, z.ZodObject<{
  type: z.ZodLiteral<"DatasetStateChanged">;
  payload: z.ZodObject<{
    datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
    state: z.ZodEnum<{
      PREPARING: "PREPARING";
      MISSING: "MISSING";
      READY: "READY";
      WRITE_FROZEN: "WRITE_FROZEN";
      RETIRED: "RETIRED";
    }>;
  }, z.core.$strict>;
  schemaVersion: z.ZodLiteral<1>;
  eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  seq: z.ZodNumber;
  occurredAt: z.ZodISODateTime;
  observedAt: z.ZodISODateTime;
  timeSource: z.ZodEnum<{
    observed: "observed";
    producer: "producer";
  }>;
  resourceRevision: z.ZodNumber;
  requirementRevision: z.ZodNullable<z.ZodNumber>;
  planRevision: z.ZodNullable<z.ZodNumber>;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
  attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
}, z.core.$strict>, z.ZodObject<{
  type: z.ZodLiteral<"PreviewOperationChanged">;
  payload: z.ZodObject<{
    previewId: z.core.$ZodBranded<z.ZodString, "preview", "out">;
    state: z.ZodEnum<{
      STOPPING: "STOPPING";
      STARTING: "STARTING";
      READY: "READY";
      UNKNOWN: "UNKNOWN";
      STOPPED: "STOPPED";
      EXPIRED: "EXPIRED";
    }>;
  }, z.core.$strict>;
  schemaVersion: z.ZodLiteral<1>;
  eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  seq: z.ZodNumber;
  occurredAt: z.ZodISODateTime;
  observedAt: z.ZodISODateTime;
  timeSource: z.ZodEnum<{
    observed: "observed";
    producer: "producer";
  }>;
  resourceRevision: z.ZodNumber;
  requirementRevision: z.ZodNullable<z.ZodNumber>;
  planRevision: z.ZodNullable<z.ZodNumber>;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
  attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
}, z.core.$strict>, z.ZodObject<{
  type: z.ZodLiteral<"AcceptancePreparationChanged">;
  payload: z.ZodObject<{
    preparationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    state: z.ZodEnum<{
      FAILED: "FAILED";
      PREPARED: "PREPARED";
      SENT: "SENT";
      UNKNOWN: "UNKNOWN";
    }>;
  }, z.core.$strict>;
  schemaVersion: z.ZodLiteral<1>;
  eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  seq: z.ZodNumber;
  occurredAt: z.ZodISODateTime;
  observedAt: z.ZodISODateTime;
  timeSource: z.ZodEnum<{
    observed: "observed";
    producer: "producer";
  }>;
  resourceRevision: z.ZodNumber;
  requirementRevision: z.ZodNullable<z.ZodNumber>;
  planRevision: z.ZodNullable<z.ZodNumber>;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
  attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
}, z.core.$strict>, z.ZodObject<{
  type: z.ZodLiteral<"AcceptanceReadinessObserved">;
  payload: z.ZodObject<{
    preparationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    sequence: z.ZodNumber;
    state: z.ZodEnum<{
      READY: "READY";
      UNKNOWN: "UNKNOWN";
    }>;
  }, z.core.$strict>;
  schemaVersion: z.ZodLiteral<1>;
  eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  seq: z.ZodNumber;
  occurredAt: z.ZodISODateTime;
  observedAt: z.ZodISODateTime;
  timeSource: z.ZodEnum<{
    observed: "observed";
    producer: "producer";
  }>;
  resourceRevision: z.ZodNumber;
  requirementRevision: z.ZodNullable<z.ZodNumber>;
  planRevision: z.ZodNullable<z.ZodNumber>;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
  attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
}, z.core.$strict>, z.ZodObject<{
  type: z.ZodLiteral<"DatasetWriteGateClosed">;
  payload: z.ZodObject<{
    datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
    preparationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    fence: z.ZodNumber;
  }, z.core.$strict>;
  schemaVersion: z.ZodLiteral<1>;
  eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  seq: z.ZodNumber;
  occurredAt: z.ZodISODateTime;
  observedAt: z.ZodISODateTime;
  timeSource: z.ZodEnum<{
    observed: "observed";
    producer: "producer";
  }>;
  resourceRevision: z.ZodNumber;
  requirementRevision: z.ZodNullable<z.ZodNumber>;
  planRevision: z.ZodNullable<z.ZodNumber>;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
  attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
}, z.core.$strict>], "type">;
type DomainEvent = z.infer<typeof domainEvent>;
declare const ephemeralTokenDelta: z.ZodObject<{
  kind: z.ZodLiteral<"token-delta">;
  streamId: z.ZodString;
  text: z.ZodString;
}, z.core.$strict>;
//#endregion
//#region src/openapi.d.ts
declare const schemas: {
  CreateProject: z.ZodObject<{
    initialRequest: z.ZodObject<{
      text: z.ZodUnion<readonly [z.ZodString, z.ZodLiteral<"">]>;
      attachmentIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "attachment", "out">>;
    }, z.core.$strict>;
    clientDraftId: z.ZodUUID;
    name: z.ZodOptional<z.ZodString>;
  }, z.core.$strict>;
  SaveMessage: z.ZodObject<{
    text: z.ZodString;
    attachmentIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "attachment", "out">>;
    clientMessageId: z.ZodUUID;
    intentHint: z.ZodOptional<z.ZodEnum<{
      change: "change";
      query: "query";
      unsure: "unsure";
    }>>;
  }, z.core.$strict>;
  AnswerQuestions: z.ZodObject<{
    answers: z.ZodArray<z.ZodObject<{
      questionId: z.core.$ZodBranded<z.ZodString, "question", "out">;
      questionRevision: z.ZodNumber;
      value: z.ZodJSONSchema;
    }, z.core.$strict>>;
  }, z.core.$strict>;
  ConfirmPlan: z.ZodObject<{
    requirementRevision: z.ZodNumber;
    reviewHash: z.ZodString;
    carryForwardHash: z.ZodOptional<z.ZodString>;
  }, z.core.$strict>;
  PlanFeedback: z.ZodObject<{
    text: z.ZodString;
    workIds: z.ZodOptional<z.ZodArray<z.core.$ZodBranded<z.ZodString, "work", "out">>>;
  }, z.core.$strict>;
  ProposeChange: z.ZodObject<{
    proposedText: z.ZodString;
    sourceMessageId: z.core.$ZodBranded<z.ZodString, "message", "out">;
  }, z.core.$strict>;
  DecideChange: z.ZodObject<{
    action: z.ZodEnum<{
      confirm: "confirm";
      reject: "reject";
    }>;
    analysisId: z.core.$ZodBranded<z.ZodString, "analysis", "out">;
    basisHash: z.ZodString;
  }, z.core.$strict>;
  PauseRun: z.ZodObject<{
    reason: z.ZodOptional<z.ZodString>;
  }, z.core.$strict>;
  ResumeRun: z.ZodObject<{
    controlRevision: z.ZodNumber;
    recoveryReviewHash: z.ZodString;
  }, z.core.$strict>;
  CancelRun: z.ZodObject<{
    impactReviewHash: z.ZodString;
  }, z.core.$strict>;
  RetryWork: z.ZodObject<{
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    failedAttemptId: z.core.$ZodBranded<z.ZodString, "attempt", "out">;
    retryReviewHash: z.ZodString;
  }, z.core.$strict>;
  RedoRun: z.ZodObject<{
    redoReviewHash: z.ZodString;
  }, z.core.$strict>;
  AcceptCandidate: z.ZodObject<{
    candidateRevision: z.ZodNumber;
    manifestHash: z.ZodString;
    reviewHash: z.ZodString;
    expectedAcceptedReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
    dataPlanHash: z.ZodString;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    preparationOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    requestHash: z.ZodString;
    expectedPreparationRevision: z.ZodNumber;
    expectedObservationSequence: z.ZodNumber;
    proofHash: z.ZodString;
    confirmation: z.ZodLiteral<"ACCEPT_RELEASE">;
  }, z.core.$strict>;
  BeginAcceptance: z.ZodObject<{
    candidateRevision: z.ZodNumber;
    manifestHash: z.ZodString;
    reviewHash: z.ZodString;
    expectedAcceptedReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
    dataPlanHash: z.ZodString;
    policyHash: z.ZodString;
  }, z.core.$strict>;
  ConfirmAcceptanceReplacement: z.ZodObject<{
    candidateRevision: z.ZodNumber;
    manifestHash: z.ZodString;
    reviewHash: z.ZodString;
    expectedAcceptedReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
    dataPlanHash: z.ZodString;
    decisionId: z.core.$ZodBranded<z.ZodString, "decision", "out">;
    confirmation: z.ZodLiteral<"REPLACE_ACCEPTED_DATA">;
  }, z.core.$strict>;
  CloseUnsentAcceptance: z.ZodObject<{
    requestHash: z.ZodString;
  }, z.core.$strict>;
  AbortAcceptance: z.ZodObject<{
    requestHash: z.ZodString;
    expectedPreparationRevision: z.ZodNumber;
    reason: z.ZodString;
    confirmation: z.ZodLiteral<"ABORT_ACCEPTANCE_PREPARATION">;
  }, z.core.$strict>;
  AcceptanceBasis: z.ZodObject<{
    candidateRevision: z.ZodNumber;
    manifestHash: z.ZodString;
    reviewHash: z.ZodString;
    expectedAcceptedReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
    dataPlanHash: z.ZodString;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
    codeCommit: z.ZodString;
    dataPlan: z.ZodDiscriminatedUnion<[z.ZodObject<{
      strategy: z.ZodLiteral<"INITIAL">;
      initialData: z.ZodEnum<{
        EMPTY: "EMPTY";
        DEMO: "DEMO";
      }>;
      sourceReleaseId: z.ZodNull;
      migrationRef: z.ZodNull;
      replacementDecisionId: z.ZodNull;
      schemaVersion: z.ZodLiteral<"devmesh.data-plan.v1">;
      runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
      codeCommit: z.ZodString;
      requirementRevision: z.ZodNumber;
      planRevision: z.ZodNumber;
      templateVersion: z.ZodString;
      checkConfigHash: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
      strategy: z.ZodLiteral<"PRESERVE_MIGRATE">;
      initialData: z.ZodNull;
      sourceReleaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
      migrationRef: z.ZodObject<{
        artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
        sha256: z.ZodString;
      }, z.core.$strict>;
      replacementDecisionId: z.ZodNull;
      schemaVersion: z.ZodLiteral<"devmesh.data-plan.v1">;
      runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
      codeCommit: z.ZodString;
      requirementRevision: z.ZodNumber;
      planRevision: z.ZodNumber;
      templateVersion: z.ZodString;
      checkConfigHash: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
      strategy: z.ZodLiteral<"REPLACE">;
      initialData: z.ZodEnum<{
        EMPTY: "EMPTY";
        DEMO: "DEMO";
      }>;
      sourceReleaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
      migrationRef: z.ZodNull;
      replacementDecisionId: z.core.$ZodBranded<z.ZodString, "decision", "out">;
      schemaVersion: z.ZodLiteral<"devmesh.data-plan.v1">;
      runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
      codeCommit: z.ZodString;
      requirementRevision: z.ZodNumber;
      planRevision: z.ZodNumber;
      templateVersion: z.ZodString;
      checkConfigHash: z.ZodString;
    }, z.core.$strict>], "strategy">;
    currentAcceptedReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
    resourceRevision: z.ZodNumber;
    qualification: z.ZodEnum<{
      CURRENT: "CURRENT";
      STALE: "STALE";
    }>;
    configured: z.ZodBoolean;
    policyHash: z.ZodNullable<z.ZodString>;
    replacementConfirmed: z.ZodBoolean;
    blockedByPreparationOperationId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "op", "out">>;
    canManage: z.ZodBoolean;
    canPrepare: z.ZodBoolean;
    canConfirmReplacement: z.ZodBoolean;
    reason: z.ZodNullable<z.ZodEnum<{
      NOT_OWNER: "NOT_OWNER";
      REVIEW_REQUIRED: "REVIEW_REQUIRED";
      CANDIDATE_STALE: "CANDIDATE_STALE";
      SOURCE_CHANGED: "SOURCE_CHANGED";
      BACKEND_UNAVAILABLE: "BACKEND_UNAVAILABLE";
      REPLACEMENT_CONFIRMATION_REQUIRED: "REPLACEMENT_CONFIRMATION_REQUIRED";
      PREPARATION_UNRESOLVED: "PREPARATION_UNRESOLVED";
      EFFECT_UNRESOLVED: "EFFECT_UNRESOLVED";
    }>>;
  }, z.core.$strict>;
  AcceptancePreparation: z.ZodObject<{
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
    releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
    requestHash: z.ZodString;
    revision: z.ZodNumber;
    state: z.ZodEnum<{
      FAILED: "FAILED";
      PREPARED: "PREPARED";
      SENT: "SENT";
      UNKNOWN: "UNKNOWN";
    }>;
    resolution: z.ZodEnum<{
      UNRESOLVED: "UNRESOLVED";
      UNSENT_FAILED: "UNSENT_FAILED";
      COMMITTED: "COMMITTED";
      ABORTING: "ABORTING";
      ABORTED: "ABORTED";
    }>;
    qualification: z.ZodEnum<{
      CURRENT: "CURRENT";
      STALE: "STALE";
    }>;
    basis: z.ZodObject<{
      candidateRevision: z.ZodNumber;
      manifestHash: z.ZodString;
      reviewHash: z.ZodString;
      expectedAcceptedReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
      dataPlanHash: z.ZodString;
    }, z.core.$strict>;
    createdAt: z.ZodISODateTime;
    updatedAt: z.ZodISODateTime;
    acceptanceOperationId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "op", "out">>;
    readiness: z.ZodObject<{
      state: z.ZodEnum<{
        STALE: "STALE";
        READY: "READY";
        UNPREPARED: "UNPREPARED";
        UNAVAILABLE: "UNAVAILABLE";
      }>;
      sequence: z.ZodNumber;
      proofHash: z.ZodNullable<z.ZodString>;
      checkedAt: z.ZodNullable<z.ZodISODateTime>;
    }, z.core.$strict>;
    resourceRevision: z.ZodNumber;
    canCommit: z.ZodBoolean;
    canCloseUnsent: z.ZodBoolean;
    canAbort: z.ZodBoolean;
  }, z.core.$strict>;
  AcceptancePreparationList: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
      sequence: z.ZodNumber;
      preparation: z.ZodObject<{
        operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
        runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
        candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
        releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
        requestHash: z.ZodString;
        revision: z.ZodNumber;
        state: z.ZodEnum<{
          FAILED: "FAILED";
          PREPARED: "PREPARED";
          SENT: "SENT";
          UNKNOWN: "UNKNOWN";
        }>;
        resolution: z.ZodEnum<{
          UNRESOLVED: "UNRESOLVED";
          UNSENT_FAILED: "UNSENT_FAILED";
          COMMITTED: "COMMITTED";
          ABORTING: "ABORTING";
          ABORTED: "ABORTED";
        }>;
        qualification: z.ZodEnum<{
          CURRENT: "CURRENT";
          STALE: "STALE";
        }>;
        basis: z.ZodObject<{
          candidateRevision: z.ZodNumber;
          manifestHash: z.ZodString;
          reviewHash: z.ZodString;
          expectedAcceptedReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
          dataPlanHash: z.ZodString;
        }, z.core.$strict>;
        createdAt: z.ZodISODateTime;
        updatedAt: z.ZodISODateTime;
        acceptanceOperationId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "op", "out">>;
        readiness: z.ZodObject<{
          state: z.ZodEnum<{
            STALE: "STALE";
            READY: "READY";
            UNPREPARED: "UNPREPARED";
            UNAVAILABLE: "UNAVAILABLE";
          }>;
          sequence: z.ZodNumber;
          proofHash: z.ZodNullable<z.ZodString>;
          checkedAt: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strict>;
        resourceRevision: z.ZodNumber;
        canCommit: z.ZodBoolean;
        canCloseUnsent: z.ZodBoolean;
        canAbort: z.ZodBoolean;
      }, z.core.$strict>;
    }, z.core.$strict>>;
    nextSequence: z.ZodNullable<z.ZodNumber>;
  }, z.core.$strict>;
  AcceptanceReplacementReceipt: z.ZodObject<{
    decisionId: z.core.$ZodBranded<z.ZodString, "decision", "out">;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  }, z.core.$strict>;
  AcceptanceAbortReceipt: z.ZodObject<{
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    preparationOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    decisionHash: z.ZodString;
    reason: z.ZodString;
    decidedAt: z.ZodISODateTime;
    decisionState: z.ZodLiteral<"RECORDED">;
  }, z.core.$strict>;
  AcceptanceCommitReceipt: z.ZodObject<{
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    status: z.ZodLiteral<"SUCCEEDED">;
    result: z.ZodObject<{
      releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
      projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
      runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
      candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
      candidateRevision: z.ZodNumber;
      manifestHash: z.ZodString;
      reviewHash: z.ZodString;
      preparationOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      acceptanceOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      requestHash: z.ZodString;
      proofHash: z.ZodString;
      datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
      previousReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
      acceptedBy: z.ZodString;
      acceptedAt: z.ZodISODateTime;
      acceptanceState: z.ZodLiteral<"ACCEPTED">;
      publicationState: z.ZodLiteral<"PENDING">;
    }, z.core.$strict>;
    links: z.ZodObject<{
      preparation: z.ZodString;
    }, z.core.$strict>;
  }, z.core.$strict>;
  CandidateReviewEntry: z.ZodObject<{
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    codeCommit: z.ZodString;
    review: z.ZodObject<{
      candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
      candidateRevision: z.ZodNumber;
      manifestHash: z.ZodString;
      qualification: z.ZodEnum<{
        CURRENT: "CURRENT";
        STALE: "STALE";
      }>;
      resourceRevision: z.ZodNumber;
      automaticStatus: z.ZodLiteral<"PASS">;
      humanStatus: z.ZodEnum<{
        STALE: "STALE";
        PASS: "PASS";
        MISSING: "MISSING";
        FAIL: "FAIL";
      }>;
      reviewHash: z.ZodString;
      items: z.ZodArray<z.ZodObject<{
        itemId: z.ZodString;
        itemHash: z.ZodString;
        kind: z.ZodEnum<{
          requirement: "requirement";
          "work-human": "work-human";
          "quality-human": "quality-human";
        }>;
        requirementIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "requirement", "out">>;
        subjectId: z.ZodString;
        checkId: z.ZodString;
        expected: z.ZodString;
        status: z.ZodEnum<{
          STALE: "STALE";
          PASS: "PASS";
          MISSING: "MISSING";
          FAIL: "FAIL";
        }>;
        result: z.ZodNullable<z.ZodObject<{
          resultId: z.ZodString;
          operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
          candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
          candidateRevision: z.ZodNumber;
          manifestHash: z.ZodString;
          item: z.ZodObject<{
            itemId: z.ZodString;
            itemHash: z.ZodString;
            kind: z.ZodEnum<{
              requirement: "requirement";
              "work-human": "work-human";
              "quality-human": "quality-human";
            }>;
            requirementIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "requirement", "out">>;
            subjectId: z.ZodString;
            checkId: z.ZodString;
            expected: z.ZodString;
          }, z.core.$strict>;
          previousResultId: z.ZodNullable<z.ZodString>;
          principalId: z.ZodString;
          verdict: z.ZodEnum<{
            PASS: "PASS";
            FAIL: "FAIL";
          }>;
          procedure: z.ZodString;
          expected: z.ZodString;
          observed: z.ZodString;
          evidence: z.ZodArray<z.ZodObject<{
            artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
            sha256: z.ZodString;
          }, z.core.$strict>>;
          createdAt: z.ZodISODateTime;
        }, z.core.$strict>>;
      }, z.core.$strict>>;
      automaticChecks: z.ZodArray<z.ZodObject<{
        operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
        checkId: z.ZodString;
        status: z.ZodString;
        codes: z.ZodArray<z.ZodString>;
      }, z.core.$strict>>;
      rejections: z.ZodArray<z.ZodObject<{
        resultId: z.ZodString;
        operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
        candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
        candidateRevision: z.ZodNumber;
        manifestHash: z.ZodString;
        rejectionId: z.ZodString;
        previousResultId: z.ZodNullable<z.ZodString>;
        classification: z.ZodEnum<{
          IN_SCOPE_DEFECT: "IN_SCOPE_DEFECT";
          SCOPE_CHANGE: "SCOPE_CHANGE";
        }>;
        state: z.ZodEnum<{
          OPEN: "OPEN";
          WITHDRAWN: "WITHDRAWN";
        }>;
        item: z.ZodNullable<z.ZodObject<{
          itemId: z.ZodString;
          itemHash: z.ZodString;
          kind: z.ZodEnum<{
            requirement: "requirement";
            "work-human": "work-human";
            "quality-human": "quality-human";
          }>;
          requirementIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "requirement", "out">>;
          subjectId: z.ZodString;
          checkId: z.ZodString;
          expected: z.ZodString;
        }, z.core.$strict>>;
        description: z.ZodString;
        reason: z.ZodString;
        evidence: z.ZodArray<z.ZodObject<{
          artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
          sha256: z.ZodString;
        }, z.core.$strict>>;
        principalId: z.ZodString;
        createdAt: z.ZodISODateTime;
        nextAction: z.ZodEnum<{
          REPAIR_REVIEW_REQUIRED: "REPAIR_REVIEW_REQUIRED";
          CHANGE_REVIEW_REQUIRED: "CHANGE_REVIEW_REQUIRED";
          NONE: "NONE";
        }>;
        applicationState: z.ZodLiteral<"NOT_APPLIED">;
      }, z.core.$strict>>;
      rejectionStatus: z.ZodEnum<{
        OPEN: "OPEN";
        NONE: "NONE";
      }>;
      canRecord: z.ZodBoolean;
      canPrepareAcceptance: z.ZodBoolean;
      canWithdrawRejections: z.ZodBoolean;
    }, z.core.$strict>;
  }, z.core.$strict>;
  CandidateHumanResult: z.ZodObject<{
    resultId: z.ZodString;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
    candidateRevision: z.ZodNumber;
    manifestHash: z.ZodString;
    item: z.ZodObject<{
      itemId: z.ZodString;
      itemHash: z.ZodString;
      kind: z.ZodEnum<{
        requirement: "requirement";
        "work-human": "work-human";
        "quality-human": "quality-human";
      }>;
      requirementIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "requirement", "out">>;
      subjectId: z.ZodString;
      checkId: z.ZodString;
      expected: z.ZodString;
    }, z.core.$strict>;
    previousResultId: z.ZodNullable<z.ZodString>;
    principalId: z.ZodString;
    verdict: z.ZodEnum<{
      PASS: "PASS";
      FAIL: "FAIL";
    }>;
    procedure: z.ZodString;
    expected: z.ZodString;
    observed: z.ZodString;
    evidence: z.ZodArray<z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
    }, z.core.$strict>>;
    createdAt: z.ZodISODateTime;
  }, z.core.$strict>;
  CandidateRejectionResult: z.ZodObject<{
    resultId: z.ZodString;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
    candidateRevision: z.ZodNumber;
    manifestHash: z.ZodString;
    rejectionId: z.ZodString;
    previousResultId: z.ZodNullable<z.ZodString>;
    classification: z.ZodEnum<{
      IN_SCOPE_DEFECT: "IN_SCOPE_DEFECT";
      SCOPE_CHANGE: "SCOPE_CHANGE";
    }>;
    state: z.ZodEnum<{
      OPEN: "OPEN";
      WITHDRAWN: "WITHDRAWN";
    }>;
    item: z.ZodNullable<z.ZodObject<{
      itemId: z.ZodString;
      itemHash: z.ZodString;
      kind: z.ZodEnum<{
        requirement: "requirement";
        "work-human": "work-human";
        "quality-human": "quality-human";
      }>;
      requirementIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "requirement", "out">>;
      subjectId: z.ZodString;
      checkId: z.ZodString;
      expected: z.ZodString;
    }, z.core.$strict>>;
    description: z.ZodString;
    reason: z.ZodString;
    evidence: z.ZodArray<z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
    }, z.core.$strict>>;
    principalId: z.ZodString;
    createdAt: z.ZodISODateTime;
    nextAction: z.ZodEnum<{
      REPAIR_REVIEW_REQUIRED: "REPAIR_REVIEW_REQUIRED";
      CHANGE_REVIEW_REQUIRED: "CHANGE_REVIEW_REQUIRED";
      NONE: "NONE";
    }>;
    applicationState: z.ZodLiteral<"NOT_APPLIED">;
  }, z.core.$strict>;
  CandidateReviewHistory: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
      sequence: z.ZodNumber;
      result: z.ZodObject<{
        resultId: z.ZodString;
        operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
        candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
        candidateRevision: z.ZodNumber;
        manifestHash: z.ZodString;
        item: z.ZodObject<{
          itemId: z.ZodString;
          itemHash: z.ZodString;
          kind: z.ZodEnum<{
            requirement: "requirement";
            "work-human": "work-human";
            "quality-human": "quality-human";
          }>;
          requirementIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "requirement", "out">>;
          subjectId: z.ZodString;
          checkId: z.ZodString;
          expected: z.ZodString;
        }, z.core.$strict>;
        previousResultId: z.ZodNullable<z.ZodString>;
        principalId: z.ZodString;
        verdict: z.ZodEnum<{
          PASS: "PASS";
          FAIL: "FAIL";
        }>;
        procedure: z.ZodString;
        expected: z.ZodString;
        observed: z.ZodString;
        evidence: z.ZodArray<z.ZodObject<{
          artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
          sha256: z.ZodString;
        }, z.core.$strict>>;
        createdAt: z.ZodISODateTime;
      }, z.core.$strict>;
    }, z.core.$strict>>;
    nextSequence: z.ZodNullable<z.ZodNumber>;
  }, z.core.$strict>;
  CandidateRejectionHistory: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
      sequence: z.ZodNumber;
      result: z.ZodObject<{
        resultId: z.ZodString;
        operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
        candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
        candidateRevision: z.ZodNumber;
        manifestHash: z.ZodString;
        rejectionId: z.ZodString;
        previousResultId: z.ZodNullable<z.ZodString>;
        classification: z.ZodEnum<{
          IN_SCOPE_DEFECT: "IN_SCOPE_DEFECT";
          SCOPE_CHANGE: "SCOPE_CHANGE";
        }>;
        state: z.ZodEnum<{
          OPEN: "OPEN";
          WITHDRAWN: "WITHDRAWN";
        }>;
        item: z.ZodNullable<z.ZodObject<{
          itemId: z.ZodString;
          itemHash: z.ZodString;
          kind: z.ZodEnum<{
            requirement: "requirement";
            "work-human": "work-human";
            "quality-human": "quality-human";
          }>;
          requirementIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "requirement", "out">>;
          subjectId: z.ZodString;
          checkId: z.ZodString;
          expected: z.ZodString;
        }, z.core.$strict>>;
        description: z.ZodString;
        reason: z.ZodString;
        evidence: z.ZodArray<z.ZodObject<{
          artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
          sha256: z.ZodString;
        }, z.core.$strict>>;
        principalId: z.ZodString;
        createdAt: z.ZodISODateTime;
        nextAction: z.ZodEnum<{
          REPAIR_REVIEW_REQUIRED: "REPAIR_REVIEW_REQUIRED";
          CHANGE_REVIEW_REQUIRED: "CHANGE_REVIEW_REQUIRED";
          NONE: "NONE";
        }>;
        applicationState: z.ZodLiteral<"NOT_APPLIED">;
      }, z.core.$strict>;
    }, z.core.$strict>>;
    nextSequence: z.ZodNullable<z.ZodNumber>;
  }, z.core.$strict>;
  RecordCandidateReview: z.ZodObject<{
    manifestHash: z.ZodString;
    evidence: z.ZodArray<z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
    }, z.core.$strict>>;
    expected: z.ZodString;
    previousResultId: z.ZodNullable<z.ZodString>;
    verdict: z.ZodEnum<{
      PASS: "PASS";
      FAIL: "FAIL";
    }>;
    procedure: z.ZodString;
    observed: z.ZodString;
    itemId: z.ZodString;
    itemHash: z.ZodString;
  }, z.core.$strict>;
  RecordCandidateRejection: z.ZodObject<{
    manifestHash: z.ZodString;
    reason: z.ZodString;
    description: z.ZodString;
    state: z.ZodEnum<{
      OPEN: "OPEN";
      WITHDRAWN: "WITHDRAWN";
    }>;
    evidence: z.ZodArray<z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
    }, z.core.$strict>>;
    previousResultId: z.ZodNullable<z.ZodString>;
    rejectionId: z.ZodString;
    classification: z.ZodEnum<{
      IN_SCOPE_DEFECT: "IN_SCOPE_DEFECT";
      SCOPE_CHANGE: "SCOPE_CHANGE";
    }>;
    itemId: z.ZodNullable<z.ZodString>;
    itemHash: z.ZodNullable<z.ZodString>;
  }, z.core.$strict>;
  CreateReleaseExport: z.ZodObject<{
    format: z.ZodLiteral<"zip">;
  }, z.core.$strict>;
  RetryReleaseExport: z.ZodObject<{
    expectedGeneration: z.ZodNumber;
  }, z.core.$strict>;
  ReleaseExport: z.ZodObject<{
    exportId: z.ZodString;
    releaseId: z.ZodString;
    runId: z.ZodString;
    candidateId: z.ZodString;
    codeCommit: z.ZodString;
    cutoffSeq: z.ZodNumber;
    snapshotHash: z.ZodString;
    state: z.ZodEnum<{
      FAILED: "FAILED";
      QUEUED: "QUEUED";
      READY: "READY";
      PACKING: "PACKING";
    }>;
    generation: z.ZodNumber;
    leaseUntil: z.ZodNullable<z.ZodISODateTime>;
    archiveHash: z.ZodNullable<z.ZodString>;
    archiveSize: z.ZodNullable<z.ZodNumber>;
    errorCode: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodISODateTime;
    updatedAt: z.ZodISODateTime;
    canRetry: z.ZodBoolean;
  }, z.core.$strict>;
  ReleaseExportList: z.ZodObject<{
    jobs: z.ZodArray<z.ZodObject<{
      exportId: z.ZodString;
      releaseId: z.ZodString;
      runId: z.ZodString;
      candidateId: z.ZodString;
      codeCommit: z.ZodString;
      cutoffSeq: z.ZodNumber;
      snapshotHash: z.ZodString;
      state: z.ZodEnum<{
        FAILED: "FAILED";
        QUEUED: "QUEUED";
        READY: "READY";
        PACKING: "PACKING";
      }>;
      generation: z.ZodNumber;
      leaseUntil: z.ZodNullable<z.ZodISODateTime>;
      archiveHash: z.ZodNullable<z.ZodString>;
      archiveSize: z.ZodNullable<z.ZodNumber>;
      errorCode: z.ZodNullable<z.ZodString>;
      createdAt: z.ZodISODateTime;
      updatedAt: z.ZodISODateTime;
      canRetry: z.ZodBoolean;
    }, z.core.$strict>>;
    nextCursor: z.ZodNullable<z.ZodString>;
  }, z.core.$strict>;
  Command: z.ZodDiscriminatedUnion<[z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    type: z.ZodLiteral<"CreateProject">;
    idempotencyKey: z.ZodUUID;
    target: z.ZodObject<{
      kind: z.ZodLiteral<"creation">;
      namespace: z.ZodString;
    }, z.core.$strict>;
    payload: z.ZodObject<{
      initialRequest: z.ZodObject<{
        text: z.ZodUnion<readonly [z.ZodString, z.ZodLiteral<"">]>;
        attachmentIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "attachment", "out">>;
      }, z.core.$strict>;
      clientDraftId: z.ZodUUID;
      name: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>;
  }, z.core.$strict>, z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    type: z.ZodLiteral<"SaveMessage">;
    idempotencyKey: z.ZodUUID;
    target: z.ZodObject<{
      kind: z.ZodLiteral<"run">;
      projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
      runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    }, z.core.$strict>;
    payload: z.ZodObject<{
      text: z.ZodString;
      attachmentIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "attachment", "out">>;
      clientMessageId: z.ZodUUID;
      intentHint: z.ZodOptional<z.ZodEnum<{
        change: "change";
        query: "query";
        unsure: "unsure";
      }>>;
    }, z.core.$strict>;
  }, z.core.$strict>, z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    type: z.ZodLiteral<"AnswerQuestions">;
    idempotencyKey: z.ZodUUID;
    target: z.ZodObject<{
      kind: z.ZodLiteral<"run">;
      projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
      runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    }, z.core.$strict>;
    payload: z.ZodObject<{
      answers: z.ZodArray<z.ZodObject<{
        questionId: z.core.$ZodBranded<z.ZodString, "question", "out">;
        questionRevision: z.ZodNumber;
        value: z.ZodJSONSchema;
      }, z.core.$strict>>;
    }, z.core.$strict>;
  }, z.core.$strict>, z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    type: z.ZodLiteral<"ConfirmPlan">;
    idempotencyKey: z.ZodUUID;
    target: z.ZodObject<{
      kind: z.ZodLiteral<"plan">;
      projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
      runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
      planRevision: z.ZodNumber;
    }, z.core.$strict>;
    payload: z.ZodObject<{
      requirementRevision: z.ZodNumber;
      reviewHash: z.ZodString;
      carryForwardHash: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>;
  }, z.core.$strict>, z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    type: z.ZodLiteral<"PlanFeedback">;
    idempotencyKey: z.ZodUUID;
    target: z.ZodObject<{
      kind: z.ZodLiteral<"plan">;
      projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
      runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
      planRevision: z.ZodNumber;
    }, z.core.$strict>;
    payload: z.ZodObject<{
      text: z.ZodString;
      workIds: z.ZodOptional<z.ZodArray<z.core.$ZodBranded<z.ZodString, "work", "out">>>;
    }, z.core.$strict>;
  }, z.core.$strict>, z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    type: z.ZodLiteral<"ProposeChange">;
    idempotencyKey: z.ZodUUID;
    target: z.ZodObject<{
      kind: z.ZodLiteral<"run">;
      projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
      runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    }, z.core.$strict>;
    payload: z.ZodObject<{
      proposedText: z.ZodString;
      sourceMessageId: z.core.$ZodBranded<z.ZodString, "message", "out">;
    }, z.core.$strict>;
  }, z.core.$strict>, z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    type: z.ZodLiteral<"DecideChange">;
    idempotencyKey: z.ZodUUID;
    target: z.ZodObject<{
      kind: z.ZodLiteral<"change">;
      projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
      changeId: z.core.$ZodBranded<z.ZodString, "change", "out">;
    }, z.core.$strict>;
    payload: z.ZodObject<{
      action: z.ZodEnum<{
        confirm: "confirm";
        reject: "reject";
      }>;
      analysisId: z.core.$ZodBranded<z.ZodString, "analysis", "out">;
      basisHash: z.ZodString;
    }, z.core.$strict>;
  }, z.core.$strict>, z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    type: z.ZodLiteral<"PauseRun">;
    idempotencyKey: z.ZodUUID;
    target: z.ZodObject<{
      kind: z.ZodLiteral<"run">;
      projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
      runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    }, z.core.$strict>;
    payload: z.ZodObject<{
      reason: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>;
  }, z.core.$strict>, z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    type: z.ZodLiteral<"ResumeRun">;
    idempotencyKey: z.ZodUUID;
    target: z.ZodObject<{
      kind: z.ZodLiteral<"run">;
      projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
      runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    }, z.core.$strict>;
    payload: z.ZodObject<{
      controlRevision: z.ZodNumber;
      recoveryReviewHash: z.ZodString;
    }, z.core.$strict>;
  }, z.core.$strict>, z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    type: z.ZodLiteral<"CancelRun">;
    idempotencyKey: z.ZodUUID;
    target: z.ZodObject<{
      kind: z.ZodLiteral<"run">;
      projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
      runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    }, z.core.$strict>;
    payload: z.ZodObject<{
      impactReviewHash: z.ZodString;
    }, z.core.$strict>;
  }, z.core.$strict>, z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    type: z.ZodLiteral<"RetryWork">;
    idempotencyKey: z.ZodUUID;
    target: z.ZodObject<{
      kind: z.ZodLiteral<"work">;
      projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
      workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
    }, z.core.$strict>;
    payload: z.ZodObject<{
      runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
      failedAttemptId: z.core.$ZodBranded<z.ZodString, "attempt", "out">;
      retryReviewHash: z.ZodString;
    }, z.core.$strict>;
  }, z.core.$strict>, z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    type: z.ZodLiteral<"RedoRun">;
    idempotencyKey: z.ZodUUID;
    target: z.ZodObject<{
      kind: z.ZodLiteral<"run">;
      projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
      runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    }, z.core.$strict>;
    payload: z.ZodObject<{
      redoReviewHash: z.ZodString;
    }, z.core.$strict>;
  }, z.core.$strict>, z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    type: z.ZodLiteral<"AcceptCandidate">;
    idempotencyKey: z.ZodUUID;
    target: z.ZodObject<{
      kind: z.ZodLiteral<"candidate">;
      projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
      candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
    }, z.core.$strict>;
    payload: z.ZodObject<{
      candidateRevision: z.ZodNumber;
      manifestHash: z.ZodString;
      reviewHash: z.ZodString;
      expectedAcceptedReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
      dataPlanHash: z.ZodString;
      runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
      preparationOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      requestHash: z.ZodString;
      expectedPreparationRevision: z.ZodNumber;
      expectedObservationSequence: z.ZodNumber;
      proofHash: z.ZodString;
      confirmation: z.ZodLiteral<"ACCEPT_RELEASE">;
    }, z.core.$strict>;
  }, z.core.$strict>], "type">;
  DomainEvent: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"ReleasePublicationChanged">;
    payload: z.ZodObject<{
      releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
      state: z.ZodEnum<{
        PENDING: "PENDING";
        SENT: "SENT";
        UNKNOWN: "UNKNOWN";
        PUBLISHED: "PUBLISHED";
      }>;
      publicationRevision: z.ZodNumber;
      observationSequence: z.ZodNumber;
      errorCode: z.ZodNullable<z.ZodString>;
    }, z.core.$strict>;
    schemaVersion: z.ZodLiteral<1>;
    eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    seq: z.ZodNumber;
    occurredAt: z.ZodISODateTime;
    observedAt: z.ZodISODateTime;
    timeSource: z.ZodEnum<{
      observed: "observed";
      producer: "producer";
    }>;
    resourceRevision: z.ZodNumber;
    requirementRevision: z.ZodNullable<z.ZodNumber>;
    planRevision: z.ZodNullable<z.ZodNumber>;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
    attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
  }, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"AcceptanceAbortRequested">;
    payload: z.ZodObject<{
      preparationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      abortOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    }, z.core.$strict>;
    schemaVersion: z.ZodLiteral<1>;
    eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    seq: z.ZodNumber;
    occurredAt: z.ZodISODateTime;
    observedAt: z.ZodISODateTime;
    timeSource: z.ZodEnum<{
      observed: "observed";
      producer: "producer";
    }>;
    resourceRevision: z.ZodNumber;
    requirementRevision: z.ZodNullable<z.ZodNumber>;
    planRevision: z.ZodNullable<z.ZodNumber>;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
    attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
  }, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"AcceptanceAbortCompleted">;
    payload: z.ZodObject<{
      preparationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      abortOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    }, z.core.$strict>;
    schemaVersion: z.ZodLiteral<1>;
    eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    seq: z.ZodNumber;
    occurredAt: z.ZodISODateTime;
    observedAt: z.ZodISODateTime;
    timeSource: z.ZodEnum<{
      observed: "observed";
      producer: "producer";
    }>;
    resourceRevision: z.ZodNumber;
    requirementRevision: z.ZodNullable<z.ZodNumber>;
    planRevision: z.ZodNullable<z.ZodNumber>;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
    attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
  }, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"InputSaved">;
    payload: z.ZodObject<{
      messageId: z.core.$ZodBranded<z.ZodString, "message", "out">;
    }, z.core.$strict>;
    schemaVersion: z.ZodLiteral<1>;
    eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    seq: z.ZodNumber;
    occurredAt: z.ZodISODateTime;
    observedAt: z.ZodISODateTime;
    timeSource: z.ZodEnum<{
      observed: "observed";
      producer: "producer";
    }>;
    resourceRevision: z.ZodNumber;
    requirementRevision: z.ZodNullable<z.ZodNumber>;
    planRevision: z.ZodNullable<z.ZodNumber>;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
    attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
  }, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"UnderstandingUpdated">;
    payload: z.ZodObject<{
      understandingRef: z.ZodObject<{
        artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
        sha256: z.ZodString;
      }, z.core.$strict>;
    }, z.core.$strict>;
    schemaVersion: z.ZodLiteral<1>;
    eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    seq: z.ZodNumber;
    occurredAt: z.ZodISODateTime;
    observedAt: z.ZodISODateTime;
    timeSource: z.ZodEnum<{
      observed: "observed";
      producer: "producer";
    }>;
    resourceRevision: z.ZodNumber;
    requirementRevision: z.ZodNullable<z.ZodNumber>;
    planRevision: z.ZodNullable<z.ZodNumber>;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
    attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
  }, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"QuestionAnswered">;
    payload: z.ZodObject<{
      questionId: z.core.$ZodBranded<z.ZodString, "question", "out">;
      questionRevision: z.ZodNumber;
    }, z.core.$strict>;
    schemaVersion: z.ZodLiteral<1>;
    eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    seq: z.ZodNumber;
    occurredAt: z.ZodISODateTime;
    observedAt: z.ZodISODateTime;
    timeSource: z.ZodEnum<{
      observed: "observed";
      producer: "producer";
    }>;
    resourceRevision: z.ZodNumber;
    requirementRevision: z.ZodNullable<z.ZodNumber>;
    planRevision: z.ZodNullable<z.ZodNumber>;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
    attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
  }, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"PlanPublished">;
    payload: z.ZodObject<{
      planRevision: z.ZodNumber;
      planRef: z.ZodObject<{
        artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
        sha256: z.ZodString;
      }, z.core.$strict>;
    }, z.core.$strict>;
    schemaVersion: z.ZodLiteral<1>;
    eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    seq: z.ZodNumber;
    occurredAt: z.ZodISODateTime;
    observedAt: z.ZodISODateTime;
    timeSource: z.ZodEnum<{
      observed: "observed";
      producer: "producer";
    }>;
    resourceRevision: z.ZodNumber;
    requirementRevision: z.ZodNullable<z.ZodNumber>;
    planRevision: z.ZodNullable<z.ZodNumber>;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
    attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
  }, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"PlanConfirmed">;
    payload: z.ZodObject<{
      planRevision: z.ZodNumber;
      decisionId: z.core.$ZodBranded<z.ZodString, "decision", "out">;
    }, z.core.$strict>;
    schemaVersion: z.ZodLiteral<1>;
    eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    seq: z.ZodNumber;
    occurredAt: z.ZodISODateTime;
    observedAt: z.ZodISODateTime;
    timeSource: z.ZodEnum<{
      observed: "observed";
      producer: "producer";
    }>;
    resourceRevision: z.ZodNumber;
    requirementRevision: z.ZodNullable<z.ZodNumber>;
    planRevision: z.ZodNullable<z.ZodNumber>;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
    attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
  }, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"WorkAdmitted">;
    payload: z.ZodObject<{
      workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
      attemptId: z.core.$ZodBranded<z.ZodString, "attempt", "out">;
      activationId: z.core.$ZodBranded<z.ZodString, "activation", "out">;
    }, z.core.$strict>;
    schemaVersion: z.ZodLiteral<1>;
    eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    seq: z.ZodNumber;
    occurredAt: z.ZodISODateTime;
    observedAt: z.ZodISODateTime;
    timeSource: z.ZodEnum<{
      observed: "observed";
      producer: "producer";
    }>;
    resourceRevision: z.ZodNumber;
    requirementRevision: z.ZodNullable<z.ZodNumber>;
    planRevision: z.ZodNullable<z.ZodNumber>;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
    attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
  }, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"AttemptStateChanged">;
    payload: z.ZodObject<{
      attemptId: z.core.$ZodBranded<z.ZodString, "attempt", "out">;
      state: z.ZodEnum<{
        VERIFYING: "VERIFYING";
        FAILED: "FAILED";
        CANCELLED: "CANCELLED";
        RESERVED: "RESERVED";
        SUBMITTED: "SUBMITTED";
        WORKING: "WORKING";
        INPUT_REQUIRED: "INPUT_REQUIRED";
        OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN";
        STOPPING: "STOPPING";
        SUCCEEDED: "SUCCEEDED";
        INTERRUPTED: "INTERRUPTED";
      }>;
    }, z.core.$strict>;
    schemaVersion: z.ZodLiteral<1>;
    eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    seq: z.ZodNumber;
    occurredAt: z.ZodISODateTime;
    observedAt: z.ZodISODateTime;
    timeSource: z.ZodEnum<{
      observed: "observed";
      producer: "producer";
    }>;
    resourceRevision: z.ZodNumber;
    requirementRevision: z.ZodNullable<z.ZodNumber>;
    planRevision: z.ZodNullable<z.ZodNumber>;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
    attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
  }, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"A2ATaskObserved">;
    payload: z.ZodObject<{
      attemptId: z.core.$ZodBranded<z.ZodString, "attempt", "out">;
      endpointId: z.ZodString;
      taskId: z.ZodString;
      state: z.ZodEnum<{
        submitted: "submitted";
        working: "working";
        "input-required": "input-required";
        "auth-required": "auth-required";
        completed: "completed";
        failed: "failed";
        canceled: "canceled";
        rejected: "rejected";
      }>;
    }, z.core.$strict>;
    schemaVersion: z.ZodLiteral<1>;
    eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    seq: z.ZodNumber;
    occurredAt: z.ZodISODateTime;
    observedAt: z.ZodISODateTime;
    timeSource: z.ZodEnum<{
      observed: "observed";
      producer: "producer";
    }>;
    resourceRevision: z.ZodNumber;
    requirementRevision: z.ZodNullable<z.ZodNumber>;
    planRevision: z.ZodNullable<z.ZodNumber>;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
    attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
  }, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"ToolOperationUpdated">;
    payload: z.ZodObject<{
      toolOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      status: z.ZodEnum<{
        FAILED: "FAILED";
        OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN";
        SUCCEEDED: "SUCCEEDED";
        RUNNING: "RUNNING";
        ACCEPTED: "ACCEPTED";
        WAITING: "WAITING";
      }>;
    }, z.core.$strict>;
    schemaVersion: z.ZodLiteral<1>;
    eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    seq: z.ZodNumber;
    occurredAt: z.ZodISODateTime;
    observedAt: z.ZodISODateTime;
    timeSource: z.ZodEnum<{
      observed: "observed";
      producer: "producer";
    }>;
    resourceRevision: z.ZodNumber;
    requirementRevision: z.ZodNullable<z.ZodNumber>;
    planRevision: z.ZodNullable<z.ZodNumber>;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
    attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
  }, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"ArtifactRegistered">;
    payload: z.ZodObject<{
      artifact: z.ZodObject<{
        artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
        sha256: z.ZodString;
      }, z.core.$strict>;
    }, z.core.$strict>;
    schemaVersion: z.ZodLiteral<1>;
    eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    seq: z.ZodNumber;
    occurredAt: z.ZodISODateTime;
    observedAt: z.ZodISODateTime;
    timeSource: z.ZodEnum<{
      observed: "observed";
      producer: "producer";
    }>;
    resourceRevision: z.ZodNumber;
    requirementRevision: z.ZodNullable<z.ZodNumber>;
    planRevision: z.ZodNullable<z.ZodNumber>;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
    attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
  }, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"ChangeApplied">;
    payload: z.ZodObject<{
      changeId: z.core.$ZodBranded<z.ZodString, "change", "out">;
      requirementRevision: z.ZodNumber;
      planRevision: z.ZodNumber;
    }, z.core.$strict>;
    schemaVersion: z.ZodLiteral<1>;
    eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    seq: z.ZodNumber;
    occurredAt: z.ZodISODateTime;
    observedAt: z.ZodISODateTime;
    timeSource: z.ZodEnum<{
      observed: "observed";
      producer: "producer";
    }>;
    resourceRevision: z.ZodNumber;
    requirementRevision: z.ZodNullable<z.ZodNumber>;
    planRevision: z.ZodNullable<z.ZodNumber>;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
    attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
  }, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"DecisionSaved">;
    payload: z.ZodObject<{
      decisionId: z.core.$ZodBranded<z.ZodString, "decision", "out">;
    }, z.core.$strict>;
    schemaVersion: z.ZodLiteral<1>;
    eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    seq: z.ZodNumber;
    occurredAt: z.ZodISODateTime;
    observedAt: z.ZodISODateTime;
    timeSource: z.ZodEnum<{
      observed: "observed";
      producer: "producer";
    }>;
    resourceRevision: z.ZodNumber;
    requirementRevision: z.ZodNullable<z.ZodNumber>;
    planRevision: z.ZodNullable<z.ZodNumber>;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
    attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
  }, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"ControlProgress">;
    payload: z.ZodObject<{
      state: z.ZodObject<{
        phase: z.ZodEnum<{
          PREPARING: "PREPARING";
          UNDERSTANDING: "UNDERSTANDING";
          PLANNING: "PLANNING";
          EXECUTING: "EXECUTING";
          VERIFYING: "VERIFYING";
          REVIEW: "REVIEW";
        }>;
        controlGate: z.ZodEnum<{
          OPEN: "OPEN";
          PAUSING: "PAUSING";
          PAUSED: "PAUSED";
          CANCELLING: "CANCELLING";
        }>;
        terminalOutcome: z.ZodNullable<z.ZodEnum<{
          COMPLETED: "COMPLETED";
          FAILED: "FAILED";
          CANCELLED: "CANCELLED";
        }>>;
      }, z.core.$strict>;
      controlRevision: z.ZodNumber;
      runEpoch: z.ZodNumber;
    }, z.core.$strict>;
    schemaVersion: z.ZodLiteral<1>;
    eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    seq: z.ZodNumber;
    occurredAt: z.ZodISODateTime;
    observedAt: z.ZodISODateTime;
    timeSource: z.ZodEnum<{
      observed: "observed";
      producer: "producer";
    }>;
    resourceRevision: z.ZodNumber;
    requirementRevision: z.ZodNullable<z.ZodNumber>;
    planRevision: z.ZodNullable<z.ZodNumber>;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
    attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
  }, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"ConfigurationApplied">;
    payload: z.ZodObject<{
      configurationRef: z.ZodObject<{
        artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
        sha256: z.ZodString;
      }, z.core.$strict>;
    }, z.core.$strict>;
    schemaVersion: z.ZodLiteral<1>;
    eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    seq: z.ZodNumber;
    occurredAt: z.ZodISODateTime;
    observedAt: z.ZodISODateTime;
    timeSource: z.ZodEnum<{
      observed: "observed";
      producer: "producer";
    }>;
    resourceRevision: z.ZodNumber;
    requirementRevision: z.ZodNullable<z.ZodNumber>;
    planRevision: z.ZodNullable<z.ZodNumber>;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
    attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
  }, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"CandidateUpdated">;
    payload: z.ZodObject<{
      candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
      state: z.ZodEnum<{
        PREPARING: "PREPARING";
        SUPERSEDED: "SUPERSEDED";
        READY: "READY";
        BLOCKED: "BLOCKED";
      }>;
    }, z.core.$strict>;
    schemaVersion: z.ZodLiteral<1>;
    eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    seq: z.ZodNumber;
    occurredAt: z.ZodISODateTime;
    observedAt: z.ZodISODateTime;
    timeSource: z.ZodEnum<{
      observed: "observed";
      producer: "producer";
    }>;
    resourceRevision: z.ZodNumber;
    requirementRevision: z.ZodNullable<z.ZodNumber>;
    planRevision: z.ZodNullable<z.ZodNumber>;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
    attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
  }, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"ReleaseAccepted">;
    payload: z.ZodObject<{
      candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
      releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
    }, z.core.$strict>;
    schemaVersion: z.ZodLiteral<1>;
    eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    seq: z.ZodNumber;
    occurredAt: z.ZodISODateTime;
    observedAt: z.ZodISODateTime;
    timeSource: z.ZodEnum<{
      observed: "observed";
      producer: "producer";
    }>;
    resourceRevision: z.ZodNumber;
    requirementRevision: z.ZodNullable<z.ZodNumber>;
    planRevision: z.ZodNullable<z.ZodNumber>;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
    attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
  }, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"PreviewStateChanged">;
    payload: z.ZodObject<{
      previewId: z.core.$ZodBranded<z.ZodString, "preview", "out">;
      state: z.ZodEnum<{
        PREPARING: "PREPARING";
        FAILED: "FAILED";
        OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN";
        STOPPING: "STOPPING";
        RUNNING: "RUNNING";
        STOPPED: "STOPPED";
      }>;
    }, z.core.$strict>;
    schemaVersion: z.ZodLiteral<1>;
    eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    seq: z.ZodNumber;
    occurredAt: z.ZodISODateTime;
    observedAt: z.ZodISODateTime;
    timeSource: z.ZodEnum<{
      observed: "observed";
      producer: "producer";
    }>;
    resourceRevision: z.ZodNumber;
    requirementRevision: z.ZodNullable<z.ZodNumber>;
    planRevision: z.ZodNullable<z.ZodNumber>;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
    attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
  }, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"ExportUpdated">;
    payload: z.ZodObject<{
      exportId: z.core.$ZodBranded<z.ZodString, "export", "out">;
      status: z.ZodEnum<{
        FAILED: "FAILED";
        OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN";
        SUCCEEDED: "SUCCEEDED";
        RUNNING: "RUNNING";
        ACCEPTED: "ACCEPTED";
        WAITING: "WAITING";
      }>;
    }, z.core.$strict>;
    schemaVersion: z.ZodLiteral<1>;
    eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    seq: z.ZodNumber;
    occurredAt: z.ZodISODateTime;
    observedAt: z.ZodISODateTime;
    timeSource: z.ZodEnum<{
      observed: "observed";
      producer: "producer";
    }>;
    resourceRevision: z.ZodNumber;
    requirementRevision: z.ZodNullable<z.ZodNumber>;
    planRevision: z.ZodNullable<z.ZodNumber>;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
    attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
  }, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"IssueChanged">;
    payload: z.ZodObject<{
      issueId: z.ZodString;
      issueRevision: z.ZodNumber;
      toolOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      toolName: z.ZodEnum<{
        "issues.create": "issues.create";
        "issues.linkFix": "issues.linkFix";
        "issues.recordVerification": "issues.recordVerification";
      }>;
    }, z.core.$strict>;
    schemaVersion: z.ZodLiteral<1>;
    eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    seq: z.ZodNumber;
    occurredAt: z.ZodISODateTime;
    observedAt: z.ZodISODateTime;
    timeSource: z.ZodEnum<{
      observed: "observed";
      producer: "producer";
    }>;
    resourceRevision: z.ZodNumber;
    requirementRevision: z.ZodNullable<z.ZodNumber>;
    planRevision: z.ZodNullable<z.ZodNumber>;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
    attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
  }, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"PipelineChanged">;
    payload: z.ZodObject<{
      pipelineId: z.ZodString;
      toolOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      state: z.ZodEnum<{
        FAILED: "FAILED";
        CANCELLED: "CANCELLED";
        OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN";
        STOPPING: "STOPPING";
        SUCCEEDED: "SUCCEEDED";
        QUEUED: "QUEUED";
        RUNNING: "RUNNING";
      }>;
    }, z.core.$strict>;
    schemaVersion: z.ZodLiteral<1>;
    eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    seq: z.ZodNumber;
    occurredAt: z.ZodISODateTime;
    observedAt: z.ZodISODateTime;
    timeSource: z.ZodEnum<{
      observed: "observed";
      producer: "producer";
    }>;
    resourceRevision: z.ZodNumber;
    requirementRevision: z.ZodNullable<z.ZodNumber>;
    planRevision: z.ZodNullable<z.ZodNumber>;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
    attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
  }, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"CandidateReviewRecorded">;
    payload: z.ZodObject<{
      candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
      resultId: z.ZodString;
    }, z.core.$strict>;
    schemaVersion: z.ZodLiteral<1>;
    eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    seq: z.ZodNumber;
    occurredAt: z.ZodISODateTime;
    observedAt: z.ZodISODateTime;
    timeSource: z.ZodEnum<{
      observed: "observed";
      producer: "producer";
    }>;
    resourceRevision: z.ZodNumber;
    requirementRevision: z.ZodNullable<z.ZodNumber>;
    planRevision: z.ZodNullable<z.ZodNumber>;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
    attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
  }, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"CandidateRejected">;
    payload: z.ZodObject<{
      candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
      rejectionId: z.ZodString;
      resultId: z.ZodString;
      state: z.ZodEnum<{
        OPEN: "OPEN";
        WITHDRAWN: "WITHDRAWN";
      }>;
    }, z.core.$strict>;
    schemaVersion: z.ZodLiteral<1>;
    eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    seq: z.ZodNumber;
    occurredAt: z.ZodISODateTime;
    observedAt: z.ZodISODateTime;
    timeSource: z.ZodEnum<{
      observed: "observed";
      producer: "producer";
    }>;
    resourceRevision: z.ZodNumber;
    requirementRevision: z.ZodNullable<z.ZodNumber>;
    planRevision: z.ZodNullable<z.ZodNumber>;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
    attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
  }, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"DatasetStateChanged">;
    payload: z.ZodObject<{
      datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
      state: z.ZodEnum<{
        PREPARING: "PREPARING";
        MISSING: "MISSING";
        READY: "READY";
        WRITE_FROZEN: "WRITE_FROZEN";
        RETIRED: "RETIRED";
      }>;
    }, z.core.$strict>;
    schemaVersion: z.ZodLiteral<1>;
    eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    seq: z.ZodNumber;
    occurredAt: z.ZodISODateTime;
    observedAt: z.ZodISODateTime;
    timeSource: z.ZodEnum<{
      observed: "observed";
      producer: "producer";
    }>;
    resourceRevision: z.ZodNumber;
    requirementRevision: z.ZodNullable<z.ZodNumber>;
    planRevision: z.ZodNullable<z.ZodNumber>;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
    attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
  }, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"PreviewOperationChanged">;
    payload: z.ZodObject<{
      previewId: z.core.$ZodBranded<z.ZodString, "preview", "out">;
      state: z.ZodEnum<{
        STOPPING: "STOPPING";
        STARTING: "STARTING";
        READY: "READY";
        UNKNOWN: "UNKNOWN";
        STOPPED: "STOPPED";
        EXPIRED: "EXPIRED";
      }>;
    }, z.core.$strict>;
    schemaVersion: z.ZodLiteral<1>;
    eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    seq: z.ZodNumber;
    occurredAt: z.ZodISODateTime;
    observedAt: z.ZodISODateTime;
    timeSource: z.ZodEnum<{
      observed: "observed";
      producer: "producer";
    }>;
    resourceRevision: z.ZodNumber;
    requirementRevision: z.ZodNullable<z.ZodNumber>;
    planRevision: z.ZodNullable<z.ZodNumber>;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
    attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
  }, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"AcceptancePreparationChanged">;
    payload: z.ZodObject<{
      preparationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      state: z.ZodEnum<{
        FAILED: "FAILED";
        PREPARED: "PREPARED";
        SENT: "SENT";
        UNKNOWN: "UNKNOWN";
      }>;
    }, z.core.$strict>;
    schemaVersion: z.ZodLiteral<1>;
    eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    seq: z.ZodNumber;
    occurredAt: z.ZodISODateTime;
    observedAt: z.ZodISODateTime;
    timeSource: z.ZodEnum<{
      observed: "observed";
      producer: "producer";
    }>;
    resourceRevision: z.ZodNumber;
    requirementRevision: z.ZodNullable<z.ZodNumber>;
    planRevision: z.ZodNullable<z.ZodNumber>;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
    attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
  }, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"AcceptanceReadinessObserved">;
    payload: z.ZodObject<{
      preparationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      sequence: z.ZodNumber;
      state: z.ZodEnum<{
        READY: "READY";
        UNKNOWN: "UNKNOWN";
      }>;
    }, z.core.$strict>;
    schemaVersion: z.ZodLiteral<1>;
    eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    seq: z.ZodNumber;
    occurredAt: z.ZodISODateTime;
    observedAt: z.ZodISODateTime;
    timeSource: z.ZodEnum<{
      observed: "observed";
      producer: "producer";
    }>;
    resourceRevision: z.ZodNumber;
    requirementRevision: z.ZodNullable<z.ZodNumber>;
    planRevision: z.ZodNullable<z.ZodNumber>;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
    attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
  }, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"DatasetWriteGateClosed">;
    payload: z.ZodObject<{
      datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
      preparationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      fence: z.ZodNumber;
    }, z.core.$strict>;
    schemaVersion: z.ZodLiteral<1>;
    eventId: z.core.$ZodBranded<z.ZodString, "evt", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    seq: z.ZodNumber;
    occurredAt: z.ZodISODateTime;
    observedAt: z.ZodISODateTime;
    timeSource: z.ZodEnum<{
      observed: "observed";
      producer: "producer";
    }>;
    resourceRevision: z.ZodNumber;
    requirementRevision: z.ZodNullable<z.ZodNumber>;
    planRevision: z.ZodNullable<z.ZodNumber>;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
    attemptId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "attempt", "out">>;
  }, z.core.$strict>], "type">;
  EphemeralTokenDelta: z.ZodObject<{
    kind: z.ZodLiteral<"token-delta">;
    streamId: z.ZodString;
    text: z.ZodString;
  }, z.core.$strict>;
  ExecutionPermit: z.ZodDiscriminatedUnion<[z.ZodObject<{
    ownerKind: z.ZodLiteral<"workflowAttempt">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    runEpoch: z.ZodNumber;
    workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
    workEpoch: z.ZodNumber;
    attemptId: z.core.$ZodBranded<z.ZodString, "attempt", "out">;
    resources: z.ZodArray<z.ZodObject<{
      resourceId: z.ZodString;
      access: z.ZodEnum<{
        read: "read";
        write: "write";
      }>;
      kind: z.ZodEnum<{
        dataset: "dataset";
        snapshot: "snapshot";
        workspace: "workspace";
        projectRepository: "projectRepository";
      }>;
    }, z.core.$strict>>;
    schemaVersion: z.ZodLiteral<"devmesh.permit.v1">;
    grantId: z.core.$ZodBranded<z.ZodString, "grant", "out">;
    activationId: z.core.$ZodBranded<z.ZodString, "activation", "out">;
    notBefore: z.ZodISODateTime;
    expiresAt: z.ZodISODateTime;
  }, z.core.$strict>, z.ZodObject<{
    ownerKind: z.ZodLiteral<"invocationAttempt">;
    invocationId: z.core.$ZodBranded<z.ZodString, "invocation", "out">;
    invocationEpoch: z.ZodNumber;
    invocationAttemptId: z.core.$ZodBranded<z.ZodString, "iattempt", "out">;
    resources: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
      kind: z.ZodLiteral<"snapshot">;
      resourceId: z.ZodString;
      access: z.ZodLiteral<"read">;
    }, z.core.$strict>, z.ZodObject<{
      resourceId: z.ZodString;
      access: z.ZodEnum<{
        read: "read";
        write: "write";
      }>;
      kind: z.ZodLiteral<"workspace">;
    }, z.core.$strict>], "kind">>;
    schemaVersion: z.ZodLiteral<"devmesh.permit.v1">;
    grantId: z.core.$ZodBranded<z.ZodString, "grant", "out">;
    activationId: z.core.$ZodBranded<z.ZodString, "activation", "out">;
    notBefore: z.ZodISODateTime;
    expiresAt: z.ZodISODateTime;
  }, z.core.$strict>], "ownerKind">;
  ExecutionOwner: z.ZodDiscriminatedUnion<[z.ZodObject<{
    ownerKind: z.ZodLiteral<"workflowAttempt">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    runEpoch: z.ZodNumber;
    workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
    workEpoch: z.ZodNumber;
    attemptId: z.core.$ZodBranded<z.ZodString, "attempt", "out">;
  }, z.core.$strict>, z.ZodObject<{
    ownerKind: z.ZodLiteral<"invocationAttempt">;
    invocationId: z.core.$ZodBranded<z.ZodString, "invocation", "out">;
    invocationEpoch: z.ZodNumber;
    invocationAttemptId: z.core.$ZodBranded<z.ZodString, "iattempt", "out">;
  }, z.core.$strict>], "ownerKind">;
  RoleOutput: z.ZodDiscriminatedUnion<[z.ZodObject<{
    schemaVersion: z.ZodLiteral<"devmesh.requirements.v1">;
    role: z.ZodLiteral<"product">;
    requirements: z.ZodArray<z.ZodObject<{
      id: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
      statement: z.ZodString;
      sourceRefs: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
        sha256: z.ZodString;
        kind: z.ZodLiteral<"artifact">;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"message">;
        messageId: z.core.$ZodBranded<z.ZodString, "message", "out">;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"requirement">;
        requirementId: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
        requirementRevision: z.ZodNumber;
      }, z.core.$strict>], "kind">>;
      acceptance: z.ZodArray<z.ZodString>;
    }, z.core.$strict>>;
    assumptions: z.ZodArray<z.ZodString>;
    questions: z.ZodArray<z.ZodObject<{
      id: z.core.$ZodBranded<z.ZodString, "question", "out">;
      required: z.ZodBoolean;
      reason: z.ZodString;
      blockingScope: z.ZodArray<z.core.$ZodBranded<z.ZodString, "work", "out">>;
      defaultOption: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
  }, z.core.$strict>, z.ZodObject<{
    schemaVersion: z.ZodLiteral<"devmesh.architecture.v1">;
    role: z.ZodLiteral<"architect">;
    interfaces: z.ZodArray<z.ZodObject<{
      name: z.ZodString;
      specificationRef: z.ZodObject<{
        artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
        sha256: z.ZodString;
      }, z.core.$strict>;
    }, z.core.$strict>>;
    planDraft: z.ZodObject<{
      requirementRevision: z.ZodNumber;
      works: z.ZodArray<z.ZodObject<{
        workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
        workRevision: z.ZodNumber;
        role: z.ZodEnum<{
          product: "product";
          architect: "architect";
          developer: "developer";
          tester: "tester";
        }>;
        goal: z.ZodString;
        inputRefs: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
          artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
          sha256: z.ZodString;
          kind: z.ZodLiteral<"artifact">;
        }, z.core.$strict>, z.ZodObject<{
          kind: z.ZodLiteral<"output">;
          workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
          outputSlot: z.ZodString;
        }, z.core.$strict>], "kind">>;
        outputSpec: z.ZodArray<z.ZodObject<{
          slot: z.ZodString;
          schemaId: z.ZodString;
        }, z.core.$strict>>;
        completionChecks: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
          kind: z.ZodLiteral<"artifact-exists">;
          outputSlot: z.ZodString;
        }, z.core.$strict>, z.ZodObject<{
          kind: z.ZodLiteral<"schema-valid">;
          outputSlot: z.ZodString;
          schemaId: z.ZodString;
        }, z.core.$strict>, z.ZodObject<{
          kind: z.ZodLiteral<"commit-resolved">;
          outputSlot: z.ZodString;
        }, z.core.$strict>, z.ZodObject<{
          kind: z.ZodLiteral<"command-exit-zero">;
          checkId: z.core.$ZodBranded<z.ZodString, "check", "out">;
        }, z.core.$strict>, z.ZodObject<{
          kind: z.ZodLiteral<"required-tests-pass">;
          checkId: z.core.$ZodBranded<z.ZodString, "check", "out">;
        }, z.core.$strict>, z.ZodObject<{
          kind: z.ZodLiteral<"coverage-threshold">;
          lines: z.ZodNumber;
          branches: z.ZodNumber;
        }, z.core.$strict>, z.ZodObject<{
          kind: z.ZodLiteral<"human-decision">;
          checkId: z.core.$ZodBranded<z.ZodString, "check", "out">;
        }, z.core.$strict>], "kind">>;
        dependencies: z.ZodArray<z.ZodObject<{
          workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
          requiredOutcome: z.ZodEnum<{
            success: "success";
            "completed-with-findings": "completed-with-findings";
          }>;
        }, z.core.$strict>>;
        writeScope: z.ZodArray<z.ZodString>;
        estimatedResources: z.ZodObject<{
          cpu: z.ZodNumber;
          memoryMiB: z.ZodNumber;
          timeoutMs: z.ZodNumber;
        }, z.core.$strict>;
        requirementIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "requirement", "out">>;
      }, z.core.$strict>>;
    }, z.core.$strict>;
    risks: z.ZodArray<z.ZodString>;
    capabilityFit: z.ZodObject<{
      supported: z.ZodBoolean;
      gaps: z.ZodArray<z.ZodString>;
    }, z.core.$strict>;
  }, z.core.$strict>, z.ZodObject<{
    schemaVersion: z.ZodLiteral<"devmesh.development-result.v1">;
    role: z.ZodLiteral<"developer">;
    baseCommit: z.ZodString;
    resultCommit: z.ZodString;
    changedFiles: z.ZodArray<z.ZodString>;
    checkRefs: z.ZodArray<z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
    }, z.core.$strict>>;
    unverified: z.ZodArray<z.ZodString>;
    handoffProposal: z.ZodNullable<z.ZodObject<{
      targetRole: z.ZodEnum<{
        product: "product";
        architect: "architect";
        developer: "developer";
        tester: "tester";
      }>;
      goal: z.ZodString;
      artifactRefs: z.ZodArray<z.ZodObject<{
        artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
        sha256: z.ZodString;
      }, z.core.$strict>>;
      reason: z.ZodString;
    }, z.core.$strict>>;
  }, z.core.$strict>, z.ZodObject<{
    schemaVersion: z.ZodLiteral<"devmesh.test-result.v1">;
    role: z.ZodLiteral<"tester">;
    targetCommit: z.ZodString;
    caseResults: z.ZodArray<z.ZodObject<{
      checkId: z.core.$ZodBranded<z.ZodString, "check", "out">;
      requirementIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "requirement", "out">>;
      status: z.ZodEnum<{
        FAILED: "FAILED";
        PASSED: "PASSED";
        SKIPPED: "SKIPPED";
        MISSING: "MISSING";
      }>;
      reportRef: z.ZodObject<{
        artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
        sha256: z.ZodString;
        targetCommit: z.ZodString;
      }, z.core.$strict>;
    }, z.core.$strict>>;
    coverageRef: z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
      targetCommit: z.ZodString;
    }, z.core.$strict>;
    defects: z.ZodArray<z.ZodObject<{
      id: z.ZodString;
      severity: z.ZodEnum<{
        LOW: "LOW";
        MEDIUM: "MEDIUM";
        HIGH: "HIGH";
        CRITICAL: "CRITICAL";
      }>;
      description: z.ZodString;
      evidenceRefs: z.ZodArray<z.ZodObject<{
        artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
        sha256: z.ZodString;
      }, z.core.$strict>>;
    }, z.core.$strict>>;
    buildRef: z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
      targetCommit: z.ZodString;
    }, z.core.$strict>;
    previewRef: z.ZodOptional<z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
      targetCommit: z.ZodString;
    }, z.core.$strict>>;
  }, z.core.$strict>], "role">;
  ProductOutput: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"devmesh.requirements.v1">;
    role: z.ZodLiteral<"product">;
    requirements: z.ZodArray<z.ZodObject<{
      id: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
      statement: z.ZodString;
      sourceRefs: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
        sha256: z.ZodString;
        kind: z.ZodLiteral<"artifact">;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"message">;
        messageId: z.core.$ZodBranded<z.ZodString, "message", "out">;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"requirement">;
        requirementId: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
        requirementRevision: z.ZodNumber;
      }, z.core.$strict>], "kind">>;
      acceptance: z.ZodArray<z.ZodString>;
    }, z.core.$strict>>;
    assumptions: z.ZodArray<z.ZodString>;
    questions: z.ZodArray<z.ZodObject<{
      id: z.core.$ZodBranded<z.ZodString, "question", "out">;
      required: z.ZodBoolean;
      reason: z.ZodString;
      blockingScope: z.ZodArray<z.core.$ZodBranded<z.ZodString, "work", "out">>;
      defaultOption: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
  }, z.core.$strict>;
  ArchitectOutput: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"devmesh.architecture.v1">;
    role: z.ZodLiteral<"architect">;
    interfaces: z.ZodArray<z.ZodObject<{
      name: z.ZodString;
      specificationRef: z.ZodObject<{
        artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
        sha256: z.ZodString;
      }, z.core.$strict>;
    }, z.core.$strict>>;
    planDraft: z.ZodObject<{
      requirementRevision: z.ZodNumber;
      works: z.ZodArray<z.ZodObject<{
        workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
        workRevision: z.ZodNumber;
        role: z.ZodEnum<{
          product: "product";
          architect: "architect";
          developer: "developer";
          tester: "tester";
        }>;
        goal: z.ZodString;
        inputRefs: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
          artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
          sha256: z.ZodString;
          kind: z.ZodLiteral<"artifact">;
        }, z.core.$strict>, z.ZodObject<{
          kind: z.ZodLiteral<"output">;
          workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
          outputSlot: z.ZodString;
        }, z.core.$strict>], "kind">>;
        outputSpec: z.ZodArray<z.ZodObject<{
          slot: z.ZodString;
          schemaId: z.ZodString;
        }, z.core.$strict>>;
        completionChecks: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
          kind: z.ZodLiteral<"artifact-exists">;
          outputSlot: z.ZodString;
        }, z.core.$strict>, z.ZodObject<{
          kind: z.ZodLiteral<"schema-valid">;
          outputSlot: z.ZodString;
          schemaId: z.ZodString;
        }, z.core.$strict>, z.ZodObject<{
          kind: z.ZodLiteral<"commit-resolved">;
          outputSlot: z.ZodString;
        }, z.core.$strict>, z.ZodObject<{
          kind: z.ZodLiteral<"command-exit-zero">;
          checkId: z.core.$ZodBranded<z.ZodString, "check", "out">;
        }, z.core.$strict>, z.ZodObject<{
          kind: z.ZodLiteral<"required-tests-pass">;
          checkId: z.core.$ZodBranded<z.ZodString, "check", "out">;
        }, z.core.$strict>, z.ZodObject<{
          kind: z.ZodLiteral<"coverage-threshold">;
          lines: z.ZodNumber;
          branches: z.ZodNumber;
        }, z.core.$strict>, z.ZodObject<{
          kind: z.ZodLiteral<"human-decision">;
          checkId: z.core.$ZodBranded<z.ZodString, "check", "out">;
        }, z.core.$strict>], "kind">>;
        dependencies: z.ZodArray<z.ZodObject<{
          workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
          requiredOutcome: z.ZodEnum<{
            success: "success";
            "completed-with-findings": "completed-with-findings";
          }>;
        }, z.core.$strict>>;
        writeScope: z.ZodArray<z.ZodString>;
        estimatedResources: z.ZodObject<{
          cpu: z.ZodNumber;
          memoryMiB: z.ZodNumber;
          timeoutMs: z.ZodNumber;
        }, z.core.$strict>;
        requirementIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "requirement", "out">>;
      }, z.core.$strict>>;
    }, z.core.$strict>;
    risks: z.ZodArray<z.ZodString>;
    capabilityFit: z.ZodObject<{
      supported: z.ZodBoolean;
      gaps: z.ZodArray<z.ZodString>;
    }, z.core.$strict>;
  }, z.core.$strict>;
  DeveloperOutput: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"devmesh.development-result.v1">;
    role: z.ZodLiteral<"developer">;
    baseCommit: z.ZodString;
    resultCommit: z.ZodString;
    changedFiles: z.ZodArray<z.ZodString>;
    checkRefs: z.ZodArray<z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
    }, z.core.$strict>>;
    unverified: z.ZodArray<z.ZodString>;
    handoffProposal: z.ZodNullable<z.ZodObject<{
      targetRole: z.ZodEnum<{
        product: "product";
        architect: "architect";
        developer: "developer";
        tester: "tester";
      }>;
      goal: z.ZodString;
      artifactRefs: z.ZodArray<z.ZodObject<{
        artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
        sha256: z.ZodString;
      }, z.core.$strict>>;
      reason: z.ZodString;
    }, z.core.$strict>>;
  }, z.core.$strict>;
  TesterOutput: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"devmesh.test-result.v1">;
    role: z.ZodLiteral<"tester">;
    targetCommit: z.ZodString;
    caseResults: z.ZodArray<z.ZodObject<{
      checkId: z.core.$ZodBranded<z.ZodString, "check", "out">;
      requirementIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "requirement", "out">>;
      status: z.ZodEnum<{
        FAILED: "FAILED";
        PASSED: "PASSED";
        SKIPPED: "SKIPPED";
        MISSING: "MISSING";
      }>;
      reportRef: z.ZodObject<{
        artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
        sha256: z.ZodString;
        targetCommit: z.ZodString;
      }, z.core.$strict>;
    }, z.core.$strict>>;
    coverageRef: z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
      targetCommit: z.ZodString;
    }, z.core.$strict>;
    defects: z.ZodArray<z.ZodObject<{
      id: z.ZodString;
      severity: z.ZodEnum<{
        LOW: "LOW";
        MEDIUM: "MEDIUM";
        HIGH: "HIGH";
        CRITICAL: "CRITICAL";
      }>;
      description: z.ZodString;
      evidenceRefs: z.ZodArray<z.ZodObject<{
        artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
        sha256: z.ZodString;
      }, z.core.$strict>>;
    }, z.core.$strict>>;
    buildRef: z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
      targetCommit: z.ZodString;
    }, z.core.$strict>;
    previewRef: z.ZodOptional<z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
      targetCommit: z.ZodString;
    }, z.core.$strict>>;
  }, z.core.$strict>;
  WorkRevision: z.ZodObject<{
    workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
    workRevision: z.ZodNumber;
    role: z.ZodEnum<{
      product: "product";
      architect: "architect";
      developer: "developer";
      tester: "tester";
    }>;
    goal: z.ZodString;
    inputRefs: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
      kind: z.ZodLiteral<"artifact">;
    }, z.core.$strict>, z.ZodObject<{
      kind: z.ZodLiteral<"output">;
      workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
      outputSlot: z.ZodString;
    }, z.core.$strict>], "kind">>;
    outputSpec: z.ZodArray<z.ZodObject<{
      slot: z.ZodString;
      schemaId: z.ZodString;
    }, z.core.$strict>>;
    completionChecks: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
      kind: z.ZodLiteral<"artifact-exists">;
      outputSlot: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
      kind: z.ZodLiteral<"schema-valid">;
      outputSlot: z.ZodString;
      schemaId: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
      kind: z.ZodLiteral<"commit-resolved">;
      outputSlot: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
      kind: z.ZodLiteral<"command-exit-zero">;
      checkId: z.core.$ZodBranded<z.ZodString, "check", "out">;
    }, z.core.$strict>, z.ZodObject<{
      kind: z.ZodLiteral<"required-tests-pass">;
      checkId: z.core.$ZodBranded<z.ZodString, "check", "out">;
    }, z.core.$strict>, z.ZodObject<{
      kind: z.ZodLiteral<"coverage-threshold">;
      lines: z.ZodNumber;
      branches: z.ZodNumber;
    }, z.core.$strict>, z.ZodObject<{
      kind: z.ZodLiteral<"human-decision">;
      checkId: z.core.$ZodBranded<z.ZodString, "check", "out">;
    }, z.core.$strict>], "kind">>;
    dependencies: z.ZodArray<z.ZodObject<{
      workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
      requiredOutcome: z.ZodEnum<{
        success: "success";
        "completed-with-findings": "completed-with-findings";
      }>;
    }, z.core.$strict>>;
    writeScope: z.ZodArray<z.ZodString>;
    estimatedResources: z.ZodObject<{
      cpu: z.ZodNumber;
      memoryMiB: z.ZodNumber;
      timeoutMs: z.ZodNumber;
    }, z.core.$strict>;
    requirementIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "requirement", "out">>;
  }, z.core.$strict>;
  PlanDraft: z.ZodObject<{
    requirementRevision: z.ZodNumber;
    works: z.ZodArray<z.ZodObject<{
      workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
      workRevision: z.ZodNumber;
      role: z.ZodEnum<{
        product: "product";
        architect: "architect";
        developer: "developer";
        tester: "tester";
      }>;
      goal: z.ZodString;
      inputRefs: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
        sha256: z.ZodString;
        kind: z.ZodLiteral<"artifact">;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"output">;
        workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
        outputSlot: z.ZodString;
      }, z.core.$strict>], "kind">>;
      outputSpec: z.ZodArray<z.ZodObject<{
        slot: z.ZodString;
        schemaId: z.ZodString;
      }, z.core.$strict>>;
      completionChecks: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"artifact-exists">;
        outputSlot: z.ZodString;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"schema-valid">;
        outputSlot: z.ZodString;
        schemaId: z.ZodString;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"commit-resolved">;
        outputSlot: z.ZodString;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"command-exit-zero">;
        checkId: z.core.$ZodBranded<z.ZodString, "check", "out">;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"required-tests-pass">;
        checkId: z.core.$ZodBranded<z.ZodString, "check", "out">;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"coverage-threshold">;
        lines: z.ZodNumber;
        branches: z.ZodNumber;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"human-decision">;
        checkId: z.core.$ZodBranded<z.ZodString, "check", "out">;
      }, z.core.$strict>], "kind">>;
      dependencies: z.ZodArray<z.ZodObject<{
        workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
        requiredOutcome: z.ZodEnum<{
          success: "success";
          "completed-with-findings": "completed-with-findings";
        }>;
      }, z.core.$strict>>;
      writeScope: z.ZodArray<z.ZodString>;
      estimatedResources: z.ZodObject<{
        cpu: z.ZodNumber;
        memoryMiB: z.ZodNumber;
        timeoutMs: z.ZodNumber;
      }, z.core.$strict>;
      requirementIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "requirement", "out">>;
    }, z.core.$strict>>;
  }, z.core.$strict>;
  WorkDelegation: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"devmesh.work.v1">;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
    workRevision: z.ZodNumber;
    attemptId: z.core.$ZodBranded<z.ZodString, "attempt", "out">;
    endpointId: z.ZodString;
    endpointRevision: z.ZodNumber;
    grantId: z.core.$ZodBranded<z.ZodString, "grant", "out">;
    activationId: z.core.$ZodBranded<z.ZodString, "activation", "out">;
    runEpoch: z.ZodNumber;
    workEpoch: z.ZodNumber;
    requirementRevision: z.ZodNumber;
    planRevision: z.ZodNumber;
    inputManifestId: z.core.$ZodBranded<z.ZodString, "manifest", "out">;
    roleSnapshotId: z.core.$ZodBranded<z.ZodString, "role", "out">;
    originRole: z.ZodEnum<{
      product: "product";
      architect: "architect";
      developer: "developer";
      tester: "tester";
    }>;
    targetRole: z.ZodEnum<{
      product: "product";
      architect: "architect";
      developer: "developer";
      tester: "tester";
    }>;
    requestedOutputSchema: z.ZodString;
  }, z.core.$strict>;
  InvocationDelegation: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"devmesh.invocation.v1">;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    invocationId: z.core.$ZodBranded<z.ZodString, "invocation", "out">;
    invocationAttemptId: z.core.$ZodBranded<z.ZodString, "iattempt", "out">;
    invocationEpoch: z.ZodNumber;
    activationId: z.core.$ZodBranded<z.ZodString, "activation", "out">;
    grantId: z.core.$ZodBranded<z.ZodString, "grant", "out">;
    endpointId: z.ZodString;
    endpointRevision: z.ZodNumber;
    inputManifestRef: z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
    }, z.core.$strict>;
    definitionSnapshotRef: z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
    }, z.core.$strict>;
  }, z.core.$strict>;
  InputManifest: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"devmesh.input-manifest.v1">;
    requirements: z.ZodArray<z.ZodObject<{
      requirementId: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
      sha256: z.ZodString;
    }, z.core.$strict>>;
    interfaces: z.ZodArray<z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
    }, z.core.$strict>>;
    artifacts: z.ZodArray<z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
    }, z.core.$strict>>;
    codeCommit: z.ZodNullable<z.ZodString>;
    templateVersion: z.ZodString;
    checkConfigHash: z.ZodString;
    decisionIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "decision", "out">>;
  }, z.core.$strict>;
  RunState: z.ZodObject<{
    phase: z.ZodEnum<{
      PREPARING: "PREPARING";
      UNDERSTANDING: "UNDERSTANDING";
      PLANNING: "PLANNING";
      EXECUTING: "EXECUTING";
      VERIFYING: "VERIFYING";
      REVIEW: "REVIEW";
    }>;
    controlGate: z.ZodEnum<{
      OPEN: "OPEN";
      PAUSING: "PAUSING";
      PAUSED: "PAUSED";
      CANCELLING: "CANCELLING";
    }>;
    terminalOutcome: z.ZodNullable<z.ZodEnum<{
      COMPLETED: "COMPLETED";
      FAILED: "FAILED";
      CANCELLED: "CANCELLED";
    }>>;
  }, z.core.$strict>;
  AttemptState: z.ZodEnum<{
    VERIFYING: "VERIFYING";
    FAILED: "FAILED";
    CANCELLED: "CANCELLED";
    RESERVED: "RESERVED";
    SUBMITTED: "SUBMITTED";
    WORKING: "WORKING";
    INPUT_REQUIRED: "INPUT_REQUIRED";
    OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN";
    STOPPING: "STOPPING";
    SUCCEEDED: "SUCCEEDED";
    INTERRUPTED: "INTERRUPTED";
  }>;
  InvocationState: z.ZodEnum<{
    VERIFYING: "VERIFYING";
    FAILED: "FAILED";
    CANCELLED: "CANCELLED";
    INPUT_REQUIRED: "INPUT_REQUIRED";
    OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN";
    STOPPING: "STOPPING";
    SUCCEEDED: "SUCCEEDED";
    QUEUED: "QUEUED";
    RUNNING: "RUNNING";
  }>;
  JobState: z.ZodEnum<{
    OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN";
    STOPPING: "STOPPING";
    QUEUED: "QUEUED";
    RUNNING: "RUNNING";
    STARTING: "STARTING";
    EXITED: "EXITED";
  }>;
  OperationStatus: z.ZodEnum<{
    FAILED: "FAILED";
    OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN";
    SUCCEEDED: "SUCCEEDED";
    RUNNING: "RUNNING";
    ACCEPTED: "ACCEPTED";
    WAITING: "WAITING";
  }>;
  A2ATaskState: z.ZodEnum<{
    submitted: "submitted";
    working: "working";
    "input-required": "input-required";
    "auth-required": "auth-required";
    completed: "completed";
    failed: "failed";
    canceled: "canceled";
    rejected: "rejected";
  }>;
  OperationReceipt: z.ZodObject<{
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    status: z.ZodEnum<{
      FAILED: "FAILED";
      OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN";
      SUCCEEDED: "SUCCEEDED";
      RUNNING: "RUNNING";
      ACCEPTED: "ACCEPTED";
      WAITING: "WAITING";
    }>;
    resource: z.ZodObject<{
      projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
      runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
      revision: z.ZodNumber;
    }, z.core.$strict>;
    links: z.ZodObject<{
      operation: z.ZodString;
    }, z.core.$strict>;
    result: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodJSONSchema>>;
  }, z.core.$strict>;
  ErrorEnvelope: z.ZodObject<{
    error: z.ZodObject<{
      code: z.ZodEnum<{
        OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN";
        SCHEMA_INVALID: "SCHEMA_INVALID";
        PRECONDITION_REQUIRED: "PRECONDITION_REQUIRED";
        PRECONDITION_FAILED: "PRECONDITION_FAILED";
        BASIS_SUPERSEDED: "BASIS_SUPERSEDED";
        PLAN_SUPERSEDED: "PLAN_SUPERSEDED";
        PERMIT_REVOKED: "PERMIT_REVOKED";
        PERMIT_EXPIRED: "PERMIT_EXPIRED";
        PERMIT_SCOPE_DENIED: "PERMIT_SCOPE_DENIED";
        IDEMPOTENCY_KEY_REUSED: "IDEMPOTENCY_KEY_REUSED";
        AUTHENTICATION_REQUIRED: "AUTHENTICATION_REQUIRED";
        FORBIDDEN: "FORBIDDEN";
        RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND";
        ACTIVE_RUN_EXISTS: "ACTIVE_RUN_EXISTS";
        LIMIT_EXCEEDED: "LIMIT_EXCEEDED";
        SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE";
        PLAN_INVALID: "PLAN_INVALID";
        PLAN_ALREADY_CONFIRMED: "PLAN_ALREADY_CONFIRMED";
        RUN_TERMINAL: "RUN_TERMINAL";
        ADMISSION_CLOSED: "ADMISSION_CLOSED";
        PREVIEW_ACCESS_NOT_CONFIGURED: "PREVIEW_ACCESS_NOT_CONFIGURED";
        PREVIEW_UNAVAILABLE: "PREVIEW_UNAVAILABLE";
        RELEASE_ACCESS_NOT_CONFIGURED: "RELEASE_ACCESS_NOT_CONFIGURED";
        RELEASE_UNAVAILABLE: "RELEASE_UNAVAILABLE";
        RANGE_NOT_SUPPORTED: "RANGE_NOT_SUPPORTED";
        EXPORT_UNAVAILABLE: "EXPORT_UNAVAILABLE";
        ACCEPTANCE_UNAVAILABLE: "ACCEPTANCE_UNAVAILABLE";
        REVIEW_UNAVAILABLE: "REVIEW_UNAVAILABLE";
        CONTENT_CORRUPT: "CONTENT_CORRUPT";
        CONTENT_TOO_LARGE: "CONTENT_TOO_LARGE";
        IDENTITY_NOT_CONFIGURED: "IDENTITY_NOT_CONFIGURED";
        REQUEST_ORIGIN_INVALID: "REQUEST_ORIGIN_INVALID";
        REQUEST_HEADERS_INVALID: "REQUEST_HEADERS_INVALID";
        REQUEST_HOST_INVALID: "REQUEST_HOST_INVALID";
        COOKIE_AUTH_NOT_CONFIGURED: "COOKIE_AUTH_NOT_CONFIGURED";
        SERVICE_STOPPING: "SERVICE_STOPPING";
        CONTENT_TYPE_INVALID: "CONTENT_TYPE_INVALID";
        REQUEST_TOO_LARGE: "REQUEST_TOO_LARGE";
        JSON_INVALID: "JSON_INVALID";
        UPLOAD_CAPACITY: "UPLOAD_CAPACITY";
        UPLOAD_IN_PROGRESS: "UPLOAD_IN_PROGRESS";
        UPLOAD_FAILED: "UPLOAD_FAILED";
        UPLOAD_TIMEOUT: "UPLOAD_TIMEOUT";
        UPLOAD_INTERRUPTED: "UPLOAD_INTERRUPTED";
        UPLOAD_TOO_LARGE: "UPLOAD_TOO_LARGE";
        UPLOAD_INVALID: "UPLOAD_INVALID";
        UPLOAD_RESULT_INVALID: "UPLOAD_RESULT_INVALID";
        MULTIPART_INVALID: "MULTIPART_INVALID";
        ATTACHMENT_TYPE_INVALID: "ATTACHMENT_TYPE_INVALID";
        ATTACHMENT_ENCODING_INVALID: "ATTACHMENT_ENCODING_INVALID";
        ATTACHMENT_EMPTY: "ATTACHMENT_EMPTY";
        ATTACHMENT_BOUND: "ATTACHMENT_BOUND";
        UPLOAD_CONTENT_CONFLICT: "UPLOAD_CONTENT_CONFLICT";
        UPLOAD_HASH_INVALID: "UPLOAD_HASH_INVALID";
        UPLOAD_CLAIM_INVALID: "UPLOAD_CLAIM_INVALID";
        OPERATION_SCOPE_INVALID: "OPERATION_SCOPE_INVALID";
        ACCEPTED_RELEASE_CHANGED: "ACCEPTED_RELEASE_CHANGED";
        MESSAGE_KEY_REUSED: "MESSAGE_KEY_REUSED";
        RUN_NOT_WRITABLE: "RUN_NOT_WRITABLE";
        EVENT_CURSOR_INVALID: "EVENT_CURSOR_INVALID";
        CONTENT_UNAVAILABLE: "CONTENT_UNAVAILABLE";
        QUESTION_SUPERSEDED: "QUESTION_SUPERSEDED";
        ANSWER_INVALID: "ANSWER_INVALID";
        INTERPRETATION_NOT_FAILED: "INTERPRETATION_NOT_FAILED";
        REQUIRED_QUESTIONS_UNANSWERED: "REQUIRED_QUESTIONS_UNANSWERED";
        INTERPRETATION_PENDING: "INTERPRETATION_PENDING";
      }>;
      message: z.ZodString;
      requestId: z.core.$ZodBranded<z.ZodString, "req", "out">;
      retryable: z.ZodBoolean;
      details: z.ZodRecord<z.ZodString, z.ZodJSONSchema>;
    }, z.core.$strict>;
  }, z.core.$strict>;
  StrongETag: z.ZodString;
  ContentBasis: z.ZodObject<{
    revision: z.ZodNumber;
    reviewHash: z.ZodString;
  }, z.core.$strict>;
  InputText: z.ZodString;
  ProjectName: z.ZodString;
  TaskTitle: z.ZodString;
  CreateTask: z.ZodObject<{
    kind: z.ZodEnum<{
      ITERATION: "ITERATION";
      FIX: "FIX";
    }>;
    title: z.ZodString;
    goal: z.ZodObject<{
      text: z.ZodUnion<readonly [z.ZodString, z.ZodLiteral<"">]>;
      attachmentIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "attachment", "out">>;
    }, z.core.$strict>;
    baseAcceptedReleaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
    clientDraftId: z.ZodUUID;
  }, z.core.$strict>;
  UploadMetadata: z.ZodObject<{
    clientAttachmentId: z.ZodUUID;
    name: z.ZodString;
  }, z.core.$strict>;
  Attachment: z.ZodObject<{
    attachmentId: z.core.$ZodBranded<z.ZodString, "attachment", "out">;
    clientAttachmentId: z.ZodUUID;
    name: z.ZodString;
    byteSize: z.ZodNumber;
    state: z.ZodEnum<{
      READY: "READY";
      REMOVED: "REMOVED";
    }>;
    createdAt: z.ZodISODateTime;
  }, z.core.$strict>;
  InputOperation: z.ZodObject<{
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    status: z.ZodEnum<{
      FAILED: "FAILED";
      OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN";
      SUCCEEDED: "SUCCEEDED";
      RUNNING: "RUNNING";
      ACCEPTED: "ACCEPTED";
      WAITING: "WAITING";
    }>;
    result: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodJSONSchema>>;
  }, z.core.$strict>;
  InputOperationLookup: z.ZodObject<{
    principalId: z.ZodString;
    scope: z.ZodString;
    key: z.ZodUUID;
    operation: z.ZodNullable<z.ZodObject<{
      operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      status: z.ZodEnum<{
        FAILED: "FAILED";
        OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN";
        SUCCEEDED: "SUCCEEDED";
        RUNNING: "RUNNING";
        ACCEPTED: "ACCEPTED";
        WAITING: "WAITING";
      }>;
      result: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodJSONSchema>>;
    }, z.core.$strict>>;
  }, z.core.$strict>;
  Workspace: z.ZodObject<{
    project: z.ZodObject<{
      projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
      name: z.ZodString;
      revision: z.ZodNumber;
      acceptedReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
    }, z.core.$strict>;
    run: z.ZodObject<{
      runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
      projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
      taskId: z.core.$ZodBranded<z.ZodString, "task", "out">;
      resourceRevision: z.ZodNumber;
      runEpoch: z.ZodNumber;
      controlRevision: z.ZodNumber;
      phase: z.ZodString;
      controlGate: z.ZodString;
      terminalOutcome: z.ZodNullable<z.ZodString>;
      currentPlanRevision: z.ZodNullable<z.ZodNumber>;
      currentRequirementRevision: z.ZodNullable<z.ZodNumber>;
      eventSeq: z.ZodNumber;
    }, z.core.$strict>;
    mode: z.ZodEnum<{
      current: "current";
      history: "history";
    }>;
    membership: z.ZodEnum<{
      owner: "owner";
      operator: "operator";
      viewer: "viewer";
    }>;
    allowedActions: z.ZodArray<z.ZodEnum<{
      saveMessage: "saveMessage";
      createTask: "createTask";
      answerQuestions: "answerQuestions";
    }>>;
    preparation: z.ZodObject<{
      understandingAvailable: z.ZodBoolean;
      requiredOpenQuestions: z.ZodNumber;
      pending: z.ZodBoolean;
    }, z.core.$strict>;
    eventCursor: z.ZodNumber;
    messages: z.ZodArray<z.ZodObject<{
      messageId: z.core.$ZodBranded<z.ZodString, "message", "out">;
      author: z.ZodString;
      bodyArtifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      clientMessageId: z.ZodString;
      createdAt: z.ZodISODateTime;
      attachmentIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "attachment", "out">>;
      intentHint: z.ZodNullable<z.ZodEnum<{
        change: "change";
        query: "query";
        unsure: "unsure";
      }>>;
      text: z.ZodUnion<readonly [z.ZodString, z.ZodLiteral<"">]>;
    }, z.core.$strict>>;
    nextMessageCursor: z.ZodNullable<z.ZodString>;
    templateBaseline: z.ZodObject<{
      version: z.ZodString;
      baseCommit: z.ZodString;
    }, z.core.$strict>;
  }, z.core.$strict>;
  Understanding: z.ZodObject<{
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    requirementRevision: z.ZodNullable<z.ZodNumber>;
    understanding: z.ZodNullable<z.ZodObject<{
      schemaVersion: z.ZodLiteral<"devmesh.understanding.v1">;
      role: z.ZodLiteral<"product">;
      requirements: z.ZodArray<z.ZodObject<{
        id: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
        statement: z.ZodString;
        sourceRefs: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
          artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
          sha256: z.ZodString;
          kind: z.ZodLiteral<"artifact">;
        }, z.core.$strict>, z.ZodObject<{
          kind: z.ZodLiteral<"message">;
          messageId: z.core.$ZodBranded<z.ZodString, "message", "out">;
        }, z.core.$strict>, z.ZodObject<{
          kind: z.ZodLiteral<"requirement">;
          requirementId: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
          requirementRevision: z.ZodNumber;
        }, z.core.$strict>], "kind">>;
        acceptance: z.ZodArray<z.ZodString>;
      }, z.core.$strict>>;
      assumptions: z.ZodArray<z.ZodString>;
      questions: z.ZodArray<z.ZodObject<{
        id: z.core.$ZodBranded<z.ZodString, "question", "out">;
        required: z.ZodBoolean;
        reason: z.ZodString;
        blockingScope: z.ZodArray<z.core.$ZodBranded<z.ZodString, "work", "out">>;
        defaultOption: z.ZodOptional<z.ZodString>;
        prompt: z.ZodString;
        sourceRefs: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
          artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
          sha256: z.ZodString;
          kind: z.ZodLiteral<"artifact">;
        }, z.core.$strict>, z.ZodObject<{
          kind: z.ZodLiteral<"message">;
          messageId: z.core.$ZodBranded<z.ZodString, "message", "out">;
        }, z.core.$strict>, z.ZodObject<{
          kind: z.ZodLiteral<"requirement">;
          requirementId: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
          requirementRevision: z.ZodNumber;
        }, z.core.$strict>], "kind">>;
        options: z.ZodDefault<z.ZodArray<z.ZodObject<{
          id: z.ZodString;
          label: z.ZodString;
        }, z.core.$strict>>>;
      }, z.core.$strict>>;
      conflicts: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        description: z.ZodString;
        sourceRefs: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
          artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
          sha256: z.ZodString;
          kind: z.ZodLiteral<"artifact">;
        }, z.core.$strict>, z.ZodObject<{
          kind: z.ZodLiteral<"message">;
          messageId: z.core.$ZodBranded<z.ZodString, "message", "out">;
        }, z.core.$strict>, z.ZodObject<{
          kind: z.ZodLiteral<"requirement">;
          requirementId: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
          requirementRevision: z.ZodNumber;
        }, z.core.$strict>], "kind">>;
        questionId: z.core.$ZodBranded<z.ZodString, "question", "out">;
      }, z.core.$strict>>;
    }, z.core.$strict>>;
    questions: z.ZodArray<z.ZodObject<{
      questionId: z.core.$ZodBranded<z.ZodString, "question", "out">;
      questionRevision: z.ZodNumber;
      requirementBasis: z.ZodNumber;
      state: z.ZodEnum<{
        OPEN: "OPEN";
        ANSWERED: "ANSWERED";
        SUPERSEDED: "SUPERSEDED";
      }>;
      content: z.ZodObject<{
        id: z.core.$ZodBranded<z.ZodString, "question", "out">;
        required: z.ZodBoolean;
        reason: z.ZodString;
        blockingScope: z.ZodArray<z.core.$ZodBranded<z.ZodString, "work", "out">>;
        defaultOption: z.ZodOptional<z.ZodString>;
        prompt: z.ZodString;
        sourceRefs: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
          artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
          sha256: z.ZodString;
          kind: z.ZodLiteral<"artifact">;
        }, z.core.$strict>, z.ZodObject<{
          kind: z.ZodLiteral<"message">;
          messageId: z.core.$ZodBranded<z.ZodString, "message", "out">;
        }, z.core.$strict>, z.ZodObject<{
          kind: z.ZodLiteral<"requirement">;
          requirementId: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
          requirementRevision: z.ZodNumber;
        }, z.core.$strict>], "kind">>;
        options: z.ZodDefault<z.ZodArray<z.ZodObject<{
          id: z.ZodString;
          label: z.ZodString;
        }, z.core.$strict>>>;
      }, z.core.$strict>;
      answer: z.ZodNullable<z.ZodObject<{
        answerId: z.ZodString;
        value: z.ZodJSONSchema;
        actor: z.ZodString;
        createdAt: z.ZodISODateTime;
      }, z.core.$strict>>;
    }, z.core.$strict>>;
    jobs: z.ZodArray<z.ZodObject<{
      jobId: z.core.$ZodBranded<z.ZodString, "job", "out">;
      operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      purpose: z.ZodEnum<{
        UNDERSTAND: "UNDERSTAND";
        INTERPRET: "INTERPRET";
        PLAN: "PLAN";
      }>;
      role: z.ZodEnum<{
        product: "product";
        architect: "architect";
      }>;
      state: z.ZodString;
      retryOf: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "job", "out">>;
      errorCode: z.ZodNullable<z.ZodString>;
      resultArtifactId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "artifact", "out">>;
    }, z.core.$strict>>;
    pendingInputCount: z.ZodNumber;
    answerInterventions: z.ZodNumber;
  }, z.core.$strict>;
  UnderstandingOutput: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"devmesh.understanding.v1">;
    role: z.ZodLiteral<"product">;
    requirements: z.ZodArray<z.ZodObject<{
      id: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
      statement: z.ZodString;
      sourceRefs: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
        sha256: z.ZodString;
        kind: z.ZodLiteral<"artifact">;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"message">;
        messageId: z.core.$ZodBranded<z.ZodString, "message", "out">;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"requirement">;
        requirementId: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
        requirementRevision: z.ZodNumber;
      }, z.core.$strict>], "kind">>;
      acceptance: z.ZodArray<z.ZodString>;
    }, z.core.$strict>>;
    assumptions: z.ZodArray<z.ZodString>;
    questions: z.ZodArray<z.ZodObject<{
      id: z.core.$ZodBranded<z.ZodString, "question", "out">;
      required: z.ZodBoolean;
      reason: z.ZodString;
      blockingScope: z.ZodArray<z.core.$ZodBranded<z.ZodString, "work", "out">>;
      defaultOption: z.ZodOptional<z.ZodString>;
      prompt: z.ZodString;
      sourceRefs: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
        sha256: z.ZodString;
        kind: z.ZodLiteral<"artifact">;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"message">;
        messageId: z.core.$ZodBranded<z.ZodString, "message", "out">;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"requirement">;
        requirementId: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
        requirementRevision: z.ZodNumber;
      }, z.core.$strict>], "kind">>;
      options: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
      }, z.core.$strict>>>;
    }, z.core.$strict>>;
    conflicts: z.ZodArray<z.ZodObject<{
      id: z.ZodString;
      description: z.ZodString;
      sourceRefs: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
        sha256: z.ZodString;
        kind: z.ZodLiteral<"artifact">;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"message">;
        messageId: z.core.$ZodBranded<z.ZodString, "message", "out">;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"requirement">;
        requirementId: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
        requirementRevision: z.ZodNumber;
      }, z.core.$strict>], "kind">>;
      questionId: z.core.$ZodBranded<z.ZodString, "question", "out">;
    }, z.core.$strict>>;
  }, z.core.$strict>;
  RetryUnderstanding: z.ZodObject<{
    failedInterpretationOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  }, z.core.$strict>;
  PreparationDelegation: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"devmesh.preparation.v1">;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    jobId: z.core.$ZodBranded<z.ZodString, "job", "out">;
    preparationAttemptId: z.ZodString;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    runEpoch: z.ZodNumber;
    activationId: z.core.$ZodBranded<z.ZodString, "activation", "out">;
    grantId: z.core.$ZodBranded<z.ZodString, "grant", "out">;
    endpointId: z.ZodString;
    endpointRevision: z.ZodNumber;
    role: z.ZodEnum<{
      product: "product";
      architect: "architect";
    }>;
    inputHash: z.ZodString;
    profileHash: z.ZodString;
    basisHash: z.ZodString;
  }, z.core.$strict>;
  PreparationInput: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"devmesh.preparation-input.v1">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    role: z.ZodEnum<{
      product: "product";
      architect: "architect";
    }>;
    basisHash: z.ZodString;
    requirementRevision: z.ZodNullable<z.ZodNumber>;
    baseCommit: z.ZodString;
    sources: z.ZodArray<z.ZodObject<{
      ref: z.ZodDiscriminatedUnion<[z.ZodObject<{
        artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
        sha256: z.ZodString;
        kind: z.ZodLiteral<"artifact">;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"message">;
        messageId: z.core.$ZodBranded<z.ZodString, "message", "out">;
      }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"requirement">;
        requirementId: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
        requirementRevision: z.ZodNumber;
      }, z.core.$strict>], "kind">;
      contentHash: z.ZodString;
      byteSize: z.ZodNumber;
      label: z.ZodString;
    }, z.core.$strict>>;
    answerIds: z.ZodArray<z.ZodString>;
  }, z.core.$strict>;
  PlanReview: z.ZodObject<{
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    resourceRevision: z.ZodNumber;
    planRevision: z.ZodNumber;
    requirementRevision: z.ZodNumber;
    reviewHash: z.ZodString;
    baseCommit: z.ZodString;
    plan: z.ZodObject<{
      requirementRevision: z.ZodNumber;
      works: z.ZodArray<z.ZodObject<{
        workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
        workRevision: z.ZodNumber;
        role: z.ZodEnum<{
          product: "product";
          architect: "architect";
          developer: "developer";
          tester: "tester";
        }>;
        goal: z.ZodString;
        inputRefs: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
          artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
          sha256: z.ZodString;
          kind: z.ZodLiteral<"artifact">;
        }, z.core.$strict>, z.ZodObject<{
          kind: z.ZodLiteral<"output">;
          workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
          outputSlot: z.ZodString;
        }, z.core.$strict>], "kind">>;
        outputSpec: z.ZodArray<z.ZodObject<{
          slot: z.ZodString;
          schemaId: z.ZodString;
        }, z.core.$strict>>;
        completionChecks: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
          kind: z.ZodLiteral<"artifact-exists">;
          outputSlot: z.ZodString;
        }, z.core.$strict>, z.ZodObject<{
          kind: z.ZodLiteral<"schema-valid">;
          outputSlot: z.ZodString;
          schemaId: z.ZodString;
        }, z.core.$strict>, z.ZodObject<{
          kind: z.ZodLiteral<"commit-resolved">;
          outputSlot: z.ZodString;
        }, z.core.$strict>, z.ZodObject<{
          kind: z.ZodLiteral<"command-exit-zero">;
          checkId: z.core.$ZodBranded<z.ZodString, "check", "out">;
        }, z.core.$strict>, z.ZodObject<{
          kind: z.ZodLiteral<"required-tests-pass">;
          checkId: z.core.$ZodBranded<z.ZodString, "check", "out">;
        }, z.core.$strict>, z.ZodObject<{
          kind: z.ZodLiteral<"coverage-threshold">;
          lines: z.ZodNumber;
          branches: z.ZodNumber;
        }, z.core.$strict>, z.ZodObject<{
          kind: z.ZodLiteral<"human-decision">;
          checkId: z.core.$ZodBranded<z.ZodString, "check", "out">;
        }, z.core.$strict>], "kind">>;
        dependencies: z.ZodArray<z.ZodObject<{
          workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
          requiredOutcome: z.ZodEnum<{
            success: "success";
            "completed-with-findings": "completed-with-findings";
          }>;
        }, z.core.$strict>>;
        writeScope: z.ZodArray<z.ZodString>;
        estimatedResources: z.ZodObject<{
          cpu: z.ZodNumber;
          memoryMiB: z.ZodNumber;
          timeoutMs: z.ZodNumber;
        }, z.core.$strict>;
        requirementIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "requirement", "out">>;
      }, z.core.$strict>>;
    }, z.core.$strict>;
    mode: z.ZodEnum<{
      current: "current";
      history: "history";
    }>;
    canConfirm: z.ZodBoolean;
    confirmation: z.ZodNullable<z.ZodObject<{
      actor: z.ZodString;
      operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      confirmedAt: z.ZodISODateTime;
    }, z.core.$strict>>;
    issues: z.ZodArray<z.ZodObject<{
      code: z.ZodString;
      path: z.ZodString;
      workId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
      relatedWorkId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "work", "out">>;
      requirementId: z.ZodOptional<z.core.$ZodBranded<z.ZodString, "requirement", "out">>;
    }, z.core.$strict>>;
    topology: z.ZodArray<z.ZodObject<{
      workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
      layer: z.ZodNumber;
    }, z.core.$strict>>;
    carryForward: z.ZodOptional<z.ZodObject<{
      sha256: z.ZodString;
      round: z.ZodNumber;
      sourcePlanRevision: z.ZodNumber;
      results: z.ZodArray<z.ZodObject<{
        workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
        workRevision: z.ZodNumber;
        attemptId: z.core.$ZodBranded<z.ZodString, "attempt", "out">;
        sourcePlanRevision: z.ZodNumber;
        outcome: z.ZodEnum<{
          success: "success";
          "completed-with-findings": "completed-with-findings";
        }>;
        codeCommit: z.ZodNullable<z.ZodString>;
        evidence: z.ZodObject<{
          artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
          sha256: z.ZodString;
        }, z.core.$strict>;
        checkConfigHash: z.ZodString;
        templateVersion: z.ZodString;
        inputManifestSha256: z.ZodString;
        snapshotSha256: z.ZodString;
        origin: z.ZodEnum<{
          FORMAL: "FORMAL";
          HISTORICAL: "HISTORICAL";
        }>;
      }, z.core.$strict>>;
    }, z.core.$strict>>;
  }, z.core.$strict>;
  WorkbenchSource: z.ZodObject<{
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    ref: z.ZodDiscriminatedUnion<[z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
      kind: z.ZodLiteral<"artifact">;
    }, z.core.$strict>, z.ZodObject<{
      kind: z.ZodLiteral<"message">;
      messageId: z.core.$ZodBranded<z.ZodString, "message", "out">;
    }, z.core.$strict>, z.ZodObject<{
      kind: z.ZodLiteral<"requirement">;
      requirementId: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
      requirementRevision: z.ZodNumber;
    }, z.core.$strict>], "kind">;
    label: z.ZodString;
    body: z.ZodDiscriminatedUnion<[z.ZodObject<{
      kind: z.ZodLiteral<"text">;
      text: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
      kind: z.ZodLiteral<"requirement">;
      requirement: z.ZodObject<{
        id: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
        statement: z.ZodString;
        sourceRefs: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
          artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
          sha256: z.ZodString;
          kind: z.ZodLiteral<"artifact">;
        }, z.core.$strict>, z.ZodObject<{
          kind: z.ZodLiteral<"message">;
          messageId: z.core.$ZodBranded<z.ZodString, "message", "out">;
        }, z.core.$strict>, z.ZodObject<{
          kind: z.ZodLiteral<"requirement">;
          requirementId: z.core.$ZodBranded<z.ZodString, "requirement", "out">;
          requirementRevision: z.ZodNumber;
        }, z.core.$strict>], "kind">>;
        acceptance: z.ZodArray<z.ZodString>;
      }, z.core.$strict>;
    }, z.core.$strict>], "kind">;
  }, z.core.$strict>;
  WorkbenchDelivery: z.ZodObject<{
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    resourceRevision: z.ZodNumber;
    projectRevision: z.ZodNumber;
    eventCursor: z.ZodNumber;
    mode: z.ZodEnum<{
      current: "current";
      history: "history";
    }>;
    membership: z.ZodEnum<{
      owner: "owner";
      operator: "operator";
      viewer: "viewer";
    }>;
    candidates: z.ZodArray<z.ZodObject<{
      candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
      revision: z.ZodNumber;
      manifestHash: z.ZodString;
      codeCommit: z.ZodString;
      createdAt: z.ZodISODateTime;
      qualification: z.ZodEnum<{
        CURRENT: "CURRENT";
        STALE: "STALE";
      }>;
      automaticStatus: z.ZodLiteral<"PASS">;
      reviewStatus: z.ZodEnum<{
        PENDING: "PENDING";
        NOT_REQUIRED: "NOT_REQUIRED";
      }>;
    }, z.core.$strict>>;
    nextRevision: z.ZodNullable<z.ZodNumber>;
    selectedCandidate: z.ZodNullable<z.ZodObject<{
      candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
      revision: z.ZodNumber;
      manifestHash: z.ZodString;
      codeCommit: z.ZodString;
      createdAt: z.ZodISODateTime;
      qualification: z.ZodEnum<{
        CURRENT: "CURRENT";
        STALE: "STALE";
      }>;
      automaticStatus: z.ZodLiteral<"PASS">;
      reviewStatus: z.ZodEnum<{
        PENDING: "PENDING";
        NOT_REQUIRED: "NOT_REQUIRED";
      }>;
    }, z.core.$strict>>;
    acceptedRelease: z.ZodNullable<z.ZodObject<{
      releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
      runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
      candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
      codeCommit: z.ZodString;
      acceptedAt: z.ZodISODateTime;
      isCurrentAccepted: z.ZodLiteral<true>;
    }, z.core.$strict>>;
  }, z.core.$strict>;
  ReleaseAccessInput: z.ZodObject<{}, z.core.$strict>;
  ReleaseAccessTicket: z.ZodObject<{
    ticket: z.ZodString;
    releaseOrigin: z.ZodURL;
    expiresAt: z.ZodISODateTime;
    sessionExpiresAt: z.ZodISODateTime;
  }, z.core.$strict>;
  ReleaseEntryView: z.ZodObject<{
    release: z.ZodObject<{
      releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
      runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
      candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
      datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
      revision: z.ZodNumber;
      state: z.ZodEnum<{
        PENDING: "PENDING";
        SENT: "SENT";
        UNKNOWN: "UNKNOWN";
        PUBLISHED: "PUBLISHED";
      }>;
      isCurrentAccepted: z.ZodBoolean;
      publishedAt: z.ZodNullable<z.ZodISODateTime>;
    }, z.core.$strict>;
    access: z.ZodObject<{
      state: z.ZodEnum<{
        AVAILABLE: "AVAILABLE";
        NOT_CONFIGURED: "NOT_CONFIGURED";
        RECOVERING: "RECOVERING";
        NOT_CURRENT: "NOT_CURRENT";
      }>;
      canWrite: z.ZodBoolean;
      releaseOrigin: z.ZodNullable<z.ZodURL>;
      checkedAt: z.ZodNullable<z.ZodISODateTime>;
    }, z.core.$strict>;
  }, z.core.$strict>;
  PreviewAccessInput: z.ZodObject<{}, z.core.$strict>;
  PreviewAccessTicket: z.ZodObject<{
    ticket: z.ZodString;
    previewOrigin: z.ZodURL;
    expiresAt: z.ZodISODateTime;
    sessionExpiresAt: z.ZodISODateTime;
  }, z.core.$strict>;
  PreviewEntryView: z.ZodObject<{
    preview: z.ZodObject<{
      previewId: z.core.$ZodBranded<z.ZodString, "preview", "out">;
      runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
      candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
      datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
      revision: z.ZodNumber;
      state: z.ZodEnum<{
        STOPPING: "STOPPING";
        STARTING: "STARTING";
        READY: "READY";
        UNKNOWN: "UNKNOWN";
        STOPPED: "STOPPED";
        EXPIRED: "EXPIRED";
      }>;
      expiresAt: z.ZodISODateTime;
      healthState: z.ZodEnum<{
        EXITED: "EXITED";
        REMOVED: "REMOVED";
        UNKNOWN: "UNKNOWN";
        HEALTHY: "HEALTHY";
        UNHEALTHY: "UNHEALTHY";
        CREATED: "CREATED";
      }>;
      healthCheckedAt: z.ZodNullable<z.ZodISODateTime>;
    }, z.core.$strict>;
    access: z.ZodObject<{
      state: z.ZodEnum<{
        STOPPING: "STOPPING";
        STARTING: "STARTING";
        UNKNOWN: "UNKNOWN";
        AVAILABLE: "AVAILABLE";
        NOT_CONFIGURED: "NOT_CONFIGURED";
        RECOVERING: "RECOVERING";
        STOPPED: "STOPPED";
        EXPIRED: "EXPIRED";
      }>;
      canWrite: z.ZodBoolean;
      previewOrigin: z.ZodNullable<z.ZodURL>;
    }, z.core.$strict>;
  }, z.core.$strict>;
  CandidatePreviewWorkspace: z.ZodObject<{
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
    candidateRevision: z.ZodNumber;
    manifestHash: z.ZodString;
    qualification: z.ZodEnum<{
      CURRENT: "CURRENT";
      STALE: "STALE";
    }>;
    resourceRevision: z.ZodNumber;
    dataPlan: z.ZodDiscriminatedUnion<[z.ZodObject<{
      strategy: z.ZodLiteral<"INITIAL">;
      initialData: z.ZodEnum<{
        EMPTY: "EMPTY";
        DEMO: "DEMO";
      }>;
      sourceReleaseId: z.ZodNull;
      migrationRef: z.ZodNull;
      replacementDecisionId: z.ZodNull;
      schemaVersion: z.ZodLiteral<"devmesh.data-plan.v1">;
      runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
      codeCommit: z.ZodString;
      requirementRevision: z.ZodNumber;
      planRevision: z.ZodNumber;
      templateVersion: z.ZodString;
      checkConfigHash: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
      strategy: z.ZodLiteral<"PRESERVE_MIGRATE">;
      initialData: z.ZodNull;
      sourceReleaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
      migrationRef: z.ZodObject<{
        artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
        sha256: z.ZodString;
      }, z.core.$strict>;
      replacementDecisionId: z.ZodNull;
      schemaVersion: z.ZodLiteral<"devmesh.data-plan.v1">;
      runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
      codeCommit: z.ZodString;
      requirementRevision: z.ZodNumber;
      planRevision: z.ZodNumber;
      templateVersion: z.ZodString;
      checkConfigHash: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
      strategy: z.ZodLiteral<"REPLACE">;
      initialData: z.ZodEnum<{
        EMPTY: "EMPTY";
        DEMO: "DEMO";
      }>;
      sourceReleaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
      migrationRef: z.ZodNull;
      replacementDecisionId: z.core.$ZodBranded<z.ZodString, "decision", "out">;
      schemaVersion: z.ZodLiteral<"devmesh.data-plan.v1">;
      runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
      codeCommit: z.ZodString;
      requirementRevision: z.ZodNumber;
      planRevision: z.ZodNumber;
      templateVersion: z.ZodString;
      checkConfigHash: z.ZodString;
    }, z.core.$strict>], "strategy">;
    canManage: z.ZodBoolean;
    configured: z.ZodBoolean;
    policyHash: z.ZodNullable<z.ZodString>;
    canCreateDataset: z.ZodBoolean;
    hasPendingEffects: z.ZodBoolean;
    datasets: z.ZodArray<z.ZodObject<{
      sequence: z.ZodNumber;
      dataset: z.ZodObject<{
        datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
        runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
        candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
        operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
        state: z.ZodEnum<{
          PREPARING: "PREPARING";
          MISSING: "MISSING";
          READY: "READY";
          WRITE_FROZEN: "WRITE_FROZEN";
          RETIRED: "RETIRED";
        }>;
        operationState: z.ZodEnum<{
          FAILED: "FAILED";
          SUCCEEDED: "SUCCEEDED";
          PREPARED: "PREPARED";
          SENT: "SENT";
          UNKNOWN: "UNKNOWN";
        }>;
        revision: z.ZodNumber;
        sourceDatasetId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "dataset", "out">>;
        sourceReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
        schemaRevision: z.ZodString;
        snapshotAt: z.ZodNullable<z.ZodISODateTime>;
        retentionUntil: z.ZodISODateTime;
        createdAt: z.ZodISODateTime;
        canStart: z.ZodBoolean;
      }, z.core.$strict>;
    }, z.core.$strict>>;
    nextDatasetSequence: z.ZodNullable<z.ZodNumber>;
    previews: z.ZodArray<z.ZodObject<{
      sequence: z.ZodNumber;
      preview: z.ZodObject<{
        previewId: z.core.$ZodBranded<z.ZodString, "preview", "out">;
        runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
        candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
        datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
        revision: z.ZodNumber;
        state: z.ZodEnum<{
          STOPPING: "STOPPING";
          STARTING: "STARTING";
          READY: "READY";
          UNKNOWN: "UNKNOWN";
          STOPPED: "STOPPED";
          EXPIRED: "EXPIRED";
        }>;
        expiresAt: z.ZodISODateTime;
        healthState: z.ZodEnum<{
          EXITED: "EXITED";
          REMOVED: "REMOVED";
          UNKNOWN: "UNKNOWN";
          HEALTHY: "HEALTHY";
          UNHEALTHY: "UNHEALTHY";
          CREATED: "CREATED";
        }>;
        healthCheckedAt: z.ZodNullable<z.ZodISODateTime>;
        operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
        impactReviewHash: z.ZodString;
        stopOperationId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "op", "out">>;
        canStop: z.ZodBoolean;
      }, z.core.$strict>;
    }, z.core.$strict>>;
    nextPreviewSequence: z.ZodNullable<z.ZodNumber>;
  }, z.core.$strict>;
  PreviewDatasetManagement: z.ZodObject<{
    datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    state: z.ZodEnum<{
      PREPARING: "PREPARING";
      MISSING: "MISSING";
      READY: "READY";
      WRITE_FROZEN: "WRITE_FROZEN";
      RETIRED: "RETIRED";
    }>;
    operationState: z.ZodEnum<{
      FAILED: "FAILED";
      SUCCEEDED: "SUCCEEDED";
      PREPARED: "PREPARED";
      SENT: "SENT";
      UNKNOWN: "UNKNOWN";
    }>;
    revision: z.ZodNumber;
    sourceDatasetId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "dataset", "out">>;
    sourceReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
    schemaRevision: z.ZodString;
    snapshotAt: z.ZodNullable<z.ZodISODateTime>;
    retentionUntil: z.ZodISODateTime;
    createdAt: z.ZodISODateTime;
    canStart: z.ZodBoolean;
  }, z.core.$strict>;
  PreviewManagement: z.ZodObject<{
    previewId: z.core.$ZodBranded<z.ZodString, "preview", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
    datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
    revision: z.ZodNumber;
    state: z.ZodEnum<{
      STOPPING: "STOPPING";
      STARTING: "STARTING";
      READY: "READY";
      UNKNOWN: "UNKNOWN";
      STOPPED: "STOPPED";
      EXPIRED: "EXPIRED";
    }>;
    expiresAt: z.ZodISODateTime;
    healthState: z.ZodEnum<{
      EXITED: "EXITED";
      REMOVED: "REMOVED";
      UNKNOWN: "UNKNOWN";
      HEALTHY: "HEALTHY";
      UNHEALTHY: "UNHEALTHY";
      CREATED: "CREATED";
    }>;
    healthCheckedAt: z.ZodNullable<z.ZodISODateTime>;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    impactReviewHash: z.ZodString;
    stopOperationId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "op", "out">>;
    canStop: z.ZodBoolean;
  }, z.core.$strict>;
  CreatePreviewDataset: z.ZodObject<{
    manifestHash: z.ZodString;
    policyHash: z.ZodString;
  }, z.core.$strict>;
  CreatePreviewIntent: z.ZodObject<{
    manifestHash: z.ZodString;
    datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
    expiresAt: z.ZodISODateTime;
  }, z.core.$strict>;
  StopPreviewIntent: z.ZodObject<{
    previewRevision: z.ZodNumber;
    impactReviewHash: z.ZodString;
    confirmation: z.ZodLiteral<"STOP_PREVIEW">;
  }, z.core.$strict>;
};
declare const commandRoutes: readonly [{
  readonly name: "CreateProject";
  readonly path: "/api/v1/projects";
  readonly parameters: {};
  readonly conditional: false;
  readonly success: readonly ["201"];
}, {
  readonly name: "SaveMessage";
  readonly path: "/api/v1/runs/{runId}/messages";
  readonly parameters: {
    readonly runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  };
  readonly conditional: true;
  readonly success: readonly ["202"];
}, {
  readonly name: "AnswerQuestions";
  readonly path: "/api/v1/runs/{runId}/questions:answer";
  readonly parameters: {
    readonly runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  };
  readonly conditional: true;
  readonly success: readonly ["202"];
}, {
  readonly name: "ConfirmPlan";
  readonly path: "/api/v1/runs/{runId}/plans/{revision}:confirm";
  readonly parameters: {
    readonly runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    readonly revision: z.ZodNumber;
  };
  readonly conditional: true;
  readonly success: readonly ["202"];
}, {
  readonly name: "PlanFeedback";
  readonly path: "/api/v1/runs/{runId}/plans/{revision}:feedback";
  readonly parameters: {
    readonly runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    readonly revision: z.ZodNumber;
  };
  readonly conditional: true;
  readonly success: readonly ["202"];
}, {
  readonly name: "ProposeChange";
  readonly path: "/api/v1/runs/{runId}/changes";
  readonly parameters: {
    readonly runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  };
  readonly conditional: true;
  readonly success: readonly ["202"];
}, {
  readonly name: "DecideChange";
  readonly path: "/api/v1/changes/{changeId}:decide";
  readonly parameters: {
    readonly changeId: z.core.$ZodBranded<z.ZodString, "change", "out">;
  };
  readonly conditional: true;
  readonly success: readonly ["200", "202"];
}, {
  readonly name: "PauseRun";
  readonly path: "/api/v1/runs/{runId}:pause";
  readonly parameters: {
    readonly runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  };
  readonly conditional: true;
  readonly success: readonly ["202"];
}, {
  readonly name: "ResumeRun";
  readonly path: "/api/v1/runs/{runId}:resume";
  readonly parameters: {
    readonly runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  };
  readonly conditional: true;
  readonly success: readonly ["202"];
}, {
  readonly name: "CancelRun";
  readonly path: "/api/v1/runs/{runId}:cancel";
  readonly parameters: {
    readonly runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  };
  readonly conditional: true;
  readonly success: readonly ["202"];
}, {
  readonly name: "RetryWork";
  readonly path: "/api/v1/works/{workId}:retry";
  readonly parameters: {
    readonly workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
  };
  readonly conditional: true;
  readonly success: readonly ["202"];
}, {
  readonly name: "RedoRun";
  readonly path: "/api/v1/runs/{runId}:redo";
  readonly parameters: {
    readonly runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  };
  readonly conditional: true;
  readonly success: readonly ["202"];
}, {
  readonly name: "AcceptCandidate";
  readonly path: "/api/v1/candidates/{candidateId}:accept";
  readonly parameters: {
    readonly candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
  };
  readonly conditional: true;
  readonly success: readonly ["202"];
}];
declare function createOpenApiDocument(): {
  openapi: string;
  jsonSchemaDialect: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  'x-runtime-constraints': string[];
  paths: Record<string, Record<string, unknown>>;
  components: {
    securitySchemes: {
      trustedIdentity: {
        type: string;
        scheme: string;
        description: string;
      };
      browserSession: {
        type: string;
        in: string;
        name: string;
        description: string;
      };
    };
    schemas: {
      [k: string]: {
        [k: string]: unknown;
        "~standard": z.core.ZodStandardSchemaWithJSON<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
        $id?: string;
        $anchor?: string;
        $ref?: string;
        $dynamicRef?: string;
        $dynamicAnchor?: string;
        $vocabulary?: Record<string, boolean>;
        $comment?: string;
        $defs?: Record<string, z.core.JSONSchema.JSONSchema>;
        type?: "object" | "array" | "string" | "number" | "boolean" | "null" | "integer";
        additionalItems?: z.core.JSONSchema._JSONSchema;
        unevaluatedItems?: z.core.JSONSchema._JSONSchema;
        prefixItems?: z.core.JSONSchema._JSONSchema[];
        items?: z.core.JSONSchema._JSONSchema | z.core.JSONSchema._JSONSchema[];
        contains?: z.core.JSONSchema._JSONSchema;
        additionalProperties?: z.core.JSONSchema._JSONSchema;
        unevaluatedProperties?: z.core.JSONSchema._JSONSchema;
        properties?: Record<string, z.core.JSONSchema._JSONSchema>;
        patternProperties?: Record<string, z.core.JSONSchema._JSONSchema>;
        dependentSchemas?: Record<string, z.core.JSONSchema._JSONSchema>;
        propertyNames?: z.core.JSONSchema._JSONSchema;
        if?: z.core.JSONSchema._JSONSchema;
        then?: z.core.JSONSchema._JSONSchema;
        else?: z.core.JSONSchema._JSONSchema;
        allOf?: z.core.JSONSchema.JSONSchema[];
        anyOf?: z.core.JSONSchema.JSONSchema[];
        oneOf?: z.core.JSONSchema.JSONSchema[];
        not?: z.core.JSONSchema._JSONSchema;
        multipleOf?: number;
        maximum?: number;
        exclusiveMaximum?: number | boolean;
        minimum?: number;
        exclusiveMinimum?: number | boolean;
        maxLength?: number;
        minLength?: number;
        pattern?: string;
        maxItems?: number;
        minItems?: number;
        uniqueItems?: boolean;
        maxContains?: number;
        minContains?: number;
        maxProperties?: number;
        minProperties?: number;
        required?: string[];
        dependentRequired?: Record<string, string[]>;
        enum?: Array<string | number | boolean | null>;
        const?: string | number | boolean | null;
        id?: string;
        title?: string;
        description?: string;
        default?: unknown;
        deprecated?: boolean;
        readOnly?: boolean;
        writeOnly?: boolean;
        nullable?: boolean;
        examples?: unknown[];
        format?: string;
        contentMediaType?: string;
        contentEncoding?: string;
        contentSchema?: z.core.JSONSchema.JSONSchema;
        _prefault?: unknown;
      };
    };
  };
};
//#endregion
//#region src/preview.d.ts
declare const previewAccessInput: z.ZodObject<{}, z.core.$strict>;
declare const previewAccessTicket: z.ZodObject<{
  ticket: z.ZodString;
  previewOrigin: z.ZodURL;
  expiresAt: z.ZodISODateTime;
  sessionExpiresAt: z.ZodISODateTime;
}, z.core.$strict>;
declare const previewEntryView: z.ZodObject<{
  preview: z.ZodObject<{
    previewId: z.core.$ZodBranded<z.ZodString, "preview", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
    datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
    revision: z.ZodNumber;
    state: z.ZodEnum<{
      STOPPING: "STOPPING";
      STARTING: "STARTING";
      READY: "READY";
      UNKNOWN: "UNKNOWN";
      STOPPED: "STOPPED";
      EXPIRED: "EXPIRED";
    }>;
    expiresAt: z.ZodISODateTime;
    healthState: z.ZodEnum<{
      EXITED: "EXITED";
      REMOVED: "REMOVED";
      UNKNOWN: "UNKNOWN";
      HEALTHY: "HEALTHY";
      UNHEALTHY: "UNHEALTHY";
      CREATED: "CREATED";
    }>;
    healthCheckedAt: z.ZodNullable<z.ZodISODateTime>;
  }, z.core.$strict>;
  access: z.ZodObject<{
    state: z.ZodEnum<{
      STOPPING: "STOPPING";
      STARTING: "STARTING";
      UNKNOWN: "UNKNOWN";
      AVAILABLE: "AVAILABLE";
      NOT_CONFIGURED: "NOT_CONFIGURED";
      RECOVERING: "RECOVERING";
      STOPPED: "STOPPED";
      EXPIRED: "EXPIRED";
    }>;
    canWrite: z.ZodBoolean;
    previewOrigin: z.ZodNullable<z.ZodURL>;
  }, z.core.$strict>;
}, z.core.$strict>;
type PreviewEntryView = z.output<typeof previewEntryView>;
declare const createPreviewDatasetInput: z.ZodObject<{
  manifestHash: z.ZodString;
  policyHash: z.ZodString;
}, z.core.$strict>;
declare const createPreviewIntentInput: z.ZodObject<{
  manifestHash: z.ZodString;
  datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
  expiresAt: z.ZodISODateTime;
}, z.core.$strict>;
declare const stopPreviewIntentInput: z.ZodObject<{
  previewRevision: z.ZodNumber;
  impactReviewHash: z.ZodString;
  confirmation: z.ZodLiteral<"STOP_PREVIEW">;
}, z.core.$strict>;
declare const previewDatasetManagement: z.ZodObject<{
  datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  state: z.ZodEnum<{
    PREPARING: "PREPARING";
    MISSING: "MISSING";
    READY: "READY";
    WRITE_FROZEN: "WRITE_FROZEN";
    RETIRED: "RETIRED";
  }>;
  operationState: z.ZodEnum<{
    FAILED: "FAILED";
    SUCCEEDED: "SUCCEEDED";
    PREPARED: "PREPARED";
    SENT: "SENT";
    UNKNOWN: "UNKNOWN";
  }>;
  revision: z.ZodNumber;
  sourceDatasetId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "dataset", "out">>;
  sourceReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
  schemaRevision: z.ZodString;
  snapshotAt: z.ZodNullable<z.ZodISODateTime>;
  retentionUntil: z.ZodISODateTime;
  createdAt: z.ZodISODateTime;
  canStart: z.ZodBoolean;
}, z.core.$strict>;
declare const previewManagement: z.ZodObject<{
  previewId: z.core.$ZodBranded<z.ZodString, "preview", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
  datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
  revision: z.ZodNumber;
  state: z.ZodEnum<{
    STOPPING: "STOPPING";
    STARTING: "STARTING";
    READY: "READY";
    UNKNOWN: "UNKNOWN";
    STOPPED: "STOPPED";
    EXPIRED: "EXPIRED";
  }>;
  expiresAt: z.ZodISODateTime;
  healthState: z.ZodEnum<{
    EXITED: "EXITED";
    REMOVED: "REMOVED";
    UNKNOWN: "UNKNOWN";
    HEALTHY: "HEALTHY";
    UNHEALTHY: "UNHEALTHY";
    CREATED: "CREATED";
  }>;
  healthCheckedAt: z.ZodNullable<z.ZodISODateTime>;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  impactReviewHash: z.ZodString;
  stopOperationId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "op", "out">>;
  canStop: z.ZodBoolean;
}, z.core.$strict>;
declare const candidatePreviewWorkspace: z.ZodObject<{
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
  candidateRevision: z.ZodNumber;
  manifestHash: z.ZodString;
  qualification: z.ZodEnum<{
    CURRENT: "CURRENT";
    STALE: "STALE";
  }>;
  resourceRevision: z.ZodNumber;
  dataPlan: z.ZodDiscriminatedUnion<[z.ZodObject<{
    strategy: z.ZodLiteral<"INITIAL">;
    initialData: z.ZodEnum<{
      EMPTY: "EMPTY";
      DEMO: "DEMO";
    }>;
    sourceReleaseId: z.ZodNull;
    migrationRef: z.ZodNull;
    replacementDecisionId: z.ZodNull;
    schemaVersion: z.ZodLiteral<"devmesh.data-plan.v1">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    codeCommit: z.ZodString;
    requirementRevision: z.ZodNumber;
    planRevision: z.ZodNumber;
    templateVersion: z.ZodString;
    checkConfigHash: z.ZodString;
  }, z.core.$strict>, z.ZodObject<{
    strategy: z.ZodLiteral<"PRESERVE_MIGRATE">;
    initialData: z.ZodNull;
    sourceReleaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
    migrationRef: z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
    }, z.core.$strict>;
    replacementDecisionId: z.ZodNull;
    schemaVersion: z.ZodLiteral<"devmesh.data-plan.v1">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    codeCommit: z.ZodString;
    requirementRevision: z.ZodNumber;
    planRevision: z.ZodNumber;
    templateVersion: z.ZodString;
    checkConfigHash: z.ZodString;
  }, z.core.$strict>, z.ZodObject<{
    strategy: z.ZodLiteral<"REPLACE">;
    initialData: z.ZodEnum<{
      EMPTY: "EMPTY";
      DEMO: "DEMO";
    }>;
    sourceReleaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
    migrationRef: z.ZodNull;
    replacementDecisionId: z.core.$ZodBranded<z.ZodString, "decision", "out">;
    schemaVersion: z.ZodLiteral<"devmesh.data-plan.v1">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    codeCommit: z.ZodString;
    requirementRevision: z.ZodNumber;
    planRevision: z.ZodNumber;
    templateVersion: z.ZodString;
    checkConfigHash: z.ZodString;
  }, z.core.$strict>], "strategy">;
  canManage: z.ZodBoolean;
  configured: z.ZodBoolean;
  policyHash: z.ZodNullable<z.ZodString>;
  canCreateDataset: z.ZodBoolean;
  hasPendingEffects: z.ZodBoolean;
  datasets: z.ZodArray<z.ZodObject<{
    sequence: z.ZodNumber;
    dataset: z.ZodObject<{
      datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
      runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
      candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
      operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      state: z.ZodEnum<{
        PREPARING: "PREPARING";
        MISSING: "MISSING";
        READY: "READY";
        WRITE_FROZEN: "WRITE_FROZEN";
        RETIRED: "RETIRED";
      }>;
      operationState: z.ZodEnum<{
        FAILED: "FAILED";
        SUCCEEDED: "SUCCEEDED";
        PREPARED: "PREPARED";
        SENT: "SENT";
        UNKNOWN: "UNKNOWN";
      }>;
      revision: z.ZodNumber;
      sourceDatasetId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "dataset", "out">>;
      sourceReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
      schemaRevision: z.ZodString;
      snapshotAt: z.ZodNullable<z.ZodISODateTime>;
      retentionUntil: z.ZodISODateTime;
      createdAt: z.ZodISODateTime;
      canStart: z.ZodBoolean;
    }, z.core.$strict>;
  }, z.core.$strict>>;
  nextDatasetSequence: z.ZodNullable<z.ZodNumber>;
  previews: z.ZodArray<z.ZodObject<{
    sequence: z.ZodNumber;
    preview: z.ZodObject<{
      previewId: z.core.$ZodBranded<z.ZodString, "preview", "out">;
      runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
      candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
      datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
      revision: z.ZodNumber;
      state: z.ZodEnum<{
        STOPPING: "STOPPING";
        STARTING: "STARTING";
        READY: "READY";
        UNKNOWN: "UNKNOWN";
        STOPPED: "STOPPED";
        EXPIRED: "EXPIRED";
      }>;
      expiresAt: z.ZodISODateTime;
      healthState: z.ZodEnum<{
        EXITED: "EXITED";
        REMOVED: "REMOVED";
        UNKNOWN: "UNKNOWN";
        HEALTHY: "HEALTHY";
        UNHEALTHY: "UNHEALTHY";
        CREATED: "CREATED";
      }>;
      healthCheckedAt: z.ZodNullable<z.ZodISODateTime>;
      operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      impactReviewHash: z.ZodString;
      stopOperationId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "op", "out">>;
      canStop: z.ZodBoolean;
    }, z.core.$strict>;
  }, z.core.$strict>>;
  nextPreviewSequence: z.ZodNullable<z.ZodNumber>;
}, z.core.$strict>;
type CandidatePreviewWorkspace = z.output<typeof candidatePreviewWorkspace>;
//#endregion
//#region src/release-access.d.ts
declare const releaseAccessInput: z.ZodObject<{}, z.core.$strict>;
declare const releaseAccessTicket: z.ZodObject<{
  ticket: z.ZodString;
  releaseOrigin: z.ZodURL;
  expiresAt: z.ZodISODateTime;
  sessionExpiresAt: z.ZodISODateTime;
}, z.core.$strict>;
declare const releaseEntryView: z.ZodObject<{
  release: z.ZodObject<{
    releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
    datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
    revision: z.ZodNumber;
    state: z.ZodEnum<{
      PENDING: "PENDING";
      SENT: "SENT";
      UNKNOWN: "UNKNOWN";
      PUBLISHED: "PUBLISHED";
    }>;
    isCurrentAccepted: z.ZodBoolean;
    publishedAt: z.ZodNullable<z.ZodISODateTime>;
  }, z.core.$strict>;
  access: z.ZodObject<{
    state: z.ZodEnum<{
      AVAILABLE: "AVAILABLE";
      NOT_CONFIGURED: "NOT_CONFIGURED";
      RECOVERING: "RECOVERING";
      NOT_CURRENT: "NOT_CURRENT";
    }>;
    canWrite: z.ZodBoolean;
    releaseOrigin: z.ZodNullable<z.ZodURL>;
    checkedAt: z.ZodNullable<z.ZodISODateTime>;
  }, z.core.$strict>;
}, z.core.$strict>;
type ReleaseEntryView = z.output<typeof releaseEntryView>;
//#endregion
//#region src/release-export.d.ts
declare const createReleaseExportInput: z.ZodObject<{
  format: z.ZodLiteral<"zip">;
}, z.core.$strict>;
declare const retryReleaseExportInput: z.ZodObject<{
  expectedGeneration: z.ZodNumber;
}, z.core.$strict>;
declare const releaseExportView: z.ZodObject<{
  exportId: z.ZodString;
  releaseId: z.ZodString;
  runId: z.ZodString;
  candidateId: z.ZodString;
  codeCommit: z.ZodString;
  cutoffSeq: z.ZodNumber;
  snapshotHash: z.ZodString;
  state: z.ZodEnum<{
    FAILED: "FAILED";
    QUEUED: "QUEUED";
    READY: "READY";
    PACKING: "PACKING";
  }>;
  generation: z.ZodNumber;
  leaseUntil: z.ZodNullable<z.ZodISODateTime>;
  archiveHash: z.ZodNullable<z.ZodString>;
  archiveSize: z.ZodNullable<z.ZodNumber>;
  errorCode: z.ZodNullable<z.ZodString>;
  createdAt: z.ZodISODateTime;
  updatedAt: z.ZodISODateTime;
  canRetry: z.ZodBoolean;
}, z.core.$strict>;
declare const releaseExportListView: z.ZodObject<{
  jobs: z.ZodArray<z.ZodObject<{
    exportId: z.ZodString;
    releaseId: z.ZodString;
    runId: z.ZodString;
    candidateId: z.ZodString;
    codeCommit: z.ZodString;
    cutoffSeq: z.ZodNumber;
    snapshotHash: z.ZodString;
    state: z.ZodEnum<{
      FAILED: "FAILED";
      QUEUED: "QUEUED";
      READY: "READY";
      PACKING: "PACKING";
    }>;
    generation: z.ZodNumber;
    leaseUntil: z.ZodNullable<z.ZodISODateTime>;
    archiveHash: z.ZodNullable<z.ZodString>;
    archiveSize: z.ZodNullable<z.ZodNumber>;
    errorCode: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodISODateTime;
    updatedAt: z.ZodISODateTime;
    canRetry: z.ZodBoolean;
  }, z.core.$strict>>;
  nextCursor: z.ZodNullable<z.ZodString>;
}, z.core.$strict>;
declare const releaseExportEntryView: z.ZodObject<{
  releaseId: z.ZodString;
  runId: z.ZodString;
  candidateId: z.ZodString;
  codeCommit: z.ZodString;
  acceptedAt: z.ZodISODateTime;
  isCurrentAccepted: z.ZodBoolean;
}, z.core.$strict>;
//#endregion
//#region src/candidate-review.d.ts
declare const candidateReviewItem: z.ZodObject<{
  itemId: z.ZodString;
  itemHash: z.ZodString;
  kind: z.ZodEnum<{
    requirement: "requirement";
    "work-human": "work-human";
    "quality-human": "quality-human";
  }>;
  requirementIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "requirement", "out">>;
  subjectId: z.ZodString;
  checkId: z.ZodString;
  expected: z.ZodString;
}, z.core.$strict>;
declare const candidateHumanResult: z.ZodObject<{
  resultId: z.ZodString;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
  candidateRevision: z.ZodNumber;
  manifestHash: z.ZodString;
  item: z.ZodObject<{
    itemId: z.ZodString;
    itemHash: z.ZodString;
    kind: z.ZodEnum<{
      requirement: "requirement";
      "work-human": "work-human";
      "quality-human": "quality-human";
    }>;
    requirementIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "requirement", "out">>;
    subjectId: z.ZodString;
    checkId: z.ZodString;
    expected: z.ZodString;
  }, z.core.$strict>;
  previousResultId: z.ZodNullable<z.ZodString>;
  principalId: z.ZodString;
  verdict: z.ZodEnum<{
    PASS: "PASS";
    FAIL: "FAIL";
  }>;
  procedure: z.ZodString;
  expected: z.ZodString;
  observed: z.ZodString;
  evidence: z.ZodArray<z.ZodObject<{
    artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
    sha256: z.ZodString;
  }, z.core.$strict>>;
  createdAt: z.ZodISODateTime;
}, z.core.$strict>;
declare const candidateRejectionResult: z.ZodObject<{
  resultId: z.ZodString;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
  candidateRevision: z.ZodNumber;
  manifestHash: z.ZodString;
  rejectionId: z.ZodString;
  previousResultId: z.ZodNullable<z.ZodString>;
  classification: z.ZodEnum<{
    IN_SCOPE_DEFECT: "IN_SCOPE_DEFECT";
    SCOPE_CHANGE: "SCOPE_CHANGE";
  }>;
  state: z.ZodEnum<{
    OPEN: "OPEN";
    WITHDRAWN: "WITHDRAWN";
  }>;
  item: z.ZodNullable<z.ZodObject<{
    itemId: z.ZodString;
    itemHash: z.ZodString;
    kind: z.ZodEnum<{
      requirement: "requirement";
      "work-human": "work-human";
      "quality-human": "quality-human";
    }>;
    requirementIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "requirement", "out">>;
    subjectId: z.ZodString;
    checkId: z.ZodString;
    expected: z.ZodString;
  }, z.core.$strict>>;
  description: z.ZodString;
  reason: z.ZodString;
  evidence: z.ZodArray<z.ZodObject<{
    artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
    sha256: z.ZodString;
  }, z.core.$strict>>;
  principalId: z.ZodString;
  createdAt: z.ZodISODateTime;
  nextAction: z.ZodEnum<{
    REPAIR_REVIEW_REQUIRED: "REPAIR_REVIEW_REQUIRED";
    CHANGE_REVIEW_REQUIRED: "CHANGE_REVIEW_REQUIRED";
    NONE: "NONE";
  }>;
  applicationState: z.ZodLiteral<"NOT_APPLIED">;
}, z.core.$strict>;
declare const candidateReviewView: z.ZodObject<{
  candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
  candidateRevision: z.ZodNumber;
  manifestHash: z.ZodString;
  qualification: z.ZodEnum<{
    CURRENT: "CURRENT";
    STALE: "STALE";
  }>;
  resourceRevision: z.ZodNumber;
  automaticStatus: z.ZodLiteral<"PASS">;
  humanStatus: z.ZodEnum<{
    STALE: "STALE";
    PASS: "PASS";
    MISSING: "MISSING";
    FAIL: "FAIL";
  }>;
  reviewHash: z.ZodString;
  items: z.ZodArray<z.ZodObject<{
    itemId: z.ZodString;
    itemHash: z.ZodString;
    kind: z.ZodEnum<{
      requirement: "requirement";
      "work-human": "work-human";
      "quality-human": "quality-human";
    }>;
    requirementIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "requirement", "out">>;
    subjectId: z.ZodString;
    checkId: z.ZodString;
    expected: z.ZodString;
    status: z.ZodEnum<{
      STALE: "STALE";
      PASS: "PASS";
      MISSING: "MISSING";
      FAIL: "FAIL";
    }>;
    result: z.ZodNullable<z.ZodObject<{
      resultId: z.ZodString;
      operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
      candidateRevision: z.ZodNumber;
      manifestHash: z.ZodString;
      item: z.ZodObject<{
        itemId: z.ZodString;
        itemHash: z.ZodString;
        kind: z.ZodEnum<{
          requirement: "requirement";
          "work-human": "work-human";
          "quality-human": "quality-human";
        }>;
        requirementIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "requirement", "out">>;
        subjectId: z.ZodString;
        checkId: z.ZodString;
        expected: z.ZodString;
      }, z.core.$strict>;
      previousResultId: z.ZodNullable<z.ZodString>;
      principalId: z.ZodString;
      verdict: z.ZodEnum<{
        PASS: "PASS";
        FAIL: "FAIL";
      }>;
      procedure: z.ZodString;
      expected: z.ZodString;
      observed: z.ZodString;
      evidence: z.ZodArray<z.ZodObject<{
        artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
        sha256: z.ZodString;
      }, z.core.$strict>>;
      createdAt: z.ZodISODateTime;
    }, z.core.$strict>>;
  }, z.core.$strict>>;
  automaticChecks: z.ZodArray<z.ZodObject<{
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    checkId: z.ZodString;
    status: z.ZodString;
    codes: z.ZodArray<z.ZodString>;
  }, z.core.$strict>>;
  rejections: z.ZodArray<z.ZodObject<{
    resultId: z.ZodString;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
    candidateRevision: z.ZodNumber;
    manifestHash: z.ZodString;
    rejectionId: z.ZodString;
    previousResultId: z.ZodNullable<z.ZodString>;
    classification: z.ZodEnum<{
      IN_SCOPE_DEFECT: "IN_SCOPE_DEFECT";
      SCOPE_CHANGE: "SCOPE_CHANGE";
    }>;
    state: z.ZodEnum<{
      OPEN: "OPEN";
      WITHDRAWN: "WITHDRAWN";
    }>;
    item: z.ZodNullable<z.ZodObject<{
      itemId: z.ZodString;
      itemHash: z.ZodString;
      kind: z.ZodEnum<{
        requirement: "requirement";
        "work-human": "work-human";
        "quality-human": "quality-human";
      }>;
      requirementIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "requirement", "out">>;
      subjectId: z.ZodString;
      checkId: z.ZodString;
      expected: z.ZodString;
    }, z.core.$strict>>;
    description: z.ZodString;
    reason: z.ZodString;
    evidence: z.ZodArray<z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
    }, z.core.$strict>>;
    principalId: z.ZodString;
    createdAt: z.ZodISODateTime;
    nextAction: z.ZodEnum<{
      REPAIR_REVIEW_REQUIRED: "REPAIR_REVIEW_REQUIRED";
      CHANGE_REVIEW_REQUIRED: "CHANGE_REVIEW_REQUIRED";
      NONE: "NONE";
    }>;
    applicationState: z.ZodLiteral<"NOT_APPLIED">;
  }, z.core.$strict>>;
  rejectionStatus: z.ZodEnum<{
    OPEN: "OPEN";
    NONE: "NONE";
  }>;
  canRecord: z.ZodBoolean;
  canPrepareAcceptance: z.ZodBoolean;
  canWithdrawRejections: z.ZodBoolean;
}, z.core.$strict>;
declare const candidateReviewEntry: z.ZodObject<{
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  codeCommit: z.ZodString;
  review: z.ZodObject<{
    candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
    candidateRevision: z.ZodNumber;
    manifestHash: z.ZodString;
    qualification: z.ZodEnum<{
      CURRENT: "CURRENT";
      STALE: "STALE";
    }>;
    resourceRevision: z.ZodNumber;
    automaticStatus: z.ZodLiteral<"PASS">;
    humanStatus: z.ZodEnum<{
      STALE: "STALE";
      PASS: "PASS";
      MISSING: "MISSING";
      FAIL: "FAIL";
    }>;
    reviewHash: z.ZodString;
    items: z.ZodArray<z.ZodObject<{
      itemId: z.ZodString;
      itemHash: z.ZodString;
      kind: z.ZodEnum<{
        requirement: "requirement";
        "work-human": "work-human";
        "quality-human": "quality-human";
      }>;
      requirementIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "requirement", "out">>;
      subjectId: z.ZodString;
      checkId: z.ZodString;
      expected: z.ZodString;
      status: z.ZodEnum<{
        STALE: "STALE";
        PASS: "PASS";
        MISSING: "MISSING";
        FAIL: "FAIL";
      }>;
      result: z.ZodNullable<z.ZodObject<{
        resultId: z.ZodString;
        operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
        candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
        candidateRevision: z.ZodNumber;
        manifestHash: z.ZodString;
        item: z.ZodObject<{
          itemId: z.ZodString;
          itemHash: z.ZodString;
          kind: z.ZodEnum<{
            requirement: "requirement";
            "work-human": "work-human";
            "quality-human": "quality-human";
          }>;
          requirementIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "requirement", "out">>;
          subjectId: z.ZodString;
          checkId: z.ZodString;
          expected: z.ZodString;
        }, z.core.$strict>;
        previousResultId: z.ZodNullable<z.ZodString>;
        principalId: z.ZodString;
        verdict: z.ZodEnum<{
          PASS: "PASS";
          FAIL: "FAIL";
        }>;
        procedure: z.ZodString;
        expected: z.ZodString;
        observed: z.ZodString;
        evidence: z.ZodArray<z.ZodObject<{
          artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
          sha256: z.ZodString;
        }, z.core.$strict>>;
        createdAt: z.ZodISODateTime;
      }, z.core.$strict>>;
    }, z.core.$strict>>;
    automaticChecks: z.ZodArray<z.ZodObject<{
      operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      checkId: z.ZodString;
      status: z.ZodString;
      codes: z.ZodArray<z.ZodString>;
    }, z.core.$strict>>;
    rejections: z.ZodArray<z.ZodObject<{
      resultId: z.ZodString;
      operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
      candidateRevision: z.ZodNumber;
      manifestHash: z.ZodString;
      rejectionId: z.ZodString;
      previousResultId: z.ZodNullable<z.ZodString>;
      classification: z.ZodEnum<{
        IN_SCOPE_DEFECT: "IN_SCOPE_DEFECT";
        SCOPE_CHANGE: "SCOPE_CHANGE";
      }>;
      state: z.ZodEnum<{
        OPEN: "OPEN";
        WITHDRAWN: "WITHDRAWN";
      }>;
      item: z.ZodNullable<z.ZodObject<{
        itemId: z.ZodString;
        itemHash: z.ZodString;
        kind: z.ZodEnum<{
          requirement: "requirement";
          "work-human": "work-human";
          "quality-human": "quality-human";
        }>;
        requirementIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "requirement", "out">>;
        subjectId: z.ZodString;
        checkId: z.ZodString;
        expected: z.ZodString;
      }, z.core.$strict>>;
      description: z.ZodString;
      reason: z.ZodString;
      evidence: z.ZodArray<z.ZodObject<{
        artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
        sha256: z.ZodString;
      }, z.core.$strict>>;
      principalId: z.ZodString;
      createdAt: z.ZodISODateTime;
      nextAction: z.ZodEnum<{
        REPAIR_REVIEW_REQUIRED: "REPAIR_REVIEW_REQUIRED";
        CHANGE_REVIEW_REQUIRED: "CHANGE_REVIEW_REQUIRED";
        NONE: "NONE";
      }>;
      applicationState: z.ZodLiteral<"NOT_APPLIED">;
    }, z.core.$strict>>;
    rejectionStatus: z.ZodEnum<{
      OPEN: "OPEN";
      NONE: "NONE";
    }>;
    canRecord: z.ZodBoolean;
    canPrepareAcceptance: z.ZodBoolean;
    canWithdrawRejections: z.ZodBoolean;
  }, z.core.$strict>;
}, z.core.$strict>;
declare const recordCandidateReviewInput: z.ZodObject<{
  manifestHash: z.ZodString;
  evidence: z.ZodArray<z.ZodObject<{
    artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
    sha256: z.ZodString;
  }, z.core.$strict>>;
  expected: z.ZodString;
  previousResultId: z.ZodNullable<z.ZodString>;
  verdict: z.ZodEnum<{
    PASS: "PASS";
    FAIL: "FAIL";
  }>;
  procedure: z.ZodString;
  observed: z.ZodString;
  itemId: z.ZodString;
  itemHash: z.ZodString;
}, z.core.$strict>;
declare const recordCandidateRejectionInput: z.ZodObject<{
  manifestHash: z.ZodString;
  reason: z.ZodString;
  description: z.ZodString;
  state: z.ZodEnum<{
    OPEN: "OPEN";
    WITHDRAWN: "WITHDRAWN";
  }>;
  evidence: z.ZodArray<z.ZodObject<{
    artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
    sha256: z.ZodString;
  }, z.core.$strict>>;
  previousResultId: z.ZodNullable<z.ZodString>;
  rejectionId: z.ZodString;
  classification: z.ZodEnum<{
    IN_SCOPE_DEFECT: "IN_SCOPE_DEFECT";
    SCOPE_CHANGE: "SCOPE_CHANGE";
  }>;
  itemId: z.ZodNullable<z.ZodString>;
  itemHash: z.ZodNullable<z.ZodString>;
}, z.core.$strict>;
declare const candidateReviewHistory: z.ZodObject<{
  items: z.ZodArray<z.ZodObject<{
    sequence: z.ZodNumber;
    result: z.ZodObject<{
      resultId: z.ZodString;
      operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
      candidateRevision: z.ZodNumber;
      manifestHash: z.ZodString;
      item: z.ZodObject<{
        itemId: z.ZodString;
        itemHash: z.ZodString;
        kind: z.ZodEnum<{
          requirement: "requirement";
          "work-human": "work-human";
          "quality-human": "quality-human";
        }>;
        requirementIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "requirement", "out">>;
        subjectId: z.ZodString;
        checkId: z.ZodString;
        expected: z.ZodString;
      }, z.core.$strict>;
      previousResultId: z.ZodNullable<z.ZodString>;
      principalId: z.ZodString;
      verdict: z.ZodEnum<{
        PASS: "PASS";
        FAIL: "FAIL";
      }>;
      procedure: z.ZodString;
      expected: z.ZodString;
      observed: z.ZodString;
      evidence: z.ZodArray<z.ZodObject<{
        artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
        sha256: z.ZodString;
      }, z.core.$strict>>;
      createdAt: z.ZodISODateTime;
    }, z.core.$strict>;
  }, z.core.$strict>>;
  nextSequence: z.ZodNullable<z.ZodNumber>;
}, z.core.$strict>;
declare const candidateRejectionHistory: z.ZodObject<{
  items: z.ZodArray<z.ZodObject<{
    sequence: z.ZodNumber;
    result: z.ZodObject<{
      resultId: z.ZodString;
      operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
      candidateRevision: z.ZodNumber;
      manifestHash: z.ZodString;
      rejectionId: z.ZodString;
      previousResultId: z.ZodNullable<z.ZodString>;
      classification: z.ZodEnum<{
        IN_SCOPE_DEFECT: "IN_SCOPE_DEFECT";
        SCOPE_CHANGE: "SCOPE_CHANGE";
      }>;
      state: z.ZodEnum<{
        OPEN: "OPEN";
        WITHDRAWN: "WITHDRAWN";
      }>;
      item: z.ZodNullable<z.ZodObject<{
        itemId: z.ZodString;
        itemHash: z.ZodString;
        kind: z.ZodEnum<{
          requirement: "requirement";
          "work-human": "work-human";
          "quality-human": "quality-human";
        }>;
        requirementIds: z.ZodArray<z.core.$ZodBranded<z.ZodString, "requirement", "out">>;
        subjectId: z.ZodString;
        checkId: z.ZodString;
        expected: z.ZodString;
      }, z.core.$strict>>;
      description: z.ZodString;
      reason: z.ZodString;
      evidence: z.ZodArray<z.ZodObject<{
        artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
        sha256: z.ZodString;
      }, z.core.$strict>>;
      principalId: z.ZodString;
      createdAt: z.ZodISODateTime;
      nextAction: z.ZodEnum<{
        REPAIR_REVIEW_REQUIRED: "REPAIR_REVIEW_REQUIRED";
        CHANGE_REVIEW_REQUIRED: "CHANGE_REVIEW_REQUIRED";
        NONE: "NONE";
      }>;
      applicationState: z.ZodLiteral<"NOT_APPLIED">;
    }, z.core.$strict>;
  }, z.core.$strict>>;
  nextSequence: z.ZodNullable<z.ZodNumber>;
}, z.core.$strict>;
//#endregion
//#region src/release-acceptance.d.ts
declare const acceptanceCandidateBasis: z.ZodObject<{
  candidateRevision: z.ZodNumber;
  manifestHash: z.ZodString;
  reviewHash: z.ZodString;
  expectedAcceptedReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
  dataPlanHash: z.ZodString;
}, z.core.$strict>;
declare const beginAcceptanceInput: z.ZodObject<{
  candidateRevision: z.ZodNumber;
  manifestHash: z.ZodString;
  reviewHash: z.ZodString;
  expectedAcceptedReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
  dataPlanHash: z.ZodString;
  policyHash: z.ZodString;
}, z.core.$strict>;
declare const confirmAcceptanceReplacementInput: z.ZodObject<{
  candidateRevision: z.ZodNumber;
  manifestHash: z.ZodString;
  reviewHash: z.ZodString;
  expectedAcceptedReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
  dataPlanHash: z.ZodString;
  decisionId: z.core.$ZodBranded<z.ZodString, "decision", "out">;
  confirmation: z.ZodLiteral<"REPLACE_ACCEPTED_DATA">;
}, z.core.$strict>;
declare const closeUnsentAcceptanceInput: z.ZodObject<{
  requestHash: z.ZodString;
}, z.core.$strict>;
declare const abortAcceptanceInput: z.ZodObject<{
  requestHash: z.ZodString;
  expectedPreparationRevision: z.ZodNumber;
  reason: z.ZodString;
  confirmation: z.ZodLiteral<"ABORT_ACCEPTANCE_PREPARATION">;
}, z.core.$strict>;
declare const acceptCandidateInput: z.ZodObject<{
  candidateRevision: z.ZodNumber;
  manifestHash: z.ZodString;
  reviewHash: z.ZodString;
  expectedAcceptedReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
  dataPlanHash: z.ZodString;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  preparationOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  requestHash: z.ZodString;
  expectedPreparationRevision: z.ZodNumber;
  expectedObservationSequence: z.ZodNumber;
  proofHash: z.ZodString;
  confirmation: z.ZodLiteral<"ACCEPT_RELEASE">;
}, z.core.$strict>;
declare const acceptanceBasisView: z.ZodObject<{
  candidateRevision: z.ZodNumber;
  manifestHash: z.ZodString;
  reviewHash: z.ZodString;
  expectedAcceptedReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
  dataPlanHash: z.ZodString;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
  codeCommit: z.ZodString;
  dataPlan: z.ZodDiscriminatedUnion<[z.ZodObject<{
    strategy: z.ZodLiteral<"INITIAL">;
    initialData: z.ZodEnum<{
      EMPTY: "EMPTY";
      DEMO: "DEMO";
    }>;
    sourceReleaseId: z.ZodNull;
    migrationRef: z.ZodNull;
    replacementDecisionId: z.ZodNull;
    schemaVersion: z.ZodLiteral<"devmesh.data-plan.v1">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    codeCommit: z.ZodString;
    requirementRevision: z.ZodNumber;
    planRevision: z.ZodNumber;
    templateVersion: z.ZodString;
    checkConfigHash: z.ZodString;
  }, z.core.$strict>, z.ZodObject<{
    strategy: z.ZodLiteral<"PRESERVE_MIGRATE">;
    initialData: z.ZodNull;
    sourceReleaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
    migrationRef: z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
    }, z.core.$strict>;
    replacementDecisionId: z.ZodNull;
    schemaVersion: z.ZodLiteral<"devmesh.data-plan.v1">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    codeCommit: z.ZodString;
    requirementRevision: z.ZodNumber;
    planRevision: z.ZodNumber;
    templateVersion: z.ZodString;
    checkConfigHash: z.ZodString;
  }, z.core.$strict>, z.ZodObject<{
    strategy: z.ZodLiteral<"REPLACE">;
    initialData: z.ZodEnum<{
      EMPTY: "EMPTY";
      DEMO: "DEMO";
    }>;
    sourceReleaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
    migrationRef: z.ZodNull;
    replacementDecisionId: z.core.$ZodBranded<z.ZodString, "decision", "out">;
    schemaVersion: z.ZodLiteral<"devmesh.data-plan.v1">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    codeCommit: z.ZodString;
    requirementRevision: z.ZodNumber;
    planRevision: z.ZodNumber;
    templateVersion: z.ZodString;
    checkConfigHash: z.ZodString;
  }, z.core.$strict>], "strategy">;
  currentAcceptedReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
  resourceRevision: z.ZodNumber;
  qualification: z.ZodEnum<{
    CURRENT: "CURRENT";
    STALE: "STALE";
  }>;
  configured: z.ZodBoolean;
  policyHash: z.ZodNullable<z.ZodString>;
  replacementConfirmed: z.ZodBoolean;
  blockedByPreparationOperationId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "op", "out">>;
  canManage: z.ZodBoolean;
  canPrepare: z.ZodBoolean;
  canConfirmReplacement: z.ZodBoolean;
  reason: z.ZodNullable<z.ZodEnum<{
    NOT_OWNER: "NOT_OWNER";
    REVIEW_REQUIRED: "REVIEW_REQUIRED";
    CANDIDATE_STALE: "CANDIDATE_STALE";
    SOURCE_CHANGED: "SOURCE_CHANGED";
    BACKEND_UNAVAILABLE: "BACKEND_UNAVAILABLE";
    REPLACEMENT_CONFIRMATION_REQUIRED: "REPLACEMENT_CONFIRMATION_REQUIRED";
    PREPARATION_UNRESOLVED: "PREPARATION_UNRESOLVED";
    EFFECT_UNRESOLVED: "EFFECT_UNRESOLVED";
  }>>;
}, z.core.$strict>;
declare const acceptancePreparationView: z.ZodObject<{
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
  releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
  requestHash: z.ZodString;
  revision: z.ZodNumber;
  state: z.ZodEnum<{
    FAILED: "FAILED";
    PREPARED: "PREPARED";
    SENT: "SENT";
    UNKNOWN: "UNKNOWN";
  }>;
  resolution: z.ZodEnum<{
    UNRESOLVED: "UNRESOLVED";
    UNSENT_FAILED: "UNSENT_FAILED";
    COMMITTED: "COMMITTED";
    ABORTING: "ABORTING";
    ABORTED: "ABORTED";
  }>;
  qualification: z.ZodEnum<{
    CURRENT: "CURRENT";
    STALE: "STALE";
  }>;
  basis: z.ZodObject<{
    candidateRevision: z.ZodNumber;
    manifestHash: z.ZodString;
    reviewHash: z.ZodString;
    expectedAcceptedReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
    dataPlanHash: z.ZodString;
  }, z.core.$strict>;
  createdAt: z.ZodISODateTime;
  updatedAt: z.ZodISODateTime;
  acceptanceOperationId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "op", "out">>;
  readiness: z.ZodObject<{
    state: z.ZodEnum<{
      STALE: "STALE";
      READY: "READY";
      UNPREPARED: "UNPREPARED";
      UNAVAILABLE: "UNAVAILABLE";
    }>;
    sequence: z.ZodNumber;
    proofHash: z.ZodNullable<z.ZodString>;
    checkedAt: z.ZodNullable<z.ZodISODateTime>;
  }, z.core.$strict>;
  resourceRevision: z.ZodNumber;
  canCommit: z.ZodBoolean;
  canCloseUnsent: z.ZodBoolean;
  canAbort: z.ZodBoolean;
}, z.core.$strict>;
declare const acceptancePreparationList: z.ZodObject<{
  items: z.ZodArray<z.ZodObject<{
    sequence: z.ZodNumber;
    preparation: z.ZodObject<{
      operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
      candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
      releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
      requestHash: z.ZodString;
      revision: z.ZodNumber;
      state: z.ZodEnum<{
        FAILED: "FAILED";
        PREPARED: "PREPARED";
        SENT: "SENT";
        UNKNOWN: "UNKNOWN";
      }>;
      resolution: z.ZodEnum<{
        UNRESOLVED: "UNRESOLVED";
        UNSENT_FAILED: "UNSENT_FAILED";
        COMMITTED: "COMMITTED";
        ABORTING: "ABORTING";
        ABORTED: "ABORTED";
      }>;
      qualification: z.ZodEnum<{
        CURRENT: "CURRENT";
        STALE: "STALE";
      }>;
      basis: z.ZodObject<{
        candidateRevision: z.ZodNumber;
        manifestHash: z.ZodString;
        reviewHash: z.ZodString;
        expectedAcceptedReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
        dataPlanHash: z.ZodString;
      }, z.core.$strict>;
      createdAt: z.ZodISODateTime;
      updatedAt: z.ZodISODateTime;
      acceptanceOperationId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "op", "out">>;
      readiness: z.ZodObject<{
        state: z.ZodEnum<{
          STALE: "STALE";
          READY: "READY";
          UNPREPARED: "UNPREPARED";
          UNAVAILABLE: "UNAVAILABLE";
        }>;
        sequence: z.ZodNumber;
        proofHash: z.ZodNullable<z.ZodString>;
        checkedAt: z.ZodNullable<z.ZodISODateTime>;
      }, z.core.$strict>;
      resourceRevision: z.ZodNumber;
      canCommit: z.ZodBoolean;
      canCloseUnsent: z.ZodBoolean;
      canAbort: z.ZodBoolean;
    }, z.core.$strict>;
  }, z.core.$strict>>;
  nextSequence: z.ZodNullable<z.ZodNumber>;
}, z.core.$strict>;
declare const acceptanceReplacementReceipt: z.ZodObject<{
  decisionId: z.core.$ZodBranded<z.ZodString, "decision", "out">;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
}, z.core.$strict>;
declare const acceptanceAbortReceipt: z.ZodObject<{
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  preparationOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  decisionHash: z.ZodString;
  reason: z.ZodString;
  decidedAt: z.ZodISODateTime;
  decisionState: z.ZodLiteral<"RECORDED">;
}, z.core.$strict>;
declare const acceptedReleaseView: z.ZodObject<{
  releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
  candidateRevision: z.ZodNumber;
  manifestHash: z.ZodString;
  reviewHash: z.ZodString;
  preparationOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  acceptanceOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  requestHash: z.ZodString;
  proofHash: z.ZodString;
  datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
  previousReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
  acceptedBy: z.ZodString;
  acceptedAt: z.ZodISODateTime;
  acceptanceState: z.ZodLiteral<"ACCEPTED">;
  publicationState: z.ZodLiteral<"PENDING">;
}, z.core.$strict>;
declare const acceptanceCommitReceipt: z.ZodObject<{
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  status: z.ZodLiteral<"SUCCEEDED">;
  result: z.ZodObject<{
    releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
    candidateRevision: z.ZodNumber;
    manifestHash: z.ZodString;
    reviewHash: z.ZodString;
    preparationOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    acceptanceOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    requestHash: z.ZodString;
    proofHash: z.ZodString;
    datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
    previousReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
    acceptedBy: z.ZodString;
    acceptedAt: z.ZodISODateTime;
    acceptanceState: z.ZodLiteral<"ACCEPTED">;
    publicationState: z.ZodLiteral<"PENDING">;
  }, z.core.$strict>;
  links: z.ZodObject<{
    preparation: z.ZodString;
  }, z.core.$strict>;
}, z.core.$strict>;
//#endregion
export { AttemptId, CandidatePreviewWorkspace, Command, ContentBasis, ContractError, DeliveryDataPlan, DomainEvent, Draft, ErrorCode, ExecutionOwner, ExecutionPermit, InvocationAttemptId, InvocationId, PipelineDefinition, PlanFacts, PlanIssue, PreparationProfile, PreviewEntryView, ProjectId, QualityEvaluation, QualityExecution, QualityPolicy, QualityReport, QualitySourceScope, ReleaseDeliveryPolicy, ReleaseEntryView, ResourceRequest, RoleOutput, RunId, UnderstandingOutput, WorkRevision, a2aTaskState, abortAcceptanceInput, acceptCandidateInput, acceptanceAbortReceipt, acceptanceBasisView, acceptanceCandidateBasis, acceptanceCommitReceipt, acceptancePreparationList, acceptancePreparationView, acceptanceReplacementReceipt, acceptedReleaseView, answerQuestionsInput, architectOutput, artifactRef, assertContentBasis, assertPermit, assertResourceVersion, attachmentIds, attachmentName, attachmentView, attemptState, beginAcceptanceInput, candidateHumanResult, candidatePreviewWorkspace, candidateRejectionHistory, candidateRejectionResult, candidateReviewEntry, candidateReviewHistory, candidateReviewItem, candidateReviewView, closeUnsentAcceptanceInput, command, commandBodies, commandRoutes, commandTarget, completionCheck, confirmAcceptanceReplacementInput, contentBasis, controlGate, createOpenApiDocument, createPreviewDatasetInput, createPreviewIntentInput, createProjectInput, createReleaseExportInput, createTaskInput, deliveryDataPlan, developerOutput, domainEvent, ephemeralTokenDelta, epoch, errorCode, errorEnvelope, eventPayloads, executionOwner, executionPermit, gitCommit, idempotencyKey, ids, initialInput, inputLimits, inputManifest, inputOperation, inputOperationLookup, inputText, inspectPlan, invocationDelegation, invocationOwner, invocationState, jobState, nonemptyText, opaqueKey, operationReceipt, operationStatus, parseContract, pipelineDefinition, pipelineStage, planDraft, planIssue, planReviewView, preparationDelegation, preparationInput, preparationProfile, preparationQuestion, preparationRole, preparationSource, previewAccessInput, previewAccessTicket, previewDatasetManagement, previewEntryView, previewImageConfig, previewImageIdentity, previewImageLimits, previewImageManifest, previewManagement, productOutput, projectName, protocolTaskId, qualityBranch, qualityCheckStatus, qualityEvaluation, qualityExecution, qualityLimits, qualityLocation, qualityPath, qualityPolicy, qualityProducer, qualityReport, qualitySourceFile, qualitySourceScope, qualityTestIdentity, question, recordCandidateRejectionInput, recordCandidateReviewInput, relativeFile, releaseAccessInput, releaseAccessTicket, releaseDeliveryPolicy, releaseDeliveryProfile, releaseEntryView, releaseExportEntryView, releaseExportListView, releaseExportView, requirement, retryReleaseExportInput, retryUnderstandingInput, revision, role, roleOutput, runPhase, runState, saveMessageInput, schemas, sha256, sourceRef, stopPreviewIntentInput, strongETag, taskTitle, terminalOutcome, testerOutput, timestamp, understandingOutput, understandingView, uploadMetadata, workDelegation, workRevision, workbenchCandidateSummary, workbenchDeliveryView, workbenchSourceView, workflowOwner, workspaceView };
//# sourceMappingURL=index.d.ts.map