# Present Query Sessions as SQL Consoles in V0.2

Glimpse V0.2 will present Query Sessions in the UI as SQL Consoles scoped to a Database Connection. This keeps the persisted Query Session model for SQL drafts, AI conversation history, execution attempts, and result metadata, while giving users a familiar database-client interaction model with connection-specific console entries or tabs.

## Considered Options

- Keep Query Session as an explicit left-side history item: preserves the V0.1 language, but is less natural once the left side is organized around Database Connections.
- Present Query Sessions as SQL Consoles: matches database client expectations and gives each connection its own editable SQL workspace.
- Use one global SQL editor regardless of connection: simplest, but makes connection switching, result ownership, and execution history ambiguous.

## Consequences

The active SQL editor and bottom Result Set view should follow the selected SQL Console. A Database Connection may have multiple SQL Consoles, and each console keeps its own SQL Draft and execution metadata. The implementation can still store these records as Query Sessions internally.
