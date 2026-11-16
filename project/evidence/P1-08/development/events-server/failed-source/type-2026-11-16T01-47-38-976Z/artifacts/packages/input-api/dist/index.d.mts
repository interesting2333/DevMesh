import { Express, Request } from "express";
import { OperationResult, Request as Request$1 } from "@devmesh/storage-sqlite";
import { LocalContentStore } from "@devmesh/blob-store";

//#region src/acceptance.d.ts
/** Only trusted composition may install this. Policies must already be registered;
 * commit must perform the ReleaseAcceptor's actual frozen-content preflight. */
interface AcceptanceAccess {
  readonly policies: Readonly<Record<string, string>>;
  commit(input: Request$1<'commitReleaseAcceptance'>): Promise<OperationResult>;
}
//#endregion
//#region src/release.d.ts
type Subject$1 = {
  principalId: string;
  runId: string;
  releaseId: string;
};
interface ReleaseAccessGateway {
  readonly config: {
    readonly platformOrigin: string;
  };
  accessForMember(subject: Subject$1): Promise<{
    releaseOrigin: string;
    canWrite: boolean;
    checkedAt: string;
  }>;
  issueForMember(subject: Subject$1): Promise<{
    ticket: string;
    releaseOrigin: string;
    expiresAt: string;
    sessionExpiresAt: string;
  }>;
}
//#endregion
//#region src/preview.d.ts
type Subject = {
  principalId: string;
  runId: string;
  previewId: string;
};
interface PreviewAccessGateway {
  readonly config: {
    readonly platformOrigin: string;
  };
  accessForMember(subject: Subject): Promise<{
    previewOrigin: string;
    canWrite: boolean;
    expiresAt: string;
  }>;
  issueForMember(subject: Subject): Promise<{
    ticket: string;
    previewOrigin: string;
    expiresAt: string;
    sessionExpiresAt: string;
  }>;
}
//#endregion
//#region src/index.d.ts
interface Identity {
  principalId: string;
}
type IdentityResolver = (request: Request, context: {
  signal: AbortSignal;
}) => Identity | null | Promise<Identity | null>;
interface TemplateBaseline {
  readonly version: string;
  readonly baseCommit: string;
}
type InputApiOptions = {
  enabled?: false;
} | {
  enabled: true;
  identityResolver?: IdentityResolver | undefined;
  baseline: TemplateBaseline;
  previewGateway?: PreviewAccessGateway | undefined;
  previewPolicies?: Readonly<Record<string, string>> | undefined;
  releaseGateway?: ReleaseAccessGateway | undefined;
  acceptance?: AcceptanceAccess | undefined;
  maximumUploads?: number;
  diagnostic?: (detail: {
    requestId: string;
    error: unknown;
  }) => void;
};
/** Resolve from a trusted repository, never a client path or commit field. */
declare function resolveTemplateBaseline(repositoryRoot: string, commit: string, templatePath?: string): Promise<TemplateBaseline>;
declare function mountInputApi(app: Express, content: LocalContentStore, options?: InputApiOptions): {
  enabled: false;
  stop: () => Promise<void>;
} | {
  enabled: true;
  stop(): Promise<void>;
};
//#endregion
export { type AcceptanceAccess, Identity, IdentityResolver, InputApiOptions, type PreviewAccessGateway, type ReleaseAccessGateway, TemplateBaseline, mountInputApi, resolveTemplateBaseline };
//# sourceMappingURL=index.d.mts.map