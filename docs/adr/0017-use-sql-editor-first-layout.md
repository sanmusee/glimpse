# Use a SQL editor-first layout

Glimpse V0.1 will use a SQL Editor-first Layout. The SQL editor and query results are the main workspace, while AI assistance, Auto Table Discovery, SQL Iteration, repair, and conversation live in supporting panels.

## Considered Options

- Chat-first layout: emphasizes AI interaction, but can make Glimpse feel like a generic chat app instead of a developer SQL tool.
- SQL editor-first layout: reinforces programmer control and keeps generated SQL and execution results central.
- BI dashboard-first layout: useful for reporting, but outside the V0.1 developer workflow.

## Consequences

Frontend design should prioritize editor ergonomics, result-table readability, visible execution state, and concise AI controls. The AI panel should assist the SQL workflow rather than become the primary workspace.
