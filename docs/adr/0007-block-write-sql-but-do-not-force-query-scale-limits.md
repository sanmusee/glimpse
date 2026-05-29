# Block write SQL but do not force query scale limits

In V0.1 Read-only Mode, Glimpse will hard-block write and schema-changing SQL statements, while treating query scale controls as warnings rather than mandatory rewrites. It should warn about missing `LIMIT`, long-running queries, or large result sets, but it should not automatically inject `LIMIT`, silently rewrite SQL, or prevent a developer from running an allowed read-only query solely because it may be large.

## Considered Options

- Enforce strict limits: safer for databases, but can feel too controlling for technical users and may alter query intent.
- Validate only read-only SQL and warn on scale risks: keeps the hard safety boundary while preserving developer control.
- Warn on everything but block nothing: more flexible, but contradicts the V0.1 read-only execution boundary.

## Consequences

The SQL validator must distinguish blocked statement types from warning-only query risks. The execution UI should make warnings visible before execution, and generated SQL must remain transparent rather than being silently modified. Future execution modes may change which statement types are blocked, but should preserve the distinction between hard blocks and warnings.
