# Defer SQL explanation after V0.1

Glimpse V0.1 will not include SQL Explanation as a required capability. The first version will focus on metadata-backed SQL generation, read-only execution, result display, and SQL repair.

## Considered Options

- Include model-generated SQL explanation in V0.1: helpful for trust, but expands prompt design and UI surface.
- Use local rules to explain SQL: avoids model dependence, but adds SQL parsing complexity.
- Defer SQL explanation: keeps V0.1 focused on the query loop and leaves explanation for a later version.

## Consequences

The V0.1 UI does not need a required explanation panel. Future versions can add SQL Explanation as a separate capability without changing the core Query Session model.
