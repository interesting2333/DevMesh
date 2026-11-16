import { z } from "zod";
import { SqliteStorage } from "@devmesh/storage-sqlite";
import { IncomingMessage, ServerResponse } from "node:http";
import { PreviewHttpTransport, ReleaseHttpTransport } from "@devmesh/runner";

//#region src/config.d.ts
declare const previewGatewayConfig: z.ZodObject<{
  enabled: z.ZodDefault<z.ZodBoolean>;
  mode: z.ZodEnum<{
    "loopback-development": "loopback-development";
    shared: "shared";
  }>;
  gatewayId: z.ZodString;
  principalId: z.ZodString;
  platformOrigin: z.ZodString;
  previewBaseOrigin: z.ZodString;
  ticketTtlMs: z.ZodDefault<z.ZodNumber>;
  sessionTtlMs: z.ZodDefault<z.ZodNumber>;
  maximumRequestBytes: z.ZodDefault<z.ZodNumber>;
  maximumInFlight: z.ZodDefault<z.ZodNumber>;
  requestTimeoutMs: z.ZodDefault<z.ZodNumber>;
}, z.core.$strict>;
type PreviewGatewayConfig = z.input<typeof previewGatewayConfig>;
type ResolvedPreviewGatewayConfig = z.output<typeof previewGatewayConfig>;
declare function gatewayConfiguration(input: PreviewGatewayConfig): {
  config: {
    enabled: boolean;
    mode: "loopback-development" | "shared";
    gatewayId: string;
    principalId: string;
    platformOrigin: string;
    previewBaseOrigin: string;
    ticketTtlMs: number;
    sessionTtlMs: number;
    maximumRequestBytes: number;
    maximumInFlight: number;
    requestTimeoutMs: number;
  };
  configurationHash: string;
};
declare function originForPreview(config: ResolvedPreviewGatewayConfig, previewId: string): string;
//#endregion
//#region src/release-config.d.ts
declare const releaseGatewayConfig: z.ZodObject<{
  enabled: z.ZodDefault<z.ZodBoolean>;
  mode: z.ZodEnum<{
    "loopback-development": "loopback-development";
    shared: "shared";
  }>;
  gatewayId: z.ZodString;
  principalId: z.ZodString;
  platformOrigin: z.ZodString;
  releaseBaseOrigin: z.ZodString;
  ticketTtlMs: z.ZodDefault<z.ZodNumber>;
  sessionTtlMs: z.ZodDefault<z.ZodNumber>;
  maximumRequestBytes: z.ZodDefault<z.ZodNumber>;
  maximumInFlight: z.ZodDefault<z.ZodNumber>;
  requestTimeoutMs: z.ZodDefault<z.ZodNumber>;
}, z.core.$strict>;
type ReleaseGatewayConfig = z.input<typeof releaseGatewayConfig>;
type ResolvedReleaseGatewayConfig = z.output<typeof releaseGatewayConfig>;
declare function releaseGatewayConfiguration(input: ReleaseGatewayConfig): {
  config: {
    enabled: boolean;
    mode: "loopback-development" | "shared";
    gatewayId: string;
    principalId: string;
    platformOrigin: string;
    releaseBaseOrigin: string;
    ticketTtlMs: number;
    sessionTtlMs: number;
    maximumRequestBytes: number;
    maximumInFlight: number;
    requestTimeoutMs: number;
  };
  configurationHash: string;
};
declare function originForRelease(config: ResolvedReleaseGatewayConfig, releaseId: string): string;
//#endregion
//#region src/release.d.ts
/** Trusted composition API. It does not turn a principal supplied over HTTP into identity. */
declare class ReleaseGateway {
  #private;
  readonly storage: Pick<SqliteStorage, 'request'>;
  readonly transport: ReleaseHttpTransport;
  readonly config: ResolvedReleaseGatewayConfig;
  readonly configurationHash: string;
  constructor(storage: Pick<SqliteStorage, 'request'>, transport: ReleaseHttpTransport, input: ReleaseGatewayConfig);
  get policy(): {
    schemaVersion: "devmesh.release-access-policy.v1";
    gatewayId: string;
    gatewayPrincipalId: string;
    configurationHash: string;
  };
  accessForMember(subject: {
    principalId: string;
    runId: string;
    releaseId: string;
  }): Promise<{
    releaseOrigin: string;
    canWrite: boolean;
    checkedAt: string;
  }>;
  /** Call only after the platform's configured identity resolver and CSRF boundary. */
  issueForMember(subject: {
    principalId: string;
    runId: string;
    releaseId: string;
  }): Promise<{
    ticket: string;
    releaseOrigin: string;
    expiresAt: string;
    sessionExpiresAt: string;
  }>;
  readonly handle: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  close(): void;
}
//#endregion
//#region src/index.d.ts
/** Trusted composition API. It does not turn a principal supplied over HTTP into identity. */
declare class PreviewGateway {
  #private;
  readonly storage: Pick<SqliteStorage, 'request'>;
  readonly transport: PreviewHttpTransport;
  readonly config: ResolvedPreviewGatewayConfig;
  readonly configurationHash: string;
  constructor(storage: Pick<SqliteStorage, 'request'>, transport: PreviewHttpTransport, input: PreviewGatewayConfig);
  get policy(): {
    schemaVersion: "devmesh.preview-access-policy.v1";
    gatewayId: string;
    gatewayPrincipalId: string;
    configurationHash: string;
  };
  accessForMember(subject: {
    principalId: string;
    runId: string;
    previewId: string;
  }): Promise<{
    previewOrigin: string;
    canWrite: boolean;
    expiresAt: string;
  }>;
  /** Call only after the platform's configured identity resolver and CSRF boundary. */
  issueForMember(subject: {
    principalId: string;
    runId: string;
    previewId: string;
  }): Promise<{
    ticket: string;
    previewOrigin: string;
    expiresAt: string;
    sessionExpiresAt: string;
  }>;
  readonly handle: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  close(): void;
}
//#endregion
export { PreviewGateway, type PreviewGatewayConfig, ReleaseGateway, type ReleaseGatewayConfig, type ResolvedPreviewGatewayConfig, type ResolvedReleaseGatewayConfig, gatewayConfiguration, originForPreview, originForRelease, previewGatewayConfig, releaseGatewayConfig, releaseGatewayConfiguration };
//# sourceMappingURL=index.d.mts.map