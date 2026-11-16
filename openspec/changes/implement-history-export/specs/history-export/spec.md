## ADDED Requirements

### Requirement: History export honors a cutoff

The system SHALL return only records created at or before the requested cutoff (default now) and MUST be read-only.

#### Scenario: Records after cutoff are excluded
- **WHEN** a cutoff precedes some project records
- **THEN** those records are absent from the export

### Requirement: Incomplete history is flagged, not invented

When no Run exists before the cutoff or any Run is still non-terminal at the cutoff, the export MUST set `complete=false` and list a reason.

#### Scenario: Active run at cutoff
- **WHEN** an active Run exists at the cutoff
- **THEN** `complete` is false and `missing` contains `ACTIVE_RUNS_AT_CUTOFF`

#### Scenario: No runs before cutoff
- **WHEN** no Run was created before the cutoff
- **THEN** `complete` is false and `missing` contains `NO_RUNS_BEFORE_CUTOFF`