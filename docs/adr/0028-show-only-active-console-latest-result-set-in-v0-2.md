# Show only active console latest Result Set in V0.2

Glimpse V0.2 will show only the most recent Result Set for the active SQL Console in the bottom results area. Execution metadata remains part of the Query Session, but V0.2 does not introduce multiple result tabs or persisted result rows.

## Considered Options

- Show only the active console's latest Result Set: keeps the query loop simple and matches the existing no-result-row-persistence boundary.
- Add multiple result tabs per console: useful for comparing executions, but adds lifecycle, memory, and switching complexity.
- Persist result rows with execution history: convenient for later review, but violates the established privacy and storage boundary.

## Consequences

The bottom results view should change when the active SQL Console changes. V0.2 can still preserve Execution Result Metadata for history, errors, and repair context, but should not treat old Result Sets as restorable tabs.
