# Send SQL errors to the model for repair

Glimpse V0.1 may send SQL text, database error messages, database dialect, and relevant Database Catalog Context or Selected Table Context to the configured model provider so the model can repair failed SQL attempts. Sensitive Connection Information and Result Set rows remain excluded.

## Considered Options

- Send errors to the model: enables the core repair loop and reduces copy-paste between tools.
- Show errors only to the user: safer and simpler, but removes AI-assisted repair from the product loop.
- Confirm before every repair call: explicit, but adds friction to a common iterative workflow.

## Consequences

Error capture should preserve enough detail for repair prompts. Logs and persisted Query Session data may include SQL and error messages, so they should be treated as sensitive work data.
