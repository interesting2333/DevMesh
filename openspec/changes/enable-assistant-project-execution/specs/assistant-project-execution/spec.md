## ADDED Requirements
### Requirement: Task-appropriate execution
The assistant SHALL choose discussion, read-only project analysis, directly authorized editing, or the existing professional workflow according to the user's actual request.
#### Scenario: Analyze a repository
- **WHEN** a user asks to explain project code
- **THEN** the assistant reads and searches actual authorized files without modifying source
### Requirement: Protected tool loop
The host SHALL persist model requests, results and tool operations, enforce mode and current input version before each effect, and reconcile unknown effects by their original identity.
#### Scenario: Interrupted write
- **WHEN** acknowledgement is lost after a file mutation
- **THEN** recovery queries the original proof and does not blindly repeat the write
### Requirement: Verifiable changes and checks
The assistant SHALL isolate changes, preserve the source baseline, expose actual diffs and check outcomes, and apply only after explicit current authorization and source comparison.
#### Scenario: Concurrent source edit
- **WHEN** the source file changes after a task snapshot
- **THEN** applying the candidate reports a conflict and retains both versions
### Requirement: Explicit development execution
Docker development execution SHALL be separately configured and identified, restrict resources and networking, and report actual availability without weakening the production Runner.
#### Scenario: Missing execution environment
- **WHEN** the configured image or Docker engine is unavailable
- **THEN** command execution is blocked with an accurate reason while available analysis remains usable
