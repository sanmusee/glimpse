# Send only selected database metadata to the model

Glimpse will allow Selected Table Context to be sent to the user-configured OpenAI-compatible model provider so the model can generate, modify, explain, and repair SQL with useful database context. Sensitive Connection Information such as host, port, username, password, API keys, and SSH keys must not be sent to the model. Sample data, query results, and full database catalogs are excluded by default until explicitly reconsidered.

## Considered Options

- Send no database metadata to the model: safer by default, but removes Glimpse's main advantage over a generic AI chat tool.
- Send broad database context automatically: more convenient, but expands the privacy and security surface too early.
- Send only user-selected table metadata: preserves the core product value while keeping the model context intentionally scoped.

## Consequences

V0.1 prompt construction, logging, debugging, and telemetry must preserve this boundary. Any future feature that sends sample data, query results, or broader catalogs to the model should make that expansion explicit.
