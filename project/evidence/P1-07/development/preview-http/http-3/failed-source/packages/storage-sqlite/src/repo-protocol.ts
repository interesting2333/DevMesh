import {z} from 'zod';
import {executionPermit,gitCommit,ids,opaqueKey,sha256} from '@devmesh/contracts';
export const repoCommitArgs=z.strictObject({workspaceRef:opaqueKey,baseCommit:gitCommit,message:z.string().trim().min(1).max(4000).refine(v=>!v.includes('\0'))});
export const repoIntegrateArgs=z.strictObject({workspaceRef:opaqueKey,baseCommit:gitCommit,commit:gitCommit});
export const repoBinding=z.strictObject({workspaceRef:opaqueKey,resourceId:opaqueKey,projectResourceId:opaqueKey,projectId:ids.project,runId:ids.run,attemptId:ids.attempt,baseCommit:gitCommit});
const prepared=z.strictObject({commit:gitCommit,tree:gitCommit,ref:z.string().regex(/^refs\/devmesh\/[A-Za-z0-9_/-]+$/),expected:gitCommit.nullable(),commitBody:z.string().max(10000).nullable()});
export const repoRequests={
  beginRepoOperation:z.strictObject({permit:executionPermit,operationId:ids.operation,toolName:z.enum(['repo.commit','repo.integrate']),args:z.union([repoCommitArgs,repoIntegrateArgs]),binding:repoBinding}),
  getRepoOperation:z.strictObject({permit:executionPermit,operationId:ids.operation}),
  prepareRepoOperation:z.strictObject({permit:executionPermit,operationId:ids.operation,requestHash:sha256,prepared}),
  finishRepoOperation:z.strictObject({operationId:ids.operation,requestHash:sha256,state:z.enum(['SUCCEEDED','CONFLICT','FAILED']),result:z.record(z.string(),z.json())}),
};
export type RepoMethod=keyof typeof repoRequests;
export type RepoInput<M extends RepoMethod>=z.output<(typeof repoRequests)[M]>;
export interface RepoOperation {operationId:string;toolName:'repo.commit'|'repo.integrate';requestHash:string;state:string;createdAt:string;scope:string[];request:{args:z.output<typeof repoCommitArgs>|z.output<typeof repoIntegrateArgs>;binding:z.output<typeof repoBinding>};prepared:z.output<typeof prepared>|null;result:Record<string,unknown>|null}
export interface RepoResults {beginRepoOperation:RepoOperation&{created:boolean};getRepoOperation:RepoOperation;prepareRepoOperation:RepoOperation;finishRepoOperation:RepoOperation}
