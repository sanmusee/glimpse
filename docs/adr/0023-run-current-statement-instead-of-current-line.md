# Run current statement instead of current line

Glimpse V0.2 will define the SQL editor execution command as Run Current Statement when no text is selected, and Run Selected Statements when text is selected. This avoids the ambiguity and broken behavior of executing only the cursor's visual line when a SQL statement spans multiple lines.

## Considered Options

- Run current line: simple to describe, but fails for common multi-line SQL formatting.
- Run the entire editor by default: simple to implement, but surprising and risky when a console contains scratch SQL.
- Run current statement or selected statements: matches developer database-client expectations and keeps execution scoped to the user's visible editing intent.

## Consequences

The editor needs statement-boundary detection around the cursor and ordered splitting for selected SQL. The execution button should not execute the full SQL Console by default unless the full console text is explicitly selected or a separate command is added later.
