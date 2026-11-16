import { z } from "zod";
import { ContentInfo, ContentReference, ObjectTarget, ObjectWrite, Request, SessionInfo, SqliteStorage } from "@devmesh/storage-sqlite";
import { Readable } from "node:stream";

//#region src/layout.d.ts
interface StorageConfig {
  dataRoot: string;
  backupRoot: string;
  runnerDataRoot?: string | undefined;
  initialize?: boolean | undefined;
  storeId?: string | undefined;
  recoveryToken?: string | undefined;
  minimumFreeBytes?: number | undefined;
  mode?: 'local' | 'shared' | undefined;
}
declare const markerSchema: z.ZodObject<{
  layoutVersion: z.ZodLiteral<1>;
  storeId: z.ZodUUID;
  nodeKind: z.ZodLiteral<"control">;
  createdAt: z.ZodISODateTime;
}, z.core.$strict>;
type LayoutMarker = z.infer<typeof markerSchema>;
declare function parseStorageConfig(value: unknown, configPath?: string, env?: NodeJS.ProcessEnv): StorageConfig;
interface LocalStorage {
  storage: SqliteStorage;
  dataRoot: string;
  backupRoot: string;
  marker: LayoutMarker;
  directorySync: 'supported' | 'unsupported';
  minimumFreeBytes: number;
  close(): Promise<void>;
}
declare function resolveStorageConfig(value: StorageConfig, configPath?: string, env?: NodeJS.ProcessEnv): StorageConfig;
declare function checkCapacity(root: string, requestedBytes: number, reserve: number): Promise<number>;
declare function openLocalStorage(input: StorageConfig): Promise<LocalStorage>;
//#endregion
//#region src/provider.d.ts
type ByteSource = Uint8Array | AsyncIterable<Uint8Array>;
interface VerifiedFile {
  contentHash: string;
  byteSize: number;
}
interface BlobProvider {
  stage(write: ObjectWrite, source: ByteSource): Promise<void>;
  publish(write: ObjectWrite): Promise<VerifiedFile>;
  openRead(contentHash: string, expectedSize: number): Promise<Readable>;
  verify(contentHash: string, expectedSize?: number): Promise<VerifiedFile>;
  delete(contentHash: string): Promise<void>;
}
declare class LocalBlobProvider implements BlobProvider {
  #private;
  readonly dataRoot: string;
  readonly minimumFreeBytes: number;
  constructor(dataRoot: string, minimumFreeBytes?: number);
  verify(contentHash: string, expectedSize?: number): Promise<VerifiedFile>;
  stage(write: ObjectWrite, source: ByteSource): Promise<void>;
  publish(write: ObjectWrite): Promise<VerifiedFile>;
  openRead(contentHash: string, expectedSize: number): Promise<Readable>;
  /** Only call after the storage transaction reserved DELETING and checked references/pins. */
  delete(contentHash: string): Promise<void>;
}
//#endregion
//#region src/store.d.ts
type WriteMeta = Request<'beginObjectWrite'>['meta'];
type BeginWrite = Request<'beginObjectWrite'>;
declare class LocalContentStore {
  #private;
  readonly storage: SqliteStorage;
  readonly dataRoot: string;
  readonly provider: BlobProvider;
  constructor(storage: SqliteStorage, dataRoot: string, minimumFreeBytes?: number, provider?: BlobProvider);
  put(input: BeginWrite, source: ByteSource): Promise<ObjectWrite>;
  putBytes(meta: WriteMeta, target: ObjectTarget, bytes: Uint8Array, mimeType?: string): Promise<ObjectWrite>;
  putText(meta: WriteMeta, target: ObjectTarget, text: string, mimeType?: string): Promise<ObjectWrite>;
  putJson(meta: WriteMeta, target: ObjectTarget, value: unknown): Promise<ObjectWrite>;
  recoverPublished(): Promise<{
    recovered: string[];
    pending: {
      writeId: string;
      code: string;
    }[];
  }>;
  verifyAll(): Promise<{
    checked: number;
    failures: {
      contentHash: string;
      code: string;
    }[];
  }>;
  openRead(principalId: string, reference: ContentReference): Promise<{
    stream: Readable;
    content: ContentInfo;
    release(): Promise<void>;
  }>;
  readBytes(principalId: string, reference: ContentReference, maxBytes?: number): Promise<Uint8Array>;
  readText(principalId: string, reference: ContentReference, maxBytes?: number): Promise<string>;
  /** Maintenance primitive only. The caller supplies the retention decision; no automatic GC. */
  deleteUnreferenced(contentHash: string): Promise<void>;
}
declare class SessionStore {
  readonly content: LocalContentStore;
  constructor(content: LocalContentStore);
  get storage(): SqliteStorage;
  ensure(principalId: string, runId: string, attemptId: string): Promise<SessionInfo>;
  append(meta: WriteMeta, target: Extract<ObjectTarget, {
    kind: 'message';
  }>, text: string): Promise<ObjectWrite>;
  snapshot(meta: WriteMeta, sessionId: string, configHash: string): Promise<ObjectWrite>;
  saveRequest(meta: WriteMeta, target: Extract<ObjectTarget, {
    kind: 'modelRequest';
  }>, request: unknown): Promise<ObjectWrite>;
  saveResponse(meta: WriteMeta, target: Extract<ObjectTarget, {
    kind: 'modelResponse';
  }>, response: unknown): Promise<ObjectWrite>;
  exportJsonl(principalId: string, sessionId: string): Promise<{
    throughMessageSeq: number;
    sha256: string;
    manifestPath: string;
    transcriptPath: string;
  }>;
}
//#endregion
//#region src/paths.d.ts
declare function canonicalRoot(path: string): string;
declare function assertSeparate(roots: string[]): void;
declare function safePath(root: string, key: string, makeParents?: boolean): string;
//#endregion
export { type BeginWrite, type BlobProvider, type ByteSource, type LayoutMarker, LocalBlobProvider, LocalContentStore, type LocalStorage, SessionStore, type StorageConfig, type VerifiedFile, type WriteMeta, assertSeparate, canonicalRoot, checkCapacity, openLocalStorage, parseStorageConfig, resolveStorageConfig, safePath };
//# sourceMappingURL=index.d.mts.map