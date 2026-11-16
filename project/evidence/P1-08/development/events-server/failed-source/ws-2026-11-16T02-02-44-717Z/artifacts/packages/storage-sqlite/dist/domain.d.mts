import { In as CandidateIntegration, Jn as CandidateSubject, Kn as CandidateBasis, Ln as CandidateIntegrationMethod, Qt as CandidateReviewInput, Sn as QualityMethod, Tn as QualityVerification, Xn as createPlanDomain, _n as WorkVerificationMethod, a as OperationResult, bn as QualityMaterial, cn as ReleaseDelivery, dn as ReleaseDeliveryMethod, dt as AcceptanceMethod, en as CandidateReviewMethod, ft as AcceptancePreparation, hn as WorkAssessment, i as Method, in as ReleaseCandidateRevision, mt as AcceptanceResults, on as ReleaseFreezeInput, r as Meta, s as Parsed, sn as ReleaseFreezeMethod, t as canonical, tn as CandidateReviewView, un as ReleaseDeliveryMaterial, ut as AcceptanceInput } from "./json-COpzezJ6.mjs";
import { DatabaseSync } from "node:sqlite";

//#region src/candidate-integration-domain.d.ts
/** Private Worker journal. Filesystem proofs are supplied only by the trusted Git adapter. */
declare function createCandidateIntegrationDomain(db: DatabaseSync, plans: ReturnType<typeof createPlanDomain>): {
  basis: {
    freeze: (input: CandidateSubject) => CandidateBasis;
    assertCurrent(original: CandidateBasis, principalId: string): CandidateBasis;
  };
  qualified: (input: CandidateSubject) => CandidateIntegration;
  execute(method: CandidateIntegrationMethod, input: unknown): unknown;
};
//#endregion
//#region src/quality-domain.d.ts
type Row$2 = Record<string, string | number | null>;
type Target$2 = {
  operationId: string;
  materialKey: string;
};
declare function createQualityDomain(db: DatabaseSync, candidates?: Pick<ReturnType<typeof createCandidateIntegrationDomain>, 'qualified'>): {
  assertPipelinePrepared(attemptId: string, workspaceRef: string): void;
  completionFacts(operationId: string, principalId: string, attemptId: string): {
    verification: QualityVerification;
    policy: {
      schemaVersion: "devmesh.quality-policy.v1";
      templateVersion: string;
      producers: {
        producerId: string;
        command: string[];
        imageDigest: string;
        pathPrefixes: string[];
      }[];
      reports: {
        reportId: string;
        producerId: string;
        format: "istanbul-v1" | "vitest-json-v1";
        path: string;
        sourceInclude: string[];
      }[];
      checks: {
        checkId: string;
        kind: "command" | "tests" | "coverage" | "human";
        producerIds: string[];
        reportIds: string[];
        requiredTests: {
          path: string;
          fullName: string;
          requirementIds: (string & import("zod").$brand<"requirement">)[];
        }[];
      }[];
      business: {
        include: string[];
        exclude: {
          glob: string;
          reason: string;
        }[];
      };
      thresholds: {
        lines: number;
        branches: number;
      };
      zeroBranches: "reject" | "complete-map-proves-none";
      delivery?: {
        producerId: string;
        architecture: "amd64" | "arm64";
        materials: {
          key: string;
          path: string;
        }[];
      } | undefined;
    };
    materials: QualityMaterial[];
  };
  authorize(principalId: string, target: Target$2): Row$2;
  validateWrite(i: {
    meta: {
      principalId: string;
      scopeId: string;
      idempotencyKey: string;
    };
    target: Target$2;
    expectedHash: string;
    expectedSize: number;
  }): void;
  commit(principalId: string, target: Target$2, hash: string, writeId: string): {
    operationId: string;
    materialKey: string;
    contentHash: string;
  };
  resolve(principalId: string, target: Target$2): {
    content_hash: string;
  };
  execute(method: QualityMethod, input: unknown): unknown;
};
//#endregion
//#region src/release-delivery-domain.d.ts
type Row$1 = Record<string, string | number | null>;
type Target$1 = {
  operationId: string;
  materialKey: string;
};
declare function createReleaseDeliveryDomain(db: DatabaseSync, quality?: Pick<ReturnType<typeof createQualityDomain>, 'completionFacts'>): {
  authorize(principalId: string, target: Target$1): Row$1;
  validateWrite(i: {
    meta: {
      principalId: string;
      scopeId: string;
      idempotencyKey: string;
    };
    target: Target$1;
    expectedHash: string;
    expectedSize: number;
  }): void;
  commit(principalId: string, target: Target$1, hash: string, writeId: string): {
    contentHash: string;
  };
  resolve(principalId: string, target: Target$1): {
    content_hash: string;
  };
  completionFacts(principalId: string, operationId: string): {
    delivery: ReleaseDelivery;
    policy: {
      producerId: string;
      architecture: "amd64" | "arm64";
      materials: {
        key: string;
        path: string;
      }[];
      schemaVersion: "devmesh.delivery-policy.v1";
      templateVersion: string;
      checkConfigHash: string;
    };
    materials: ReleaseDeliveryMaterial[];
  };
  execute(method: ReleaseDeliveryMethod, input: unknown): unknown;
};
//#endregion
//#region src/work-verification-domain.d.ts
type Row = Record<string, string | number | null>;
type Target = {
  operationId: string;
};
declare function createWorkVerificationDomain(db: DatabaseSync, quality?: Pick<ReturnType<typeof createQualityDomain>, 'completionFacts'>): {
  frozenFacts(principalId: string, operationId: string, allowCarried?: boolean): {
    state: string;
    assessment: WorkAssessment;
    operationId: string;
    runId: string;
    attemptId: string;
    evidence: {
      artifactId: string;
      sha256: string;
    };
  };
  authorize(principalId: string, target: Target): Row;
  validateWrite(i: {
    meta: {
      principalId: string;
      scopeId: string;
      idempotencyKey: string;
    };
    target: Target;
    expectedHash: string;
    expectedSize: number;
  }): void;
  commit(principalId: string, target: Target, hash: string, writeId: string): {
    artifactId: string;
    contentHash: string;
  };
  resolve(principalId: string, target: Target): {
    content_hash: string;
  };
  assertCompletion(i: Parsed<"recordVerifiedWork">): Row;
  applied(id: string): void;
  execute(method: WorkVerificationMethod, input: unknown): unknown;
};
//#endregion
//#region src/release-freeze-domain.d.ts
interface Hooks$2 {
  operation(meta: Meta, kind: string, payload: unknown, action: (operationId: string) => Record<string, unknown>, authorize?: () => void): OperationResult;
  changed(runId: string, operationId: string, candidateId: string): void;
}
declare function createReleaseFreezeDomain(db: DatabaseSync, plans: ReturnType<typeof createPlanDomain>, candidates: ReturnType<typeof createCandidateIntegrationDomain>, deliveries: Pick<ReturnType<typeof createReleaseDeliveryDomain>, 'completionFacts'>, works: Pick<ReturnType<typeof createWorkVerificationDomain>, 'frozenFacts'>, quality: Pick<ReturnType<typeof createQualityDomain>, 'completionFacts'>, hooks: Hooks$2): {
  getCandidate: (i: ReleaseFreezeInput<"getReleaseCandidate">) => ReleaseCandidateRevision;
  execute(method: ReleaseFreezeMethod, input: unknown): unknown;
};
//#endregion
//#region src/candidate-review-domain.d.ts
interface Hooks$1 {
  operation(meta: Meta, kind: string, payload: unknown, action: (operationId: string) => Record<string, unknown>, authorize: () => void): OperationResult;
  changed(runId: string, operationId: string, candidateId: string, resultId: string): void;
  rejected(runId: string, operationId: string, candidateId: string, rejectionId: string, resultId: string, state: 'OPEN' | 'WITHDRAWN'): void;
}
declare function createCandidateReviewDomain(db: DatabaseSync, plans: ReturnType<typeof createPlanDomain>, freezes: Pick<ReturnType<typeof createReleaseFreezeDomain>, 'getCandidate'>, hooks: Hooks$1): {
  getReview: (i: CandidateReviewInput<"getCandidateReview">) => CandidateReviewView;
  execute(method: CandidateReviewMethod, input: unknown): unknown;
};
//#endregion
//#region src/acceptance-domain.d.ts
interface Hooks {
  operation(meta: Meta, kind: string, payload: unknown, action: (operationId: string) => Record<string, unknown>, authorize: () => void): OperationResult;
  changed(runId: string, operationId: string, preparationId: string, state: AcceptancePreparation['state']): void;
  decision(runId: string, operationId: string, decisionId: string): void;
  sourceClosed(runId: string, operationId: string, datasetId: string, fence: number): void;
}
declare function createAcceptanceDomain(db: DatabaseSync, plans: ReturnType<typeof createPlanDomain>, freezes: Pick<ReturnType<typeof createReleaseFreezeDomain>, 'getCandidate'>, reviews: Pick<ReturnType<typeof createCandidateReviewDomain>, 'getReview'>, hooks: Hooks): {
  getCandidateBasis: (i: AcceptanceInput<"getCandidateAcceptanceBasis">) => AcceptanceResults["getCandidateAcceptanceBasis"];
  listCandidatePreparations: (i: AcceptanceInput<"listCandidateAcceptancePreparations">) => AcceptanceResults["listCandidateAcceptancePreparations"];
  getPreparation: (i: AcceptanceInput<"getAcceptancePreparation">) => AcceptancePreparation;
  execute(method: AcceptanceMethod, input: unknown): unknown;
};
//#endregion
//#region src/domain.d.ts
declare function createDomain(db: DatabaseSync): {
  execute(method: Method, input: unknown): unknown;
};
//#endregion
export { canonical, createAcceptanceDomain, createDomain };
//# sourceMappingURL=domain.d.mts.map