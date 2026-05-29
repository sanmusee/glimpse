# Stop selected statement execution on first failure

Glimpse V0.2 will execute selected SQL statements in order and stop when the first statement fails. This keeps multi-statement execution predictable while the bottom results area only shows the active console's latest Result Set or error state.

## Considered Options

- Continue after failures: maximizes progress, but can obscure which statement matters when the UI shows only one latest result state.
- Stop on first failure: makes the failure point clear and avoids running later statements after an unexpected error.
- Ask after each failure: safer, but interrupts the common execution path and adds extra state for V0.2.

## Consequences

Execution metadata should capture statements that actually ran. Statements after the first failure should remain unexecuted, and the results area should make the failed statement and error visible.
