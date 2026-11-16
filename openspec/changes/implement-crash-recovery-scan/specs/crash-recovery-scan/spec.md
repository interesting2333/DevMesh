## ADDED Requirements

### Requirement: Startup recovery scan is read-only

The system SHALL expose a read-only recovery scan that reports control runs, active and unknown attempts, pending and leased Outbox records, and open preparations. The scan MUST NOT mutate Run control state, attempts, Outbox leases or external operations.

#### Scenario: Scan does not reopen a paused Run
- **WHEN** a paused Run exists and the recovery scan runs after a restart
- **THEN** the scan reports the Run as PAUSED and does not change its control gate

#### Scenario: Unknown attempt remains unknown
- **WHEN** an attempt is OUTCOME_UNKNOWN and the recovery scan runs
- **THEN** the scan counts it and leaves the attempt state unchanged

### Requirement: Leases are reported, not stolen

The scan SHALL separate pending and leased Outbox records. Lease takeover MUST remain an explicit `claimOutbox` operation that only takes expired leases.

#### Scenario: Expired lease moves to reconciliation
- **WHEN** an Outbox record has an expired lease
- **THEN** the scan still reports it and an explicit claim moves it to RECONCILE for original-key verification instead of automatic redelivery

### Requirement: Recovery never replays external actions

The scan and its platform wrapper MUST NOT resend create/start/stop, tool calls or acceptance actions. Reconciliation MUST use the original operation key.

#### Scenario: Late result is reconciled by original key
- **WHEN** an operation result arrives after a restart
- **THEN** the original operation is looked up by the original key and no new action is issued
