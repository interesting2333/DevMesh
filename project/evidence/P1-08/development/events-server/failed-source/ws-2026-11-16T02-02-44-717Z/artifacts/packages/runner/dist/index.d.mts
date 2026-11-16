import { z } from "zod";
import { AcceptanceAbortFinalization, AcceptanceAbortFinalization as AcceptanceAbortFinalization$1, AcceptanceAbortRecord, AcceptanceAbortRecoveryBackend, AcceptanceAbortRecoveryResults, AcceptancePreparation, AcceptancePreparationBackend, AcceptancePreparationObservation, AcceptancePreparationRequest, AcceptancePreparedProof, DatasetPreparationBackend, DatasetPreparationObservation, PreviewAccessRecord, PreviewEffect, PreviewExecutionBackend, PreviewExecutionResult, PreviewStartRequest, ReleaseAccessRecord, ReleaseAccessTarget, ReleasePublication, ReleasePublicationBackend, ReleasePublicationObservation, ReleasePublicationProof, SqliteStorage, acceptanceAbortSourceRecovery, acceptanceDatasetAbortProof, acceptanceDatasetAbortProof as acceptanceDatasetAbortProof$1, acceptanceDatasetAbortReceipt, acceptanceDatasetAbortRequest, acceptanceDatasetFences, releaseRouteBinding } from "@devmesh/storage-sqlite";
import { DatabaseSync } from "node:sqlite";
import { AddressInfo } from "node:net";

