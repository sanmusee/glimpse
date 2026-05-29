# Limit V0.2 connection tree to table level

Glimpse V0.2 will let the Database Connection Tree expand from saved Database Connections to the configured Default Database/Schema and its tables, but it will not require field-level, index-level, or full database-object browsing in the left tree. This exposes enough catalog structure for SQL work without turning the V0.2 scope into a full database IDE object explorer.

## Considered Options

- Show only saved Database Connections: simplest, but underuses the catalog metadata Glimpse already reads.
- Expand to Default Database/Schema and tables: gives users useful orientation while keeping the tree compact.
- Expand to fields, indexes, procedures, and other database objects: familiar in full IDEs, but too broad for the 0.2 workbench.

## Consequences

V0.2 can reuse the existing Database Catalog Context for table listing. Table details, columns, indexes, and DDL can be introduced later through a detail view or contextual action rather than deep left-tree nesting.
