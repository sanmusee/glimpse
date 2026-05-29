# Use global AI configuration in V0.1

Glimpse V0.1 will use one Global AI Configuration shared across all database connections. The configuration includes `base_url`, `api_key`, `model`, `temperature`, and `max_tokens` for an OpenAI-compatible model provider.

## Considered Options

- Global AI configuration: simplest for an early personal developer tool and keeps database connections focused on database access.
- Per-connection AI configuration: flexible, but adds setup complexity and mixes model policy into database connection management.
- Global default with per-connection overrides: powerful, but more than V0.1 needs.

## Consequences

Settings should have one AI provider section. Database connection records should not store model provider overrides in V0.1, though the configuration model can leave room for future workspace-level or connection-level policy.
