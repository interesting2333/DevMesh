export {ControlledGit,WorkspaceError} from './git.js';
export type {SourceEntry,SourceManifest,TemplateBasis,GitIdentity,GitRefUpdate} from './git.js';
export {LocalManagedWorkspaces} from './allocation.js';
export type {LocalWorkspaceOptions,AllocationFence,AllocationFencer} from './allocation.js';
export {LocalRunnerWorkspaceFencer,createLocalRepoAcquire} from './fencing.js';
export type {LocalRunnerFencerOptions} from './fencing.js';
export {LocalSourceArchives} from './source-archives.js';
export type {LocalSourceArchiveOptions} from './source-archives.js';
export {LocalCandidateIntegrations} from './candidate-integrations.js';
export type {LocalCandidateIntegrationOptions} from './candidate-integrations.js';
export {LocalCandidateConflicts} from './candidate-conflicts.js';
export type {CandidateConflictContext,CandidateMerge} from './candidate-integrations.js';

export {captureWorkspaceMaterials,verifyWorkspaceMaterials} from './workspace-materials.js';
export type {WorkspaceMaterialEntry,WorkspaceMaterialSnapshot,CapturedWorkspaceMaterials} from './workspace-materials.js';
export {LocalWorkspacePreservations} from './workspace-preservations.js';
export type {LocalWorkspacePreservationOptions,PreservedWorkspaceLease} from './workspace-preservations.js';

export {LocalWorkspaceReclamations} from './workspace-reclamations.js';
export {verifyWorkspaceRemnants} from './workspace-remnants.js';
export {createLocalWorkspaceCleanupAuthority,createLocalManagedRunnerAuthority} from './maintenance-authority.js';
export {createLocalManagedBindingResolver} from './managed-bindings.js';
export {createLocalManagedRuntimeLifecycle} from './runtime-lifecycle.js';
export {LocalReleaseExportSources} from './release-export-sources.js';
export {LocalWorkbenchDirectories} from './workbench-directories.js';
