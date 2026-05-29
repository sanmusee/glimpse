# Require manual execution for AI-generated SQL

Glimpse will not automatically execute SQL immediately after AI generation. Generated SQL must be displayed for user review, and execution requires an explicit user action.

## Considered Options

- Auto-execute generated SQL: fastest loop, but weakens trust and makes mistakes more costly.
- Auto-execute only simple SQL: convenient, but creates ambiguous complexity rules and surprises users.
- Require manual execution: preserves programmer control and keeps AI assistance reviewable.

## Consequences

The UI must keep generation and execution as separate states. SQL explanations, warnings, and selected execution mode should be visible before the user triggers execution.
