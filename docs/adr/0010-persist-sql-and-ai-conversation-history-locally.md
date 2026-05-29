# Persist SQL and AI conversation history locally

Glimpse V0.1 will persist Query History, SQL Drafts, and AI Conversation History locally so users can return to prior SQL work and continue from previous AI interactions.

## Considered Options

- Persist SQL history and drafts only: reduces stored AI context, but loses the reasoning and iteration path around a query.
- Persist SQL history, drafts, and AI conversation history: improves continuity for SQL work, but stores more potentially sensitive project context locally.
- Persist nothing by default: strongest privacy posture, but weakens a daily developer tool workflow.

## Consequences

Local storage should treat SQL and AI histories as sensitive work data. Non-secret history can live in SQLite, while credentials, database passwords, API keys, and SSH keys remain in macOS Keychain. Future settings may add retention controls or private-session behavior.
