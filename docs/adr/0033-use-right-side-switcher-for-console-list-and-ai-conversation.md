# Use right-side switcher for console list and AI conversation

Glimpse V0.2 will add a Right-side Content Switcher at the top of the right-side workspace area. The switcher initially supports SQL Console List and a Cursor-style AI Conversation View, with chat history above and an input box below.

## Considered Options

- Keep the right side only for SQL Console List: clear for console switching, but removes an obvious home for AI interaction.
- Move AI interaction only to dialogs or drawers: keeps the main layout sparse, but makes AI conversation feel disconnected from the SQL workspace.
- Use a right-side switcher: keeps console switching and AI conversation available in one region without showing both at once.

## Consequences

ADR-0024 and ADR-0025 are superseded for V0.2 layout purposes. The right-side area is no longer a console-only panel, and AI conversation is no longer modal-only. The SQL editor remains the primary workspace; selecting the AI Conversation View should not replace the editor or bottom Result Set.