//#region src/protocol.d.ts
declare class RunnerError extends Error {
  readonly code: string;
  readonly status: number;
  readonly outcome: 'not-sent' | 'known' | 'unknown';
  constructor(code: string, status: number, outcome?: 'not-sent' | 'known' | 'unknown');
}
declare const imageDigest: z.ZodString;
declare const commandSpec: z.ZodObject<{
  kind: z.ZodEnum<{
    install: "install";
    build: "build";
    unit: "unit";
    e2e: "e2e";
    preview: "preview";
  }>;
}, z.core.$strict>;
declare const resourceLimits: z.ZodObject<{
  cpu: z.ZodNumber;
  memoryMiB: z.ZodNumber;
  pids: z.ZodNumber;
  temporaryMiB: z.ZodNumber;
  timeoutMs: z.ZodNumber;
}, z.core.$strict>;
declare const startJob: z.ZodObject<{
  schemaVersion: z.ZodLiteral<"devmesh.runner-job.v1">;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  permit: z.ZodDiscriminatedUnion<[z.ZodObject<{
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
  imageDigest: z.ZodString;
  workspaceRef: z.ZodString;
  commandSpec: z.ZodObject<{
    kind: z.ZodEnum<{
      install: "install";
      build: "build";
      unit: "unit";
      e2e: "e2e";
      preview: "preview";
    }>;
  }, z.core.$strict>;
  resourceLimits: z.ZodObject<{
    cpu: z.ZodNumber;
    memoryMiB: z.ZodNumber;
    pids: z.ZodNumber;
    temporaryMiB: z.ZodNumber;
    timeoutMs: z.ZodNumber;
  }, z.core.$strict>;
  networkPolicyRef: z.ZodString;
  outputSpec: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
declare const renewJob: z.ZodObject<{
  permit: z.ZodDiscriminatedUnion<[z.ZodObject<{
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
  sequence: z.ZodNumber;
}, z.core.$strict>;
type StartJob = z.output<typeof startJob>;
type RenewJob = z.output<typeof renewJob>;
type JobState = 'QUEUED' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'EXITED' | 'OUTCOME_UNKNOWN';
interface Job {
  jobId: string;
  controllerId: string;
  operationId: string;
  requestHash: string;
  request: StartJob;
  /** Hash of the immutable approved argv; never includes the host workspace path. */
  executionProfile?: {
    runnerId: string;
    commandHash: string;
  } | null;
  state: JobState;
  containerId: string | null;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  exitCode: number | null;
  stopRequested: boolean;
  stopEvidence: Record<string, unknown> | null;
  errorCode: string | null;
  leaseSequence: number;
  lastHeartbeat: string;
  logCursor: number;
  outputRefs: {
    path: string;
    sha256: string;
    byteSize: number;
  }[];
}
interface ContainerFact {
  containerId: string;
  state: 'created' | 'running' | 'exited' | 'unknown';
  pid: number | null;
  exitCode: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  labels: Record<string, string>;
}
interface ExecutionBackend {
  readonly configured: boolean;
  probe(): Promise<void>;
  start(job: Job, workspacePath: string, argv: readonly string[], authorize: () => Promise<boolean>): Promise<ContainerFact>;
  inspect(job: Job): Promise<ContainerFact | null>;
  stop(job: Job): Promise<ContainerFact | null>;
  logs(job: Job): Promise<Uint8Array>;
}
interface RunnerAuthority {
  /** Must check current committed grant/epochs and service caller scopes. */
  verify(controllerId: string, request: StartJob, permit: StartJob['permit']): Promise<void>;
  /** Required only for managed workspace fencing; must check the current grant. */
  verifyWorkspace?(controllerId: string, permit: StartJob['permit'], workspaceRef: string): Promise<void>;
  /** Separate original-operation cleanup authority; cannot authorize new execution or edits. */
  verifyWorkspaceCleanup?(controllerId: string, permit: StartJob['permit'], workspaceRef: string, parentOperationId: string): Promise<void>;
}
declare const ownerKey: (p: StartJob["permit"]) => string;
declare const attemptKey: (p: StartJob["permit"]) => (string & z.core.$brand<"attempt">) | (string & z.core.$brand<"iattempt">);
//#endregion
//#region src/workspace-fence.d.ts
declare const workspaceBindingSchema: z.ZodObject<{
  attemptId: z.ZodString;
  ownerKind: z.ZodEnum<{
    workflowAttempt: "workflowAttempt";
    invocationAttempt: "invocationAttempt";
  }>;
  resourceId: z.ZodString;
  relativePath: z.ZodString;
  sourceDirectory: z.ZodOptional<z.ZodLiteral<"repo">>;
}, z.core.$strict>;
type WorkspaceBinding = z.output<typeof workspaceBindingSchema>;
declare const acquireWorkspaceFence: z.ZodObject<{
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  parentOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  workspaceRef: z.ZodString;
  permit: z.ZodDiscriminatedUnion<[z.ZodObject<{
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
  holderToken: z.ZodUUID;
  purpose: z.ZodOptional<z.ZodEnum<{
    write: "write";
    cleanup: "cleanup";
  }>>;
}, z.core.$strict>;
type AcquireWorkspaceFence = z.output<typeof acquireWorkspaceFence>;
declare const releaseWorkspaceFence: z.ZodObject<{
  holderToken: z.ZodUUID;
  requestHash: z.ZodString;
}, z.core.$strict>;
declare const workspaceFenceSchema: z.ZodObject<{
  fenceId: z.ZodString;
  controllerId: z.ZodString;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  workspaceRef: z.ZodString;
  workspacePath: z.ZodString;
  holderToken: z.ZodUUID;
  requestHash: z.ZodString;
  request: z.ZodObject<{
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    parentOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    workspaceRef: z.ZodString;
    permit: z.ZodDiscriminatedUnion<[z.ZodObject<{
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
    holderToken: z.ZodUUID;
    purpose: z.ZodOptional<z.ZodEnum<{
      write: "write";
      cleanup: "cleanup";
    }>>;
  }, z.core.$strict>;
  state: z.ZodEnum<{
    ACTIVE: "ACTIVE";
    RELEASED: "RELEASED";
  }>;
  createdAt: z.ZodISODateTime;
  releasedAt: z.ZodNullable<z.ZodISODateTime>;
}, z.core.$strict>;
type WorkspaceFence = z.output<typeof workspaceFenceSchema>;
//#endregion
//#region src/client.d.ts
declare class RunnerClient {
  readonly credentialRef: string;
  readonly credentials: (ref: string) => Promise<string | undefined>;
  readonly timeoutMs: number;
  readonly base: URL;
  constructor(endpoint: string, credentialRef: string, credentials: (ref: string) => Promise<string | undefined>, timeoutMs?: number);
  private request;
  start(input: StartJob): Promise<Job>;
  get(jobId: string): Promise<Job>;
  byOperation(operationId: string): Promise<Job>;
  stop(jobId: string): Promise<Job>;
  renew(jobId: string, input: RenewJob): Promise<Job>;
  private decodeFence;
  acquireWorkspaceFence(input: AcquireWorkspaceFence): Promise<{
    fenceId: string;
    controllerId: string;
    operationId: string & z.core.$brand<"op">;
    workspaceRef: string;
    workspacePath: string;
    holderToken: string;
    requestHash: string;
    request: {
      operationId: string & z.core.$brand<"op">;
      parentOperationId: string & z.core.$brand<"op">;
      workspaceRef: string;
      permit: {
        ownerKind: "workflowAttempt";
        runId: string & z.core.$brand<"run">;
        runEpoch: number;
        workId: string & z.core.$brand<"work">;
        workEpoch: number;
        attemptId: string & z.core.$brand<"attempt">;
        resources: {
          resourceId: string;
          access: "read" | "write";
          kind: "dataset" | "snapshot" | "workspace" | "projectRepository";
        }[];
        schemaVersion: "devmesh.permit.v1";
        grantId: string & z.core.$brand<"grant">;
        activationId: string & z.core.$brand<"activation">;
        notBefore: string;
        expiresAt: string;
      } | {
        ownerKind: "invocationAttempt";
        invocationId: string & z.core.$brand<"invocation">;
        invocationEpoch: number;
        invocationAttemptId: string & z.core.$brand<"iattempt">;
        resources: ({
          kind: "snapshot";
          resourceId: string;
          access: "read";
        } | {
          resourceId: string;
          access: "read" | "write";
          kind: "workspace";
        })[];
        schemaVersion: "devmesh.permit.v1";
        grantId: string & z.core.$brand<"grant">;
        activationId: string & z.core.$brand<"activation">;
        notBefore: string;
        expiresAt: string;
      };
      holderToken: string;
      purpose?: "write" | "cleanup" | undefined;
    };
    state: "ACTIVE" | "RELEASED";
    createdAt: string;
    releasedAt: string | null;
  }>;
  getWorkspaceFence(fenceId: string): Promise<{
    fenceId: string;
    controllerId: string;
    operationId: string & z.core.$brand<"op">;
    workspaceRef: string;
    workspacePath: string;
    holderToken: string;
    requestHash: string;
    request: {
      operationId: string & z.core.$brand<"op">;
      parentOperationId: string & z.core.$brand<"op">;
      workspaceRef: string;
      permit: {
        ownerKind: "workflowAttempt";
        runId: string & z.core.$brand<"run">;
        runEpoch: number;
        workId: string & z.core.$brand<"work">;
        workEpoch: number;
        attemptId: string & z.core.$brand<"attempt">;
        resources: {
          resourceId: string;
          access: "read" | "write";
          kind: "dataset" | "snapshot" | "workspace" | "projectRepository";
        }[];
        schemaVersion: "devmesh.permit.v1";
        grantId: string & z.core.$brand<"grant">;
        activationId: string & z.core.$brand<"activation">;
        notBefore: string;
        expiresAt: string;
      } | {
        ownerKind: "invocationAttempt";
        invocationId: string & z.core.$brand<"invocation">;
        invocationEpoch: number;
        invocationAttemptId: string & z.core.$brand<"iattempt">;
        resources: ({
          kind: "snapshot";
          resourceId: string;
          access: "read";
        } | {
          resourceId: string;
          access: "read" | "write";
          kind: "workspace";
        })[];
        schemaVersion: "devmesh.permit.v1";
        grantId: string & z.core.$brand<"grant">;
        activationId: string & z.core.$brand<"activation">;
        notBefore: string;
        expiresAt: string;
      };
      holderToken: string;
      purpose?: "write" | "cleanup" | undefined;
    };
    state: "ACTIVE" | "RELEASED";
    createdAt: string;
    releasedAt: string | null;
  }>;
  workspaceFenceByOperation(operationId: string): Promise<{
    fenceId: string;
    controllerId: string;
    operationId: string & z.core.$brand<"op">;
    workspaceRef: string;
    workspacePath: string;
    holderToken: string;
    requestHash: string;
    request: {
      operationId: string & z.core.$brand<"op">;
      parentOperationId: string & z.core.$brand<"op">;
      workspaceRef: string;
      permit: {
        ownerKind: "workflowAttempt";
        runId: string & z.core.$brand<"run">;
        runEpoch: number;
        workId: string & z.core.$brand<"work">;
        workEpoch: number;
        attemptId: string & z.core.$brand<"attempt">;
        resources: {
          resourceId: string;
          access: "read" | "write";
          kind: "dataset" | "snapshot" | "workspace" | "projectRepository";
        }[];
        schemaVersion: "devmesh.permit.v1";
        grantId: string & z.core.$brand<"grant">;
        activationId: string & z.core.$brand<"activation">;
        notBefore: string;
        expiresAt: string;
      } | {
        ownerKind: "invocationAttempt";
        invocationId: string & z.core.$brand<"invocation">;
        invocationEpoch: number;
        invocationAttemptId: string & z.core.$brand<"iattempt">;
        resources: ({
          kind: "snapshot";
          resourceId: string;
          access: "read";
        } | {
          resourceId: string;
          access: "read" | "write";
          kind: "workspace";
        })[];
        schemaVersion: "devmesh.permit.v1";
        grantId: string & z.core.$brand<"grant">;
        activationId: string & z.core.$brand<"activation">;
        notBefore: string;
        expiresAt: string;
      };
      holderToken: string;
      purpose?: "write" | "cleanup" | undefined;
    };
    state: "ACTIVE" | "RELEASED";
    createdAt: string;
    releasedAt: string | null;
  }>;
  activeWorkspaceFence(workspaceRef: string): Promise<{
    fenceId: string;
    controllerId: string;
    operationId: string & z.core.$brand<"op">;
    workspaceRef: string;
    workspacePath: string;
    holderToken: string;
    requestHash: string;
    request: {
      operationId: string & z.core.$brand<"op">;
      parentOperationId: string & z.core.$brand<"op">;
      workspaceRef: string;
      permit: {
        ownerKind: "workflowAttempt";
        runId: string & z.core.$brand<"run">;
        runEpoch: number;
        workId: string & z.core.$brand<"work">;
        workEpoch: number;
        attemptId: string & z.core.$brand<"attempt">;
        resources: {
          resourceId: string;
          access: "read" | "write";
          kind: "dataset" | "snapshot" | "workspace" | "projectRepository";
        }[];
        schemaVersion: "devmesh.permit.v1";
        grantId: string & z.core.$brand<"grant">;
        activationId: string & z.core.$brand<"activation">;
        notBefore: string;
        expiresAt: string;
      } | {
        ownerKind: "invocationAttempt";
        invocationId: string & z.core.$brand<"invocation">;
        invocationEpoch: number;
        invocationAttemptId: string & z.core.$brand<"iattempt">;
        resources: ({
          kind: "snapshot";
          resourceId: string;
          access: "read";
        } | {
          resourceId: string;
          access: "read" | "write";
          kind: "workspace";
        })[];
        schemaVersion: "devmesh.permit.v1";
        grantId: string & z.core.$brand<"grant">;
        activationId: string & z.core.$brand<"activation">;
        notBefore: string;
        expiresAt: string;
      };
      holderToken: string;
      purpose?: "write" | "cleanup" | undefined;
    };
    state: "ACTIVE" | "RELEASED";
    createdAt: string;
    releasedAt: string | null;
  }>;
  releaseWorkspaceFence(fenceId: string, input: z.input<typeof releaseWorkspaceFence>): Promise<{
    fenceId: string;
    controllerId: string;
    operationId: string & z.core.$brand<"op">;
    workspaceRef: string;
    workspacePath: string;
    holderToken: string;
    requestHash: string;
    request: {
      operationId: string & z.core.$brand<"op">;
      parentOperationId: string & z.core.$brand<"op">;
      workspaceRef: string;
      permit: {
        ownerKind: "workflowAttempt";
        runId: string & z.core.$brand<"run">;
        runEpoch: number;
        workId: string & z.core.$brand<"work">;
        workEpoch: number;
        attemptId: string & z.core.$brand<"attempt">;
        resources: {
          resourceId: string;
          access: "read" | "write";
          kind: "dataset" | "snapshot" | "workspace" | "projectRepository";
        }[];
        schemaVersion: "devmesh.permit.v1";
        grantId: string & z.core.$brand<"grant">;
        activationId: string & z.core.$brand<"activation">;
        notBefore: string;
        expiresAt: string;
      } | {
        ownerKind: "invocationAttempt";
        invocationId: string & z.core.$brand<"invocation">;
        invocationEpoch: number;
        invocationAttemptId: string & z.core.$brand<"iattempt">;
        resources: ({
          kind: "snapshot";
          resourceId: string;
          access: "read";
        } | {
          resourceId: string;
          access: "read" | "write";
          kind: "workspace";
        })[];
        schemaVersion: "devmesh.permit.v1";
        grantId: string & z.core.$brand<"grant">;
        activationId: string & z.core.$brand<"activation">;
        notBefore: string;
        expiresAt: string;
      };
      holderToken: string;
      purpose?: "write" | "cleanup" | undefined;
    };
    state: "ACTIVE" | "RELEASED";
    createdAt: string;
    releasedAt: string | null;
  }>;
  logs(jobId: string, offset?: number, limit?: number): Promise<{
    jobId: string & z.core.$brand<"job">;
    offset: number;
    nextOffset: number;
    complete: boolean;
    data: string;
  }>;
  /** Read an original output by its recorded index; never accepts a remote path. */
  output(jobId: string, index: number, expected: {
    sha256: string;
    byteSize: number;
  }, maximumBytes?: number): Promise<Uint8Array>;
  private decode;
}
//#endregion
//#region src/policy.d.ts
interface RunnerPolicyConfig {
  runnerId: string;
  dataRoot: string;
  imageDigests: readonly string[];
  commands: Readonly<Partial<Record<StartJob['commandSpec']['kind'], readonly string[]>>>;
  maximumCpu: number;
  maximumMemoryMiB: number;
  maximumTemporaryMiB: number;
  workspaces: Readonly<Record<string, WorkspaceBinding>>;
}
declare class RunnerPolicy {
  readonly config: RunnerPolicyConfig;
  constructor(config: RunnerPolicyConfig);
  validate(input: unknown, stored?: WorkspaceBinding): Promise<{
    request: StartJob;
    workspacePath: string;
    argv: readonly string[];
  }>;
  private workspacePath;
  fence(input: AcquireWorkspaceFence, stored?: WorkspaceBinding): Promise<{
    binding: {
      attemptId: string;
      ownerKind: "workflowAttempt" | "invocationAttempt";
      resourceId: string;
      relativePath: string;
      sourceDirectory?: "repo" | undefined;
    };
    workspacePath: string;
  }>;
}
//#endregion
//#region src/preview-reservation.d.ts
/** Trusted Runner configuration, never an admission budget supplied by a project user. */
declare const runnerCapacity: z.ZodObject<{
  maximumJobs: z.ZodNumber;
  cpu: z.ZodNumber;
  memoryMiB: z.ZodNumber;
}, z.core.$strict>;
declare const previewResourceLimits: z.ZodObject<{
  cpu: z.ZodNumber;
  memoryMiB: z.ZodNumber;
  pids: z.ZodNumber;
  temporaryMiB: z.ZodNumber;
}, z.core.$strict>;
declare const previewReservationSchema: z.ZodObject<{
  reservationId: z.ZodString;
  controllerId: z.ZodString;
  request: z.ZodObject<{
    manifestHash: z.ZodString;
    storageKey: z.ZodString;
    datasetOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    templateVersion: z.ZodString;
    schemaRevision: z.ZodString;
    imageIdentity: z.ZodObject<{
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
    expiresAt: z.ZodISODateTime;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
    policyHash: z.ZodString;
    backendRef: z.ZodString;
    runnerId: z.ZodString;
    previewId: z.core.$ZodBranded<z.ZodString, "preview", "out">;
    datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
    imageDigest: z.ZodString;
    schemaVersion: z.ZodLiteral<"devmesh.preview-start.v1">;
  }, z.core.$strict>;
  requestHash: z.ZodString;
  resourceLimits: z.ZodObject<{
    cpu: z.ZodNumber;
    memoryMiB: z.ZodNumber;
    pids: z.ZodNumber;
    temporaryMiB: z.ZodNumber;
  }, z.core.$strict>;
  state: z.ZodEnum<{
    EXITED: "EXITED";
    ACTIVE: "ACTIVE";
    UNKNOWN: "UNKNOWN";
    REMOVED: "REMOVED";
    RESERVED: "RESERVED";
    DISPATCHED: "DISPATCHED";
    CANCELLED: "CANCELLED";
  }>;
  revision: z.ZodNumber;
  instanceId: z.ZodNullable<z.ZodString>;
  endpoint: z.ZodNullable<z.ZodObject<{
    host: z.ZodLiteral<"127.0.0.1">;
    port: z.ZodNumber;
  }, z.core.$strict>>;
  fact: z.ZodNullable<z.ZodObject<{
    previewId: z.core.$ZodBranded<z.ZodString, "preview", "out">;
    datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
    imageDigest: z.ZodString;
    state: z.ZodEnum<{
      EXITED: "EXITED";
      CREATED: "CREATED";
      HEALTHY: "HEALTHY";
      UNHEALTHY: "UNHEALTHY";
      UNKNOWN: "UNKNOWN";
      REMOVED: "REMOVED";
    }>;
    instanceId: z.ZodNullable<z.ZodString>;
    endpoint: z.ZodNullable<z.ZodObject<{
      host: z.ZodLiteral<"127.0.0.1">;
      port: z.ZodNumber;
    }, z.core.$strict>>;
    checkedAt: z.ZodISODateTime;
  }, z.core.$strict>>;
  createdAt: z.ZodISODateTime;
  updatedAt: z.ZodISODateTime;
  releasedAt: z.ZodNullable<z.ZodISODateTime>;
}, z.core.$strict>;
type RunnerCapacity = z.output<typeof runnerCapacity>;
type PreviewResourceLimits = z.output<typeof previewResourceLimits>;
type PreviewReservation = z.output<typeof previewReservationSchema>;
interface RunnerCapacityUsage {
  slots: number;
  cpu: number;
  memoryMiB: number;
  previewSlots: number;
  jobSlots: number;
  acceptanceServiceSlots: number;
  releaseServiceSlots: number;
}
//#endregion
//#region src/preview-container.d.ts
declare const previewContainerProfile: z.ZodObject<{
  schemaVersion: z.ZodLiteral<"devmesh.preview-container-profile.v1">;
  reservationId: z.ZodString;
  requestHash: z.ZodString;
  repository: z.ZodString;
  datasetDirectory: z.ZodString;
  datasetBytes: z.ZodNumber;
  resourceLimits: z.ZodObject<{
    cpu: z.ZodNumber;
    memoryMiB: z.ZodNumber;
    pids: z.ZodNumber;
    temporaryMiB: z.ZodNumber;
  }, z.core.$strict>;
  networkName: z.ZodString;
  containerName: z.ZodString;
}, z.core.$strict>;
declare const previewContainerActionSchema: z.ZodObject<{
  kind: z.ZodEnum<{
    STOP: "STOP";
    NETWORK_CREATE: "NETWORK_CREATE";
    CREATE: "CREATE";
    START: "START";
  }>;
  operationId: z.ZodString;
  requestHash: z.ZodString;
  request: z.ZodUnion<readonly [z.ZodObject<{
    manifestHash: z.ZodString;
    storageKey: z.ZodString;
    datasetOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    templateVersion: z.ZodString;
    schemaRevision: z.ZodString;
    imageIdentity: z.ZodObject<{
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
    expiresAt: z.ZodISODateTime;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
    policyHash: z.ZodString;
    backendRef: z.ZodString;
    runnerId: z.ZodString;
    previewId: z.core.$ZodBranded<z.ZodString, "preview", "out">;
    datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
    imageDigest: z.ZodString;
    schemaVersion: z.ZodLiteral<"devmesh.preview-start.v1">;
  }, z.core.$strict>, z.ZodObject<{
    startOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    startRequestHash: z.ZodString;
    instanceId: z.ZodString;
    reason: z.ZodEnum<{
      USER: "USER";
      EXPIRED: "EXPIRED";
    }>;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
    policyHash: z.ZodString;
    backendRef: z.ZodString;
    runnerId: z.ZodString;
    previewId: z.core.$ZodBranded<z.ZodString, "preview", "out">;
    datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
    imageDigest: z.ZodString;
    schemaVersion: z.ZodLiteral<"devmesh.preview-stop.v1">;
  }, z.core.$strict>]>;
  state: z.ZodEnum<{
    SENT: "SENT";
    OBSERVED: "OBSERVED";
  }>;
  observation: z.ZodNullable<z.ZodObject<{
    objectId: z.ZodString;
    state: z.ZodEnum<{
      RUNNING: "RUNNING";
      EXITED: "EXITED";
      CREATED: "CREATED";
    }>;
    checkedAt: z.ZodISODateTime;
  }, z.core.$strict>>;
  createdAt: z.ZodISODateTime;
  observedAt: z.ZodNullable<z.ZodISODateTime>;
}, z.core.$strict>;
type PreviewContainerProfile = z.output<typeof previewContainerProfile>;
type PreviewContainerActionRecord = z.output<typeof previewContainerActionSchema>;
interface PreviewContainerJournal {
  profile: PreviewContainerProfile;
  profileHash: string;
  networkId: string | null;
  containerId: string | null;
  actions: PreviewContainerActionRecord[];
}
declare function previewContainerNames(reservationId: string): {
  networkName: string;
  containerName: string;
};
interface PreviewContainerFact {
  containerId: string;
  networkId: string;
  state: 'created' | 'running' | 'exited' | 'unknown';
  pid: number;
  exitCode: number | null;
  endpoint: {
    host: '127.0.0.1';
    port: number;
  } | null;
}
interface PreviewContainerDriver {
  readonly configured: boolean;
  probe(request: PreviewStartRequest, repository: string): Promise<void>;
  prepare(profile: PreviewContainerProfile): Promise<void>;
  network(profile: PreviewContainerProfile, request: PreviewStartRequest): Promise<string | null>;
  createNetwork(profile: PreviewContainerProfile, request: PreviewStartRequest, authorize: () => Promise<boolean>): Promise<string>;
  inspect(profile: PreviewContainerProfile, request: PreviewStartRequest, networkId: string, containerId: string | null): Promise<PreviewContainerFact | null>;
  create(profile: PreviewContainerProfile, request: PreviewStartRequest, networkId: string, authorize: () => Promise<boolean>): Promise<PreviewContainerFact | null>;
  start(profile: PreviewContainerProfile, request: PreviewStartRequest, networkId: string, containerId: string, authorize: () => Promise<boolean>): Promise<PreviewContainerFact | null>;
  stop(profile: PreviewContainerProfile, request: PreviewStartRequest, networkId: string, containerId: string, authorize: () => Promise<boolean>): Promise<PreviewContainerFact | null>;
  containerAbsent(containerId: string): Promise<boolean>;
  networkAbsent(networkId: string): Promise<boolean>;
  removeContainer(profile: PreviewContainerProfile, request: PreviewStartRequest, networkId: string, containerId: string, authorize: () => Promise<boolean>): Promise<void>;
  removeNetwork(profile: PreviewContainerProfile, request: PreviewStartRequest, networkId: string, authorize: () => Promise<boolean>): Promise<void>;
}
//#endregion
//#region src/preview-lifecycle.d.ts
declare const previewReleaseClaim: z.ZodObject<{
  schemaVersion: z.ZodLiteral<"devmesh.preview-release-claim.v1">;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
  candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
  manifestHash: z.ZodString;
  previewId: z.core.$ZodBranded<z.ZodString, "preview", "out">;
  datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
  imageDigest: z.ZodString;
  startOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  startRequestHash: z.ZodString;
  instanceId: z.ZodString;
  acceptanceRequestHash: z.ZodString;
}, z.core.$strict>;
declare const runnerPreviewLifecycle: z.ZodObject<{
  reservationId: z.ZodString;
  requestHash: z.ZodString;
  state: z.ZodEnum<{
    STOPPING: "STOPPING";
    RELEASE_HELD: "RELEASE_HELD";
    RELEASE_OWNED: "RELEASE_OWNED";
    PREVIEW: "PREVIEW";
  }>;
  revision: z.ZodNumber;
  expiresAt: z.ZodISODateTime;
  expiredAt: z.ZodNullable<z.ZodISODateTime>;
  lastWallAt: z.ZodISODateTime;
  releaseClaim: z.ZodNullable<z.ZodObject<{
    schemaVersion: z.ZodLiteral<"devmesh.preview-release-claim.v1">;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
    candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
    manifestHash: z.ZodString;
    previewId: z.core.$ZodBranded<z.ZodString, "preview", "out">;
    datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
    imageDigest: z.ZodString;
    startOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    startRequestHash: z.ZodString;
    instanceId: z.ZodString;
    acceptanceRequestHash: z.ZodString;
  }, z.core.$strict>>;
  releaseClaimHash: z.ZodNullable<z.ZodString>;
  expiryRequest: z.ZodNullable<z.ZodObject<{
    startOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    startRequestHash: z.ZodString;
    instanceId: z.ZodString;
    reason: z.ZodEnum<{
      USER: "USER";
      EXPIRED: "EXPIRED";
    }>;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
    policyHash: z.ZodString;
    backendRef: z.ZodString;
    runnerId: z.ZodString;
    previewId: z.core.$ZodBranded<z.ZodString, "preview", "out">;
    datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
    imageDigest: z.ZodString;
    schemaVersion: z.ZodLiteral<"devmesh.preview-stop.v1">;
  }, z.core.$strict>>;
  expiryRequestHash: z.ZodNullable<z.ZodString>;
  createdAt: z.ZodISODateTime;
  updatedAt: z.ZodISODateTime;
}, z.core.$strict>;
type RunnerPreviewLifecycle = z.output<typeof runnerPreviewLifecycle>;
type PreviewReleaseClaim = z.output<typeof previewReleaseClaim>;
//#endregion
//#region src/preview-cleanup.d.ts
declare const previewCleanupKind: z.ZodEnum<{
  CONTAINER_REMOVE: "CONTAINER_REMOVE";
  NETWORK_REMOVE: "NETWORK_REMOVE";
}>;
declare const previewCleanupRequest: z.ZodObject<{
  schemaVersion: z.ZodLiteral<"devmesh.preview-cleanup.v1">;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  reservationId: z.ZodString;
  startRequestHash: z.ZodString;
  profileHash: z.ZodString;
  stopRequestHash: z.ZodString;
  containerId: z.ZodString;
  networkId: z.ZodString;
  kind: z.ZodEnum<{
    CONTAINER_REMOVE: "CONTAINER_REMOVE";
    NETWORK_REMOVE: "NETWORK_REMOVE";
  }>;
}, z.core.$strict>;
declare const previewCleanupObservation: z.ZodObject<{
  objectId: z.ZodString;
  absenceVerified: z.ZodLiteral<true>;
  checkedAt: z.ZodISODateTime;
}, z.core.$strict>;
declare const previewCleanupAction: z.ZodObject<{
  request: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"devmesh.preview-cleanup.v1">;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    reservationId: z.ZodString;
    startRequestHash: z.ZodString;
    profileHash: z.ZodString;
    stopRequestHash: z.ZodString;
    containerId: z.ZodString;
    networkId: z.ZodString;
    kind: z.ZodEnum<{
      CONTAINER_REMOVE: "CONTAINER_REMOVE";
      NETWORK_REMOVE: "NETWORK_REMOVE";
    }>;
  }, z.core.$strict>;
  requestHash: z.ZodString;
  state: z.ZodEnum<{
    SENT: "SENT";
    OBSERVED: "OBSERVED";
  }>;
  observation: z.ZodNullable<z.ZodObject<{
    objectId: z.ZodString;
    absenceVerified: z.ZodLiteral<true>;
    checkedAt: z.ZodISODateTime;
  }, z.core.$strict>>;
  createdAt: z.ZodISODateTime;
  observedAt: z.ZodNullable<z.ZodISODateTime>;
}, z.core.$strict>;
type PreviewCleanupKind = z.output<typeof previewCleanupKind>;
type PreviewCleanupAction = z.output<typeof previewCleanupAction>;
//#endregion
//#region src/service-docker.d.ts
type ServiceContainerFact = PreviewContainerFact;
//#endregion
//#region src/acceptance-service.d.ts
declare const acceptanceServiceRequest: z.ZodObject<{
  schemaVersion: z.ZodLiteral<"devmesh.acceptance-service-start.v1">;
  purpose: z.ZodLiteral<"ACCEPTANCE">;
  preparation: z.ZodObject<{
    runEpoch: z.ZodNumber;
    requirementRevision: z.ZodNumber;
    planRevision: z.ZodNumber;
    codeCommit: z.ZodString;
    image: z.ZodObject<{
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
    policyHash: z.ZodString;
    backendPrincipalId: z.ZodString;
    backendRef: z.ZodString;
    runnerId: z.ZodString;
    source: z.ZodNullable<z.ZodObject<{
      releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
      datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
      datasetOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      storageKey: z.ZodString;
      schemaRevision: z.ZodString;
    }, z.core.$strict>>;
    target: z.ZodObject<{
      datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
      storageKey: z.ZodString;
      schemaRevision: z.ZodString;
    }, z.core.$strict>;
    candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
    candidateRevision: z.ZodNumber;
    manifestHash: z.ZodString;
    reviewHash: z.ZodString;
    expectedAcceptedReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
    dataPlanHash: z.ZodString;
    schemaVersion: z.ZodLiteral<"devmesh.acceptance-prepare.v1">;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  }, z.core.$strict>;
  acceptanceRequestHash: z.ZodString;
  dataReceipt: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"devmesh.local-dataset-receipt.v2">;
    purpose: z.ZodLiteral<"ACCEPTANCE">;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    requestHash: z.ZodString;
    fencesHash: z.ZodString;
    data: z.ZodObject<{
      datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
      storageKey: z.ZodString;
      schemaRevision: z.ZodString;
      originDatasetId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "dataset", "out">>;
      sourceReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
      snapshotAt: z.ZodISODateTime;
      sha256: z.ZodString;
      byteSize: z.ZodNumber;
      integrity: z.ZodLiteral<"ok">;
      journalHash: z.ZodString;
      migrationRef: z.ZodNullable<z.ZodObject<{
        artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
        sha256: z.ZodString;
      }, z.core.$strict>>;
    }, z.core.$strict>;
  }, z.core.$strict>;
  fences: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"devmesh.local-dataset-fences.v1">;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    requestHash: z.ZodString;
    sourceFence: z.ZodNullable<z.ZodObject<{
      datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
      datasetOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      closeOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      closeRequestHash: z.ZodString;
      gateFence: z.ZodNumber;
      physical: z.ZodObject<{
        kind: z.ZodLiteral<"DURABLE_WRITE_FENCE">;
        fenceId: z.ZodString;
        generation: z.ZodNumber;
        proofHash: z.ZodString;
        heldAt: z.ZodISODateTime;
        state: z.ZodLiteral<"HELD">;
      }, z.core.$strict>;
    }, z.core.$strict>>;
    targetFence: z.ZodObject<{
      datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
      physical: z.ZodObject<{
        kind: z.ZodLiteral<"DURABLE_WRITE_FENCE">;
        fenceId: z.ZodString;
        generation: z.ZodNumber;
        proofHash: z.ZodString;
        heldAt: z.ZodISODateTime;
        state: z.ZodLiteral<"HELD">;
      }, z.core.$strict>;
      writeState: z.ZodLiteral<"CLOSED">;
    }, z.core.$strict>;
  }, z.core.$strict>;
}, z.core.$strict>;
declare const acceptanceServiceProfile: z.ZodObject<{
  resourceLimits: z.ZodObject<{
    cpu: z.ZodNumber;
    memoryMiB: z.ZodNumber;
    pids: z.ZodNumber;
    temporaryMiB: z.ZodNumber;
  }, z.core.$strict>;
  requestHash: z.ZodString;
  reservationId: z.ZodString;
  repository: z.ZodString;
  datasetDirectory: z.ZodString;
  datasetBytes: z.ZodNumber;
  networkName: z.ZodString;
  containerName: z.ZodString;
  schemaVersion: z.ZodLiteral<"devmesh.acceptance-service-profile.v1">;
  purpose: z.ZodLiteral<"ACCEPTANCE">;
  accessMode: z.ZodLiteral<"READ_ONLY">;
}, z.core.$strict>;
declare const acceptanceServiceFact: z.ZodObject<{
  operationId: z.ZodString;
  releaseId: z.ZodString;
  datasetId: z.ZodString;
  imageDigest: z.ZodString;
  state: z.ZodEnum<{
    EXITED: "EXITED";
    CREATED: "CREATED";
    HEALTHY: "HEALTHY";
    UNHEALTHY: "UNHEALTHY";
    UNKNOWN: "UNKNOWN";
  }>;
  instanceId: z.ZodNullable<z.ZodString>;
  endpoint: z.ZodNullable<z.ZodObject<{
    host: z.ZodLiteral<"127.0.0.1">;
    port: z.ZodNumber;
  }, z.core.$strict>>;
  checkedAt: z.ZodISODateTime;
}, z.core.$strict>;
declare const acceptanceServiceReservation: z.ZodObject<{
  purpose: z.ZodLiteral<"ACCEPTANCE">;
  reservationId: z.ZodString;
  controllerId: z.ZodString;
  request: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"devmesh.acceptance-service-start.v1">;
    purpose: z.ZodLiteral<"ACCEPTANCE">;
    preparation: z.ZodObject<{
      runEpoch: z.ZodNumber;
      requirementRevision: z.ZodNumber;
      planRevision: z.ZodNumber;
      codeCommit: z.ZodString;
      image: z.ZodObject<{
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
      policyHash: z.ZodString;
      backendPrincipalId: z.ZodString;
      backendRef: z.ZodString;
      runnerId: z.ZodString;
      source: z.ZodNullable<z.ZodObject<{
        releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
        datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
        datasetOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
        storageKey: z.ZodString;
        schemaRevision: z.ZodString;
      }, z.core.$strict>>;
      target: z.ZodObject<{
        datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
        storageKey: z.ZodString;
        schemaRevision: z.ZodString;
      }, z.core.$strict>;
      candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
      candidateRevision: z.ZodNumber;
      manifestHash: z.ZodString;
      reviewHash: z.ZodString;
      expectedAcceptedReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
      dataPlanHash: z.ZodString;
      schemaVersion: z.ZodLiteral<"devmesh.acceptance-prepare.v1">;
      operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
      projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
      runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    }, z.core.$strict>;
    acceptanceRequestHash: z.ZodString;
    dataReceipt: z.ZodObject<{
      schemaVersion: z.ZodLiteral<"devmesh.local-dataset-receipt.v2">;
      purpose: z.ZodLiteral<"ACCEPTANCE">;
      operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      requestHash: z.ZodString;
      fencesHash: z.ZodString;
      data: z.ZodObject<{
        datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
        storageKey: z.ZodString;
        schemaRevision: z.ZodString;
        originDatasetId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "dataset", "out">>;
        sourceReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
        snapshotAt: z.ZodISODateTime;
        sha256: z.ZodString;
        byteSize: z.ZodNumber;
        integrity: z.ZodLiteral<"ok">;
        journalHash: z.ZodString;
        migrationRef: z.ZodNullable<z.ZodObject<{
          artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
          sha256: z.ZodString;
        }, z.core.$strict>>;
      }, z.core.$strict>;
    }, z.core.$strict>;
    fences: z.ZodObject<{
      schemaVersion: z.ZodLiteral<"devmesh.local-dataset-fences.v1">;
      operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      requestHash: z.ZodString;
      sourceFence: z.ZodNullable<z.ZodObject<{
        datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
        datasetOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
        closeOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
        closeRequestHash: z.ZodString;
        gateFence: z.ZodNumber;
        physical: z.ZodObject<{
          kind: z.ZodLiteral<"DURABLE_WRITE_FENCE">;
          fenceId: z.ZodString;
          generation: z.ZodNumber;
          proofHash: z.ZodString;
          heldAt: z.ZodISODateTime;
          state: z.ZodLiteral<"HELD">;
        }, z.core.$strict>;
      }, z.core.$strict>>;
      targetFence: z.ZodObject<{
        datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
        physical: z.ZodObject<{
          kind: z.ZodLiteral<"DURABLE_WRITE_FENCE">;
          fenceId: z.ZodString;
          generation: z.ZodNumber;
          proofHash: z.ZodString;
          heldAt: z.ZodISODateTime;
          state: z.ZodLiteral<"HELD">;
        }, z.core.$strict>;
        writeState: z.ZodLiteral<"CLOSED">;
      }, z.core.$strict>;
    }, z.core.$strict>;
  }, z.core.$strict>;
  requestHash: z.ZodString;
  resourceLimits: z.ZodObject<{
    cpu: z.ZodNumber;
    memoryMiB: z.ZodNumber;
    pids: z.ZodNumber;
    temporaryMiB: z.ZodNumber;
  }, z.core.$strict>;
  state: z.ZodEnum<{
    EXITED: "EXITED";
    ACTIVE: "ACTIVE";
    UNKNOWN: "UNKNOWN";
    REMOVED: "REMOVED";
    RESERVED: "RESERVED";
    DISPATCHED: "DISPATCHED";
    CANCELLED: "CANCELLED";
  }>;
  revision: z.ZodNumber;
  instanceId: z.ZodNullable<z.ZodString>;
  endpoint: z.ZodNullable<z.ZodObject<{
    host: z.ZodLiteral<"127.0.0.1">;
    port: z.ZodNumber;
  }, z.core.$strict>>;
  fact: z.ZodNullable<z.ZodObject<{
    operationId: z.ZodString;
    releaseId: z.ZodString;
    datasetId: z.ZodString;
    imageDigest: z.ZodString;
    state: z.ZodEnum<{
      EXITED: "EXITED";
      CREATED: "CREATED";
      HEALTHY: "HEALTHY";
      UNHEALTHY: "UNHEALTHY";
      UNKNOWN: "UNKNOWN";
    }>;
    instanceId: z.ZodNullable<z.ZodString>;
    endpoint: z.ZodNullable<z.ZodObject<{
      host: z.ZodLiteral<"127.0.0.1">;
      port: z.ZodNumber;
    }, z.core.$strict>>;
    checkedAt: z.ZodISODateTime;
  }, z.core.$strict>>;
  custodyState: z.ZodEnum<{
    RELEASE_HELD: "RELEASE_HELD";
    PREPARING: "PREPARING";
  }>;
  claim: z.ZodNullable<z.ZodObject<{
    schemaVersion: z.ZodLiteral<"devmesh.acceptance-service-claim.v1">;
    purpose: z.ZodLiteral<"ACCEPTANCE">;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    acceptanceRequestHash: z.ZodString;
    releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
    manifestHash: z.ZodString;
    reviewHash: z.ZodString;
    dataPlanHash: z.ZodString;
    datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
    imageDigest: z.ZodString;
    reservationId: z.ZodString;
    profileHash: z.ZodString;
    serviceRequestHash: z.ZodString;
    instanceId: z.ZodString;
  }, z.core.$strict>>;
  claimHash: z.ZodNullable<z.ZodString>;
  createdAt: z.ZodISODateTime;
  updatedAt: z.ZodISODateTime;
  releasedAt: z.ZodNullable<z.ZodISODateTime>;
}, z.core.$strict>;
declare const acceptanceServiceActionRecord: z.ZodObject<{
  request: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"devmesh.acceptance-service-action.v1">;
    purpose: z.ZodLiteral<"ACCEPTANCE">;
    operationId: z.ZodString;
    reservationId: z.ZodString;
    serviceRequestHash: z.ZodString;
    profileHash: z.ZodString;
    kind: z.ZodEnum<{
      NETWORK_CREATE: "NETWORK_CREATE";
      CREATE: "CREATE";
      START: "START";
    }>;
    networkId: z.ZodNullable<z.ZodString>;
    containerId: z.ZodNullable<z.ZodString>;
  }, z.core.$strict>;
  requestHash: z.ZodString;
  state: z.ZodEnum<{
    SENT: "SENT";
    OBSERVED: "OBSERVED";
  }>;
  observation: z.ZodNullable<z.ZodObject<{
    objectId: z.ZodString;
    state: z.ZodEnum<{
      RUNNING: "RUNNING";
      EXITED: "EXITED";
      CREATED: "CREATED";
    }>;
    checkedAt: z.ZodISODateTime;
  }, z.core.$strict>>;
  createdAt: z.ZodISODateTime;
  observedAt: z.ZodNullable<z.ZodISODateTime>;
}, z.core.$strict>;
type AcceptanceServiceRequest = z.output<typeof acceptanceServiceRequest>;
type AcceptanceServiceProfile = z.output<typeof acceptanceServiceProfile>;
type AcceptanceServiceFact = z.output<typeof acceptanceServiceFact>;
type AcceptanceServiceReservation = z.output<typeof acceptanceServiceReservation>;
type AcceptanceServiceAction = z.output<typeof acceptanceServiceActionRecord>;
interface AcceptanceServiceJournal {
  profile: AcceptanceServiceProfile;
  profileHash: string;
  networkId: string | null;
  containerId: string | null;
  actions: AcceptanceServiceAction[];
}
interface AcceptanceServiceDriver {
  readonly configured: boolean;
  probe(request: AcceptancePreparation['request'], repository: string): Promise<void>;
  prepare(profile: AcceptanceServiceProfile): Promise<void>;
  network(profile: AcceptanceServiceProfile, request: AcceptanceServiceRequest): Promise<string | null>;
  createNetwork(profile: AcceptanceServiceProfile, request: AcceptanceServiceRequest, authorize: () => Promise<boolean>): Promise<string>;
  inspect(profile: AcceptanceServiceProfile, request: AcceptanceServiceRequest, networkId: string, containerId: string | null): Promise<ServiceContainerFact | null>;
  create(profile: AcceptanceServiceProfile, request: AcceptanceServiceRequest, networkId: string, authorize: () => Promise<boolean>): Promise<ServiceContainerFact | null>;
  start(profile: AcceptanceServiceProfile, request: AcceptanceServiceRequest, networkId: string, containerId: string, authorize: () => Promise<boolean>): Promise<ServiceContainerFact | null>;
}
declare function acceptanceServiceNames(reservationId: string): {
  networkName: string;
  containerName: string;
};
//#endregion
//#region src/acceptance-abort.d.ts
declare const acceptanceAbortActionRequest: z.ZodObject<{
  schemaVersion: z.ZodLiteral<"devmesh.acceptance-service-abort-action.v1">;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  preparationOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  abortOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  decisionHash: z.ZodString;
  reservationId: z.ZodString;
  serviceRequestHash: z.ZodString;
  profileHash: z.ZodString;
  kind: z.ZodEnum<{
    STOP: "STOP";
    CONTAINER_REMOVE: "CONTAINER_REMOVE";
    NETWORK_REMOVE: "NETWORK_REMOVE";
  }>;
  containerId: z.ZodNullable<z.ZodString>;
  networkId: z.ZodString;
}, z.core.$strict>;
declare const acceptanceAbortObservation: z.ZodDiscriminatedUnion<[z.ZodObject<{
  kind: z.ZodLiteral<"STOP">;
  objectId: z.ZodString;
  state: z.ZodEnum<{
    EXITED: "EXITED";
    CREATED: "CREATED";
  }>;
  checkedAt: z.ZodISODateTime;
}, z.core.$strict>, z.ZodObject<{
  kind: z.ZodEnum<{
    CONTAINER_REMOVE: "CONTAINER_REMOVE";
    NETWORK_REMOVE: "NETWORK_REMOVE";
  }>;
  objectId: z.ZodString;
  absenceVerified: z.ZodLiteral<true>;
  checkedAt: z.ZodISODateTime;
}, z.core.$strict>], "kind">;
declare const acceptanceAbortAction: z.ZodObject<{
  request: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"devmesh.acceptance-service-abort-action.v1">;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    preparationOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    abortOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    decisionHash: z.ZodString;
    reservationId: z.ZodString;
    serviceRequestHash: z.ZodString;
    profileHash: z.ZodString;
    kind: z.ZodEnum<{
      STOP: "STOP";
      CONTAINER_REMOVE: "CONTAINER_REMOVE";
      NETWORK_REMOVE: "NETWORK_REMOVE";
    }>;
    containerId: z.ZodNullable<z.ZodString>;
    networkId: z.ZodString;
  }, z.core.$strict>;
  requestHash: z.ZodString;
  state: z.ZodEnum<{
    SENT: "SENT";
    OBSERVED: "OBSERVED";
  }>;
  observation: z.ZodNullable<z.ZodDiscriminatedUnion<[z.ZodObject<{
    kind: z.ZodLiteral<"STOP">;
    objectId: z.ZodString;
    state: z.ZodEnum<{
      EXITED: "EXITED";
      CREATED: "CREATED";
    }>;
    checkedAt: z.ZodISODateTime;
  }, z.core.$strict>, z.ZodObject<{
    kind: z.ZodEnum<{
      CONTAINER_REMOVE: "CONTAINER_REMOVE";
      NETWORK_REMOVE: "NETWORK_REMOVE";
    }>;
    objectId: z.ZodString;
    absenceVerified: z.ZodLiteral<true>;
    checkedAt: z.ZodISODateTime;
  }, z.core.$strict>], "kind">>;
  createdAt: z.ZodISODateTime;
  observedAt: z.ZodNullable<z.ZodISODateTime>;
}, z.core.$strict>;
type AcceptanceAbortAction = z.output<typeof acceptanceAbortAction>;
interface AcceptanceServiceAbort {
  controllerId: string;
  record: AcceptanceAbortRecord;
  reservation: AcceptanceServiceReservation | null;
  actions: AcceptanceAbortAction[];
  serviceCleared: boolean;
  networkCleared: boolean;
}
interface AcceptanceAbortStoreResults {
  acceptanceAbortEnroll: AcceptanceServiceAbort;
  acceptanceAbortGet: AcceptanceServiceAbort;
  acceptanceAbortActionBegin: {
    dispatch: boolean;
    action: AcceptanceAbortAction;
  };
  acceptanceAbortActionAuthorized: {
    allowed: boolean;
  };
  acceptanceAbortActionObserve: AcceptanceServiceAbort;
}
interface AcceptanceAbortDriver extends Pick<AcceptanceServiceDriver, 'configured' | 'network' | 'inspect'> {
  stop(p: AcceptanceServiceProfile, r: AcceptanceServiceRequest, networkId: string, containerId: string, authorize: () => Promise<boolean>): Promise<ServiceContainerFact | null>;
  containerAbsent(id: string): Promise<boolean>;
  networkAbsent(id: string): Promise<boolean>;
  removeContainer(p: AcceptanceServiceProfile, r: AcceptanceServiceRequest, networkId: string, containerId: string, authorize: () => Promise<boolean>): Promise<void>;
  removeNetwork(p: AcceptanceServiceProfile, r: AcceptanceServiceRequest, networkId: string, authorize: () => Promise<boolean>): Promise<void>;
}
//#endregion
//#region src/release-retirement.d.ts
/** Private trusted handoff, not a public caller-supplied cleanup permission. */
declare const releaseRetirementRequest: z.ZodObject<{
  schemaVersion: z.ZodLiteral<"devmesh.release-retirement.v1">;
  promotion: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"devmesh.release-promotion.v1">;
    acceptanceOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    preparation: z.ZodObject<{
      runEpoch: z.ZodNumber;
      requirementRevision: z.ZodNumber;
      planRevision: z.ZodNumber;
      codeCommit: z.ZodString;
      image: z.ZodObject<{
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
      policyHash: z.ZodString;
      backendPrincipalId: z.ZodString;
      backendRef: z.ZodString;
      runnerId: z.ZodString;
      source: z.ZodNullable<z.ZodObject<{
        releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
        datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
        datasetOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
        storageKey: z.ZodString;
        schemaRevision: z.ZodString;
      }, z.core.$strict>>;
      target: z.ZodObject<{
        datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
        storageKey: z.ZodString;
        schemaRevision: z.ZodString;
      }, z.core.$strict>;
      candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
      candidateRevision: z.ZodNumber;
      manifestHash: z.ZodString;
      reviewHash: z.ZodString;
      expectedAcceptedReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
      dataPlanHash: z.ZodString;
      schemaVersion: z.ZodLiteral<"devmesh.acceptance-prepare.v1">;
      operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
      projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
      runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    }, z.core.$strict>;
    preparedProof: z.ZodObject<{
      schemaVersion: z.ZodLiteral<"devmesh.acceptance-prepared.v1">;
      operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      requestHash: z.ZodString;
      releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
      projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
      runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
      candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
      manifestHash: z.ZodString;
      reviewHash: z.ZodString;
      dataPlanHash: z.ZodString;
      runnerId: z.ZodString;
      backendRef: z.ZodString;
      data: z.ZodObject<{
        datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
        storageKey: z.ZodString;
        schemaRevision: z.ZodString;
        originDatasetId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "dataset", "out">>;
        sourceReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
        snapshotAt: z.ZodISODateTime;
        sha256: z.ZodString;
        byteSize: z.ZodNumber;
        integrity: z.ZodLiteral<"ok">;
        journalHash: z.ZodString;
        migrationRef: z.ZodNullable<z.ZodObject<{
          artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
          sha256: z.ZodString;
        }, z.core.$strict>>;
      }, z.core.$strict>;
      sourceFence: z.ZodNullable<z.ZodObject<{
        datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
        datasetOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
        closeOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
        closeRequestHash: z.ZodString;
        gateFence: z.ZodNumber;
        physical: z.ZodObject<{
          kind: z.ZodLiteral<"DURABLE_WRITE_FENCE">;
          fenceId: z.ZodString;
          generation: z.ZodNumber;
          proofHash: z.ZodString;
          heldAt: z.ZodISODateTime;
          state: z.ZodLiteral<"HELD">;
        }, z.core.$strict>;
      }, z.core.$strict>>;
      targetFence: z.ZodObject<{
        datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
        physical: z.ZodObject<{
          kind: z.ZodLiteral<"DURABLE_WRITE_FENCE">;
          fenceId: z.ZodString;
          generation: z.ZodNumber;
          proofHash: z.ZodString;
          heldAt: z.ZodISODateTime;
          state: z.ZodLiteral<"HELD">;
        }, z.core.$strict>;
        writeState: z.ZodLiteral<"CLOSED">;
      }, z.core.$strict>;
      service: z.ZodObject<{
        reservationId: z.ZodString;
        profileHash: z.ZodString;
        endpoint: z.ZodObject<{
          host: z.ZodLiteral<"127.0.0.1">;
          port: z.ZodNumber;
        }, z.core.$strict>;
        claim: z.ZodDiscriminatedUnion<[z.ZodObject<{
          schemaVersion: z.ZodLiteral<"devmesh.preview-release-claim.v1">;
          operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
          releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
          candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
          manifestHash: z.ZodString;
          previewId: z.core.$ZodBranded<z.ZodString, "preview", "out">;
          datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
          imageDigest: z.ZodString;
          startOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
          startRequestHash: z.ZodString;
          instanceId: z.ZodString;
          acceptanceRequestHash: z.ZodString;
        }, z.core.$strict>, z.ZodObject<{
          schemaVersion: z.ZodLiteral<"devmesh.acceptance-service-claim.v1">;
          purpose: z.ZodLiteral<"ACCEPTANCE">;
          operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
          acceptanceRequestHash: z.ZodString;
          releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
          projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
          runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
          candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
          manifestHash: z.ZodString;
          reviewHash: z.ZodString;
          dataPlanHash: z.ZodString;
          datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
          imageDigest: z.ZodString;
          reservationId: z.ZodString;
          profileHash: z.ZodString;
          serviceRequestHash: z.ZodString;
          instanceId: z.ZodString;
        }, z.core.$strict>], "schemaVersion">;
        claimHash: z.ZodString;
        custodyState: z.ZodLiteral<"RELEASE_HELD">;
        custodyRevision: z.ZodNumber;
      }, z.core.$strict>;
      preparedAt: z.ZodISODateTime;
    }, z.core.$strict>;
    proofHash: z.ZodString;
  }, z.core.$strict>;
  promotionRequestHash: z.ZodString;
  gates: z.ZodObject<{
    sourceGate: z.ZodNullable<z.ZodObject<{
      datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
      datasetOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      datasetRequestHash: z.ZodString;
      state: z.ZodEnum<{
        CLOSED: "CLOSED";
        OPEN: "OPEN";
      }>;
      fence: z.ZodNumber;
      revision: z.ZodNumber;
      closeOperationId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "op", "out">>;
      closeRequestHash: z.ZodNullable<z.ZodString>;
    }, z.core.$strict>>;
    targetGate: z.ZodObject<{
      datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
      datasetOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      datasetRequestHash: z.ZodString;
      state: z.ZodEnum<{
        CLOSED: "CLOSED";
        OPEN: "OPEN";
      }>;
      fence: z.ZodNumber;
      revision: z.ZodNumber;
      closeOperationId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "op", "out">>;
      closeRequestHash: z.ZodNullable<z.ZodString>;
    }, z.core.$strict>;
    previousRoute: z.ZodNullable<z.ZodObject<{
      releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
      routeHash: z.ZodString;
      generation: z.ZodNumber;
    }, z.core.$strict>>;
  }, z.core.$strict>;
}, z.core.$strict>;
declare const releaseRetirementKind: z.ZodEnum<{
  STOP: "STOP";
  CONTAINER_REMOVE: "CONTAINER_REMOVE";
  NETWORK_REMOVE: "NETWORK_REMOVE";
  REVOKE_PREPARATION: "REVOKE_PREPARATION";
}>;
declare const releaseRetirementRevocation: z.ZodObject<{
  schemaVersion: z.ZodLiteral<"devmesh.release-preparation-revoked.v1">;
  promotionRequestHash: z.ZodString;
  preparationOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
  runnerId: z.ZodString;
  controllerId: z.ZodString;
  barrierId: z.ZodString;
  generation: z.ZodNumber;
  proofHash: z.ZodString;
  state: z.ZodLiteral<"PERMANENTLY_REVOKED">;
}, z.core.$strict>;
declare const releaseRetirementActionRequest: z.ZodObject<{
  schemaVersion: z.ZodLiteral<"devmesh.release-retirement-action.v1">;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
  promotionRequestHash: z.ZodString;
  retirementRequestHash: z.ZodString;
  reservationId: z.ZodString;
  serviceRequestHash: z.ZodString;
  profileHash: z.ZodString;
  networkId: z.ZodString;
  containerId: z.ZodString;
  kind: z.ZodEnum<{
    STOP: "STOP";
    CONTAINER_REMOVE: "CONTAINER_REMOVE";
    NETWORK_REMOVE: "NETWORK_REMOVE";
    REVOKE_PREPARATION: "REVOKE_PREPARATION";
  }>;
}, z.core.$strict>;
declare const releaseRetirementObservation: z.ZodDiscriminatedUnion<[z.ZodObject<{
  kind: z.ZodLiteral<"REVOKE_PREPARATION">;
  proof: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"devmesh.release-preparation-revoked.v1">;
    promotionRequestHash: z.ZodString;
    preparationOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
    runnerId: z.ZodString;
    controllerId: z.ZodString;
    barrierId: z.ZodString;
    generation: z.ZodNumber;
    proofHash: z.ZodString;
    state: z.ZodLiteral<"PERMANENTLY_REVOKED">;
  }, z.core.$strict>;
  checkedAt: z.ZodISODateTime;
}, z.core.$strict>, z.ZodObject<{
  kind: z.ZodLiteral<"STOP">;
  objectId: z.ZodString;
  state: z.ZodEnum<{
    EXITED: "EXITED";
    CREATED: "CREATED";
  }>;
  checkedAt: z.ZodISODateTime;
}, z.core.$strict>, z.ZodObject<{
  kind: z.ZodEnum<{
    CONTAINER_REMOVE: "CONTAINER_REMOVE";
    NETWORK_REMOVE: "NETWORK_REMOVE";
  }>;
  objectId: z.ZodString;
  absenceVerified: z.ZodLiteral<true>;
  checkedAt: z.ZodISODateTime;
}, z.core.$strict>], "kind">;
declare const releaseRetirementAction: z.ZodObject<{
  request: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"devmesh.release-retirement-action.v1">;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
    promotionRequestHash: z.ZodString;
    retirementRequestHash: z.ZodString;
    reservationId: z.ZodString;
    serviceRequestHash: z.ZodString;
    profileHash: z.ZodString;
    networkId: z.ZodString;
    containerId: z.ZodString;
    kind: z.ZodEnum<{
      STOP: "STOP";
      CONTAINER_REMOVE: "CONTAINER_REMOVE";
      NETWORK_REMOVE: "NETWORK_REMOVE";
      REVOKE_PREPARATION: "REVOKE_PREPARATION";
    }>;
  }, z.core.$strict>;
  requestHash: z.ZodString;
  state: z.ZodEnum<{
    SENT: "SENT";
    OBSERVED: "OBSERVED";
  }>;
  observation: z.ZodNullable<z.ZodDiscriminatedUnion<[z.ZodObject<{
    kind: z.ZodLiteral<"REVOKE_PREPARATION">;
    proof: z.ZodObject<{
      schemaVersion: z.ZodLiteral<"devmesh.release-preparation-revoked.v1">;
      promotionRequestHash: z.ZodString;
      preparationOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
      runnerId: z.ZodString;
      controllerId: z.ZodString;
      barrierId: z.ZodString;
      generation: z.ZodNumber;
      proofHash: z.ZodString;
      state: z.ZodLiteral<"PERMANENTLY_REVOKED">;
    }, z.core.$strict>;
    checkedAt: z.ZodISODateTime;
  }, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"STOP">;
    objectId: z.ZodString;
    state: z.ZodEnum<{
      EXITED: "EXITED";
      CREATED: "CREATED";
    }>;
    checkedAt: z.ZodISODateTime;
  }, z.core.$strict>, z.ZodObject<{
    kind: z.ZodEnum<{
      CONTAINER_REMOVE: "CONTAINER_REMOVE";
      NETWORK_REMOVE: "NETWORK_REMOVE";
    }>;
    objectId: z.ZodString;
    absenceVerified: z.ZodLiteral<true>;
    checkedAt: z.ZodISODateTime;
  }, z.core.$strict>], "kind">>;
  createdAt: z.ZodISODateTime;
  observedAt: z.ZodNullable<z.ZodISODateTime>;
}, z.core.$strict>;
type ReleaseRetirementRequest = z.output<typeof releaseRetirementRequest>;
type ReleaseRetirementAction = z.output<typeof releaseRetirementAction>;
type ReleaseRetirementKind = z.output<typeof releaseRetirementKind>;
interface ReleaseRetirement {
  sequence: number;
  controllerId: string;
  request: ReleaseRetirementRequest;
  requestHash: string;
  reservation: AcceptanceServiceReservation;
  original: AcceptanceServiceJournal;
  actions: ReleaseRetirementAction[];
  revoked: boolean;
  containerCleared: boolean;
  networkCleared: boolean;
  createdAt: string;
}
interface ReleaseRetirementStoreResults {
  releaseRetirementEnroll: {
    dispatch: boolean;
    journal: ReleaseRetirement;
  };
  releaseRetirementGet: ReleaseRetirement;
  releaseRetirementPage: {
    items: ReleaseRetirement[];
    nextSequence: number | null;
  };
  releaseRetirementActionBegin: {
    dispatch: boolean;
    action: ReleaseRetirementAction;
  };
  releaseRetirementActionAuthorized: {
    allowed: boolean;
  };
  releaseRetirementActionObserve: ReleaseRetirement;
}
/** Must permanently revoke all old preparation acquire/renew/write authority and
 * settle previously admitted actions. A file flag or logical gate is insufficient.
 * revoke must call authorize immediately before acting; inspect is query-only. */
interface ReleaseRetirementAuthority {
  readonly configured: boolean;
  preflight(request: ReleaseRetirementRequest): Promise<void>;
  revoke(request: ReleaseRetirementRequest, controllerId: string, authorize: () => Promise<boolean>): Promise<z.output<typeof releaseRetirementRevocation>>;
  inspect(request: ReleaseRetirementRequest, controllerId: string): Promise<z.output<typeof releaseRetirementRevocation> | null>;
}
//#endregion
//#region src/release-service.d.ts
declare const releaseServiceRequest: z.ZodObject<{
  promotion: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"devmesh.release-promotion.v1">;
    acceptanceOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    preparation: z.ZodObject<{
      runEpoch: z.ZodNumber;
      requirementRevision: z.ZodNumber;
      planRevision: z.ZodNumber;
      codeCommit: z.ZodString;
      image: z.ZodObject<{
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
      policyHash: z.ZodString;
      backendPrincipalId: z.ZodString;
      backendRef: z.ZodString;
      runnerId: z.ZodString;
      source: z.ZodNullable<z.ZodObject<{
        releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
        datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
        datasetOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
        storageKey: z.ZodString;
        schemaRevision: z.ZodString;
      }, z.core.$strict>>;
      target: z.ZodObject<{
        datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
        storageKey: z.ZodString;
        schemaRevision: z.ZodString;
      }, z.core.$strict>;
      candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
      candidateRevision: z.ZodNumber;
      manifestHash: z.ZodString;
      reviewHash: z.ZodString;
      expectedAcceptedReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
      dataPlanHash: z.ZodString;
      schemaVersion: z.ZodLiteral<"devmesh.acceptance-prepare.v1">;
      operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
      projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
      runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    }, z.core.$strict>;
    preparedProof: z.ZodObject<{
      schemaVersion: z.ZodLiteral<"devmesh.acceptance-prepared.v1">;
      operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      requestHash: z.ZodString;
      releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
      projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
      runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
      candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
      manifestHash: z.ZodString;
      reviewHash: z.ZodString;
      dataPlanHash: z.ZodString;
      runnerId: z.ZodString;
      backendRef: z.ZodString;
      data: z.ZodObject<{
        datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
        storageKey: z.ZodString;
        schemaRevision: z.ZodString;
        originDatasetId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "dataset", "out">>;
        sourceReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
        snapshotAt: z.ZodISODateTime;
        sha256: z.ZodString;
        byteSize: z.ZodNumber;
        integrity: z.ZodLiteral<"ok">;
        journalHash: z.ZodString;
        migrationRef: z.ZodNullable<z.ZodObject<{
          artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
          sha256: z.ZodString;
        }, z.core.$strict>>;
      }, z.core.$strict>;
      sourceFence: z.ZodNullable<z.ZodObject<{
        datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
        datasetOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
        closeOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
        closeRequestHash: z.ZodString;
        gateFence: z.ZodNumber;
        physical: z.ZodObject<{
          kind: z.ZodLiteral<"DURABLE_WRITE_FENCE">;
          fenceId: z.ZodString;
          generation: z.ZodNumber;
          proofHash: z.ZodString;
          heldAt: z.ZodISODateTime;
          state: z.ZodLiteral<"HELD">;
        }, z.core.$strict>;
      }, z.core.$strict>>;
      targetFence: z.ZodObject<{
        datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
        physical: z.ZodObject<{
          kind: z.ZodLiteral<"DURABLE_WRITE_FENCE">;
          fenceId: z.ZodString;
          generation: z.ZodNumber;
          proofHash: z.ZodString;
          heldAt: z.ZodISODateTime;
          state: z.ZodLiteral<"HELD">;
        }, z.core.$strict>;
        writeState: z.ZodLiteral<"CLOSED">;
      }, z.core.$strict>;
      service: z.ZodObject<{
        reservationId: z.ZodString;
        profileHash: z.ZodString;
        endpoint: z.ZodObject<{
          host: z.ZodLiteral<"127.0.0.1">;
          port: z.ZodNumber;
        }, z.core.$strict>;
        claim: z.ZodDiscriminatedUnion<[z.ZodObject<{
          schemaVersion: z.ZodLiteral<"devmesh.preview-release-claim.v1">;
          operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
          releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
          candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
          manifestHash: z.ZodString;
          previewId: z.core.$ZodBranded<z.ZodString, "preview", "out">;
          datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
          imageDigest: z.ZodString;
          startOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
          startRequestHash: z.ZodString;
          instanceId: z.ZodString;
          acceptanceRequestHash: z.ZodString;
        }, z.core.$strict>, z.ZodObject<{
          schemaVersion: z.ZodLiteral<"devmesh.acceptance-service-claim.v1">;
          purpose: z.ZodLiteral<"ACCEPTANCE">;
          operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
          acceptanceRequestHash: z.ZodString;
          releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
          projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
          runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
          candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
          manifestHash: z.ZodString;
          reviewHash: z.ZodString;
          dataPlanHash: z.ZodString;
          datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
          imageDigest: z.ZodString;
          reservationId: z.ZodString;
          profileHash: z.ZodString;
          serviceRequestHash: z.ZodString;
          instanceId: z.ZodString;
        }, z.core.$strict>], "schemaVersion">;
        claimHash: z.ZodString;
        custodyState: z.ZodLiteral<"RELEASE_HELD">;
        custodyRevision: z.ZodNumber;
      }, z.core.$strict>;
      preparedAt: z.ZodISODateTime;
    }, z.core.$strict>;
    proofHash: z.ZodString;
  }, z.core.$strict>;
  promotionRequestHash: z.ZodString;
  gates: z.ZodObject<{
    sourceGate: z.ZodNullable<z.ZodObject<{
      datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
      datasetOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      datasetRequestHash: z.ZodString;
      state: z.ZodEnum<{
        CLOSED: "CLOSED";
        OPEN: "OPEN";
      }>;
      fence: z.ZodNumber;
      revision: z.ZodNumber;
      closeOperationId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "op", "out">>;
      closeRequestHash: z.ZodNullable<z.ZodString>;
    }, z.core.$strict>>;
    targetGate: z.ZodObject<{
      datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
      datasetOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      datasetRequestHash: z.ZodString;
      state: z.ZodEnum<{
        CLOSED: "CLOSED";
        OPEN: "OPEN";
      }>;
      fence: z.ZodNumber;
      revision: z.ZodNumber;
      closeOperationId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "op", "out">>;
      closeRequestHash: z.ZodNullable<z.ZodString>;
    }, z.core.$strict>;
    previousRoute: z.ZodNullable<z.ZodObject<{
      releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
      routeHash: z.ZodString;
      generation: z.ZodNumber;
    }, z.core.$strict>>;
  }, z.core.$strict>;
  schemaVersion: z.ZodLiteral<"devmesh.release-service-start.v1">;
  purpose: z.ZodLiteral<"RELEASE">;
  retirementRequestHash: z.ZodString;
}, z.core.$strict>;
declare const releaseServiceFences: z.ZodObject<{
  schemaVersion: z.ZodLiteral<"devmesh.release-service-fences.v1">;
  releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
  promotionRequestHash: z.ZodString;
  retirementRequestHash: z.ZodString;
  revocationProofHash: z.ZodString;
  target: z.ZodObject<{
    fenceId: z.ZodString;
    generation: z.ZodNumber;
    proofHash: z.ZodString;
    previousHoldHash: z.ZodString;
    datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
    owner: z.ZodLiteral<"RELEASE">;
    state: z.ZodLiteral<"ARMED">;
    writeState: z.ZodLiteral<"CONTROL_CLOSED">;
  }, z.core.$strict>;
  source: z.ZodNullable<z.ZodObject<{
    fenceId: z.ZodString;
    generation: z.ZodNumber;
    proofHash: z.ZodString;
    previousHoldHash: z.ZodString;
    releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
    datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
    datasetOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    state: z.ZodLiteral<"RETIRED">;
    writeState: z.ZodLiteral<"CLOSED">;
  }, z.core.$strict>>;
}, z.core.$strict>;
declare const releaseServiceProfile: z.ZodObject<{
  resourceLimits: z.ZodObject<{
    cpu: z.ZodNumber;
    memoryMiB: z.ZodNumber;
    pids: z.ZodNumber;
    temporaryMiB: z.ZodNumber;
  }, z.core.$strict>;
  requestHash: z.ZodString;
  reservationId: z.ZodString;
  repository: z.ZodString;
  datasetDirectory: z.ZodString;
  datasetBytes: z.ZodNumber;
  networkName: z.ZodString;
  containerName: z.ZodString;
  schemaVersion: z.ZodLiteral<"devmesh.release-service-profile.v1">;
  purpose: z.ZodLiteral<"RELEASE">;
  accessMode: z.ZodLiteral<"READ_WRITE">;
  writeAdmission: z.ZodLiteral<"CONTROL_GATE_FENCED">;
  fenceProofHash: z.ZodString;
  gateBindingHash: z.ZodString;
}, z.core.$strict>;
declare const releaseServiceGuardProof: z.ZodObject<{
  schemaVersion: z.ZodLiteral<"devmesh.release-service-guard.v1">;
  releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
  runnerId: z.ZodString;
  controllerId: z.ZodString;
  serviceRequestHash: z.ZodString;
  reservationId: z.ZodString;
  profileHash: z.ZodString;
  datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
  targetProofHash: z.ZodString;
  gateBindingHash: z.ZodString;
  guardId: z.ZodString;
  proofHash: z.ZodString;
  scope: z.ZodLiteral<"ALL_DATASET_WRITES">;
  writeAdmission: z.ZodLiteral<"CONTROL_GATE_FENCED">;
  state: z.ZodLiteral<"ENFORCED">;
}, z.core.$strict>;
declare const releaseServiceAction: z.ZodObject<{
  request: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"devmesh.release-service-action.v1">;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
    serviceRequestHash: z.ZodString;
    kind: z.ZodEnum<{
      ARM_FENCES: "ARM_FENCES";
      SOURCE_STOP: "SOURCE_STOP";
      SOURCE_CONTAINER_REMOVE: "SOURCE_CONTAINER_REMOVE";
      SOURCE_NETWORK_REMOVE: "SOURCE_NETWORK_REMOVE";
      PROFILE_PREPARE: "PROFILE_PREPARE";
      GUARD_ENFORCE: "GUARD_ENFORCE";
      NETWORK_CREATE: "NETWORK_CREATE";
      CREATE: "CREATE";
      START: "START";
      ROUTE_BIND: "ROUTE_BIND";
    }>;
    reservationId: z.ZodNullable<z.ZodString>;
    profileHash: z.ZodNullable<z.ZodString>;
    containerId: z.ZodNullable<z.ZodString>;
    networkId: z.ZodNullable<z.ZodString>;
  }, z.core.$strict>;
  requestHash: z.ZodString;
  state: z.ZodEnum<{
    SENT: "SENT";
    OBSERVED: "OBSERVED";
  }>;
  observation: z.ZodNullable<z.ZodDiscriminatedUnion<[z.ZodObject<{
    kind: z.ZodLiteral<"ARM_FENCES">;
    proof: z.ZodObject<{
      schemaVersion: z.ZodLiteral<"devmesh.release-service-fences.v1">;
      releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
      promotionRequestHash: z.ZodString;
      retirementRequestHash: z.ZodString;
      revocationProofHash: z.ZodString;
      target: z.ZodObject<{
        fenceId: z.ZodString;
        generation: z.ZodNumber;
        proofHash: z.ZodString;
        previousHoldHash: z.ZodString;
        datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
        owner: z.ZodLiteral<"RELEASE">;
        state: z.ZodLiteral<"ARMED">;
        writeState: z.ZodLiteral<"CONTROL_CLOSED">;
      }, z.core.$strict>;
      source: z.ZodNullable<z.ZodObject<{
        fenceId: z.ZodString;
        generation: z.ZodNumber;
        proofHash: z.ZodString;
        previousHoldHash: z.ZodString;
        releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
        datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
        datasetOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
        state: z.ZodLiteral<"RETIRED">;
        writeState: z.ZodLiteral<"CLOSED">;
      }, z.core.$strict>>;
    }, z.core.$strict>;
    checkedAt: z.ZodISODateTime;
  }, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"PROFILE_PREPARE">;
    profileHash: z.ZodString;
    checkedAt: z.ZodISODateTime;
  }, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"GUARD_ENFORCE">;
    proof: z.ZodObject<{
      schemaVersion: z.ZodLiteral<"devmesh.release-service-guard.v1">;
      releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
      runnerId: z.ZodString;
      controllerId: z.ZodString;
      serviceRequestHash: z.ZodString;
      reservationId: z.ZodString;
      profileHash: z.ZodString;
      datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
      targetProofHash: z.ZodString;
      gateBindingHash: z.ZodString;
      guardId: z.ZodString;
      proofHash: z.ZodString;
      scope: z.ZodLiteral<"ALL_DATASET_WRITES">;
      writeAdmission: z.ZodLiteral<"CONTROL_GATE_FENCED">;
      state: z.ZodLiteral<"ENFORCED">;
    }, z.core.$strict>;
    checkedAt: z.ZodISODateTime;
  }, z.core.$strict>, z.ZodObject<{
    kind: z.ZodEnum<{
      SOURCE_STOP: "SOURCE_STOP";
      NETWORK_CREATE: "NETWORK_CREATE";
      CREATE: "CREATE";
      START: "START";
    }>;
    objectId: z.ZodString;
    state: z.ZodEnum<{
      RUNNING: "RUNNING";
      EXITED: "EXITED";
      CREATED: "CREATED";
    }>;
    checkedAt: z.ZodISODateTime;
  }, z.core.$strict>, z.ZodObject<{
    kind: z.ZodEnum<{
      SOURCE_CONTAINER_REMOVE: "SOURCE_CONTAINER_REMOVE";
      SOURCE_NETWORK_REMOVE: "SOURCE_NETWORK_REMOVE";
    }>;
    objectId: z.ZodString;
    absenceVerified: z.ZodLiteral<true>;
    checkedAt: z.ZodISODateTime;
  }, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"ROUTE_BIND">;
    route: z.ZodObject<{
      schemaVersion: z.ZodLiteral<"devmesh.release-route.v1">;
      routeId: z.ZodString;
      generation: z.ZodNumber;
      projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
      releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
      previousReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
      datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
      imageDigest: z.ZodString;
      instanceId: z.ZodString;
      endpoint: z.ZodObject<{
        host: z.ZodLiteral<"127.0.0.1">;
        port: z.ZodNumber;
      }, z.core.$strict>;
      serviceClaimHash: z.ZodString;
      state: z.ZodLiteral<"BOUND">;
    }, z.core.$strict>;
    routeHash: z.ZodString;
    checkedAt: z.ZodISODateTime;
  }, z.core.$strict>], "kind">>;
  createdAt: z.ZodISODateTime;
  observedAt: z.ZodNullable<z.ZodISODateTime>;
}, z.core.$strict>;
declare const releaseServiceFact: z.ZodObject<{
  releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
  datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
  imageDigest: z.ZodString;
  state: z.ZodEnum<{
    EXITED: "EXITED";
    CREATED: "CREATED";
    HEALTHY: "HEALTHY";
    UNHEALTHY: "UNHEALTHY";
    UNKNOWN: "UNKNOWN";
  }>;
  instanceId: z.ZodNullable<z.ZodString>;
  endpoint: z.ZodNullable<z.ZodObject<{
    host: z.ZodLiteral<"127.0.0.1">;
    port: z.ZodNumber;
  }, z.core.$strict>>;
  checkedAt: z.ZodISODateTime;
}, z.core.$strict>;
declare const releaseServiceReservation: z.ZodObject<{
  purpose: z.ZodLiteral<"RELEASE">;
  releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
  reservationId: z.ZodString;
  controllerId: z.ZodString;
  requestHash: z.ZodString;
  resourceLimits: z.ZodObject<{
    cpu: z.ZodNumber;
    memoryMiB: z.ZodNumber;
    pids: z.ZodNumber;
    temporaryMiB: z.ZodNumber;
  }, z.core.$strict>;
  state: z.ZodEnum<{
    EXITED: "EXITED";
    ACTIVE: "ACTIVE";
    UNKNOWN: "UNKNOWN";
    REMOVED: "REMOVED";
    RESERVED: "RESERVED";
    DISPATCHED: "DISPATCHED";
  }>;
  revision: z.ZodNumber;
  instanceId: z.ZodNullable<z.ZodString>;
  endpoint: z.ZodNullable<z.ZodObject<{
    host: z.ZodLiteral<"127.0.0.1">;
    port: z.ZodNumber;
  }, z.core.$strict>>;
  fact: z.ZodNullable<z.ZodObject<{
    releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
    datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
    imageDigest: z.ZodString;
    state: z.ZodEnum<{
      EXITED: "EXITED";
      CREATED: "CREATED";
      HEALTHY: "HEALTHY";
      UNHEALTHY: "UNHEALTHY";
      UNKNOWN: "UNKNOWN";
    }>;
    instanceId: z.ZodNullable<z.ZodString>;
    endpoint: z.ZodNullable<z.ZodObject<{
      host: z.ZodLiteral<"127.0.0.1">;
      port: z.ZodNumber;
    }, z.core.$strict>>;
    checkedAt: z.ZodISODateTime;
  }, z.core.$strict>>;
  claim: z.ZodNullable<z.ZodObject<{
    schemaVersion: z.ZodLiteral<"devmesh.release-service-claim.v1">;
    purpose: z.ZodLiteral<"RELEASE">;
    releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
    projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
    acceptanceOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    preparationOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    promotionRequestHash: z.ZodString;
    preparedProofHash: z.ZodString;
    runnerId: z.ZodString;
    datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
    imageDigest: z.ZodString;
    reservationId: z.ZodString;
    profileHash: z.ZodString;
    serviceRequestHash: z.ZodString;
    instanceId: z.ZodString;
    networkId: z.ZodString;
    accessMode: z.ZodLiteral<"READ_WRITE">;
    custodyState: z.ZodLiteral<"RELEASE_OWNED">;
    writeAdmission: z.ZodLiteral<"CONTROL_GATE_FENCED">;
    targetFence: z.ZodObject<{
      fenceId: z.ZodString;
      generation: z.ZodNumber;
      proofHash: z.ZodString;
      previousHoldHash: z.ZodString;
    }, z.core.$strict>;
  }, z.core.$strict>>;
  claimHash: z.ZodNullable<z.ZodString>;
  createdAt: z.ZodISODateTime;
  updatedAt: z.ZodISODateTime;
  releasedAt: z.ZodNullable<z.ZodISODateTime>;
}, z.core.$strict>;
type ReleaseServiceRequest = z.output<typeof releaseServiceRequest>;
type ReleaseServiceProfile = z.output<typeof releaseServiceProfile>;
type ReleaseServiceFences = z.output<typeof releaseServiceFences>;
type ReleaseServiceGuardProof = z.output<typeof releaseServiceGuardProof>;
type ReleaseServiceAction = z.output<typeof releaseServiceAction>;
type ReleaseServiceReservation = z.output<typeof releaseServiceReservation>;
interface ReleaseServiceOriginal {
  request: ReleaseServiceRequest;
  requestHash: string;
  reservation: ReleaseServiceReservation;
  profile: ReleaseServiceProfile;
  profileHash: string;
  networkId: string;
  containerId: string;
  proof: ReleasePublicationProof;
}
interface ReleaseServiceJournal {
  sequence: number;
  controllerId: string;
  request: ReleaseServiceRequest;
  requestHash: string;
  retirement: ReleaseRetirement;
  source: ReleaseServiceOriginal | null;
  profilePreparation: 'EXECUTE_ONCE' | 'INSPECT_ONLY' | null;
  reservation: ReleaseServiceReservation | null;
  profile: ReleaseServiceProfile | null;
  profileHash: string | null;
  networkId: string | null;
  containerId: string | null;
  actions: ReleaseServiceAction[];
  proof: ReleasePublicationProof | null;
  proofHash: string | null;
  createdAt: string;
}
interface ReleaseServiceStoreResults {
  releaseServiceEnroll: {
    dispatch: boolean;
    journal: ReleaseServiceJournal;
  };
  releaseServiceGet: ReleaseServiceJournal;
  releaseServicePage: {
    items: ReleaseServiceJournal[];
    nextSequence: number | null;
  };
  releaseServiceReserve: ReleaseServiceJournal;
  releaseServiceProfilePrepare: ReleaseServiceJournal;
  releaseServiceActionBegin: {
    dispatch: boolean;
    action: ReleaseServiceAction;
  };
  releaseServiceActionAuthorized: {
    allowed: boolean;
  };
  releaseServiceActionObserve: ReleaseServiceJournal;
  releaseServiceRecord: ReleaseServiceJournal;
  releaseServiceOwn: ReleaseServiceJournal;
  releaseServicePrepareProof: ReleaseServiceJournal;
}
declare function releaseServiceNames(id: string): {
  networkName: string;
  containerName: string;
};
declare function releaseServiceGateBinding(r: ReleaseServiceRequest): string;
/** Owns physical handoff of the exact old HELD generations. ARM_FENCES must keep
 * all target writes closed, retire the old source, and preserve permanent revoke. */
