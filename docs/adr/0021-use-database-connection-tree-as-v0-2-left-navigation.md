# Use Database Connection Tree as V0.2 left navigation

Glimpse V0.2 will change the left side of the workbench from V0.1's session-history-and-catalog support area into a Database Connection Tree where saved Database Connections are first-level items. This makes the app feel more like a focused SQL workbench: users choose a connection first, then create or open SQL work against that connection.

## Considered Options

- Keep Query Session history as the left-side primary structure: preserves V0.1 continuity, but makes connection management feel secondary.
- Use Database Connection Tree as the left-side primary structure: better matches the user's mental model from database clients and keeps connection switching visible.
- Split left navigation into separate connection and session tabs: flexible, but adds navigation complexity before the 0.2 workbench shape is stable.

## Consequences

Query Sessions remain part of the domain model, but V0.2 UI should not make them the first-level left navigation concept. Session history can move to connection-scoped consoles, tabs, recent work affordances, or another supporting surface without displacing Database Connections as the left-side anchor.
