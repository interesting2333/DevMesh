## ADDED Requirements
### Requirement: Complete execution detail navigation
The conversation workbench SHALL provide Task, Collaboration, Results, Preview and Records tabs in execution details, using saved facts from the selected conversation and its exact Run.
#### Scenario: Inspect without leaving the conversation
- **WHEN** the user switches between the five detail tabs
- **THEN** the corresponding real content or an explicit empty state is shown without submitting commands or replacing the conversation draft
#### Scenario: Review a plan from another detail tab
- **WHEN** the user opens the full plan from the conversation
- **THEN** execution details selects the Task tab and displays the current plan

### Requirement: Understandable mode selection
The composer SHALL explain plan and execute choices, preserve the current saved mode and report unavailable execution conditions without claiming execution has started.
#### Scenario: Choose a mode for the next message
- **WHEN** the user chooses a mode with pointer or keyboard
- **THEN** only the local draft mode changes until the user sends a message, and the active task is not immediately paused or restarted

### Requirement: Readable desktop conversation
The workbench SHALL align readable conversation text and its composer, allow desktop navigation collapse and preserve history reading position while reporting new replies.
#### Scenario: User reads history
- **WHEN** another reply arrives while the user is reading earlier messages
- **THEN** the view preserves the scroll position and offers a return to the latest reply

### Requirement: Exact plan decision
The workbench SHALL show the actual current plan and confirm only its displayed version and input basis through one persistent command.
#### Scenario: Displayed plan becomes stale
- **WHEN** the input or reviewed plan basis changes before confirmation
- **THEN** the command is rejected without recording a plan decision or starting execution

### Requirement: Recoverable conversation title
The workbench SHALL persist original rename commands and preserve manual titles over automatic goal titles.
#### Scenario: Rename acknowledgement is lost
- **WHEN** a rename response is lost and the page is refreshed
- **THEN** the original command remains available for lookup and recovery without automatic mutation on refresh
