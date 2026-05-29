# Do not persist query result sets in V0.1

Glimpse V0.1 will display query Result Sets in the UI but will not persist the returned rows and values in Query Session history. It will persist Execution Result Metadata such as SQL, timestamp, duration, row count, success/failure state, and error messages.

## Considered Options

- Persist metadata only: preserves useful history while avoiding default storage of business data.
- Persist the most recent result set: convenient for returning to a session, but still stores potentially sensitive data.
- Persist all result sets: strongest history continuity, but creates privacy, storage, and retention concerns.

## Consequences

SQLite history should not store result rows by default. If future versions add saved results, exports, or pinned result snapshots, those should be explicit user actions with clear retention behavior.
