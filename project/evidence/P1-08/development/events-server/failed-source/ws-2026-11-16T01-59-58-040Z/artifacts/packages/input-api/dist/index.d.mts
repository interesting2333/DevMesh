import { Express } from "express";
import { z } from "zod";
import { OperationResult, Request } from "@devmesh/storage-sqlite";
import { LocalContentStore } from "@devmesh/blob-store";
import { IncomingMessage } from "node:http";

//#region src/acceptance.d.ts
/** Only trusted composition may install this. Policies must already be registered;
 * commit must perform the ReleaseAcceptor's actual frozen-content preflight. */
interface AcceptanceAccess {
  readonly policies: Readonly<Record<string, string>>;
  commit(input: Request<'commitReleaseAcceptance'>): Promise<OperationResult>;
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
//#region src/input-auth.d.ts
interface Identity {
  principalId: string;
}
/** Both Express HTTP requests and upgrade requests share the Node request boundary. */
type IdentityResolver = (request: IncomingMessage, context: {
  signal: AbortSignal;
}) => Identity | null | Promise<Identity | null>;
//#endregion
//#region src/workbench-events-server.d.ts
declare const limitsSchema: z.ZodObject<{
  maximumConnections: z.ZodDefault<z.ZodNumber>;
  maximumPendingUpgrades: z.ZodDefault<z.ZodNumber>;
  maximumPendingWakeups: z.ZodDefault<z.ZodNumber>;
  pageSize: z.ZodDefault<z.ZodNumber>;
  maximumCatchupEvents: z.ZodDefault<z.ZodNumber>;
  maximumOutboundBytes: z.ZodDefault<z.ZodNumber>;
  sendTimeoutMs: z.ZodDefault<z.ZodNumber>;
  reauthorizeMs: z.ZodDefault<z.ZodNumber>;
  closeTimeoutMs: z.ZodDefault<z.ZodNumber>;
}, z.core.$strict>;
type WorkbenchEventLimits = z.input<typeof limitsSchema>;
//#endregion
//#region src/index.d.ts
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
  events?: WorkbenchEventLimits | undefined;
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
  stopAdmission: () => void;
  stop: () => Promise<void>;
  attachEvents?: never;
} | {
  enabled: true;
  attachEvents: (host: import("http").Server) => void;
  stopAdmission: () => void;
  stop(): Promise<void>;
};
//#endregion
export { type AcceptanceAccess, type Identity, type IdentityResolver, InputApiOptions, type PreviewAccessGateway, type ReleaseAccessGateway, TemplateBaseline, type WorkbenchEventLimits, mountInputApi, resolveTemplateBaseline };
//# sourceMappingURL=index.d.mts.map