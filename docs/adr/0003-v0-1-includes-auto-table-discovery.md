# V0.1 includes auto table discovery

Glimpse V0.1 will support Auto Table Discovery: a user can describe a query need and Glimpse should identify likely relevant tables from the connected database catalog. The resulting Candidate Table Set should be visible for user review before or alongside SQL generation.

## Considered Options

- Manual table selection only: simpler and safer, but leaves too much schema navigation work on the user.
- Select a primary table and auto-expand nearby tables: reduces complexity, but still assumes the user already knows the entry table.
- Auto-discover relevant tables from the database catalog: provides a stronger assistant experience, but requires careful catalog indexing, ranking, and model-context boundaries.

## Consequences

V0.1 must include enough metadata indexing and search to propose relevant tables from the connected catalog. This changes the original product note that table selection would be manual-only in the first version. The privacy boundary for whether full catalogs can be sent to the model remains a separate decision.
