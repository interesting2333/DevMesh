import { ReleaseExportSources } from "@devmesh/result-verifier";
import { LocalContentStore, StorageConfig } from "@devmesh/blob-store";
import { InternalA2AConfig } from "@devmesh/a2a-adapter";
import { RuntimeConfig } from "@devmesh/agent-runtime";

//#region src/release-exports.d.ts
interface ReleaseExportSchedulerOptions {
  pollIntervalMs?: number;
  maxConcurrentJobs?: number;
  maxJobsPerPass?: number;
}
/** Consumes only local delivery jobs. It never drives acceptance or publication. */
declare class ReleaseExportScheduler {
  #private;
  readonly content: LocalContentStore;
  lastError: string | null;
  constructor(content: LocalContentStore, sources: ReleaseExportSources, options?: ReleaseExportSchedulerOptions);
  /** Coalesced, bounded full scan. Every pass starts at the original queue head. */
  tick(): Promise<void>;
  private consume;
  private advance;
  start(): void;
  stop(): Promise<void>;
}
//#endregion
//#region src/config.d.ts
interface ServerConfig {
  host: '127.0.0.1' | '::1';
  port: number;
  shutdownTimeoutMs: number;
  storage?: Readonly<StorageConfig> | undefined;
  storageSources?: Readonly<Record<string, string>> | undefined;
  a2a?: Readonly<InternalA2AConfig> | undefined;
  runtime?: Readonly<RuntimeConfig> | undefined;
  inputApi?: Readonly<{
    repositoryRoot: string;
    commit: string;
    templatePath: string;
  }> | undefined;
  releaseExports?: Readonly<ReleaseExportSchedulerOptions> | undefined;
}
declare class ConfigError extends Error {
  readonly code = "CONFIG_INVALID";
}
declare function loadConfig(env?: NodeJS.ProcessEnv, configPath?: string): Readonly<ServerConfig>;
//#endregion
export { ReleaseExportSchedulerOptions as a, ReleaseExportScheduler as i, ServerConfig as n, loadConfig as r, ConfigError as t };
//# sourceMappingURL=config-C1HphGDv.d.mts.map