# Use right-side SQL Console List in V0.2

Status: superseded by ADR-0033

Glimpse V0.2 will use the right side of the workbench for a SQL Console List showing created consoles and the active console selection. This shifts V0.2 away from the V0.1 assumption that the right side is primarily occupied by AI assistance, Candidate Table Set, and table details.

## Considered Options

- Keep the V0.1 right-side AI and context panels: preserves the previous workbench shape, but leaves console switching without a clear persistent home.
- Use the right side for SQL Console List: makes created consoles visible and supports fast switching between connection-scoped workspaces.
- Place SQL Console List only in editor tabs: compact, but may become hard to scan once many connections and consoles exist.

## Consequences

The active SQL editor and Result Set view should follow the selected item in the SQL Console List. AI assistance and table context need a different V0.2 surface if they remain in scope, such as a dialog, drawer, inline command, or later version.
