## ADDED Requirements

### Requirement: Model credentials are write-only

The settings API SHALL accept an API key and MUST NOT return it or include it in errors or logs. The key MUST be stored only in a local file with mode 0600.

#### Scenario: Key never echoed
- **WHEN** settings are saved or read
- **THEN** responses contain only `hasApiKey`, never the key value

### Requirement: Endpoint and model are validated

Endpoint MUST be https, or http on loopback, without credentials/query/hash. Model ID and provider ID MUST be bounded safe strings.

#### Scenario: Insecure endpoint rejected
- **WHEN** an http endpoint on a non-loopback host is saved
- **THEN** the request is rejected and no file is written

### Requirement: Connection test is explicit

The test endpoint SHALL call the configured provider's model list with the saved key and return only status categories, with a bounded timeout.

#### Scenario: Test without configuration
- **WHEN** no key is configured and a test is requested
- **THEN** the request is rejected

### Requirement: Workbench exposes settings under More

The workbench sidebar MUST provide a “更多” entry containing “设置”, which opens the model settings dialog.

#### Scenario: Save from dialog
- **WHEN** the user saves valid model settings from the dialog
- **THEN** the dialog reports saved and instructs that a restart applies them

### Requirement: Provider models can be discovered before saving

The authenticated settings API SHALL discover model IDs using the proposed Provider, Endpoint and optional API key without saving them. A saved key MUST only be reused when both Provider and normalized Endpoint match its saved connection. The request MUST have bounded duration and response size, MUST NOT follow redirects and MUST NOT echo credentials or upstream error bodies.

#### Scenario: Discover with unsaved credentials
- **WHEN** an operator supplies a valid connection and a new API key before selecting a model
- **THEN** the API returns unique valid model IDs from the provider without writing settings or returning the key

#### Scenario: Changed connection cannot reuse the saved secret
- **WHEN** the Provider or Endpoint differs from the saved connection and no new key is supplied
- **THEN** discovery is rejected before making a provider request

### Requirement: Workbench supports model choice and manual fallback

The settings dialog SHALL display discovered model IDs in a selectable control, retain the current model and offer manual input when discovery is unavailable. Opening saved settings MAY discover read-only model metadata; connection changes and dialog closure MUST invalidate outstanding discovery results. Selecting a model MUST NOT save or apply it automatically.

#### Scenario: Choose and save a provider model
- **WHEN** the operator discovers models and selects one
- **THEN** the choice is kept in the form and only an explicit save persists it, with the restart reminder

#### Scenario: Discovery fails or becomes stale
- **WHEN** the provider cannot return a usable list or the operator changes the connection during discovery
- **THEN** the current model remains editable and an old response cannot replace the current connection's model list
