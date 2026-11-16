import { AgentManifest } from "@devmesh/storage-sqlite";

//#region src/config.d.ts
interface ServiceIdentity {
  principalId: string;
  credentialRef: string;
}
interface InternalA2AConfig {
  manifest: AgentManifest;
  identities: ServiceIdentity[];
}
declare function loadInternalA2AConfig(value: unknown, configPath?: string): InternalA2AConfig;
//#endregion
export { ServiceIdentity as n, loadInternalA2AConfig as r, InternalA2AConfig as t };
//# sourceMappingURL=config-C3H_Bws-.d.mts.map