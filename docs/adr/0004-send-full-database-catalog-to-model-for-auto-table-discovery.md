# Send full database catalog to the model for auto table discovery

Glimpse V0.1 may send Database Catalog Context from the connected database to the user-configured OpenAI-compatible model provider so the model can help identify relevant tables from a natural-language query. Sensitive Connection Information, sample data, and query results remain excluded by default.

## Considered Options

- Narrow candidate tables locally before calling the model: reduces model-visible catalog scope, but may make early table discovery weaker and more complex to build.
- Send the full catalog to the model: gives the model maximum schema context for table discovery, but expands the privacy boundary beyond manually selected tables.
- Make it configurable with a safer default: flexible, but adds settings complexity before the first product loop is proven.

## Consequences

Prompt construction, logging, and debugging must treat the full catalog as potentially sensitive metadata even though it is allowed model context. Future enterprise or privacy-focused modes may need a setting to switch back to local-first narrowing.