interface ReleaseServiceAuthority {
  readonly configured: boolean;
  preflight(p: ReleasePublication): Promise<void>;
  handoff(retirement: ReleaseRetirement, authorize: () => Promise<boolean>): Promise<ReleaseServiceFences>;
  inspect(retirement: ReleaseRetirement): Promise<ReleaseServiceFences | null>;
}
/** Enforce before mounting/starting any writable instance. Every dataset write,
 * including background/direct filesystem writes, must obey the exact physical
 * generation AND current control gate. A proxy flag alone does not satisfy this. */
interface ReleaseServiceWriteGuard {
  readonly configured: boolean;
  enforce(p: ReleaseServiceProfile, r: ReleaseServiceRequest, controllerId: string, authorize: () => Promise<boolean>): Promise<ReleaseServiceGuardProof>;
  inspect(p: ReleaseServiceProfile, r: ReleaseServiceRequest, controllerId: string): Promise<ReleaseServiceGuardProof | null>;
}
interface ReleaseServiceDriver {
  readonly configured: boolean;
  probe(r: ReleaseServiceRequest['promotion']['preparation'], repository: string): Promise<void>;
  prepare(p: ReleaseServiceProfile, r: ReleaseServiceRequest, authorize: () => Promise<boolean>): Promise<void>;
  prepared(p: ReleaseServiceProfile, r: ReleaseServiceRequest): Promise<boolean>;
  enforceGuard(p: ReleaseServiceProfile, r: ReleaseServiceRequest, controllerId: string, authorize: () => Promise<boolean>): Promise<ReleaseServiceGuardProof>;
  inspectGuard(p: ReleaseServiceProfile, r: ReleaseServiceRequest, controllerId: string): Promise<ReleaseServiceGuardProof | null>;
  network(p: ReleaseServiceProfile, r: ReleaseServiceRequest): Promise<string | null>;
  createNetwork(p: ReleaseServiceProfile, r: ReleaseServiceRequest, authorize: () => Promise<boolean>): Promise<string>;
  inspect(p: ReleaseServiceProfile, r: ReleaseServiceRequest, networkId: string, containerId: string | null): Promise<ServiceContainerFact | null>;
  /** Query a retired source's original Docker profile without requiring its
   * closed write guard to admit execution. Never starts or modifies it. */
  inspectRetired(p: ReleaseServiceProfile, r: ReleaseServiceRequest, networkId: string, containerId: string): Promise<ServiceContainerFact | null>;
  create(p: ReleaseServiceProfile, r: ReleaseServiceRequest, networkId: string, authorize: () => Promise<boolean>): Promise<ServiceContainerFact | null>;
  start(p: ReleaseServiceProfile, r: ReleaseServiceRequest, networkId: string, containerId: string, authorize: () => Promise<boolean>): Promise<ServiceContainerFact | null>;
  stop(p: ReleaseServiceProfile, r: ReleaseServiceRequest, networkId: string, containerId: string, authorize: () => Promise<boolean>): Promise<ServiceContainerFact | null>;
  removeContainer(p: ReleaseServiceProfile, r: ReleaseServiceRequest, networkId: string, containerId: string, authorize: () => Promise<boolean>): Promise<void>;
  removeNetwork(p: ReleaseServiceProfile, r: ReleaseServiceRequest, networkId: string, authorize: () => Promise<boolean>): Promise<void>;
  containerAbsent(id: string): Promise<boolean>;
  networkAbsent(id: string): Promise<boolean>;
}
/** Bind the exact original route under control admission; never expose an
 * unguarded service or activate an unrelated generation. inspect is query-only. */
