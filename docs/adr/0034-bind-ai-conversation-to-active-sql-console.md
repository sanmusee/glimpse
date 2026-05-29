# Bind AI conversation to active SQL Console

Glimpse V0.2 will bind the AI Conversation View to the active SQL Console. Each SQL Console keeps its own AI Conversation History, and switching consoles changes the visible conversation along with the SQL Draft and Result Set.

## Considered Options

- Use one global AI conversation: simpler, but mixes unrelated databases, SQL drafts, and tasks.
- Bind conversation to the active SQL Console: aligns with the existing Query Session model and preserves task context.
- Bind conversation only to Database Connection: groups related work, but still mixes multiple console tasks under the same connection.

## Consequences

The AI Conversation View should read and write the active console's Query Session AI Conversation History. Empty-state behavior should be per console, not global.
