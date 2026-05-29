# Use a global model provider registry in V0.2

Glimpse V0.2 will evolve the V0.1 single Global AI Configuration into a global Model Provider Registry with multiple saved OpenAI-compatible Model Provider configurations and one Default Model Provider. This keeps provider switching convenient for a personal developer tool while preserving the V0.1 boundary that Database Connections do not own or override model provider settings.

## Considered Options

- Keep one global AI configuration: simplest, but forces users to overwrite settings when moving between OpenAI, DeepSeek, Ollama, internal gateways, or other OpenAI-compatible endpoints.
- Use a global provider registry with a default provider: supports realistic provider switching without mixing model policy into database connection management.
- Add per-connection provider configuration: flexible, but couples database access and model selection too early.

## Consequences

The V0.2 settings UI should manage multiple provider records and make the Default Model Provider visible. Query Sessions and Database Connections should continue to reference database context separately from model provider configuration unless a later version explicitly reopens per-connection policy.