interface ReleaseServiceRoutes {
  readonly configured: boolean;
  preflight(p: ReleasePublication): Promise<void>;
  bind(j: ReleaseServiceJournal, authorize: () => Promise<boolean>): Promise<z.output<typeof releaseRouteBinding>>;
  inspect(j: ReleaseServiceJournal): Promise<z.output<typeof releaseRouteBinding> | null>;
}
//#endregion
//#region src/store-protocol.d.ts
declare const storeRequests: {
  acceptanceServiceReserve: z.ZodObject<{
    request: z.ZodObject<{
      schemaVersion: z.ZodLiteral<"devmesh.acceptance-service-start.v1">;
      purpose: z.ZodLiteral<"ACCEPTANCE">;
      preparation: z.ZodObject<{
        runEpoch: z.ZodNumber;
        requirementRevision: z.ZodNumber;
        planRevision: z.ZodNumber;
        codeCommit: z.ZodString;
        image: z.ZodObject<{
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
        policyHash: z.ZodString;
        backendPrincipalId: z.ZodString;
        backendRef: z.ZodString;
        runnerId: z.ZodString;
        source: z.ZodNullable<z.ZodObject<{
          releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
          datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
          datasetOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
          storageKey: z.ZodString;
          schemaRevision: z.ZodString;
        }, z.core.$strict>>;
        target: z.ZodObject<{
          datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
          storageKey: z.ZodString;
          schemaRevision: z.ZodString;
        }, z.core.$strict>;
        candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
        candidateRevision: z.ZodNumber;
        manifestHash: z.ZodString;
        reviewHash: z.ZodString;
        expectedAcceptedReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
        dataPlanHash: z.ZodString;
        schemaVersion: z.ZodLiteral<"devmesh.acceptance-prepare.v1">;
        operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
        releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
        projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
        runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
      }, z.core.$strict>;
      acceptanceRequestHash: z.ZodString;
      dataReceipt: z.ZodObject<{
        schemaVersion: z.ZodLiteral<"devmesh.local-dataset-receipt.v2">;
        purpose: z.ZodLiteral<"ACCEPTANCE">;
        operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
        requestHash: z.ZodString;
        fencesHash: z.ZodString;
        data: z.ZodObject<{
          datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
          storageKey: z.ZodString;
          schemaRevision: z.ZodString;
          originDatasetId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "dataset", "out">>;
          sourceReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
          snapshotAt: z.ZodISODateTime;
          sha256: z.ZodString;
          byteSize: z.ZodNumber;
          integrity: z.ZodLiteral<"ok">;
          journalHash: z.ZodString;
          migrationRef: z.ZodNullable<z.ZodObject<{
            artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
            sha256: z.ZodString;
          }, z.core.$strict>>;
        }, z.core.$strict>;
      }, z.core.$strict>;
      fences: z.ZodObject<{
        schemaVersion: z.ZodLiteral<"devmesh.local-dataset-fences.v1">;
        operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
        requestHash: z.ZodString;
        sourceFence: z.ZodNullable<z.ZodObject<{
          datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
          datasetOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
          closeOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
          closeRequestHash: z.ZodString;
          gateFence: z.ZodNumber;
          physical: z.ZodObject<{
            kind: z.ZodLiteral<"DURABLE_WRITE_FENCE">;
            fenceId: z.ZodString;
            generation: z.ZodNumber;
            proofHash: z.ZodString;
            heldAt: z.ZodISODateTime;
            state: z.ZodLiteral<"HELD">;
          }, z.core.$strict>;
        }, z.core.$strict>>;
        targetFence: z.ZodObject<{
          datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
          physical: z.ZodObject<{
            kind: z.ZodLiteral<"DURABLE_WRITE_FENCE">;
            fenceId: z.ZodString;
            generation: z.ZodNumber;
            proofHash: z.ZodString;
            heldAt: z.ZodISODateTime;
            state: z.ZodLiteral<"HELD">;
          }, z.core.$strict>;
          writeState: z.ZodLiteral<"CLOSED">;
        }, z.core.$strict>;
      }, z.core.$strict>;
    }, z.core.$strict>;
    requestHash: z.ZodString;
    resourceLimits: z.ZodObject<{
      cpu: z.ZodNumber;
      memoryMiB: z.ZodNumber;
      pids: z.ZodNumber;
      temporaryMiB: z.ZodNumber;
    }, z.core.$strict>;
    capacity: z.ZodObject<{
      maximumJobs: z.ZodNumber;
      cpu: z.ZodNumber;
      memoryMiB: z.ZodNumber;
    }, z.core.$strict>;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  acceptanceServiceGet: z.ZodObject<{
    reservationId: z.ZodString;
    requestHash: z.ZodString;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  acceptanceServiceByOperation: z.ZodObject<{
    operationId: z.ZodString;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  acceptanceServicePage: z.ZodObject<{
    afterSequence: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  acceptanceServiceDispatch: z.ZodObject<{
    reservationId: z.ZodString;
    requestHash: z.ZodString;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  acceptanceServiceCancel: z.ZodObject<{
    reservationId: z.ZodString;
    requestHash: z.ZodString;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  acceptanceServiceRecord: z.ZodObject<{
    expectedRevision: z.ZodNumber;
    fact: z.ZodObject<{
      operationId: z.ZodString;
      releaseId: z.ZodString;
      datasetId: z.ZodString;
      imageDigest: z.ZodString;
      state: z.ZodEnum<{
        EXITED: "EXITED";
        CREATED: "CREATED";
        HEALTHY: "HEALTHY";
        UNHEALTHY: "UNHEALTHY";
        UNKNOWN: "UNKNOWN";
      }>;
      instanceId: z.ZodNullable<z.ZodString>;
      endpoint: z.ZodNullable<z.ZodObject<{
        host: z.ZodLiteral<"127.0.0.1">;
        port: z.ZodNumber;
      }, z.core.$strict>>;
      checkedAt: z.ZodISODateTime;
    }, z.core.$strict>;
    reservationId: z.ZodString;
    requestHash: z.ZodString;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  acceptanceServiceProfilePrepare: z.ZodObject<{
    profile: z.ZodObject<{
      resourceLimits: z.ZodObject<{
        cpu: z.ZodNumber;
        memoryMiB: z.ZodNumber;
        pids: z.ZodNumber;
        temporaryMiB: z.ZodNumber;
      }, z.core.$strict>;
      requestHash: z.ZodString;
      reservationId: z.ZodString;
      repository: z.ZodString;
      datasetDirectory: z.ZodString;
      datasetBytes: z.ZodNumber;
      networkName: z.ZodString;
      containerName: z.ZodString;
      schemaVersion: z.ZodLiteral<"devmesh.acceptance-service-profile.v1">;
      purpose: z.ZodLiteral<"ACCEPTANCE">;
      accessMode: z.ZodLiteral<"READ_ONLY">;
    }, z.core.$strict>;
    reservationId: z.ZodString;
    requestHash: z.ZodString;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  acceptanceServiceJournal: z.ZodObject<{
    reservationId: z.ZodString;
    requestHash: z.ZodString;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  acceptanceServiceActionBegin: z.ZodObject<{
    kind: z.ZodEnum<{
      NETWORK_CREATE: "NETWORK_CREATE";
      CREATE: "CREATE";
      START: "START";
    }>;
    reservationId: z.ZodString;
    requestHash: z.ZodString;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  acceptanceServiceActionAuthorized: z.ZodObject<{
    kind: z.ZodEnum<{
      NETWORK_CREATE: "NETWORK_CREATE";
      CREATE: "CREATE";
      START: "START";
    }>;
    actionRequestHash: z.ZodString;
    reservationId: z.ZodString;
    requestHash: z.ZodString;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  acceptanceServiceActionObserve: z.ZodObject<{
    kind: z.ZodEnum<{
      NETWORK_CREATE: "NETWORK_CREATE";
      CREATE: "CREATE";
      START: "START";
    }>;
    actionRequestHash: z.ZodString;
    observation: z.ZodObject<{
      objectId: z.ZodString;
      state: z.ZodEnum<{
        RUNNING: "RUNNING";
        EXITED: "EXITED";
        CREATED: "CREATED";
      }>;
      checkedAt: z.ZodISODateTime;
    }, z.core.$strict>;
    reservationId: z.ZodString;
    requestHash: z.ZodString;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  acceptanceServiceHold: z.ZodObject<{
    claim: z.ZodObject<{
      schemaVersion: z.ZodLiteral<"devmesh.acceptance-service-claim.v1">;
      purpose: z.ZodLiteral<"ACCEPTANCE">;
      operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      acceptanceRequestHash: z.ZodString;
      releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
      projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
      runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
      candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
      manifestHash: z.ZodString;
      reviewHash: z.ZodString;
      dataPlanHash: z.ZodString;
      datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
      imageDigest: z.ZodString;
      reservationId: z.ZodString;
      profileHash: z.ZodString;
      serviceRequestHash: z.ZodString;
      instanceId: z.ZodString;
    }, z.core.$strict>;
    claimHash: z.ZodString;
    reservationId: z.ZodString;
    requestHash: z.ZodString;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  acceptanceServicePrepareProof: z.ZodObject<{
    reservationId: z.ZodString;
    requestHash: z.ZodString;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  previewCleanupGet: z.ZodObject<{
    reservationId: z.ZodString;
    requestHash: z.ZodString;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  previewCleanupPage: z.ZodObject<{
    afterSequence: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  previewCleanupActionBegin: z.ZodObject<{
    kind: z.ZodEnum<{
      CONTAINER_REMOVE: "CONTAINER_REMOVE";
      NETWORK_REMOVE: "NETWORK_REMOVE";
    }>;
    reservationId: z.ZodString;
    requestHash: z.ZodString;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  previewCleanupActionAuthorized: z.ZodObject<{
    kind: z.ZodEnum<{
      CONTAINER_REMOVE: "CONTAINER_REMOVE";
      NETWORK_REMOVE: "NETWORK_REMOVE";
    }>;
    actionRequestHash: z.ZodString;
    reservationId: z.ZodString;
    requestHash: z.ZodString;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  previewCleanupActionObserve: z.ZodObject<{
    kind: z.ZodEnum<{
      CONTAINER_REMOVE: "CONTAINER_REMOVE";
      NETWORK_REMOVE: "NETWORK_REMOVE";
    }>;
    actionRequestHash: z.ZodString;
    observation: z.ZodObject<{
      objectId: z.ZodString;
      absenceVerified: z.ZodLiteral<true>;
      checkedAt: z.ZodISODateTime;
    }, z.core.$strict>;
    reservationId: z.ZodString;
    requestHash: z.ZodString;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  previewLifecycleEnroll: z.ZodObject<{
    reservationId: z.ZodString;
    requestHash: z.ZodString;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  previewLifecycleGet: z.ZodObject<{
    reservationId: z.ZodString;
    requestHash: z.ZodString;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  previewExpiryPrepare: z.ZodObject<{
    reservationId: z.ZodString;
    requestHash: z.ZodString;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  previewExpiryAuthorized: z.ZodObject<{
    expiryRequestHash: z.ZodString;
    reservationId: z.ZodString;
    requestHash: z.ZodString;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  previewLifecycleActionAuthorized: z.ZodObject<{
    kind: z.ZodEnum<{
      STOP: "STOP";
      NETWORK_CREATE: "NETWORK_CREATE";
      CREATE: "CREATE";
      START: "START";
    }>;
    actionRequestHash: z.ZodString;
    reservationId: z.ZodString;
    requestHash: z.ZodString;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  previewReleaseHold: z.ZodObject<{
    claim: z.ZodObject<{
      schemaVersion: z.ZodLiteral<"devmesh.preview-release-claim.v1">;
      operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
      candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
      manifestHash: z.ZodString;
      previewId: z.core.$ZodBranded<z.ZodString, "preview", "out">;
      datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
      imageDigest: z.ZodString;
      startOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      startRequestHash: z.ZodString;
      instanceId: z.ZodString;
      acceptanceRequestHash: z.ZodString;
    }, z.core.$strict>;
    claimHash: z.ZodString;
    reservationId: z.ZodString;
    requestHash: z.ZodString;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  previewReleaseCommit: z.ZodObject<{
    claimHash: z.ZodString;
    releaseId: z.ZodString;
    acceptanceOperationId: z.ZodString;
    acceptanceRequestHash: z.ZodString;
    reservationId: z.ZodString;
    requestHash: z.ZodString;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  previewContainerPrepare: z.ZodObject<{
    profile: z.ZodObject<{
      schemaVersion: z.ZodLiteral<"devmesh.preview-container-profile.v1">;
      reservationId: z.ZodString;
      requestHash: z.ZodString;
      repository: z.ZodString;
      datasetDirectory: z.ZodString;
      datasetBytes: z.ZodNumber;
      resourceLimits: z.ZodObject<{
        cpu: z.ZodNumber;
        memoryMiB: z.ZodNumber;
        pids: z.ZodNumber;
        temporaryMiB: z.ZodNumber;
      }, z.core.$strict>;
      networkName: z.ZodString;
      containerName: z.ZodString;
    }, z.core.$strict>;
    reservationId: z.ZodString;
    requestHash: z.ZodString;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  previewContainerGet: z.ZodObject<{
    reservationId: z.ZodString;
    requestHash: z.ZodString;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  previewContainerActionBegin: z.ZodObject<{
    action: z.ZodObject<{
      kind: z.ZodEnum<{
        STOP: "STOP";
        NETWORK_CREATE: "NETWORK_CREATE";
        CREATE: "CREATE";
        START: "START";
      }>;
      requestHash: z.ZodString;
      request: z.ZodUnion<readonly [z.ZodObject<{
        manifestHash: z.ZodString;
        storageKey: z.ZodString;
        datasetOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
        templateVersion: z.ZodString;
        schemaRevision: z.ZodString;
        imageIdentity: z.ZodObject<{
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
        expiresAt: z.ZodISODateTime;
        operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
        projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
        runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
        candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
        policyHash: z.ZodString;
        backendRef: z.ZodString;
        runnerId: z.ZodString;
        previewId: z.core.$ZodBranded<z.ZodString, "preview", "out">;
        datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
        imageDigest: z.ZodString;
        schemaVersion: z.ZodLiteral<"devmesh.preview-start.v1">;
      }, z.core.$strict>, z.ZodObject<{
        startOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
        startRequestHash: z.ZodString;
        instanceId: z.ZodString;
        reason: z.ZodEnum<{
          USER: "USER";
          EXPIRED: "EXPIRED";
        }>;
        operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
        projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
        runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
        candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
        policyHash: z.ZodString;
        backendRef: z.ZodString;
        runnerId: z.ZodString;
        previewId: z.core.$ZodBranded<z.ZodString, "preview", "out">;
        datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
        imageDigest: z.ZodString;
        schemaVersion: z.ZodLiteral<"devmesh.preview-stop.v1">;
      }, z.core.$strict>]>;
    }, z.core.$strict>;
    reservationId: z.ZodString;
    requestHash: z.ZodString;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  previewContainerActionObserve: z.ZodObject<{
    kind: z.ZodEnum<{
      STOP: "STOP";
      NETWORK_CREATE: "NETWORK_CREATE";
      CREATE: "CREATE";
      START: "START";
    }>;
    actionRequestHash: z.ZodString;
    observation: z.ZodObject<{
      objectId: z.ZodString;
      state: z.ZodEnum<{
        RUNNING: "RUNNING";
        EXITED: "EXITED";
        CREATED: "CREATED";
      }>;
      checkedAt: z.ZodISODateTime;
    }, z.core.$strict>;
    reservationId: z.ZodString;
    requestHash: z.ZodString;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  capacityConfigure: z.ZodObject<{
    maximumJobs: z.ZodNumber;
    cpu: z.ZodNumber;
    memoryMiB: z.ZodNumber;
  }, z.core.$strict>;
  capacityUsage: z.ZodObject<{}, z.core.$strict>;
  previewReserve: z.ZodObject<{
    request: z.ZodObject<{
      manifestHash: z.ZodString;
      storageKey: z.ZodString;
      datasetOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      templateVersion: z.ZodString;
      schemaRevision: z.ZodString;
      imageIdentity: z.ZodObject<{
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
      expiresAt: z.ZodISODateTime;
      operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
      runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
      candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
      policyHash: z.ZodString;
      backendRef: z.ZodString;
      runnerId: z.ZodString;
      previewId: z.core.$ZodBranded<z.ZodString, "preview", "out">;
      datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
      imageDigest: z.ZodString;
      schemaVersion: z.ZodLiteral<"devmesh.preview-start.v1">;
    }, z.core.$strict>;
    requestHash: z.ZodString;
    resourceLimits: z.ZodObject<{
      cpu: z.ZodNumber;
      memoryMiB: z.ZodNumber;
      pids: z.ZodNumber;
      temporaryMiB: z.ZodNumber;
    }, z.core.$strict>;
    capacity: z.ZodObject<{
      maximumJobs: z.ZodNumber;
      cpu: z.ZodNumber;
      memoryMiB: z.ZodNumber;
    }, z.core.$strict>;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  previewReservationGet: z.ZodObject<{
    reservationId: z.ZodString;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  previewReservationByOperation: z.ZodObject<{
    operationId: z.ZodString;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  previewReservationPage: z.ZodObject<{
    afterSequence: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  previewReservationDispatch: z.ZodObject<{
    reservationId: z.ZodString;
    requestHash: z.ZodString;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  previewReservationCancel: z.ZodObject<{
    reservationId: z.ZodString;
    requestHash: z.ZodString;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  previewReservationRecord: z.ZodObject<{
    reservationId: z.ZodString;
    requestHash: z.ZodString;
    expectedRevision: z.ZodNumber;
    fact: z.ZodObject<{
      previewId: z.core.$ZodBranded<z.ZodString, "preview", "out">;
      datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
      imageDigest: z.ZodString;
      state: z.ZodEnum<{
        EXITED: "EXITED";
        CREATED: "CREATED";
        HEALTHY: "HEALTHY";
        UNHEALTHY: "UNHEALTHY";
        UNKNOWN: "UNKNOWN";
        REMOVED: "REMOVED";
      }>;
      instanceId: z.ZodNullable<z.ZodString>;
      endpoint: z.ZodNullable<z.ZodObject<{
        host: z.ZodLiteral<"127.0.0.1">;
        port: z.ZodNumber;
      }, z.core.$strict>>;
      checkedAt: z.ZodISODateTime;
    }, z.core.$strict>;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  fenceAcquire: z.ZodObject<{
    request: z.ZodObject<{
      operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      parentOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      workspaceRef: z.ZodString;
      permit: z.ZodDiscriminatedUnion<[z.ZodObject<{
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
      holderToken: z.ZodUUID;
      purpose: z.ZodOptional<z.ZodEnum<{
        write: "write";
        cleanup: "cleanup";
      }>>;
    }, z.core.$strict>;
    workspacePath: z.ZodString;
    binding: z.ZodObject<{
      attemptId: z.ZodString;
      ownerKind: z.ZodEnum<{
        workflowAttempt: "workflowAttempt";
        invocationAttempt: "invocationAttempt";
      }>;
      resourceId: z.ZodString;
      relativePath: z.ZodString;
      sourceDirectory: z.ZodOptional<z.ZodLiteral<"repo">>;
    }, z.core.$strict>;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  fenceGet: z.ZodObject<{
    fenceId: z.ZodString;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  fenceByOperation: z.ZodObject<{
    operationId: z.ZodString;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  fenceActive: z.ZodObject<{
    workspaceRef: z.ZodString;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  fenceRelease: z.ZodObject<{
    fenceId: z.ZodString;
    release: z.ZodObject<{
      holderToken: z.ZodUUID;
      requestHash: z.ZodString;
    }, z.core.$strict>;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  workspaceBinding: z.ZodObject<{
    workspaceRef: z.ZodString;
  }, z.core.$strict>;
  register: z.ZodObject<{
    request: z.ZodObject<{
      schemaVersion: z.ZodLiteral<"devmesh.runner-job.v1">;
      operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      permit: z.ZodDiscriminatedUnion<[z.ZodObject<{
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
      imageDigest: z.ZodString;
      workspaceRef: z.ZodString;
      commandSpec: z.ZodObject<{
        kind: z.ZodEnum<{
          install: "install";
          build: "build";
          unit: "unit";
          e2e: "e2e";
          preview: "preview";
        }>;
      }, z.core.$strict>;
      resourceLimits: z.ZodObject<{
        cpu: z.ZodNumber;
        memoryMiB: z.ZodNumber;
        pids: z.ZodNumber;
        temporaryMiB: z.ZodNumber;
        timeoutMs: z.ZodNumber;
      }, z.core.$strict>;
      networkPolicyRef: z.ZodString;
      outputSpec: z.ZodArray<z.ZodString>;
    }, z.core.$strict>;
    execution: z.ZodObject<{
      workspacePath: z.ZodString;
      argv: z.ZodArray<z.ZodString>;
    }, z.core.$strict>;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  get: z.ZodObject<{
    jobId: z.ZodString;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  byOperation: z.ZodObject<{
    operationId: z.ZodString;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  pending: z.ZodObject<{
    limit: z.ZodDefault<z.ZodNumber>;
  }, z.core.$strict>;
  active: z.ZodObject<{}, z.core.$strict>;
  claim: z.ZodObject<{
    jobId: z.ZodString;
    maximumJobs: z.ZodNumber;
    cpu: z.ZodNumber;
    memoryMiB: z.ZodNumber;
  }, z.core.$strict>;
  stop: z.ZodObject<{
    jobId: z.ZodString;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  renew: z.ZodObject<{
    jobId: z.ZodString;
    renewal: z.ZodObject<{
      permit: z.ZodDiscriminatedUnion<[z.ZodObject<{
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
      sequence: z.ZodNumber;
    }, z.core.$strict>;
    controllerId: z.ZodString;
  }, z.core.$strict>;
  record: z.ZodObject<{
    jobId: z.ZodString;
    state: z.ZodEnum<{
      RUNNING: "RUNNING";
      STOPPING: "STOPPING";
      EXITED: "EXITED";
      OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN";
    }>;
    containerId: z.ZodNullable<z.ZodString>;
    exitCode: z.ZodNullable<z.ZodNumber>;
    evidence: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodJSONSchema>>;
    errorCode: z.ZodNullable<z.ZodString>;
    materials: z.ZodOptional<z.ZodObject<{
      logCursor: z.ZodNumber;
      outputRefs: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        sha256: z.ZodString;
        byteSize: z.ZodNumber;
      }, z.core.$strict>>;
    }, z.core.$strict>>;
  }, z.core.$strict>;
  inspect: z.ZodObject<{}, z.core.$strict>;
  releaseServiceEnroll: z.ZodObject<{
    controllerId: z.ZodString;
    request: z.ZodObject<{
      promotion: z.ZodObject<{
        schemaVersion: z.ZodLiteral<"devmesh.release-promotion.v1">;
        acceptanceOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
        preparation: z.ZodObject<{
          runEpoch: z.ZodNumber;
          requirementRevision: z.ZodNumber;
          planRevision: z.ZodNumber;
          codeCommit: z.ZodString;
          image: z.ZodObject<{
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
          policyHash: z.ZodString;
          backendPrincipalId: z.ZodString;
          backendRef: z.ZodString;
          runnerId: z.ZodString;
          source: z.ZodNullable<z.ZodObject<{
            releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
            datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
            datasetOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
            storageKey: z.ZodString;
            schemaRevision: z.ZodString;
          }, z.core.$strict>>;
          target: z.ZodObject<{
            datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
            storageKey: z.ZodString;
            schemaRevision: z.ZodString;
          }, z.core.$strict>;
          candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
          candidateRevision: z.ZodNumber;
          manifestHash: z.ZodString;
          reviewHash: z.ZodString;
          expectedAcceptedReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
          dataPlanHash: z.ZodString;
          schemaVersion: z.ZodLiteral<"devmesh.acceptance-prepare.v1">;
          operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
          releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
          projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
          runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
        }, z.core.$strict>;
        preparedProof: z.ZodObject<{
          schemaVersion: z.ZodLiteral<"devmesh.acceptance-prepared.v1">;
          operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
          requestHash: z.ZodString;
          releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
          projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
          runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
          candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
          manifestHash: z.ZodString;
          reviewHash: z.ZodString;
          dataPlanHash: z.ZodString;
          runnerId: z.ZodString;
          backendRef: z.ZodString;
          data: z.ZodObject<{
            datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
            storageKey: z.ZodString;
            schemaRevision: z.ZodString;
            originDatasetId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "dataset", "out">>;
            sourceReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
            snapshotAt: z.ZodISODateTime;
            sha256: z.ZodString;
            byteSize: z.ZodNumber;
            integrity: z.ZodLiteral<"ok">;
            journalHash: z.ZodString;
            migrationRef: z.ZodNullable<z.ZodObject<{
              artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
              sha256: z.ZodString;
            }, z.core.$strict>>;
          }, z.core.$strict>;
          sourceFence: z.ZodNullable<z.ZodObject<{
            datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
            datasetOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
            closeOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
            closeRequestHash: z.ZodString;
            gateFence: z.ZodNumber;
            physical: z.ZodObject<{
              kind: z.ZodLiteral<"DURABLE_WRITE_FENCE">;
              fenceId: z.ZodString;
              generation: z.ZodNumber;
              proofHash: z.ZodString;
              heldAt: z.ZodISODateTime;
              state: z.ZodLiteral<"HELD">;
            }, z.core.$strict>;
          }, z.core.$strict>>;
          targetFence: z.ZodObject<{
            datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
            physical: z.ZodObject<{
              kind: z.ZodLiteral<"DURABLE_WRITE_FENCE">;
              fenceId: z.ZodString;
              generation: z.ZodNumber;
              proofHash: z.ZodString;
              heldAt: z.ZodISODateTime;
              state: z.ZodLiteral<"HELD">;
            }, z.core.$strict>;
            writeState: z.ZodLiteral<"CLOSED">;
          }, z.core.$strict>;
          service: z.ZodObject<{
            reservationId: z.ZodString;
            profileHash: z.ZodString;
            endpoint: z.ZodObject<{
              host: z.ZodLiteral<"127.0.0.1">;
              port: z.ZodNumber;
            }, z.core.$strict>;
            claim: z.ZodDiscriminatedUnion<[z.ZodObject<{
              schemaVersion: z.ZodLiteral<"devmesh.preview-release-claim.v1">;
              operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
              releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
              candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
              manifestHash: z.ZodString;
              previewId: z.core.$ZodBranded<z.ZodString, "preview", "out">;
              datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
              imageDigest: z.ZodString;
              startOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
              startRequestHash: z.ZodString;
              instanceId: z.ZodString;
              acceptanceRequestHash: z.ZodString;
            }, z.core.$strict>, z.ZodObject<{
              schemaVersion: z.ZodLiteral<"devmesh.acceptance-service-claim.v1">;
              purpose: z.ZodLiteral<"ACCEPTANCE">;
              operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
              acceptanceRequestHash: z.ZodString;
              releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
              projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
              runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
              candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
              manifestHash: z.ZodString;
              reviewHash: z.ZodString;
              dataPlanHash: z.ZodString;
              datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
              imageDigest: z.ZodString;
              reservationId: z.ZodString;
              profileHash: z.ZodString;
              serviceRequestHash: z.ZodString;
              instanceId: z.ZodString;
            }, z.core.$strict>], "schemaVersion">;
            claimHash: z.ZodString;
            custodyState: z.ZodLiteral<"RELEASE_HELD">;
            custodyRevision: z.ZodNumber;
          }, z.core.$strict>;
          preparedAt: z.ZodISODateTime;
        }, z.core.$strict>;
        proofHash: z.ZodString;
      }, z.core.$strict>;
      promotionRequestHash: z.ZodString;
      gates: z.ZodObject<{
        sourceGate: z.ZodNullable<z.ZodObject<{
          datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
          datasetOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
          datasetRequestHash: z.ZodString;
          state: z.ZodEnum<{
            CLOSED: "CLOSED";
            OPEN: "OPEN";
          }>;
          fence: z.ZodNumber;
          revision: z.ZodNumber;
          closeOperationId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "op", "out">>;
          closeRequestHash: z.ZodNullable<z.ZodString>;
        }, z.core.$strict>>;
        targetGate: z.ZodObject<{
          datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
          datasetOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
          datasetRequestHash: z.ZodString;
          state: z.ZodEnum<{
            CLOSED: "CLOSED";
            OPEN: "OPEN";
          }>;
          fence: z.ZodNumber;
          revision: z.ZodNumber;
          closeOperationId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "op", "out">>;
          closeRequestHash: z.ZodNullable<z.ZodString>;
        }, z.core.$strict>;
        previousRoute: z.ZodNullable<z.ZodObject<{
          releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
          routeHash: z.ZodString;
          generation: z.ZodNumber;
        }, z.core.$strict>>;
      }, z.core.$strict>;
      schemaVersion: z.ZodLiteral<"devmesh.release-service-start.v1">;
      purpose: z.ZodLiteral<"RELEASE">;
      retirementRequestHash: z.ZodString;
    }, z.core.$strict>;
    requestHash: z.ZodString;
    resourceLimits: z.ZodObject<{
      cpu: z.ZodNumber;
      memoryMiB: z.ZodNumber;
      pids: z.ZodNumber;
      temporaryMiB: z.ZodNumber;
    }, z.core.$strict>;
  }, z.core.$strict>;
  releaseServiceGet: z.ZodObject<{
    controllerId: z.ZodString;
    releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
    requestHash: z.ZodString;
  }, z.core.$strict>;
  releaseServicePage: z.ZodObject<{
    controllerId: z.ZodString;
    afterSequence: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
  }, z.core.$strict>;
  releaseServiceReserve: z.ZodObject<{
    capacity: z.ZodObject<{
      maximumJobs: z.ZodNumber;
      cpu: z.ZodNumber;
      memoryMiB: z.ZodNumber;
    }, z.core.$strict>;
    controllerId: z.ZodString;
    releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
    requestHash: z.ZodString;
  }, z.core.$strict>;
  releaseServiceProfilePrepare: z.ZodObject<{
    profile: z.ZodObject<{
      resourceLimits: z.ZodObject<{
        cpu: z.ZodNumber;
        memoryMiB: z.ZodNumber;
        pids: z.ZodNumber;
        temporaryMiB: z.ZodNumber;
      }, z.core.$strict>;
      requestHash: z.ZodString;
      reservationId: z.ZodString;
      repository: z.ZodString;
      datasetDirectory: z.ZodString;
      datasetBytes: z.ZodNumber;
      networkName: z.ZodString;
      containerName: z.ZodString;
      schemaVersion: z.ZodLiteral<"devmesh.release-service-profile.v1">;
      purpose: z.ZodLiteral<"RELEASE">;
      accessMode: z.ZodLiteral<"READ_WRITE">;
      writeAdmission: z.ZodLiteral<"CONTROL_GATE_FENCED">;
      fenceProofHash: z.ZodString;
      gateBindingHash: z.ZodString;
    }, z.core.$strict>;
    controllerId: z.ZodString;
    releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
    requestHash: z.ZodString;
  }, z.core.$strict>;
  releaseServiceActionBegin: z.ZodObject<{
    kind: z.ZodEnum<{
      ARM_FENCES: "ARM_FENCES";
      SOURCE_STOP: "SOURCE_STOP";
      SOURCE_CONTAINER_REMOVE: "SOURCE_CONTAINER_REMOVE";
      SOURCE_NETWORK_REMOVE: "SOURCE_NETWORK_REMOVE";
      PROFILE_PREPARE: "PROFILE_PREPARE";
      GUARD_ENFORCE: "GUARD_ENFORCE";
      NETWORK_CREATE: "NETWORK_CREATE";
      CREATE: "CREATE";
      START: "START";
      ROUTE_BIND: "ROUTE_BIND";
    }>;
    controllerId: z.ZodString;
    releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
    requestHash: z.ZodString;
  }, z.core.$strict>;
  releaseServiceActionAuthorized: z.ZodObject<{
    kind: z.ZodEnum<{
      ARM_FENCES: "ARM_FENCES";
      SOURCE_STOP: "SOURCE_STOP";
      SOURCE_CONTAINER_REMOVE: "SOURCE_CONTAINER_REMOVE";
      SOURCE_NETWORK_REMOVE: "SOURCE_NETWORK_REMOVE";
      PROFILE_PREPARE: "PROFILE_PREPARE";
      GUARD_ENFORCE: "GUARD_ENFORCE";
      NETWORK_CREATE: "NETWORK_CREATE";
      CREATE: "CREATE";
      START: "START";
      ROUTE_BIND: "ROUTE_BIND";
    }>;
    actionRequestHash: z.ZodString;
    controllerId: z.ZodString;
    releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
    requestHash: z.ZodString;
  }, z.core.$strict>;
  releaseServiceActionObserve: z.ZodObject<{
    kind: z.ZodEnum<{
      ARM_FENCES: "ARM_FENCES";
      SOURCE_STOP: "SOURCE_STOP";
      SOURCE_CONTAINER_REMOVE: "SOURCE_CONTAINER_REMOVE";
      SOURCE_NETWORK_REMOVE: "SOURCE_NETWORK_REMOVE";
      PROFILE_PREPARE: "PROFILE_PREPARE";
      GUARD_ENFORCE: "GUARD_ENFORCE";
      NETWORK_CREATE: "NETWORK_CREATE";
      CREATE: "CREATE";
      START: "START";
      ROUTE_BIND: "ROUTE_BIND";
    }>;
    actionRequestHash: z.ZodString;
    observation: z.ZodDiscriminatedUnion<[z.ZodObject<{
      kind: z.ZodLiteral<"ARM_FENCES">;
      proof: z.ZodObject<{
        schemaVersion: z.ZodLiteral<"devmesh.release-service-fences.v1">;
        releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
        promotionRequestHash: z.ZodString;
        retirementRequestHash: z.ZodString;
        revocationProofHash: z.ZodString;
        target: z.ZodObject<{
          fenceId: z.ZodString;
          generation: z.ZodNumber;
          proofHash: z.ZodString;
          previousHoldHash: z.ZodString;
          datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
          owner: z.ZodLiteral<"RELEASE">;
          state: z.ZodLiteral<"ARMED">;
          writeState: z.ZodLiteral<"CONTROL_CLOSED">;
        }, z.core.$strict>;
        source: z.ZodNullable<z.ZodObject<{
          fenceId: z.ZodString;
          generation: z.ZodNumber;
          proofHash: z.ZodString;
          previousHoldHash: z.ZodString;
          releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
          datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
          datasetOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
          state: z.ZodLiteral<"RETIRED">;
          writeState: z.ZodLiteral<"CLOSED">;
        }, z.core.$strict>>;
      }, z.core.$strict>;
      checkedAt: z.ZodISODateTime;
    }, z.core.$strict>, z.ZodObject<{
      kind: z.ZodLiteral<"PROFILE_PREPARE">;
      profileHash: z.ZodString;
      checkedAt: z.ZodISODateTime;
    }, z.core.$strict>, z.ZodObject<{
      kind: z.ZodLiteral<"GUARD_ENFORCE">;
      proof: z.ZodObject<{
        schemaVersion: z.ZodLiteral<"devmesh.release-service-guard.v1">;
        releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
        runnerId: z.ZodString;
        controllerId: z.ZodString;
        serviceRequestHash: z.ZodString;
        reservationId: z.ZodString;
        profileHash: z.ZodString;
        datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
        targetProofHash: z.ZodString;
        gateBindingHash: z.ZodString;
        guardId: z.ZodString;
        proofHash: z.ZodString;
        scope: z.ZodLiteral<"ALL_DATASET_WRITES">;
        writeAdmission: z.ZodLiteral<"CONTROL_GATE_FENCED">;
        state: z.ZodLiteral<"ENFORCED">;
      }, z.core.$strict>;
      checkedAt: z.ZodISODateTime;
    }, z.core.$strict>, z.ZodObject<{
      kind: z.ZodEnum<{
        SOURCE_STOP: "SOURCE_STOP";
        NETWORK_CREATE: "NETWORK_CREATE";
        CREATE: "CREATE";
        START: "START";
      }>;
      objectId: z.ZodString;
      state: z.ZodEnum<{
        RUNNING: "RUNNING";
        EXITED: "EXITED";
        CREATED: "CREATED";
      }>;
      checkedAt: z.ZodISODateTime;
    }, z.core.$strict>, z.ZodObject<{
      kind: z.ZodEnum<{
        SOURCE_CONTAINER_REMOVE: "SOURCE_CONTAINER_REMOVE";
        SOURCE_NETWORK_REMOVE: "SOURCE_NETWORK_REMOVE";
      }>;
      objectId: z.ZodString;
      absenceVerified: z.ZodLiteral<true>;
      checkedAt: z.ZodISODateTime;
    }, z.core.$strict>, z.ZodObject<{
      kind: z.ZodLiteral<"ROUTE_BIND">;
      route: z.ZodObject<{
        schemaVersion: z.ZodLiteral<"devmesh.release-route.v1">;
        routeId: z.ZodString;
        generation: z.ZodNumber;
        projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
        releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
        previousReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
        datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
        imageDigest: z.ZodString;
        instanceId: z.ZodString;
        endpoint: z.ZodObject<{
          host: z.ZodLiteral<"127.0.0.1">;
          port: z.ZodNumber;
        }, z.core.$strict>;
        serviceClaimHash: z.ZodString;
        state: z.ZodLiteral<"BOUND">;
      }, z.core.$strict>;
      routeHash: z.ZodString;
      checkedAt: z.ZodISODateTime;
    }, z.core.$strict>], "kind">;
    controllerId: z.ZodString;
    releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
    requestHash: z.ZodString;
  }, z.core.$strict>;
  releaseServiceRecord: z.ZodObject<{
    expectedRevision: z.ZodNumber;
    fact: z.ZodObject<{
      releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
      datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
      imageDigest: z.ZodString;
      state: z.ZodEnum<{
        EXITED: "EXITED";
        CREATED: "CREATED";
        HEALTHY: "HEALTHY";
        UNHEALTHY: "UNHEALTHY";
        UNKNOWN: "UNKNOWN";
      }>;
      instanceId: z.ZodNullable<z.ZodString>;
      endpoint: z.ZodNullable<z.ZodObject<{
        host: z.ZodLiteral<"127.0.0.1">;
        port: z.ZodNumber;
      }, z.core.$strict>>;
      checkedAt: z.ZodISODateTime;
    }, z.core.$strict>;
    controllerId: z.ZodString;
    releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
    requestHash: z.ZodString;
  }, z.core.$strict>;
  releaseServiceOwn: z.ZodObject<{
    controllerId: z.ZodString;
    releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
    requestHash: z.ZodString;
  }, z.core.$strict>;
  releaseServicePrepareProof: z.ZodObject<{
    controllerId: z.ZodString;
    releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
    requestHash: z.ZodString;
  }, z.core.$strict>;
  releaseRetirementEnroll: z.ZodObject<{
    controllerId: z.ZodString;
    request: z.ZodObject<{
      schemaVersion: z.ZodLiteral<"devmesh.release-retirement.v1">;
      promotion: z.ZodObject<{
        schemaVersion: z.ZodLiteral<"devmesh.release-promotion.v1">;
        acceptanceOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
        preparation: z.ZodObject<{
          runEpoch: z.ZodNumber;
          requirementRevision: z.ZodNumber;
          planRevision: z.ZodNumber;
          codeCommit: z.ZodString;
          image: z.ZodObject<{
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
          policyHash: z.ZodString;
          backendPrincipalId: z.ZodString;
          backendRef: z.ZodString;
          runnerId: z.ZodString;
          source: z.ZodNullable<z.ZodObject<{
            releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
            datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
            datasetOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
            storageKey: z.ZodString;
            schemaRevision: z.ZodString;
          }, z.core.$strict>>;
          target: z.ZodObject<{
            datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
            storageKey: z.ZodString;
            schemaRevision: z.ZodString;
          }, z.core.$strict>;
          candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
          candidateRevision: z.ZodNumber;
          manifestHash: z.ZodString;
          reviewHash: z.ZodString;
          expectedAcceptedReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
          dataPlanHash: z.ZodString;
          schemaVersion: z.ZodLiteral<"devmesh.acceptance-prepare.v1">;
          operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
          releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
          projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
          runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
        }, z.core.$strict>;
        preparedProof: z.ZodObject<{
          schemaVersion: z.ZodLiteral<"devmesh.acceptance-prepared.v1">;
          operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
          requestHash: z.ZodString;
          releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
          projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
          runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
          candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
          manifestHash: z.ZodString;
          reviewHash: z.ZodString;
          dataPlanHash: z.ZodString;
          runnerId: z.ZodString;
          backendRef: z.ZodString;
          data: z.ZodObject<{
            datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
            storageKey: z.ZodString;
            schemaRevision: z.ZodString;
            originDatasetId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "dataset", "out">>;
            sourceReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
            snapshotAt: z.ZodISODateTime;
            sha256: z.ZodString;
            byteSize: z.ZodNumber;
            integrity: z.ZodLiteral<"ok">;
            journalHash: z.ZodString;
            migrationRef: z.ZodNullable<z.ZodObject<{
              artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
              sha256: z.ZodString;
            }, z.core.$strict>>;
          }, z.core.$strict>;
          sourceFence: z.ZodNullable<z.ZodObject<{
            datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
            datasetOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
            closeOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
            closeRequestHash: z.ZodString;
            gateFence: z.ZodNumber;
            physical: z.ZodObject<{
              kind: z.ZodLiteral<"DURABLE_WRITE_FENCE">;
              fenceId: z.ZodString;
              generation: z.ZodNumber;
              proofHash: z.ZodString;
              heldAt: z.ZodISODateTime;
              state: z.ZodLiteral<"HELD">;
            }, z.core.$strict>;
          }, z.core.$strict>>;
          targetFence: z.ZodObject<{
            datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
            physical: z.ZodObject<{
              kind: z.ZodLiteral<"DURABLE_WRITE_FENCE">;
              fenceId: z.ZodString;
              generation: z.ZodNumber;
              proofHash: z.ZodString;
              heldAt: z.ZodISODateTime;
              state: z.ZodLiteral<"HELD">;
            }, z.core.$strict>;
            writeState: z.ZodLiteral<"CLOSED">;
          }, z.core.$strict>;
          service: z.ZodObject<{
            reservationId: z.ZodString;
            profileHash: z.ZodString;
            endpoint: z.ZodObject<{
              host: z.ZodLiteral<"127.0.0.1">;
              port: z.ZodNumber;
            }, z.core.$strict>;
            claim: z.ZodDiscriminatedUnion<[z.ZodObject<{
              schemaVersion: z.ZodLiteral<"devmesh.preview-release-claim.v1">;
              operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
              releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
              candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
              manifestHash: z.ZodString;
              previewId: z.core.$ZodBranded<z.ZodString, "preview", "out">;
              datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
              imageDigest: z.ZodString;
              startOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
              startRequestHash: z.ZodString;
              instanceId: z.ZodString;
              acceptanceRequestHash: z.ZodString;
            }, z.core.$strict>, z.ZodObject<{
              schemaVersion: z.ZodLiteral<"devmesh.acceptance-service-claim.v1">;
              purpose: z.ZodLiteral<"ACCEPTANCE">;
              operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
              acceptanceRequestHash: z.ZodString;
              releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
              projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
              runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
              candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
              manifestHash: z.ZodString;
              reviewHash: z.ZodString;
              dataPlanHash: z.ZodString;
              datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
              imageDigest: z.ZodString;
              reservationId: z.ZodString;
              profileHash: z.ZodString;
              serviceRequestHash: z.ZodString;
              instanceId: z.ZodString;
            }, z.core.$strict>], "schemaVersion">;
            claimHash: z.ZodString;
            custodyState: z.ZodLiteral<"RELEASE_HELD">;
            custodyRevision: z.ZodNumber;
          }, z.core.$strict>;
          preparedAt: z.ZodISODateTime;
        }, z.core.$strict>;
        proofHash: z.ZodString;
      }, z.core.$strict>;
      promotionRequestHash: z.ZodString;
      gates: z.ZodObject<{
        sourceGate: z.ZodNullable<z.ZodObject<{
          datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
          datasetOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
          datasetRequestHash: z.ZodString;
          state: z.ZodEnum<{
            CLOSED: "CLOSED";
            OPEN: "OPEN";
          }>;
          fence: z.ZodNumber;
          revision: z.ZodNumber;
          closeOperationId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "op", "out">>;
          closeRequestHash: z.ZodNullable<z.ZodString>;
        }, z.core.$strict>>;
        targetGate: z.ZodObject<{
          datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
          datasetOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
          datasetRequestHash: z.ZodString;
          state: z.ZodEnum<{
            CLOSED: "CLOSED";
            OPEN: "OPEN";
          }>;
          fence: z.ZodNumber;
          revision: z.ZodNumber;
          closeOperationId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "op", "out">>;
          closeRequestHash: z.ZodNullable<z.ZodString>;
        }, z.core.$strict>;
        previousRoute: z.ZodNullable<z.ZodObject<{
          releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
          routeHash: z.ZodString;
          generation: z.ZodNumber;
        }, z.core.$strict>>;
      }, z.core.$strict>;
    }, z.core.$strict>;
    requestHash: z.ZodString;
  }, z.core.$strict>;
  releaseRetirementGet: z.ZodObject<{
    controllerId: z.ZodString;
    releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
    requestHash: z.ZodString;
  }, z.core.$strict>;
  releaseRetirementPage: z.ZodObject<{
    controllerId: z.ZodString;
    afterSequence: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
  }, z.core.$strict>;
  releaseRetirementActionBegin: z.ZodObject<{
    kind: z.ZodEnum<{
      STOP: "STOP";
      CONTAINER_REMOVE: "CONTAINER_REMOVE";
      NETWORK_REMOVE: "NETWORK_REMOVE";
      REVOKE_PREPARATION: "REVOKE_PREPARATION";
    }>;
    controllerId: z.ZodString;
    releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
    requestHash: z.ZodString;
  }, z.core.$strict>;
  releaseRetirementActionAuthorized: z.ZodObject<{
    kind: z.ZodEnum<{
      STOP: "STOP";
      CONTAINER_REMOVE: "CONTAINER_REMOVE";
      NETWORK_REMOVE: "NETWORK_REMOVE";
      REVOKE_PREPARATION: "REVOKE_PREPARATION";
    }>;
    actionRequestHash: z.ZodString;
    controllerId: z.ZodString;
    releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
    requestHash: z.ZodString;
  }, z.core.$strict>;
  releaseRetirementActionObserve: z.ZodObject<{
    kind: z.ZodEnum<{
      STOP: "STOP";
      CONTAINER_REMOVE: "CONTAINER_REMOVE";
      NETWORK_REMOVE: "NETWORK_REMOVE";
      REVOKE_PREPARATION: "REVOKE_PREPARATION";
    }>;
    actionRequestHash: z.ZodString;
    observation: z.ZodDiscriminatedUnion<[z.ZodObject<{
      kind: z.ZodLiteral<"REVOKE_PREPARATION">;
      proof: z.ZodObject<{
        schemaVersion: z.ZodLiteral<"devmesh.release-preparation-revoked.v1">;
        promotionRequestHash: z.ZodString;
        preparationOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
        releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
        runnerId: z.ZodString;
        controllerId: z.ZodString;
        barrierId: z.ZodString;
        generation: z.ZodNumber;
        proofHash: z.ZodString;
        state: z.ZodLiteral<"PERMANENTLY_REVOKED">;
      }, z.core.$strict>;
      checkedAt: z.ZodISODateTime;
    }, z.core.$strict>, z.ZodObject<{
      kind: z.ZodLiteral<"STOP">;
      objectId: z.ZodString;
      state: z.ZodEnum<{
        EXITED: "EXITED";
        CREATED: "CREATED";
      }>;
      checkedAt: z.ZodISODateTime;
    }, z.core.$strict>, z.ZodObject<{
      kind: z.ZodEnum<{
        CONTAINER_REMOVE: "CONTAINER_REMOVE";
        NETWORK_REMOVE: "NETWORK_REMOVE";
      }>;
      objectId: z.ZodString;
      absenceVerified: z.ZodLiteral<true>;
      checkedAt: z.ZodISODateTime;
    }, z.core.$strict>], "kind">;
    controllerId: z.ZodString;
    releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
    requestHash: z.ZodString;
  }, z.core.$strict>;
  acceptanceAbortEnroll: z.ZodObject<{
    controllerId: z.ZodString;
    decision: z.ZodObject<{
      schemaVersion: z.ZodLiteral<"devmesh.acceptance-abort-decision.v1">;
      operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      preparation: z.ZodObject<{
        runEpoch: z.ZodNumber;
        requirementRevision: z.ZodNumber;
        planRevision: z.ZodNumber;
        codeCommit: z.ZodString;
        image: z.ZodObject<{
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
        policyHash: z.ZodString;
        backendPrincipalId: z.ZodString;
        backendRef: z.ZodString;
        runnerId: z.ZodString;
        source: z.ZodNullable<z.ZodObject<{
          releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
          datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
          datasetOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
          storageKey: z.ZodString;
          schemaRevision: z.ZodString;
        }, z.core.$strict>>;
        target: z.ZodObject<{
          datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
          storageKey: z.ZodString;
          schemaRevision: z.ZodString;
        }, z.core.$strict>;
        candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
        candidateRevision: z.ZodNumber;
        manifestHash: z.ZodString;
        reviewHash: z.ZodString;
        expectedAcceptedReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
        dataPlanHash: z.ZodString;
        schemaVersion: z.ZodLiteral<"devmesh.acceptance-prepare.v1">;
        operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
        releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
        projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
        runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
      }, z.core.$strict>;
      preparationRequestHash: z.ZodString;
      preparationRevision: z.ZodNumber;
      preparedProofHash: z.ZodNullable<z.ZodString>;
      requestedBy: z.ZodString;
      reason: z.ZodString;
      decidedAt: z.ZodISODateTime;
    }, z.core.$strict>;
    decisionHash: z.ZodString;
  }, z.core.$strict>;
  acceptanceAbortGet: z.ZodObject<{
    controllerId: z.ZodString;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    decisionHash: z.ZodString;
  }, z.core.$strict>;
  acceptanceAbortActionBegin: z.ZodObject<{
    kind: z.ZodEnum<{
      STOP: "STOP";
      CONTAINER_REMOVE: "CONTAINER_REMOVE";
      NETWORK_REMOVE: "NETWORK_REMOVE";
    }>;
    controllerId: z.ZodString;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    decisionHash: z.ZodString;
  }, z.core.$strict>;
  acceptanceAbortActionAuthorized: z.ZodObject<{
    kind: z.ZodEnum<{
      STOP: "STOP";
      CONTAINER_REMOVE: "CONTAINER_REMOVE";
      NETWORK_REMOVE: "NETWORK_REMOVE";
    }>;
    actionRequestHash: z.ZodString;
    controllerId: z.ZodString;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    decisionHash: z.ZodString;
  }, z.core.$strict>;
  acceptanceAbortActionObserve: z.ZodObject<{
    kind: z.ZodEnum<{
      STOP: "STOP";
      CONTAINER_REMOVE: "CONTAINER_REMOVE";
      NETWORK_REMOVE: "NETWORK_REMOVE";
    }>;
    actionRequestHash: z.ZodString;
    observation: z.ZodDiscriminatedUnion<[z.ZodObject<{
      kind: z.ZodLiteral<"STOP">;
      objectId: z.ZodString;
      state: z.ZodEnum<{
        EXITED: "EXITED";
        CREATED: "CREATED";
      }>;
      checkedAt: z.ZodISODateTime;
    }, z.core.$strict>, z.ZodObject<{
      kind: z.ZodEnum<{
        CONTAINER_REMOVE: "CONTAINER_REMOVE";
        NETWORK_REMOVE: "NETWORK_REMOVE";
      }>;
      objectId: z.ZodString;
      absenceVerified: z.ZodLiteral<true>;
      checkedAt: z.ZodISODateTime;
    }, z.core.$strict>], "kind">;
    controllerId: z.ZodString;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    decisionHash: z.ZodString;
  }, z.core.$strict>;
};
type RunnerStoreMethod = keyof typeof storeRequests;
type StoreInput<M extends RunnerStoreMethod> = z.input<(typeof storeRequests)[M]>;
interface InternalJob {
  job: Job;
  execution: {
    workspacePath: string;
    argv: string[];
  };
  leasePermit: Job['request']['permit'];
  leaseRenewedAt: string;
}
interface StoreResults extends AcceptanceAbortStoreResults, ReleaseRetirementStoreResults, ReleaseServiceStoreResults {
  acceptanceServiceReserve: AcceptanceServiceReservation;
  acceptanceServiceGet: AcceptanceServiceReservation;
  acceptanceServiceByOperation: AcceptanceServiceReservation | null;
  acceptanceServicePage: {
    items: {
      sequence: number;
      reservation: AcceptanceServiceReservation;
    }[];
    nextSequence: number | null;
  };
  acceptanceServiceDispatch: {
    dispatch: boolean;
    reservation: AcceptanceServiceReservation;
  };
  acceptanceServiceCancel: AcceptanceServiceReservation;
  acceptanceServiceRecord: AcceptanceServiceReservation;
  acceptanceServiceProfilePrepare: AcceptanceServiceJournal;
  acceptanceServiceJournal: AcceptanceServiceJournal | null;
  acceptanceServiceActionBegin: {
    dispatch: boolean;
    journal: AcceptanceServiceJournal;
  };
  acceptanceServiceActionAuthorized: {
    allowed: boolean;
  };
  acceptanceServiceActionObserve: AcceptanceServiceJournal;
  acceptanceServiceHold: AcceptanceServiceReservation;
  acceptanceServicePrepareProof: AcceptancePreparedProof;
  previewCleanupGet: PreviewCleanupAction[];
  previewCleanupActionBegin: {
    dispatch: boolean;
    action: PreviewCleanupAction;
  };
  previewCleanupActionAuthorized: {
    allowed: boolean;
  };
  previewCleanupActionObserve: PreviewCleanupAction;
  previewCleanupPage: {
    items: {
      sequence: number;
      reservationId: string;
      requestHash: string;
    }[];
    nextSequence: number | null;
  };
  previewLifecycleEnroll: RunnerPreviewLifecycle;
  previewLifecycleGet: RunnerPreviewLifecycle | null;
  previewExpiryPrepare: RunnerPreviewLifecycle | null;
  previewExpiryAuthorized: {
    allowed: boolean;
  };
  previewLifecycleActionAuthorized: {
    allowed: boolean;
  };
  previewReleaseHold: RunnerPreviewLifecycle;
  previewReleaseCommit: RunnerPreviewLifecycle;
  previewContainerPrepare: PreviewContainerJournal;
  previewContainerGet: PreviewContainerJournal | null;
  previewContainerActionBegin: {
    dispatch: boolean;
    journal: PreviewContainerJournal;
  };
  previewContainerActionObserve: PreviewContainerJournal;
  capacityConfigure: RunnerCapacity;
  capacityUsage: {
    capacity: RunnerCapacity | null;
    usage: RunnerCapacityUsage;
  };
  previewReserve: PreviewReservation;
  previewReservationGet: PreviewReservation;
  previewReservationByOperation: PreviewReservation | null;
  previewReservationPage: {
    items: {
      sequence: number;
      reservation: PreviewReservation;
    }[];
    nextSequence: number | null;
  };
  previewReservationDispatch: {
    dispatch: boolean;
    reservation: PreviewReservation;
  };
  previewReservationCancel: PreviewReservation;
  previewReservationRecord: PreviewReservation;
  fenceAcquire: WorkspaceFence;
  fenceGet: WorkspaceFence;
  fenceByOperation: WorkspaceFence | null;
  fenceActive: WorkspaceFence | null;
  fenceRelease: WorkspaceFence;
  workspaceBinding: WorkspaceBinding | null;
  register: Job;
  get: Job;
  byOperation: Job | null;
  pending: InternalJob[];
  active: InternalJob[];
  claim: InternalJob | null;
  stop: Job;
  renew: Job;
  record: Job;
  inspect: {
    version: number;
    runnerId: string;
    jobs: number;
    foreignKeyErrors: unknown[];
  };
}
//#endregion
//#region src/store.d.ts
interface RunnerStoreOptions {
  databasePath: string;
  runnerId: string;
  initialize?: boolean;
  recoveryToken?: string;
  queueCapacity?: number;
}
declare class RunnerStore {
  #private;
  readonly options: RunnerStoreOptions;
  readonly ready: Promise<void>;
  constructor(options: RunnerStoreOptions);
  request<M extends RunnerStoreMethod>(method: M, input: StoreInput<M>): Promise<StoreResults[M]>;
  close(): Promise<void>;
  terminate(): Promise<void>;
}
declare function openRunnerStore(options: RunnerStoreOptions): Promise<RunnerStore>;
//#endregion
//#region src/docker.d.ts
interface WorkspaceQuota {
  /** Return only after the filesystem enforces the requested hard workspace quota. */
  enforce(workspacePath: string, maximumBytes: number): Promise<void>;
}
interface DockerOptions {
  enabled?: boolean;
  runnerId: string;
  dockerPath: string;
  socketPath: string;
  workspaceBytes: number;
  quota?: WorkspaceQuota;
}
type CliExecutor = (args: readonly string[], timeoutMs: number, maximumBytes: number) => Promise<{
  code: number;
  stdout: string;
}>;
declare class DockerBackend implements ExecutionBackend {
  #private;
  readonly configured: boolean;
  constructor(options: DockerOptions, executor?: CliExecutor);
  private enabled;
  private call;
  probe(): Promise<void>;
  createArguments(job: Job, workspacePath: string, argv: readonly string[]): string[];
  private verify;
  start(job: Job, workspacePath: string, argv: readonly string[], authorize: () => Promise<boolean>): Promise<ContainerFact>;
  inspect(job: Job): Promise<ContainerFact | null>;
  stop(job: Job): Promise<ContainerFact | null>;
  logs(job: Job): Promise<Uint8Array<ArrayBuffer>>;
}
//#endregion
//#region src/materials.d.ts
declare class RunnerMaterials {
  readonly root: string;
  readonly maximumBytes: number;
  constructor(root: string, maximumBytes?: number);
  private put;
  collect(job: Job, workspacePath: string, backend: ExecutionBackend): Promise<{
    logCursor: number;
    outputRefs: {
      path: string;
      sha256: string;
      byteSize: number;
    }[];
  }>;
  read(path: string): Promise<NonSharedBuffer>;
}
//#endregion
//#region src/manager.d.ts
interface ManagerOptions {
  maximumJobs?: number;
  pollIntervalMs?: number;
  onError?: (code: string) => void;
}
declare class RunnerManager {
  #private;
  readonly store: RunnerStore;
  readonly policy: RunnerPolicy;
  readonly backend: ExecutionBackend;
  readonly authority: RunnerAuthority;
  readonly materials: RunnerMaterials;
  readonly options: ManagerOptions;
  constructor(store: RunnerStore, policy: RunnerPolicy, backend: ExecutionBackend, authority: RunnerAuthority, materials: RunnerMaterials, options?: ManagerOptions);
  private time;
  private verify;
  start(): Promise<void>;
  private report;
  private background;
  submit(controllerId: string, input: unknown): Promise<Job>;
  get(controllerId: string, jobId: string): Promise<Job>;
  acquireWorkspaceFence(controllerId: string, input: AcquireWorkspaceFence): Promise<{
    fenceId: string;
    controllerId: string;
    operationId: string & import("zod").$brand<"op">;
    workspaceRef: string;
    workspacePath: string;
    holderToken: string;
    requestHash: string;
    request: {
      operationId: string & import("zod").$brand<"op">;
      parentOperationId: string & import("zod").$brand<"op">;
      workspaceRef: string;
      permit: {
        ownerKind: "workflowAttempt";
        runId: string & import("zod").$brand<"run">;
        runEpoch: number;
        workId: string & import("zod").$brand<"work">;
        workEpoch: number;
        attemptId: string & import("zod").$brand<"attempt">;
        resources: {
          resourceId: string;
          access: "read" | "write";
          kind: "dataset" | "snapshot" | "workspace" | "projectRepository";
        }[];
        schemaVersion: "devmesh.permit.v1";
        grantId: string & import("zod").$brand<"grant">;
        activationId: string & import("zod").$brand<"activation">;
        notBefore: string;
        expiresAt: string;
      } | {
        ownerKind: "invocationAttempt";
        invocationId: string & import("zod").$brand<"invocation">;
        invocationEpoch: number;
        invocationAttemptId: string & import("zod").$brand<"iattempt">;
        resources: ({
          kind: "snapshot";
          resourceId: string;
          access: "read";
        } | {
          resourceId: string;
          access: "read" | "write";
          kind: "workspace";
        })[];
        schemaVersion: "devmesh.permit.v1";
        grantId: string & import("zod").$brand<"grant">;
        activationId: string & import("zod").$brand<"activation">;
        notBefore: string;
        expiresAt: string;
      };
      holderToken: string;
      purpose?: "write" | "cleanup" | undefined;
    };
    state: "ACTIVE" | "RELEASED";
    createdAt: string;
    releasedAt: string | null;
  }>;
  getWorkspaceFence(controllerId: string, fenceId: string): Promise<{
    fenceId: string;
    controllerId: string;
    operationId: string & import("zod").$brand<"op">;
    workspaceRef: string;
    workspacePath: string;
    holderToken: string;
    requestHash: string;
    request: {
      operationId: string & import("zod").$brand<"op">;
      parentOperationId: string & import("zod").$brand<"op">;
      workspaceRef: string;
      permit: {
        ownerKind: "workflowAttempt";
        runId: string & import("zod").$brand<"run">;
        runEpoch: number;
        workId: string & import("zod").$brand<"work">;
        workEpoch: number;
        attemptId: string & import("zod").$brand<"attempt">;
        resources: {
          resourceId: string;
          access: "read" | "write";
          kind: "dataset" | "snapshot" | "workspace" | "projectRepository";
        }[];
        schemaVersion: "devmesh.permit.v1";
        grantId: string & import("zod").$brand<"grant">;
        activationId: string & import("zod").$brand<"activation">;
        notBefore: string;
        expiresAt: string;
      } | {
        ownerKind: "invocationAttempt";
        invocationId: string & import("zod").$brand<"invocation">;
        invocationEpoch: number;
        invocationAttemptId: string & import("zod").$brand<"iattempt">;
        resources: ({
          kind: "snapshot";
          resourceId: string;
          access: "read";
        } | {
          resourceId: string;
          access: "read" | "write";
          kind: "workspace";
        })[];
        schemaVersion: "devmesh.permit.v1";
        grantId: string & import("zod").$brand<"grant">;
        activationId: string & import("zod").$brand<"activation">;
        notBefore: string;
        expiresAt: string;
      };
      holderToken: string;
      purpose?: "write" | "cleanup" | undefined;
    };
    state: "ACTIVE" | "RELEASED";
    createdAt: string;
    releasedAt: string | null;
  }>;
  workspaceFenceByOperation(controllerId: string, operationId: string): Promise<{
    fenceId: string;
    controllerId: string;
    operationId: string & import("zod").$brand<"op">;
    workspaceRef: string;
    workspacePath: string;
    holderToken: string;
    requestHash: string;
    request: {
      operationId: string & import("zod").$brand<"op">;
      parentOperationId: string & import("zod").$brand<"op">;
      workspaceRef: string;
      permit: {
        ownerKind: "workflowAttempt";
        runId: string & import("zod").$brand<"run">;
        runEpoch: number;
        workId: string & import("zod").$brand<"work">;
        workEpoch: number;
        attemptId: string & import("zod").$brand<"attempt">;
        resources: {
          resourceId: string;
          access: "read" | "write";
          kind: "dataset" | "snapshot" | "workspace" | "projectRepository";
        }[];
        schemaVersion: "devmesh.permit.v1";
        grantId: string & import("zod").$brand<"grant">;
        activationId: string & import("zod").$brand<"activation">;
        notBefore: string;
        expiresAt: string;
      } | {
        ownerKind: "invocationAttempt";
        invocationId: string & import("zod").$brand<"invocation">;
        invocationEpoch: number;
        invocationAttemptId: string & import("zod").$brand<"iattempt">;
        resources: ({
          kind: "snapshot";
          resourceId: string;
          access: "read";
        } | {
          resourceId: string;
          access: "read" | "write";
          kind: "workspace";
        })[];
        schemaVersion: "devmesh.permit.v1";
        grantId: string & import("zod").$brand<"grant">;
        activationId: string & import("zod").$brand<"activation">;
        notBefore: string;
        expiresAt: string;
      };
      holderToken: string;
      purpose?: "write" | "cleanup" | undefined;
    };
    state: "ACTIVE" | "RELEASED";
    createdAt: string;
    releasedAt: string | null;
  }>;
  activeWorkspaceFence(controllerId: string, workspaceRef: string): Promise<{
    fenceId: string;
    controllerId: string;
    operationId: string & import("zod").$brand<"op">;
    workspaceRef: string;
    workspacePath: string;
    holderToken: string;
    requestHash: string;
    request: {
      operationId: string & import("zod").$brand<"op">;
      parentOperationId: string & import("zod").$brand<"op">;
      workspaceRef: string;
      permit: {
        ownerKind: "workflowAttempt";
        runId: string & import("zod").$brand<"run">;
        runEpoch: number;
        workId: string & import("zod").$brand<"work">;
        workEpoch: number;
        attemptId: string & import("zod").$brand<"attempt">;
        resources: {
          resourceId: string;
          access: "read" | "write";
          kind: "dataset" | "snapshot" | "workspace" | "projectRepository";
        }[];
        schemaVersion: "devmesh.permit.v1";
        grantId: string & import("zod").$brand<"grant">;
        activationId: string & import("zod").$brand<"activation">;
        notBefore: string;
        expiresAt: string;
      } | {
        ownerKind: "invocationAttempt";
        invocationId: string & import("zod").$brand<"invocation">;
        invocationEpoch: number;
        invocationAttemptId: string & import("zod").$brand<"iattempt">;
        resources: ({
          kind: "snapshot";
          resourceId: string;
          access: "read";
        } | {
          resourceId: string;
          access: "read" | "write";
          kind: "workspace";
        })[];
        schemaVersion: "devmesh.permit.v1";
        grantId: string & import("zod").$brand<"grant">;
        activationId: string & import("zod").$brand<"activation">;
        notBefore: string;
        expiresAt: string;
      };
      holderToken: string;
      purpose?: "write" | "cleanup" | undefined;
    };
    state: "ACTIVE" | "RELEASED";
    createdAt: string;
    releasedAt: string | null;
  }>;
  releaseWorkspaceFence(controllerId: string, fenceId: string, input: unknown): Promise<{
    fenceId: string;
    controllerId: string;
    operationId: string & import("zod").$brand<"op">;
    workspaceRef: string;
    workspacePath: string;
    holderToken: string;
    requestHash: string;
    request: {
      operationId: string & import("zod").$brand<"op">;
      parentOperationId: string & import("zod").$brand<"op">;
      workspaceRef: string;
      permit: {
        ownerKind: "workflowAttempt";
        runId: string & import("zod").$brand<"run">;
        runEpoch: number;
        workId: string & import("zod").$brand<"work">;
        workEpoch: number;
        attemptId: string & import("zod").$brand<"attempt">;
        resources: {
          resourceId: string;
          access: "read" | "write";
          kind: "dataset" | "snapshot" | "workspace" | "projectRepository";
        }[];
        schemaVersion: "devmesh.permit.v1";
        grantId: string & import("zod").$brand<"grant">;
        activationId: string & import("zod").$brand<"activation">;
        notBefore: string;
        expiresAt: string;
      } | {
        ownerKind: "invocationAttempt";
        invocationId: string & import("zod").$brand<"invocation">;
        invocationEpoch: number;
        invocationAttemptId: string & import("zod").$brand<"iattempt">;
        resources: ({
          kind: "snapshot";
          resourceId: string;
          access: "read";
        } | {
          resourceId: string;
          access: "read" | "write";
          kind: "workspace";
        })[];
        schemaVersion: "devmesh.permit.v1";
        grantId: string & import("zod").$brand<"grant">;
        activationId: string & import("zod").$brand<"activation">;
        notBefore: string;
        expiresAt: string;
      };
      holderToken: string;
      purpose?: "write" | "cleanup" | undefined;
    };
    state: "ACTIVE" | "RELEASED";
    createdAt: string;
    releasedAt: string | null;
  }>;
  byOperation(controllerId: string, operationId: string): Promise<Job>;
  renew(controllerId: string, jobId: string, input: RenewJob): Promise<Job>;
  stop(controllerId: string, jobId: string): Promise<Job>;
  private watch;
  private allowed;
  private fact;
  private stopOriginal;
  tick(): Promise<void>;
  readOutput(controllerId: string, jobId: string, index: number): Promise<{
    ref: {
      path: string;
      sha256: string;
      byteSize: number;
    };
    bytes: NonSharedBuffer;
  }>;
  close(): Promise<void>;
}
//#endregion
//#region src/layout.d.ts
interface RunnerLayoutOptions {
  dataRoot: string;
  controlDataRoot: string;
  backupRoot: string;
  runnerId: string;
  initialize?: boolean;
  recoveryToken?: string;
  layoutRecoveryToken?: string;
}
declare function openRunnerStorage(input: RunnerLayoutOptions): Promise<{
  store: RunnerStore;
  dataRoot: string;
  marker: {
    nodeKind: "runner";
    layoutVersion: 1;
    runnerId: string;
  };
  close(): Promise<void>;
}>;
//#endregion
//#region src/dataset-paths.d.ts
/** Trusted Runner configuration. No request may supply an absolute data path. */
interface RunnerDatasetPathOptions {
  runnerRoot: string;
  controlDataRoot: string;
  backupRoot: string;
  runnerId: string;
}
declare class RunnerDatasetPaths {
  readonly options: RunnerDatasetPathOptions;
  readonly root: string;
  constructor(options: RunnerDatasetPathOptions);
  resolve(input: {
    projectId: string;
    datasetId: string;
  }, createParents?: boolean): {
    directory: string;
    storageKey: string;
    databasePath: string;
    journalPath: string;
    receiptPath: string;
    markerPath: string;
    stagingPath: string;
    fencesPath: string;
    abortJournalPath: string;
    abortReceiptPath: string;
  };
}
//#endregion
//#region src/dataset-backend.d.ts
declare const localSqliteDatasetOptions: z.ZodObject<{
  mode: z.ZodLiteral<"local-development">;
  runnerRoot: z.ZodString;
  controlDataRoot: z.ZodString;
  backupRoot: z.ZodString;
  runnerId: z.ZodString;
  backendRef: z.ZodString;
  maximumBytes: z.ZodDefault<z.ZodNumber>;
  timeoutMs: z.ZodDefault<z.ZodNumber>;
  maximumWorkers: z.ZodDefault<z.ZodNumber>;
}, z.core.$strict>;
type LocalSqliteDatasetOptions = z.input<typeof localSqliteDatasetOptions>;
/** Explicit local development adapter. It cannot authorize a production migration. */
declare class LocalSqliteDatasetBackend implements DatasetPreparationBackend {
  #private;
  readonly configured = true;
  readonly options: z.output<typeof localSqliteDatasetOptions>;
  constructor(options: LocalSqliteDatasetOptions);
  preflight(effect: PreviewEffect): Promise<void>;
  prepare(effect: PreviewEffect, authorize?: () => Promise<boolean>): Promise<DatasetPreparationObservation>;
  inspect(effect: PreviewEffect): Promise<DatasetPreparationObservation>;
}
//#endregion
//#region src/dataset-journal.d.ts
declare const acceptanceDatasetReceipt: z.ZodObject<{
  schemaVersion: z.ZodLiteral<"devmesh.local-dataset-receipt.v2">;
  purpose: z.ZodLiteral<"ACCEPTANCE">;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  requestHash: z.ZodString;
  fencesHash: z.ZodString;
  data: z.ZodObject<{
    datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
    storageKey: z.ZodString;
    schemaRevision: z.ZodString;
    originDatasetId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "dataset", "out">>;
    sourceReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
    snapshotAt: z.ZodISODateTime;
    sha256: z.ZodString;
    byteSize: z.ZodNumber;
    integrity: z.ZodLiteral<"ok">;
    journalHash: z.ZodString;
    migrationRef: z.ZodNullable<z.ZodObject<{
      artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
      sha256: z.ZodString;
    }, z.core.$strict>>;
  }, z.core.$strict>;
}, z.core.$strict>;
type AcceptanceDatasetFences = z.output<typeof acceptanceDatasetFences>;
//#endregion
//#region src/acceptance-dataset-backend.d.ts
declare const acceptanceDataOptions: z.ZodObject<{
  mode: z.ZodLiteral<"local-development">;
  runnerRoot: z.ZodString;
  controlDataRoot: z.ZodString;
  backupRoot: z.ZodString;
  runnerId: z.ZodString;
  maximumBytes: z.ZodDefault<z.ZodNumber>;
  timeoutMs: z.ZodDefault<z.ZodNumber>;
  maximumWorkers: z.ZodDefault<z.ZodNumber>;
  backendRef: z.ZodString;
}, z.core.$strict>;
type AcceptanceDatasetObservation = {
  state: 'MATERIALIZED';
  receipt: z.output<typeof acceptanceDatasetReceipt>;
} | {
  state: 'UNKNOWN';
  errorCode: string;
};
/** Implementations must durably exclude every source/target writer, including
 * already admitted work. A process lock or control-plane CLOSED flag is insufficient. */
interface AcceptanceDatasetAuthority {
  readonly configured: boolean;
  /** Read-only configuration and original-subject check. */
  preflight(preparation: AcceptancePreparation): Promise<void>;
  /** Only the exclusive original journal winner may acquire. Recheck authorize
  * immediately before each physical effect. Retain custody after interruption. */
  acquire(preparation: AcceptancePreparation, authorize: () => Promise<boolean>): Promise<AcceptanceDatasetFences>;
  /** Query original durable custody only; never acquire, renew, or replace it. */
  inspect(preparation: AcceptancePreparation): Promise<AcceptanceDatasetFences>;
}
type AcceptanceDatasetOptions = z.input<typeof acceptanceDataOptions> & {
  authority?: AcceptanceDatasetAuthority;
  trustedMigrationHashes?: readonly string[];
  loadMigration?: (ref: NonNullable<AcceptancePreparation['request']['dataPlan']['migrationRef']>) => Promise<Uint8Array>;
};
/** Explicit local data materializer. This produces data evidence only; it does
 * not implement AcceptancePreparationBackend or attest service/release readiness. */
declare class LocalSqliteAcceptanceDatasetBackend {
  #private;
  readonly options: z.output<typeof acceptanceDataOptions>;
  readonly authority: AcceptanceDatasetAuthority | undefined;
  readonly trustedMigrationHashes: readonly string[];
  readonly loadMigration: AcceptanceDatasetOptions['loadMigration'];
  constructor(options: AcceptanceDatasetOptions);
  get configured(): boolean;
  preflight(preparation: AcceptancePreparation): Promise<void>;
  prepare(preparation: AcceptancePreparation, authorize: () => Promise<boolean>): Promise<AcceptanceDatasetObservation>;
  inspect(preparation: AcceptancePreparation): Promise<AcceptanceDatasetObservation>;
}
//#endregion
//#region src/preview-docker.d.ts
interface PreviewDatasetQuota {
  /** Enforce a hard directory quota and prepare only this dataset for uid/gid 10001. */
  prepare(directory: string, maximumBytes: number): Promise<void>;
  verify(directory: string, maximumBytes: number): Promise<boolean>;
}
interface PreviewNetworkIsolation {
  /** Enforce no egress to host/control/other networks; retain only host-origin published-port traffic. */
  enforce(networkId: string): Promise<void>;
  verify(networkId: string): Promise<boolean>;
}
interface PreviewDockerOptions {
  enabled?: boolean;
  dockerPath: string;
  socketPath: string;
  quota?: PreviewDatasetQuota;
  networkIsolation?: PreviewNetworkIsolation;
}
declare function previewDockerRemovalArguments(kind: 'CONTAINER_REMOVE' | 'NETWORK_REMOVE', id: string): string[];
/** Only a successful full-ID list query may establish absence. */
declare function verifyPreviewDockerAbsence(output: string, id: string): boolean;
declare function previewDockerNetworkArguments(raw: PreviewContainerProfile, r: PreviewStartRequest): string[];
declare function previewDockerCreateArguments(raw: PreviewContainerProfile, r: PreviewStartRequest, networkId: string): string[];
declare function verifyPreviewDockerImage(value: unknown, r: PreviewStartRequest, repository: string): void;
declare function verifyPreviewDockerNetwork(value: unknown, p: PreviewContainerProfile, r: PreviewStartRequest): string;
declare function verifyPreviewDockerContainer(value: unknown, p: PreviewContainerProfile, r: PreviewStartRequest, networkId: string, containerId: string | null): PreviewContainerFact;
declare class DockerPreviewDriver implements PreviewContainerDriver {
  #private;
  readonly configured: boolean;
  constructor(options: PreviewDockerOptions, executor?: CliExecutor);
  probe(r: PreviewStartRequest, repository: string): Promise<void>;
  prepare(p: PreviewContainerProfile): Promise<void>;
  network(p: PreviewContainerProfile, r: PreviewStartRequest): Promise<string | null>;
  createNetwork(p: PreviewContainerProfile, r: PreviewStartRequest, authorize: () => Promise<boolean>): Promise<string>;
  inspect(p: PreviewContainerProfile, r: PreviewStartRequest, networkId: string, containerId: string | null): Promise<PreviewContainerFact | null>;
  create(p: PreviewContainerProfile, r: PreviewStartRequest, networkId: string, authorize: () => Promise<boolean>): Promise<PreviewContainerFact | null>;
  start(p: PreviewContainerProfile, r: PreviewStartRequest, networkId: string, containerId: string, authorize: () => Promise<boolean>): Promise<PreviewContainerFact | null>;
  stop(p: PreviewContainerProfile, r: PreviewStartRequest, networkId: string, containerId: string, authorize: () => Promise<boolean>): Promise<PreviewContainerFact | null>;
  containerAbsent(id: string): Promise<boolean>;
  networkAbsent(id: string): Promise<boolean>;
  removeContainer(p: PreviewContainerProfile, r: PreviewStartRequest, networkId: string, containerId: string, authorize: () => Promise<boolean>): Promise<void>;
  removeNetwork(p: PreviewContainerProfile, r: PreviewStartRequest, networkId: string, authorize: () => Promise<boolean>): Promise<void>;
}
//#endregion
//#region src/acceptance-docker.d.ts
type AcceptanceDockerOptions = PreviewDockerOptions;
declare function acceptanceDockerNetworkArguments(raw: AcceptanceServiceProfile, input: AcceptanceServiceRequest): string[];
declare function acceptanceDockerCreateArguments(raw: AcceptanceServiceProfile, input: AcceptanceServiceRequest, networkId: string): string[];
declare function verifyAcceptanceDockerImage(value: unknown, r: AcceptancePreparation['request'], repository: string): void;
declare function verifyAcceptanceDockerNetwork(value: unknown, raw: AcceptanceServiceProfile, input: AcceptanceServiceRequest): string;
declare function verifyAcceptanceDockerContainer(value: unknown, raw: AcceptanceServiceProfile, input: AcceptanceServiceRequest, networkId: string, containerId: string | null): PreviewContainerFact;
/** Explicit Linux driver. Every physical observation rechecks the full original
 * profile; the entire acceptance dataset is mounted read-only. */
declare class DockerAcceptanceServiceDriver implements AcceptanceServiceDriver, AcceptanceAbortDriver {
  #private;
  readonly configured: boolean;
  constructor(options: AcceptanceDockerOptions, executor?: CliExecutor);
  probe(r: AcceptancePreparation['request'], repository: string): Promise<void>;
  prepare(p: AcceptanceServiceProfile): Promise<void>;
  network(p: AcceptanceServiceProfile, r: AcceptanceServiceRequest): Promise<string | null>;
  createNetwork(p: AcceptanceServiceProfile, r: AcceptanceServiceRequest, authorize: () => Promise<boolean>): Promise<string>;
  inspect(p: AcceptanceServiceProfile, r: AcceptanceServiceRequest, networkId: string, containerId: string | null): Promise<ServiceContainerFact | null>;
  create(p: AcceptanceServiceProfile, r: AcceptanceServiceRequest, networkId: string, authorize: () => Promise<boolean>): Promise<PreviewContainerFact | null>;
  start(p: AcceptanceServiceProfile, r: AcceptanceServiceRequest, networkId: string, containerId: string, authorize: () => Promise<boolean>): Promise<PreviewContainerFact | null>;
  stop(p: AcceptanceServiceProfile, r: AcceptanceServiceRequest, networkId: string, containerId: string, authorize: () => Promise<boolean>): Promise<PreviewContainerFact | null>;
  containerAbsent(id: string): Promise<boolean>;
  networkAbsent(id: string): Promise<boolean>;
  removeContainer(p: AcceptanceServiceProfile, r: AcceptanceServiceRequest, networkId: string, containerId: string, authorize: () => Promise<boolean>): Promise<void>;
  removeNetwork(p: AcceptanceServiceProfile, r: AcceptanceServiceRequest, networkId: string, authorize: () => Promise<boolean>): Promise<void>;
}
//#endregion
//#region src/acceptance-preparation-backend.d.ts
declare const optionsSchema$5: z.ZodObject<{
  enabled: z.ZodDefault<z.ZodBoolean>;
  runnerId: z.ZodString;
  controllerId: z.ZodString;
  backendRef: z.ZodString;
  repository: z.ZodString;
  capacity: z.ZodObject<{
    maximumJobs: z.ZodNumber;
    cpu: z.ZodNumber;
    memoryMiB: z.ZodNumber;
  }, z.core.$strict>;
  resourceLimits: z.ZodObject<{
    cpu: z.ZodNumber;
    memoryMiB: z.ZodNumber;
    pids: z.ZodNumber;
    temporaryMiB: z.ZodNumber;
  }, z.core.$strict>;
  datasetBytes: z.ZodDefault<z.ZodNumber>;
}, z.core.$strict>;
type RunnerAcceptancePreparationOptions = z.input<typeof optionsSchema$5>;
/** Explicit trusted composition. Infrastructure adapters are never inferred from
 * a client receipt or installed by platform startup. */
declare class RunnerAcceptancePreparationBackend implements AcceptancePreparationBackend {
  #private;
  readonly store: Pick<RunnerStore, 'request' | 'options'>;
  readonly paths: RunnerDatasetPaths;
  readonly datasets: LocalSqliteAcceptanceDatasetBackend;
  readonly driver: AcceptanceServiceDriver;
  readonly options: z.output<typeof optionsSchema$5>;
  constructor(store: Pick<RunnerStore, 'request' | 'options'>, paths: RunnerDatasetPaths, datasets: LocalSqliteAcceptanceDatasetBackend, driver: AcceptanceServiceDriver, options: RunnerAcceptancePreparationOptions);
  get configured(): boolean;
  preflight(p: AcceptancePreparation): Promise<void>;
  inspect(p: AcceptancePreparation): Promise<AcceptancePreparationObservation>;
  prepare(p: AcceptancePreparation, authorize: () => Promise<boolean>): Promise<AcceptancePreparationObservation>;
}
//#endregion
//#region src/acceptance-abort-backend.d.ts
declare const optionsSchema$4: z.ZodObject<{
  enabled: z.ZodDefault<z.ZodBoolean>;
  runnerId: z.ZodString;
  controllerId: z.ZodString;
  backendRef: z.ZodString;
  principalId: z.ZodString;
}, z.core.$strict>;
declare const inputSchema: z.ZodObject<{
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  requestHash: z.ZodString;
}, z.core.$strict>;
/** Explicit trusted composition. A model/caller cannot supply a cleanup decision. */
declare class RunnerAcceptanceAbortBackend {
  #private;
  readonly store: Pick<RunnerStore, 'request' | 'options'>;
  readonly control: Pick<SqliteStorage, 'request'>;
  readonly driver: AcceptanceAbortDriver;
  readonly options: z.output<typeof optionsSchema$4>;
  constructor(store: Pick<RunnerStore, 'request' | 'options'>, control: Pick<SqliteStorage, 'request'>, driver: AcceptanceAbortDriver, options: z.input<typeof optionsSchema$4>);
  get configured(): boolean;
  advance(raw: z.input<typeof inputSchema>, signal?: AbortSignal): Promise<AcceptanceServiceAbort>;
}
//#endregion
//#region src/release-retirement-backend.d.ts
declare const optionsSchema$3: z.ZodObject<{
  enabled: z.ZodDefault<z.ZodBoolean>;
  runnerId: z.ZodString;
  controllerId: z.ZodString;
  backendRef: z.ZodString;
  principalId: z.ZodString;
}, z.core.$strict>;
/** Only the unique publication winner calls retire. This adapter implements the
 * readonly retirement stage, not writable service creation or publication success. */
declare class RunnerReleaseRetirementBackend {
  #private;
  readonly store: Pick<RunnerStore, 'request' | 'options'>;
  readonly control: Pick<SqliteStorage, 'request'>;
  readonly driver: AcceptanceAbortDriver;
  readonly authority: ReleaseRetirementAuthority;
  readonly options: z.output<typeof optionsSchema$3>;
  constructor(store: Pick<RunnerStore, 'request' | 'options'>, control: Pick<SqliteStorage, 'request'>, driver: AcceptanceAbortDriver, authority: ReleaseRetirementAuthority, options: z.input<typeof optionsSchema$3>);
  get configured(): boolean;
  preflight(p: ReleasePublication, continuation?: boolean): Promise<void>;
  retire(p: ReleasePublication, authorize: () => Promise<boolean>): Promise<ReleaseRetirement>;
  /** Explicit coordination; only unstarted stages receive new unique grants. */
  resume(p: ReleasePublication, authorize: () => Promise<boolean>): Promise<ReleaseRetirement>;
  /** Never enroll, begin a stage, revoke, stop, remove or start from recovery. */
  inspect(p: ReleasePublication): Promise<ReleaseRetirement>;
}
//#endregion
//#region src/acceptance-dataset-abort.d.ts
declare const acceptanceDatasetAbortJournal: z.ZodObject<{
  schemaVersion: z.ZodLiteral<"devmesh.local-dataset-abort-operation.v1">;
  request: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"devmesh.acceptance-dataset-abort.v1">;
    decision: z.ZodObject<{
      schemaVersion: z.ZodLiteral<"devmesh.acceptance-abort-decision.v1">;
      operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      preparation: z.ZodObject<{
        runEpoch: z.ZodNumber;
        requirementRevision: z.ZodNumber;
        planRevision: z.ZodNumber;
        codeCommit: z.ZodString;
        image: z.ZodObject<{
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
        policyHash: z.ZodString;
        backendPrincipalId: z.ZodString;
        backendRef: z.ZodString;
        runnerId: z.ZodString;
        source: z.ZodNullable<z.ZodObject<{
          releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
          datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
          datasetOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
          storageKey: z.ZodString;
          schemaRevision: z.ZodString;
        }, z.core.$strict>>;
        target: z.ZodObject<{
          datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
          storageKey: z.ZodString;
          schemaRevision: z.ZodString;
        }, z.core.$strict>;
        candidateId: z.core.$ZodBranded<z.ZodString, "candidate", "out">;
        candidateRevision: z.ZodNumber;
        manifestHash: z.ZodString;
        reviewHash: z.ZodString;
        expectedAcceptedReleaseId: z.ZodNullable<z.core.$ZodBranded<z.ZodString, "release", "out">>;
        dataPlanHash: z.ZodString;
        schemaVersion: z.ZodLiteral<"devmesh.acceptance-prepare.v1">;
        operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
        releaseId: z.core.$ZodBranded<z.ZodString, "release", "out">;
        projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
        runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
      }, z.core.$strict>;
      preparationRequestHash: z.ZodString;
      preparationRevision: z.ZodNumber;
      preparedProofHash: z.ZodNullable<z.ZodString>;
      requestedBy: z.ZodString;
      reason: z.ZodString;
      decidedAt: z.ZodISODateTime;
    }, z.core.$strict>;
    decisionHash: z.ZodString;
    controllerId: z.ZodString;
    serviceCleanupHash: z.ZodString;
  }, z.core.$strict>;
  requestHash: z.ZodString;
  originalJournalHash: z.ZodNullable<z.ZodString>;
  originalFences: z.ZodNullable<z.ZodObject<{
    schemaVersion: z.ZodLiteral<"devmesh.local-dataset-fences.v1">;
    operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
    requestHash: z.ZodString;
    sourceFence: z.ZodNullable<z.ZodObject<{
      datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
      datasetOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      closeOperationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
      closeRequestHash: z.ZodString;
      gateFence: z.ZodNumber;
      physical: z.ZodObject<{
        kind: z.ZodLiteral<"DURABLE_WRITE_FENCE">;
        fenceId: z.ZodString;
        generation: z.ZodNumber;
        proofHash: z.ZodString;
        heldAt: z.ZodISODateTime;
        state: z.ZodLiteral<"HELD">;
      }, z.core.$strict>;
    }, z.core.$strict>>;
    targetFence: z.ZodObject<{
      datasetId: z.core.$ZodBranded<z.ZodString, "dataset", "out">;
      physical: z.ZodObject<{
        kind: z.ZodLiteral<"DURABLE_WRITE_FENCE">;
        fenceId: z.ZodString;
        generation: z.ZodNumber;
        proofHash: z.ZodString;
        heldAt: z.ZodISODateTime;
        state: z.ZodLiteral<"HELD">;
      }, z.core.$strict>;
      writeState: z.ZodLiteral<"CLOSED">;
    }, z.core.$strict>;
  }, z.core.$strict>>;
  createdAt: z.ZodISODateTime;
}, z.core.$strict>;
type AcceptanceDatasetAbortJournal = z.output<typeof acceptanceDatasetAbortJournal>;
type AcceptanceDatasetAbortProof = z.output<typeof acceptanceDatasetAbortProof>;
type AcceptanceDatasetAbortObservation = {
  state: 'RESTORED_CLOSED';
  receipt: z.output<typeof acceptanceDatasetAbortReceipt>;
} | {
  state: 'UNKNOWN';
  errorCode: string;
};
/** Trusted physical adapter. A file/process lock or control CLOSED flag cannot
 * satisfy this contract. It must atomically tombstone the original acquisition,
 * settle in-flight work, fence late work and retain a stable queryable result.
 * Even when originalFences is null, query the authority's own original custody;
 * absence of a local file is never proof that acquisition did not occur. */
interface AcceptanceDatasetAbortAuthority {
  readonly configured: boolean;
  abort(journal: AcceptanceDatasetAbortJournal, authorize: () => Promise<boolean>): Promise<AcceptanceDatasetAbortProof>;
  /** Read the original result only; never acquire, renew, release or replace. */
  inspectAbort(journal: AcceptanceDatasetAbortJournal): Promise<AcceptanceDatasetAbortProof | null>;
}
//#endregion
//#region src/acceptance-dataset-abort-backend.d.ts
declare const acceptanceDatasetAbortOptions: z.ZodObject<{
  mode: z.ZodLiteral<"local-development">;
  runnerRoot: z.ZodString;
  controlDataRoot: z.ZodString;
  backupRoot: z.ZodString;
  runnerId: z.ZodString;
  maximumBytes: z.ZodDefault<z.ZodNumber>;
  timeoutMs: z.ZodDefault<z.ZodNumber>;
  maximumWorkers: z.ZodDefault<z.ZodNumber>;
  backendRef: z.ZodString;
  enabled: z.ZodDefault<z.ZodBoolean>;
  controllerId: z.ZodString;
  principalId: z.ZodString;
}, z.core.$strict>;
declare const input$1: z.ZodObject<{
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  requestHash: z.ZodString;
}, z.core.$strict>;
/** Explicit trusted composition; the caller supplies neither a decision nor a
 * cleanup-success flag. Each Worker owns one bounded durable file operation. */
declare class RunnerAcceptanceDatasetAbortBackend {
  #private;
  readonly store: Pick<RunnerStore, 'request' | 'options'>;
  readonly control: Pick<SqliteStorage, 'request'>;
  readonly authority: AcceptanceDatasetAbortAuthority | undefined;
  readonly options: z.output<typeof acceptanceDatasetAbortOptions>;
  constructor(store: Pick<RunnerStore, 'request' | 'options'>, control: Pick<SqliteStorage, 'request'>, authority: AcceptanceDatasetAbortAuthority | undefined, options: z.input<typeof acceptanceDatasetAbortOptions>);
  get configured(): boolean;
  advance(raw: z.input<typeof input$1>, signal?: AbortSignal): Promise<AcceptanceDatasetAbortObservation>;
}
//#endregion
//#region src/preview-health.d.ts
/** Only an inspected original container's loopback port may reach this helper. */
declare function probePreviewHealth(endpoint: {
  host: '127.0.0.1';
  port: number;
}, timeoutMs?: number): Promise<boolean>;
//#endregion
//#region src/preview-backend.d.ts
declare const optionsSchema$2: z.ZodObject<{
  enabled: z.ZodDefault<z.ZodBoolean>;
  runnerId: z.ZodString;
  controllerId: z.ZodString;
  backendRef: z.ZodString;
  repository: z.ZodString;
  capacity: z.ZodObject<{
    maximumJobs: z.ZodNumber;
    cpu: z.ZodNumber;
    memoryMiB: z.ZodNumber;
  }, z.core.$strict>;
  resourceLimits: z.ZodObject<{
    cpu: z.ZodNumber;
    memoryMiB: z.ZodNumber;
    pids: z.ZodNumber;
    temporaryMiB: z.ZodNumber;
  }, z.core.$strict>;
  datasetBytes: z.ZodDefault<z.ZodNumber>;
}, z.core.$strict>;
type RunnerPreviewBackendOptions = z.input<typeof optionsSchema$2>;
/** Explicit trusted composition, no public registration or container-receipt API. */
declare class RunnerPreviewBackend implements PreviewExecutionBackend {
  #private;
  readonly store: Pick<RunnerStore, 'request' | 'options'>;
  readonly paths: RunnerDatasetPaths;
  readonly datasets: DatasetPreparationBackend;
  readonly driver: PreviewContainerDriver;
  readonly configured: boolean;
  readonly options: z.output<typeof optionsSchema$2>;
  constructor(store: Pick<RunnerStore, 'request' | 'options'>, paths: RunnerDatasetPaths, datasets: DatasetPreparationBackend, driver: PreviewContainerDriver, options: RunnerPreviewBackendOptions);
  preflight(effect: PreviewEffect, datasetEffect: PreviewEffect): Promise<void>;
  inspect(effect: PreviewEffect): Promise<PreviewExecutionResult>;
  execute(effect: PreviewEffect, datasetEffect: PreviewEffect, authorize: () => Promise<boolean>): Promise<PreviewExecutionResult>;
  /** Original-ID removal. Existing SENT actions only query, including after restart. */
  cleanupReservation(reservationId: string, isOpen?: () => boolean): Promise<{
    state: string;
  }>;
  /** Runner-only expiry path; never depends on a control database connection. */
  expireReservation(reservationId: string, isOpen?: () => boolean): Promise<{
    state: string;
    result: null;
  } | {
    state: string;
    result: PreviewExecutionResult;
  }>;
}
//#endregion
//#region src/preview-watchdog.d.ts
declare const optionsSchema$1: z.ZodObject<{
  enabled: z.ZodDefault<z.ZodBoolean>;
  pollIntervalMs: z.ZodDefault<z.ZodNumber>;
  pageSize: z.ZodDefault<z.ZodNumber>;
}, z.core.$strict>;
interface PreviewWatchdogResult {
  reservationId: string;
  state: string;
  errorCode: string | null;
}
/** A Runner-local loop, deliberately independent of platform/control liveness. */
declare class RunnerPreviewWatchdog {
  #private;
  readonly backend: RunnerPreviewBackend;
  readonly options: z.output<typeof optionsSchema$1>;
  constructor(backend: RunnerPreviewBackend, options?: z.input<typeof optionsSchema$1>);
  reconcile(): Promise<PreviewWatchdogResult[]>;
  start(onError?: (code: string) => void): Promise<PreviewWatchdogResult[]>;
  close(): Promise<void>;
}
//#endregion
//#region src/preview-http.d.ts
interface PreviewHttpInput {
  record: PreviewAccessRecord;
  headers: Record<string, string>;
  body: Uint8Array;
  signal: AbortSignal;
  authorize: () => Promise<boolean>;
}
interface PreviewHttpResult {
  status: number;
  headers: Record<string, string | string[]>;
  body: Uint8Array;
}
interface PreviewHttpTransport {
  readonly configured: boolean;
  forward(input: PreviewHttpInput): Promise<PreviewHttpResult>;
}
/** Only compose on the Runner owning the original reservation and loopback port. */
declare class RunnerPreviewHttpTransport implements PreviewHttpTransport {
  #private;
  readonly backend: RunnerPreviewBackend;
  readonly maximumResponseBytes: number;
  readonly timeoutMs: number;
  readonly configured: boolean;
  constructor(backend: RunnerPreviewBackend, maximumResponseBytes?: number, timeoutMs?: number);
  forward(input: PreviewHttpInput): Promise<PreviewHttpResult>;
}
//#endregion
//#region src/dataset-profile.d.ts
declare const webCrudDatasetProfile: {
  readonly templateVersion: "web-crud-v1";
  readonly schemaRevision: "web-crud-v1.schema.1";
};
//#endregion
//#region src/server.d.ts
interface RunnerIdentity {
  controllerId: string;
  credentialRef: string;
}
declare function serveRunner(manager: RunnerManager, options: {
  host?: string;
  port?: number;
  identities: RunnerIdentity[];
  credentials: (ref: string) => Promise<string | undefined>;
}): Promise<{
  address: AddressInfo;
  close(): Promise<void>;
}>;
//#endregion
//#region src/acceptance-abort-finalizer.d.ts
interface AcceptanceAbortSourceRecoveryAuthority {
  readonly configured: boolean;
  /** Query the exact restored original Release and its existing serving claim.
   * Never acquire, renew, start a service or open a write gate in this method. */
  inspect(input: {
    preparation: AcceptancePreparationRequest;
    decisionHash: string;
    sourceGate: NonNullable<AcceptanceAbortRecoveryResults['getAcceptanceAbortRecovery']['sourceGate']>;
    sourceImageDigest: string;
    dataProof: z.output<typeof acceptanceDatasetAbortProof$1>;
  }): Promise<z.output<typeof acceptanceAbortSourceRecovery> | null>;
}
declare const options$1: z.ZodObject<{
  enabled: z.ZodDefault<z.ZodBoolean>;
  runnerId: z.ZodString;
  controllerId: z.ZodString;
  principalId: z.ZodString;
  backendRef: z.ZodString;
}, z.core.$strict>;
declare const input: z.ZodObject<{
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  requestHash: z.ZodString;
}, z.core.$strict>;
/** Trusted composition, deliberately opt-in. Caller supplies only original IDs;
 * cleanup comes from Runner SQLite and data proof from the durable file Worker. */
declare class RunnerAcceptanceAbortFinalizer {
  readonly store: Pick<RunnerStore, 'request' | 'options'>;
  readonly control: Pick<SqliteStorage, 'request'>;
  readonly data: Pick<RunnerAcceptanceDatasetAbortBackend, 'configured' | 'advance'>;
  readonly source: AcceptanceAbortSourceRecoveryAuthority | undefined;
  readonly options: z.output<typeof options$1>;
  constructor(store: Pick<RunnerStore, 'request' | 'options'>, control: Pick<SqliteStorage, 'request'>, data: Pick<RunnerAcceptanceDatasetAbortBackend, 'configured' | 'advance'>, source: AcceptanceAbortSourceRecoveryAuthority | undefined, raw: z.input<typeof options$1>);
  get configured(): boolean;
  advance(raw: z.input<typeof input>, signal?: AbortSignal): Promise<AcceptanceAbortFinalization$1>;
}
//#endregion
//#region src/acceptance-abort-coordinator.d.ts
declare const options: z.ZodObject<{
  enabled: z.ZodDefault<z.ZodBoolean>;
  runnerId: z.ZodString;
  controllerId: z.ZodString;
  principalId: z.ZodString;
  backendRef: z.ZodString;
}, z.core.$strict>;
/** Compose original cleanup and completion only, never a new abort decision. */
declare class RunnerAcceptanceAbortCoordinator implements AcceptanceAbortRecoveryBackend {
  #private;
  readonly cleanup: Pick<RunnerAcceptanceAbortBackend, 'configured' | 'advance' | 'options'>;
  readonly finalizer: Pick<RunnerAcceptanceAbortFinalizer, 'configured' | 'advance' | 'options'>;
  readonly options: z.output<typeof options>;
  constructor(cleanup: Pick<RunnerAcceptanceAbortBackend, 'configured' | 'advance' | 'options'>, finalizer: Pick<RunnerAcceptanceAbortFinalizer, 'configured' | 'advance' | 'options'>, raw: z.input<typeof options>);
  get configured(): boolean;
  advance(input: {
    operationId: string;
    requestHash: string;
  }, signal?: AbortSignal): Promise<AcceptanceAbortFinalization$1>;
}
//#endregion
//#region src/release-docker.d.ts
type ReleasePreparation = {
  request: ReleaseServiceRequest['promotion']['preparation'];
};
type ReleaseDockerOptions = PreviewDockerOptions & {
  controllerId: string;
  guard?: ReleaseServiceWriteGuard;
};
declare function releaseDockerNetworkArguments(raw: ReleaseServiceProfile, input: ReleaseServiceRequest): string[];
declare function releaseDockerCreateArguments(raw: ReleaseServiceProfile, input: ReleaseServiceRequest, networkId: string): string[];
declare function verifyReleaseDockerImage(value: unknown, r: ReleasePreparation['request'], repository: string): void;
declare function verifyReleaseDockerNetwork(value: unknown, raw: ReleaseServiceProfile, input: ReleaseServiceRequest): string;
declare function verifyReleaseDockerContainer(value: unknown, raw: ReleaseServiceProfile, input: ReleaseServiceRequest, networkId: string, containerId: string | null): PreviewContainerFact;
/** Explicit Linux driver. Every physical observation rechecks the full original
 * profile. A physical write guard is required before writable create/start. */
declare class DockerReleaseServiceDriver implements ReleaseServiceDriver {
  #private;
  readonly configured: boolean;
  constructor(options: ReleaseDockerOptions, executor?: CliExecutor);
  enforceGuard(p: ReleaseServiceProfile, r: ReleaseServiceRequest, controllerId: string, authorize: () => Promise<boolean>): Promise<{
    schemaVersion: "devmesh.release-service-guard.v1";
    releaseId: string & z.core.$brand<"release">;
    runnerId: string;
    controllerId: string;
    serviceRequestHash: string;
    reservationId: string;
    profileHash: string;
    datasetId: string & z.core.$brand<"dataset">;
    targetProofHash: string;
    gateBindingHash: string;
    guardId: string;
    proofHash: string;
    scope: "ALL_DATASET_WRITES";
    writeAdmission: "CONTROL_GATE_FENCED";
    state: "ENFORCED";
  }>;
  inspectGuard(p: ReleaseServiceProfile, r: ReleaseServiceRequest, controllerId: string): Promise<{
    schemaVersion: "devmesh.release-service-guard.v1";
    releaseId: string & z.core.$brand<"release">;
    runnerId: string;
    controllerId: string;
    serviceRequestHash: string;
    reservationId: string;
    profileHash: string;
    datasetId: string & z.core.$brand<"dataset">;
    targetProofHash: string;
    gateBindingHash: string;
    guardId: string;
    proofHash: string;
    scope: "ALL_DATASET_WRITES";
    writeAdmission: "CONTROL_GATE_FENCED";
    state: "ENFORCED";
  } | null>;
  probe(r: ReleasePreparation['request'], repository: string): Promise<void>;
  prepared(p: ReleaseServiceProfile, r: ReleaseServiceRequest): Promise<boolean>;
  prepare(p: ReleaseServiceProfile, r: ReleaseServiceRequest, authorize: () => Promise<boolean>): Promise<void>;
  network(p: ReleaseServiceProfile, r: ReleaseServiceRequest): Promise<string | null>;
  createNetwork(p: ReleaseServiceProfile, r: ReleaseServiceRequest, authorize: () => Promise<boolean>): Promise<string>;
  inspect(p: ReleaseServiceProfile, r: ReleaseServiceRequest, networkId: string, containerId: string | null): Promise<ServiceContainerFact | null>;
  inspectRetired(p: ReleaseServiceProfile, r: ReleaseServiceRequest, networkId: string, containerId: string): Promise<PreviewContainerFact | null>;
  create(p: ReleaseServiceProfile, r: ReleaseServiceRequest, networkId: string, authorize: () => Promise<boolean>): Promise<PreviewContainerFact | null>;
  start(p: ReleaseServiceProfile, r: ReleaseServiceRequest, networkId: string, containerId: string, authorize: () => Promise<boolean>): Promise<PreviewContainerFact | null>;
  stop(p: ReleaseServiceProfile, r: ReleaseServiceRequest, networkId: string, containerId: string, authorize: () => Promise<boolean>): Promise<PreviewContainerFact | null>;
  containerAbsent(id: string): Promise<boolean>;
  networkAbsent(id: string): Promise<boolean>;
  removeContainer(p: ReleaseServiceProfile, r: ReleaseServiceRequest, networkId: string, containerId: string, authorize: () => Promise<boolean>): Promise<void>;
  removeNetwork(p: ReleaseServiceProfile, r: ReleaseServiceRequest, networkId: string, authorize: () => Promise<boolean>): Promise<void>;
}
//#endregion
//#region src/release-service-backend.d.ts
declare const optionsSchema: z.ZodObject<{
  enabled: z.ZodDefault<z.ZodBoolean>;
  runnerId: z.ZodString;
  controllerId: z.ZodString;
  backendRef: z.ZodString;
  principalId: z.ZodString;
  repository: z.ZodString;
  capacity: z.ZodObject<{
    maximumJobs: z.ZodNumber;
    cpu: z.ZodNumber;
    memoryMiB: z.ZodNumber;
  }, z.core.$strict>;
  resourceLimits: z.ZodObject<{
    cpu: z.ZodNumber;
    memoryMiB: z.ZodNumber;
    pids: z.ZodNumber;
    temporaryMiB: z.ZodNumber;
  }, z.core.$strict>;
}, z.core.$strict>;
type RunnerReleaseServiceOptions = z.input<typeof optionsSchema>;
/** Explicit trusted composition. Query recovery never begins another physical
 * stage. Provider implementations must enforce physical fencing on every write. */
declare class RunnerReleaseServiceBackend implements ReleasePublicationBackend {
  #private;
  readonly store: Pick<RunnerStore, 'request' | 'options'>;
  readonly control: Pick<SqliteStorage, 'request'>;
  readonly retirement: RunnerReleaseRetirementBackend;
  readonly authority: ReleaseServiceAuthority;
  readonly driver: ReleaseServiceDriver;
  readonly routes: ReleaseServiceRoutes;
  readonly options: z.output<typeof optionsSchema>;
  constructor(store: Pick<RunnerStore, 'request' | 'options'>, control: Pick<SqliteStorage, 'request'>, retirement: RunnerReleaseRetirementBackend, authority: ReleaseServiceAuthority, driver: ReleaseServiceDriver, routes: ReleaseServiceRoutes, options: RunnerReleaseServiceOptions);
  get configured(): boolean;
  preflight(p: ReleasePublication): Promise<void>;
  publish(p: ReleasePublication, authorize: () => Promise<boolean>): Promise<ReleasePublicationObservation>;
  resume(p: ReleasePublication, authorize: () => Promise<boolean>): Promise<ReleasePublicationObservation>;
  /** Query original actions only. No new enrollment/reservation/profile, guard
   * enforcement, ownership claim, create/start, route bind or physical handoff. */
  inspect(p: ReleasePublication): Promise<ReleasePublicationObservation>;
}
//#endregion
//#region src/release-http.d.ts
interface ReleaseHttpInput {
  record: ReleaseAccessRecord;
  headers: Record<string, string>;
  body: Uint8Array;
  signal: AbortSignal;
  authorize: () => Promise<boolean>;
}
interface ReleaseHttpResult {
  status: number;
  headers: Record<string, string | string[]>;
  body: Uint8Array;
}
interface ReleaseHttpTransport {
  readonly configured: boolean;
  check(target: ReleaseAccessTarget): Promise<{
    checkedAt: string;
  }>;
  forward(input: ReleaseHttpInput): Promise<ReleaseHttpResult>;
}
/** Explicit Runner-local composition. A saved publication is identity, never live health. */
declare class RunnerReleaseHttpTransport implements ReleaseHttpTransport {
  readonly backend: RunnerReleaseServiceBackend;
  readonly maximumResponseBytes: number;
  readonly timeoutMs: number;
  constructor(backend: RunnerReleaseServiceBackend, maximumResponseBytes?: number, timeoutMs?: number);
  get configured(): boolean;
  check(target: ReleaseAccessTarget): Promise<{
    checkedAt: string;
  }>;
  forward(input: ReleaseHttpInput): Promise<ReleaseHttpResult>;
}
//#endregion
export { type AcceptanceAbortAction, type AcceptanceAbortDriver, type AcceptanceAbortFinalization, type AcceptanceAbortSourceRecoveryAuthority, type AcceptanceDatasetAbortAuthority, type AcceptanceDatasetAbortJournal, type AcceptanceDatasetAbortObservation, type AcceptanceDatasetAbortProof, type AcceptanceDatasetAuthority, type AcceptanceDatasetFences, type AcceptanceDatasetObservation, type AcceptanceDatasetOptions, type AcceptanceDockerOptions, type AcceptanceServiceAbort, type AcceptanceServiceAction, type AcceptanceServiceDriver, type AcceptanceServiceFact, type AcceptanceServiceJournal, type AcceptanceServiceProfile, type AcceptanceServiceRequest, type AcceptanceServiceReservation, type AcquireWorkspaceFence, type CliExecutor, type ContainerFact, DockerAcceptanceServiceDriver, DockerBackend, type DockerOptions, DockerPreviewDriver, DockerReleaseServiceDriver, type ExecutionBackend, type Job, type JobState, LocalSqliteAcceptanceDatasetBackend, LocalSqliteDatasetBackend, type LocalSqliteDatasetOptions, type ManagerOptions, type PreviewCleanupAction, type PreviewCleanupKind, type PreviewContainerActionRecord, type PreviewContainerDriver, type PreviewContainerFact, type PreviewContainerJournal, type PreviewContainerProfile, type PreviewDatasetQuota, type PreviewDockerOptions, type PreviewHttpInput, type PreviewHttpResult, type PreviewHttpTransport, type PreviewNetworkIsolation, type PreviewReleaseClaim, type PreviewReservation, type PreviewResourceLimits, type PreviewWatchdogResult, type ReleaseDockerOptions, type ReleaseHttpInput, type ReleaseHttpResult, type ReleaseHttpTransport, type ReleaseRetirement, type ReleaseRetirementAction, type ReleaseRetirementAuthority, type ReleaseRetirementKind, type ReleaseRetirementRequest, type ReleaseServiceAuthority, type ReleaseServiceDriver, type ReleaseServiceFences, type ReleaseServiceGuardProof, type ReleaseServiceJournal, type ReleaseServiceOriginal, type ReleaseServiceProfile, type ReleaseServiceRequest, type ReleaseServiceRoutes, type ReleaseServiceWriteGuard, type RenewJob, RunnerAcceptanceAbortBackend, RunnerAcceptanceAbortCoordinator, RunnerAcceptanceAbortFinalizer, RunnerAcceptanceDatasetAbortBackend, RunnerAcceptancePreparationBackend, type RunnerAcceptancePreparationOptions, type RunnerAuthority, type RunnerCapacity, type RunnerCapacityUsage, RunnerClient, type RunnerDatasetPathOptions, RunnerDatasetPaths, RunnerError, type RunnerIdentity, type RunnerLayoutOptions, RunnerManager, RunnerMaterials, RunnerPolicy, type RunnerPolicyConfig, RunnerPreviewBackend, type RunnerPreviewBackendOptions, RunnerPreviewHttpTransport, type RunnerPreviewLifecycle, RunnerPreviewWatchdog, RunnerReleaseHttpTransport, RunnerReleaseRetirementBackend, RunnerReleaseServiceBackend, type RunnerReleaseServiceOptions, RunnerStore, type RunnerStoreOptions, type StartJob, type WorkspaceBinding, type WorkspaceFence, type WorkspaceQuota, acceptanceAbortActionRequest, acceptanceAbortObservation, acceptanceDatasetAbortJournal, acceptanceDatasetAbortProof, acceptanceDatasetAbortReceipt, acceptanceDatasetAbortRequest, acceptanceDockerCreateArguments, acceptanceDockerNetworkArguments, acceptanceServiceFact, acceptanceServiceNames, acceptanceServiceProfile, acceptanceServiceRequest, acceptanceServiceReservation, acquireWorkspaceFence, attemptKey, commandSpec, imageDigest, openRunnerStorage, openRunnerStore, ownerKey, previewCleanupKind, previewCleanupObservation, previewCleanupRequest, previewContainerNames, previewContainerProfile, previewDockerCreateArguments, previewDockerNetworkArguments, previewDockerRemovalArguments, previewReleaseClaim, previewReservationSchema, previewResourceLimits, probePreviewHealth, releaseDockerCreateArguments, releaseDockerNetworkArguments, releaseRetirementActionRequest, releaseRetirementObservation, releaseRetirementRequest, releaseRetirementRevocation, releaseServiceFact, releaseServiceFences, releaseServiceGateBinding, releaseServiceGuardProof, releaseServiceNames, releaseServiceProfile, releaseServiceRequest, releaseWorkspaceFence, renewJob, resourceLimits, runnerCapacity, runnerPreviewLifecycle, serveRunner, startJob, verifyAcceptanceDockerContainer, verifyAcceptanceDockerImage, verifyAcceptanceDockerNetwork, verifyPreviewDockerAbsence, verifyPreviewDockerContainer, verifyPreviewDockerImage, verifyPreviewDockerNetwork, verifyReleaseDockerContainer, verifyReleaseDockerImage, verifyReleaseDockerNetwork, webCrudDatasetProfile, workspaceFenceSchema };
//# sourceMappingURL=index.d.mts.map