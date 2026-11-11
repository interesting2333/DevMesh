import {z} from 'zod';
import {executionPermit,gitCommit,ids,opaqueKey,sha256} from '@devmesh/contracts';
import {repoBinding} from './repo-protocol.js';
import {managedSourcePath} from './workspace-protocol.js';
const fileBasis=z.strictObject({workspaceRef:opaqueKey,baseCommit:gitCommit,path:managedSourcePath});
export const repoFileReadArgs=fileBasis.extend({offset:z.number().int().min(0).max(2*1024*1024).default(0),length:z.number().int().min(1).max(65536).default(65536)});
export const repoWriteFileArgs=fileBasis.extend({expectedSha256:sha256.nullable(),text:z.string().max(65536).refine(v=>Buffer.byteLength(v,'utf8')<=65536&&Buffer.byteLength(JSON.stringify(v),'utf8')<=192*1024&&!v.includes('\0'))});
export const repoDeleteFileArgs=fileBasis.extend({expectedSha256:sha256});
const identity=z.strictObject({path:z.string().min(1).max(4096),device:z.string().regex(/^\d+$/),fileId:z.string().regex(/^\d+$/)});
export const repoFileProof=z.strictObject({directories:z.array(identity).min(2).max(128),file:identity,sha256,byteSize:z.number().int().nonnegative().max(2*1024*1024)});
export const repoFileRequests={
  beginRepoFileOperation:z.strictObject({permit:executionPermit,operationId:ids.operation,toolName:z.enum(['repo.writeFile','repo.deleteFile']),args:z.union([repoWriteFileArgs,repoDeleteFileArgs]),binding:repoBinding}),
  getRepoFileOperation:z.strictObject({permit:executionPermit,operationId:ids.operation}),
  prepareRepoFileOperation:z.strictObject({permit:executionPermit,operationId:ids.operation,requestHash:sha256,proof:repoFileProof}),
  finishRepoFileOperation:z.strictObject({operationId:ids.operation,requestHash:sha256,state:z.enum(['SUCCEEDED','FAILED']),result:z.record(z.string(),z.json())}),
  confirmRepoFileCleanup:z.strictObject({operationId:ids.operation,requestHash:sha256}),
  assertRepoWorkspaceSettled:z.strictObject({permit:executionPermit,workspaceRef:opaqueKey}),
};
export type RepoFileMethod=keyof typeof repoFileRequests;
export type RepoFileInput<M extends RepoFileMethod>=z.output<(typeof repoFileRequests)[M]>;
export interface RepoFileOperation {operationId:string;toolName:'repo.writeFile'|'repo.deleteFile';requestHash:string;state:string;cleanupConfirmed:boolean;scope:string[];request:{args:z.output<typeof repoWriteFileArgs>|z.output<typeof repoDeleteFileArgs>;binding:z.output<typeof repoBinding>};proof:z.output<typeof repoFileProof>|null;result:Record<string,unknown>|null}
export interface RepoFileResults {beginRepoFileOperation:RepoFileOperation&{created:boolean};getRepoFileOperation:RepoFileOperation;prepareRepoFileOperation:RepoFileOperation;finishRepoFileOperation:RepoFileOperation;confirmRepoFileCleanup:RepoFileOperation;assertRepoWorkspaceSettled:{settled:true}}
