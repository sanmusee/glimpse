# Limit V0.1 catalog scope to one default database/schema

Glimpse V0.1 will read and send model-visible Database Catalog Context only for the single Default Database/Schema configured on a connection. It will not automatically read every database or schema visible to the configured account.

## Considered Options

- Single default database/schema: keeps catalog size, privacy scope, and table discovery quality manageable for V0.1.
- User-selected multiple databases/schemas: useful later, but adds configuration and cross-schema discovery complexity.
- All visible databases/schemas: most automatic, but risks large prompts, noisy discovery, and unnecessary metadata exposure.

## Consequences

Connection setup must include a default database/schema. Multi-schema and cross-database query assistance become future capabilities rather than V0.1 assumptions.
