# user-identity-validation Specification

## Purpose

Ensures all REST endpoints that accept a client-supplied `userId` validate it against one canonical format — length- and character-bounded, trimmed — and reject non-conforming values with HTTP 400 before performing any DynamoDB access.

## Requirements

### Requirement: A canonical userId format is enforced across REST endpoints
The system SHALL define one canonical format for a client-supplied `userId` — a trimmed string of 8 to 64 characters drawn only from `[A-Za-z0-9._-]` — and SHALL apply the identical rule at every REST endpoint that reads a `userId`, whether from a path parameter, a query-string parameter, or a request body.

#### Scenario: Well-formed userId is accepted
- **WHEN** a REST request supplies a `userId` that, after trimming, is 8–64 characters of `[A-Za-z0-9._-]`
- **THEN** the endpoint proceeds using the trimmed value as the identity key

#### Scenario: The same rule applies on read and write paths
- **WHEN** a `userId` is read on any of the user-history, stats, or submit endpoints
- **THEN** all three enforce the identical format rule from a single shared validator

### Requirement: Malformed userId is rejected before any data access
The system SHALL reject a `userId` that does not conform to the canonical format with HTTP `400` and a clear error message, before performing any DynamoDB read or write that would use the value as a key.

#### Scenario: Empty or whitespace-only userId
- **WHEN** a request supplies a `userId` that is empty or only whitespace after trimming
- **THEN** the endpoint returns `400` with an `Invalid userId` error and performs no table access

#### Scenario: Oversized or out-of-charset userId
- **WHEN** a request supplies a `userId` longer than 64 characters, shorter than 8, or containing characters outside `[A-Za-z0-9._-]` (including control characters or expression metacharacters)
- **THEN** the endpoint returns `400` and performs no table access

#### Scenario: Malformed userId never becomes a stored key
- **WHEN** the submit endpoint receives a request whose body `userId` is malformed
- **THEN** the endpoint returns `400` and issues no `PutCommand`, so no record is persisted under a malformed identity

### Requirement: userId is normalized before use
The system SHALL trim the `userId` and use the normalized value both as the DynamoDB key and in any response field that echoes the id, so that inputs differing only by surrounding whitespace map to the same identity.

#### Scenario: Whitespace-padded userId maps to one identity
- **WHEN** two requests supply the same id with and without surrounding whitespace
- **THEN** both resolve to the same trimmed key and do not fork the user's data across variants
