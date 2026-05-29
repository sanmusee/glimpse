# V0.1 includes read-only SQL execution

Glimpse V0.1 will implement Read-only Mode and execute allowed read-only SQL statements such as `SELECT`, `WITH`, and `EXPLAIN` inside the app, then display query results or errors. It will block write and schema-changing statements such as `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, and `CREATE` in V0.1, while leaving room for future Data Modification Mode and Full Access Mode.

## Considered Options

- Generate, explain, and copy SQL only: keeps V0.1 smaller, but leaves the user bouncing between Glimpse and another database tool.
- Execute read-only SQL in Glimpse: creates a fuller query loop and enables in-app error repair, but requires result display, query limits, timeout handling, cancellation, and stronger SQL safety checks.
- Hide execution behind an experimental flag: lowers default risk, but weakens the first-run product loop.

## Consequences

V0.1 must include a result table, error capture, execution-state handling, and read-only SQL validation. Query execution should remain visible and user-triggered; Glimpse should not silently execute generated SQL. Execution validation should be modeled as an Execution Safety Mode concept rather than hard-coded as the only possible policy forever.
