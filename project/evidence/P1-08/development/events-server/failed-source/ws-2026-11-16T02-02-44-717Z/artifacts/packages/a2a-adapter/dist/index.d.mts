import { n as ServiceIdentity, r as loadInternalA2AConfig, t as InternalA2AConfig } from "./config-C3H_Bws-.mjs";
import { AgentCard, CancelTaskRequest, GetTaskRequest, ListTasksRequest, ListTasksResponse, Message, SendMessageRequest, StreamResponse, SubscribeToTaskRequest, Task } from "@a2a-js/sdk";
import { AgentManifest, EndpointConfig, EndpointView, SqliteStorage } from "@devmesh/storage-sqlite";
import { Express } from "express";
import { A2ARequestHandler, ServerCallContext, TaskStore } from "@a2a-js/sdk/server";

//#region src/registry.d.ts
type CredentialResolver = (ref: string) => Promise<string | undefined>;
declare const cardHash: (card: AgentCard) => string;
declare class AgentRegistry {
  #private;
  readonly storage: SqliteStorage;
  constructor(storage: SqliteStorage);
  get ready(): boolean;
  get version(): {
    generationId: string;
    projectionRevision: number;
  };
  closeAdmission(): void;
  refresh(): Promise<void>;
  resolveRole(role: string): Promise<EndpointView>;
  reconcile(manifestInput: unknown, resolveCredential: CredentialResolver, timeoutMs?: number): Promise<void>;
  probe(e: EndpointConfig, resolveCredential: CredentialResolver, timeoutMs?: number): Promise<{
    checkId: string;
    status: "HEALTHY" | "UNHEALTHY" | "NEEDS_REVIEW";
    observedCardHash: string | null;
    checkedAt: string;
    expiresAt: string;
    errorCode: string | null;
  }>;
  checkHealth(manifest: AgentManifest, credentials: CredentialResolver): Promise<void>;
}
//#endregion
//#region src/handler.d.ts
declare class DurableTaskStore implements TaskStore {
  readonly storage: SqliteStorage;
  readonly endpointId: string;
  constructor(storage: SqliteStorage, endpointId: string);
  load(taskId: string, context: ServerCallContext): Promise<Task | undefined>;
  save(task: Task, context: ServerCallContext): Promise<void>;
  list(params: ListTasksRequest, context: ServerCallContext): Promise<ListTasksResponse>;
}
declare class DurableRequestHandler implements A2ARequestHandler {
  readonly storage: SqliteStorage;
  readonly registry: AgentRegistry;
  readonly endpoint: EndpointConfig;
  readonly card: AgentCard;
  readonly tasks: DurableTaskStore;
  constructor(storage: SqliteStorage, registry: AgentRegistry, endpoint: EndpointConfig, card: AgentCard);
  getAgentCard(): Promise<AgentCard>;
  getAuthenticatedExtendedAgentCard(_params: unknown, context: ServerCallContext): Promise<AgentCard>;
  sendMessage(params: SendMessageRequest, context: ServerCallContext): Promise<Message | Task>;
  getTask(params: GetTaskRequest, context: ServerCallContext): Promise<Task>;
  cancelTask(params: CancelTaskRequest, context: ServerCallContext): Promise<Task>;
  sendMessageStream(params: SendMessageRequest, context: ServerCallContext): AsyncGenerator<StreamResponse>;
  resubscribe(params: SubscribeToTaskRequest, context: ServerCallContext): AsyncGenerator<StreamResponse>;
  private follow;
  listTasks(params: ListTasksRequest, context: ServerCallContext): Promise<ListTasksResponse>;
  createTaskPushNotificationConfig(): Promise<never>;
  getTaskPushNotificationConfig(): Promise<never>;
  listTaskPushNotificationConfigs(): Promise<never>;
  deleteTaskPushNotificationConfig(): Promise<never>;
}
//#endregion
//#region src/server.d.ts
interface InternalA2AOptions {
  manifest: AgentManifest;
  identities: ServiceIdentity[];
  resolveCredential: CredentialResolver;
  healthIntervalMs?: number;
  projectionIntervalMs?: number;
}
declare function createRoleCard(e: Pick<EndpointConfig, 'agentKey' | 'implementationVersion' | 'address' | 'streaming' | 'supportedSkills'>): AgentCard;
declare const environmentCredentials: (env?: NodeJS.ProcessEnv) => CredentialResolver;
declare function mountInternalAgents(app: Express, storage: SqliteStorage, options: InternalA2AOptions): {
  registry: AgentRegistry;
  handlers: Map<string, DurableRequestHandler>;
  activate(): Promise<void>;
  stop(): Promise<void>;
};
//#endregion
//#region src/preparation-client.d.ts
declare function preparationClient(endpoint: EndpointConfig, token: string, signal: AbortSignal): Promise<(input: unknown) => Promise<unknown>>;
declare function scheduledWorkClient(endpoint: EndpointConfig, token: string, signal: AbortSignal): Promise<(input: unknown) => Promise<unknown>>;
//#endregion
//#region src/index.d.ts
declare const protocolVersion = "1.0";
//#endregion
export { AgentRegistry, type CredentialResolver, DurableRequestHandler, DurableTaskStore, type InternalA2AConfig, type InternalA2AOptions, type ServiceIdentity, cardHash, createRoleCard, environmentCredentials, loadInternalA2AConfig, mountInternalAgents, preparationClient, protocolVersion, scheduledWorkClient };
//# sourceMappingURL=index.d.mts.map