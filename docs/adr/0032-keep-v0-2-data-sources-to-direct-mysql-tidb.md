# Keep V0.2 data sources to direct MySQL/TiDB

Glimpse V0.2 will keep Database Connection support limited to direct MySQL/TiDB connections using host, port, username, password, and Default Database/Schema. It will not add PostgreSQL, SSH Tunnel, advanced SSL, bastion-host workflows, or other connection types in V0.2.

## Considered Options

- Expand database and connection types in V0.2: useful for broader adoption, but competes with the workbench, console, and execution UX changes.
- Keep direct MySQL/TiDB only: preserves the existing database-access boundary while improving the core SQL client experience.

## Consequences

The V0.2 data source form may show a type field only if it does not imply unsupported choices. Driver and catalog work should focus on the existing MySQL/TiDB path.
