# Use Workbench layout as V0.1 UI baseline

Glimpse V0.1 will use the Workbench Layout from UI prototype Variant A as its baseline: session history and catalog context on the left, SQL editor and query results in the center, and AI assistance, Candidate Table Set, and table context on the right. Variant B's command-first top band and Variant C's timeline-first session view may inspire future refinements, but they are not the V0.1 baseline.

## Considered Options

- Variant A, Workbench: most directly supports SQL editor-first behavior while keeping AI and table discovery close to the editor.
- Variant B, Command Deck: makes natural-language entry prominent, but risks pulling Glimpse toward a chat-first product.
- Variant C, Session Timeline: makes Query Session lifecycle very clear, but weakens immediate catalog inspection and SQL workbench density.

## Consequences

Issue #2 should implement a three-zone workbench shell. Issues involving Candidate Table Set, SQL generation, execution warnings, result display, and Query Session history should be reviewed against this layout: SQL and results stay central; AI assistance and candidate tables remain visible but supporting; session history and catalog context stay available without taking over the workspace.
