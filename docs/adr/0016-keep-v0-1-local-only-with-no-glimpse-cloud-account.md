# Keep V0.1 local-only with no Glimpse cloud account

Glimpse V0.1 will be a Local-only App. It will not include a Glimpse account system, Glimpse-hosted cloud sync, or a remote history service.

## Considered Options

- Local-only app: keeps privacy boundaries simple and fits the early personal developer tool positioning.
- Account without sync: adds identity complexity without clear V0.1 value.
- Cloud sync for settings and history: useful for teams and multi-device workflows, but introduces hosting, privacy, security, and permission design too early.

## Consequences

All V0.1 configuration and history remain on the user's machine, except for explicit calls to the user's configured database and AI model provider. Team sharing, cloud sync, and hosted templates are future product areas, not V0.1 assumptions.
