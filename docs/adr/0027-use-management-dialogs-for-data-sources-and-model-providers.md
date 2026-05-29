# Use management dialogs for data sources and model providers

Glimpse V0.2 will use management dialogs for both Database Connections and Model Providers. Each dialog has a left list of saved records and a right form for creating or editing the selected record; the add action opens an empty form, and saving refreshes the list and selects the saved item.

## Considered Options

- Use new-only dialogs: quick for first setup, but forces separate edit flows later.
- Use always-visible forms in the main workbench: simple, but consumes space that should belong to connection navigation and SQL work.
- Use management dialogs with list and form panes: matches the intended database-client interaction and supports create/edit in one place.

## Consequences

The main workbench can keep compact toolbar entry points for data source and model provider management. Dialog state should distinguish selecting an existing record from creating a new one, and tests should cover save-refresh-select behavior.
