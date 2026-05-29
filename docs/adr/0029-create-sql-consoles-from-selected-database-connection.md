# Create SQL Consoles from selected Database Connection

Glimpse V0.2 will create SQL Consoles from the currently selected Database Connection in the Database Connection Tree. The main New Console command belongs to the left connection tree; double-clicking a Database Connection opens its most recent SQL Console or creates one if no console exists, while the right-side SQL Console List primarily switches and closes consoles.

## Considered Options

- Create consoles from a global command with later connection selection: flexible, but makes console ownership ambiguous.
- Create consoles from the selected Database Connection: keeps the connection-to-console relationship explicit.
- Make the right-side Console List the main creation surface: visible near consoles, but weaker at expressing which Database Connection owns the new console.

## Consequences

The UI should disable or clarify New Console when no Database Connection is selected. Any right-side add action must derive its target connection from the current selection or active console rather than creating a connectionless console.
