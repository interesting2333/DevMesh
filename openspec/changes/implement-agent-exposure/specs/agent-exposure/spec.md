## ADDED Requirements

### Requirement: Exposure lifecycle is explicit

An exposure MUST move only DRAFT→VALIDATED→PUBLISHED→DRAINING→RETIRED and MUST reject other transitions without changing state.

#### Scenario: Publish before validation is rejected
- **WHEN** a DRAFT exposure is published
- **THEN** the request is rejected and the state stays DRAFT

### Requirement: Validation checks the card

Validation SHALL recompute the Card hash and reject a mismatch. Cards MUST have non-empty name, description and version, and unique non-empty skills.

#### Scenario: Duplicate skills are rejected
- **WHEN** a draft contains duplicate skills
- **THEN** creation is rejected and no record is stored

### Requirement: Catalog exposes only active exposures

The catalog SHALL return PUBLISHED and DRAINING exposures and MUST exclude DRAFT, VALIDATED and RETIRED.

#### Scenario: Retired exposure is absent
- **WHEN** an exposure is retired
- **THEN** it no longer appears in the catalog
