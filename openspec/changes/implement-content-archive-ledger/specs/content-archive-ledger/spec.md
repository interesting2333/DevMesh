## ADDED Requirements

### Requirement: Archive requests are durable and idempotent

The system SHALL persist an archive request for an existing content object with its project, requester and state. Replaying the same request MUST return the original record.

#### Scenario: Replay returns the original request
- **WHEN** the same archive request is submitted again
- **THEN** the original record is returned and no duplicate is created

### Requirement: Acknowledgement never deletes content

An ACK SHALL only move a REQUESTED record to ACKED and record the actor and time. The content object MUST remain present, and there MUST be no deletion command in this increment.

#### Scenario: ACK leaves content intact
- **WHEN** an archive request is acknowledged
- **THEN** the record is ACKED and the content object still exists

#### Scenario: Lost ACK keeps the request open
- **WHEN** no ACK is ever submitted
- **THEN** the record stays REQUESTED and the content object still exists
