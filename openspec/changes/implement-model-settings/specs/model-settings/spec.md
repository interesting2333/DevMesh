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