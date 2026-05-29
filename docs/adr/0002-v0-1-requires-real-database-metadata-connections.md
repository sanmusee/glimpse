# V0.1 requires real database metadata connections

Glimpse V0.1 will connect to real MySQL/TiDB databases to read metadata for databases, schemas, tables, columns, and indexes. It will not execute user SQL in the first version; generated SQL is copied out for execution elsewhere.

## Considered Options

- Manual DDL paste only: faster to prototype, but too close to a generic AI chat workflow and weakens Glimpse's core differentiation.
- Real metadata connection plus no execution: validates the database-context value while keeping query execution, result display, cancellation, and export out of V0.1.
- Real metadata connection plus SQL execution: more complete, but expands the first release into query safety, timeouts, result rendering, and cancellation.

## Consequences

V0.1 must include local connection configuration, secure credential storage, MySQL/TiDB metadata readers, and a table-selection UI. SQL execution remains a later capability and should not drive the first release architecture beyond leaving room for it.
