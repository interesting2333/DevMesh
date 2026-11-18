## ADDED Requirements
### Requirement: Explicit task removal
The workbench SHALL require explicit confirmation before deleting a conversation task and describe the retained project, delivery and audit data.
#### Scenario: Delete an idle task
- **WHEN** its authorized owner confirms a current deletion basis
- **THEN** the task disappears from visible conversations and cannot receive further messages or controls, while its related project and original records remain

### Requirement: Running and unresolved work protection
The system SHALL refuse deletion of active or unresolved work and recheck write authorization and the conversation revision atomically.
#### Scenario: Run is still open
- **WHEN** deletion is attempted before the associated Run is paused or ended
- **THEN** no deletion is recorded and the user is guided to pause or reconcile the work first

### Requirement: Recoverable deletion command
The client SHALL persist the original deletion UUID and body before HTTP, and retain a way to query the original result after the conversation has been deleted.
#### Scenario: Deletion acknowledgement is lost
- **WHEN** the page refreshes after a lost response
- **THEN** no deletion is automatically posted and explicit recovery verifies the original key without recreating or deleting a different conversation
