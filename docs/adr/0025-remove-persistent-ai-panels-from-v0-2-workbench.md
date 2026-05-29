# Remove persistent AI panels from V0.2 workbench

Status: superseded by ADR-0033

Glimpse V0.2 will not reserve a persistent main workbench panel for AI Assistant, Candidate Table Set, or table details. The main layout prioritizes Database Connection Tree, SQL editor, SQL Console List, and Result Set, while AI-assisted capabilities can move to commands, dialogs, drawers, or contextual actions.

## Considered Options

- Keep V0.1 persistent AI and context panels: keeps AI visible, but competes with the database-client layout the V0.2 workbench is moving toward.
- Use non-persistent AI surfaces: preserves AI capability without making the main workspace feel chat-first.
- Remove AI features entirely from V0.2: simplifies layout, but would undercut Glimpse's AI SQL client positioning.

## Consequences

V0.2 implementation should avoid assuming a permanent right-side AI panel. AI entry points should be explicit user actions, and any future AI surface should not displace the core connection, console, editor, and result workflow.
