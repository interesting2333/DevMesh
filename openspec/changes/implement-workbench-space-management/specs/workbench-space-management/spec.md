## ADDED Requirements
### Requirement: Workspace navigation and ownership
The workbench SHALL expose a unified workspace menu and separate application settings, restrict workspace mutations to their owner, and scope task search and new drafts to the active workspace.
#### Scenario: Switch between workspaces
- **WHEN** an owner switches workspace after saving input
- **THEN** the appropriate tasks and draft are restored without cancelling background execution

### Requirement: Protected management commands
The system SHALL reject deletion of the last workspace or a workspace containing visible tasks, and reject migration of active or unresolved tasks.
#### Scenario: Move a quiescent task
- **WHEN** an owner submits a current task revision and accessible destination
- **THEN** grouping changes atomically while the task's original directory and execution basis remain

### Requirement: Frozen trusted code context
The host SHALL validate code directories against configured trusted roots and freeze Git identity and commit when a task is created.
#### Scenario: Edit a workspace directory
- **WHEN** the owner replaces its directory
- **THEN** new tasks use the new binding and existing tasks retain their original code context

### Requirement: Original request recovery
The client SHALL save each workspace command's key and body before sending, and recover its original receipt explicitly after refresh without automatic POST.
#### Scenario: Workspace update response is lost
- **WHEN** the user reloads and chooses recovery
- **THEN** the original operation is looked up before retrying the same command
