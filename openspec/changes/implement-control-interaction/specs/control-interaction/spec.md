## ADDED Requirements

### Requirement: Pause and resume are explicit workbench actions

The workbench SHALL offer pause while the Run is OPEN and resume while it is PAUSED with a recovery review hash. Both actions MUST use the current control revision and MUST NOT show success on a failed request.

#### Scenario: Pause uses the current revision
- **WHEN** the user pauses an OPEN Run
- **THEN** the request carries the current control revision and the status area reflects the resulting gate

#### Scenario: Failed action is not success
- **WHEN** a pause or resume request fails
- **THEN** the UI reports an unconfirmed action and the next authoritative read decides the state

### Requirement: Reconnect preserves authoritative control state

After a disconnect and resnapshot the workbench SHALL re-read the control status and enable actions only for the authoritative gate.

#### Scenario: Paused state survives reconnect
- **WHEN** the Run is PAUSED and the WebSocket reconnects
- **THEN** the control area still shows PAUSED and only offers resume when the review hash exists
