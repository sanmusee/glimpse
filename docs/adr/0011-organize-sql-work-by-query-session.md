# Organize SQL work by query session

Glimpse V0.1 will organize persisted SQL and AI work around Query Sessions. A Query Session contains the user's query need, bound database connection, Default Database/Schema, Candidate Table Set, SQL drafts, generated SQL, explanations, AI Conversation History, execution attempts, result metadata, and errors.

## Considered Options

- Global history list: simpler, but quickly becomes hard to navigate as AI conversations, SQL revisions, and execution errors accumulate.
- Group by database connection only: useful, but does not capture the lifecycle of a specific query task.
- Query Session: preserves the full context of a query task and gives the UI a natural unit for history, continuation, and repair.

## Consequences

The local data model and UI should treat Query Session as a first-class concept. SQL drafts, AI messages, selected or discovered tables, and execution records should belong to a session.
