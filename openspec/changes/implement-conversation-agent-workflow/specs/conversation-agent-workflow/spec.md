## ADDED Requirements

### Requirement: Conversations retain authorized messages and decisions
The system SHALL durably retain user and assistant messages, exact input versions, actions and authorization under an authorized conversation, with bounded ordered reads and idempotent writes. Legacy inputs and execution facts SHALL remain available.

#### Scenario: A reply arrives after a newer user instruction
- **WHEN** an older decision returns after the conversation input version changes
- **THEN** it SHALL NOT apply actions to the newer goal or overwrite newer messages

### Requirement: Main assistant advances a bounded verified workflow
The assistant SHALL use actual context and saved results to answer, clarify, delegate, observe, verify and deliver. It SHALL retain unknown requests instead of blindly resending effects, and report actual capability blocks.

#### Scenario: User asks a question
- **WHEN** the user requests advice rather than authorizing implementation
- **THEN** the assistant SHALL answer without converting the advice into an implementation requirement

### Requirement: Execution authorization differs from manual plan confirmation
The system SHALL support EXECUTE and PLAN modes. PLAN requires explicit confirmation of an accurate current plan; EXECUTE uses a separate bounded authorization and the original quality and permission gates. Automatic authorization SHALL NOT fabricate a manual plan decision.

#### Scenario: Plan mode is selected
- **WHEN** the user asks for a plan without implementation
- **THEN** the system SHALL retain a readable plan and await applicable user confirmation before implementation

### Requirement: Continuous conversation exposes real progress and control
The workbench SHALL retain the composer, messages, attachments and original recovery while showing real replies, progress, clarification, confirmation and delivery in one conversation. Detailed plans and logs SHALL be available on demand. Pause and resume SHALL reflect actual control facts.

#### Scenario: User refreshes during work
- **WHEN** the page reconnects or refreshes
- **THEN** it SHALL recover saved messages and exact results without automatically resubmitting pending commands or replacing drafts
