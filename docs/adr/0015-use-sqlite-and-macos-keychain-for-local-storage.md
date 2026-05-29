# Use SQLite and macOS Keychain for local storage

Glimpse V0.1 will use SQLite for non-secret configuration and work history, and macOS Keychain for credentials and secret material. SQLite stores connection names, host, port, Default Database/Schema, Query Sessions, SQL drafts, AI Conversation History, Execution Result Metadata, and user preferences. Keychain stores database passwords, AI API keys, and future SSH keys.

## Considered Options

- Store everything in SQLite: simpler, but risks plaintext secret storage.
- Use SQLite plus app-managed encryption: flexible, but adds key management burden.
- Use SQLite plus macOS Keychain: fits a macOS local app and delegates secret handling to the platform.

## Consequences

Database connection records and AI settings must reference secrets stored in Keychain rather than embedding secret values in SQLite. Export, backup, and debugging flows should not accidentally dump Keychain-managed secrets.
