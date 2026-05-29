# Glimpse V0.1 Issue Draft

Sources:

- `docs/product/glimpse-v0.1-prd.zh.md`
- `CONTEXT.md`
- `docs/adr/`

Notes:

- This is a local draft. No GitHub Issues have been created.
- The breakdown follows tracer-bullet vertical slices: each issue should produce an independently demoable or verifiable end-to-end path where possible.
- Suggested labels use the current repo vocabulary: `needs-triage`, `ready-for-agent`, `ready-for-human`.

## Overview

| # | Title | Type | Suggested label | Blocked by | User stories covered |
|---|---|---|---|---|---|
| 0 | Scaffold the SQL editor-first app shell and empty states | AFK | `ready-for-agent` | None | 20, 21, 22 |
| 1 | Configure the global AI provider and support streaming test requests | AFK | `ready-for-agent` | 0 | 2, 3, 10, 11, 22 |
| 2 | Create and save direct MySQL/TiDB database connections | AFK | `ready-for-agent` | 0 | 1, 3 |
| 3 | Read and refresh the default schema catalog after opening a connection | AFK | `ready-for-agent` | 2 | 4, 5 |
| 4 | Create Query Sessions, SQL drafts, and session restore | AFK | `ready-for-agent` | 0, 2 | 18, 19, 20 |
| 5 | Discover candidate tables from catalog and show an adjustable set | AFK | `ready-for-agent` | 1, 3, 4 | 6, 7 |
| 6 | Generate SQL from natural language and stream it into the editor | AFK | `ready-for-agent` | 1, 4, 5 | 8, 10, 12, 20 |
| 7 | Iterate on current SQL using natural-language edits | AFK | `ready-for-agent` | 6 | 9, 10, 18 |
| 8 | Implement Read-only Mode, manual execution gate, and SQL safety validation | AFK | `ready-for-agent` | 2, 4, 6 | 12, 13, 14 |
| 9 | Display a basic result table and support copying visible results | AFK | `ready-for-agent` | 8 | 15, 16, 19 |
| 10 | Repair current SQL with AI after execution errors | AFK | `ready-for-agent` | 1, 4, 8 | 10, 17, 18 |
| 11 | Manage Query Session history and continuation workflow | AFK | `ready-for-agent` | 4, 6, 8, 10 | 18, 19, 20 |
| 12 | Add V0.1 privacy, safety, and scope regression tests | AFK | `ready-for-agent` | 1, 2, 3, 8, 10 | 3, 12, 13, 19 |

## Issue 0: Scaffold the SQL editor-first app shell and empty states

**Type**: AFK  
**Suggested label**: `ready-for-agent`  
**Blocked by**: None  
**User stories covered**: 20, 21, 22

### Background

The V0.1 interface must be SQL editor-first, not chat-first. First launch should open directly into the main interface and use empty states to guide AI provider setup and first Database Connection setup. The app also needs Light, Dark, and System theme preferences.

### Scope

- Scaffold the minimal Tauri 2 + React + TypeScript + shadcn/ui + Tailwind app shell.
- Create the SQL editor-first main layout: reserve the primary workspace for the SQL editor and result area, and reserve supporting space for the AI Assistant Panel.
- Implement Empty State Setup for missing AI configuration and missing database connections.
- Implement Light, Dark, and System theme preference and persist it in local SQLite.
- Do not implement real AI calls, database connections, SQL execution, or the result table.

### Acceptance Criteria

- [ ] The app opens directly into the main interface instead of a first-run wizard.
- [ ] The main interface visually centers the SQL editor and result area, with AI assistance in a supporting area.
- [ ] Missing AI configuration and missing database connections each show a clear empty-state entry point.
- [ ] Users can switch Light, Dark, and System themes.
- [ ] Theme preference is restored after restart.

### Testing Suggestions

- UI state tests for first launch empty states, theme switching, and theme restore.
- Frontend component tests for no-AI-config, no-database-connection, and configured placeholder states.
- Local persistence tests for reading and writing Theme Preference.

### Dependencies

None - can start immediately.

## Issue 1: Configure the global AI provider and support streaming test requests

**Type**: AFK  
**Suggested label**: `ready-for-agent`  
**Blocked by**: Issue 0  
**User stories covered**: 2, 3, 10, 11, 22

### Background

V0.1 uses one Global AI Configuration shared across all database connections. The provider should be OpenAI-compatible and support streaming responses. The API key is a secret and must be stored in macOS Keychain.

### Scope

- Provide a Global AI Configuration form in settings or empty state: `base_url`, `api_key`, `model`, `temperature`, `max_tokens`.
- Store non-secret configuration in SQLite and store `api_key` in Keychain.
- Provide a manual connection/model test that uses a streaming request.
- Display AI Request Failure and allow manual retry.
- Do not implement SQL generation prompts, model fallback, or automatic retry.

### Acceptance Criteria

- [ ] Users can save global AI configuration.
- [ ] SQLite does not store plaintext `api_key`.
- [ ] The AI API key can be written, read, and updated in Keychain.
- [ ] A test request can display Streaming AI Response.
- [ ] Failed AI requests show clear errors and can be retried manually.
- [ ] Failures do not trigger automatic retry or model fallback.

### Testing Suggestions

- Keychain boundary tests proving SQLite records do not contain plaintext keys.
- AI client tests for successful streaming responses, failure responses, and timeout/network errors.
- UI tests for save, load, error display, and manual retry.

### Dependencies

- Issue 0

## Issue 2: Create and save direct MySQL/TiDB database connections

**Type**: AFK  
**Suggested label**: `ready-for-agent`  
**Blocked by**: Issue 0  
**User stories covered**: 1, 3

### Background

V0.1 supports multiple Direct Database Connections, while each Query Session binds to one connection and one Default Database/Schema. Database passwords must be stored in Keychain; SQLite stores only non-secret configuration.

### Scope

- Provide minimal UI to create, edit, and delete Database Connections.
- Support direct MySQL/TiDB fields: connection name, host, port, username, password, Default Database/Schema.
- Store connection name, host, port, username, and Default Database/Schema in SQLite.
- Store database password in macOS Keychain.
- Provide manual connection testing and show success/failure.
- Do not support SSH Tunnel, advanced SSL, bastion-host workflows, or cross-connection queries.

### Acceptance Criteria

- [ ] Users can create multiple database connection configurations.
- [ ] Users can choose or edit Default Database/Schema.
- [ ] Database passwords are not stored as plaintext in SQLite.
- [ ] Successful connection tests show success state.
- [ ] Failed connection tests show database or network errors.
- [ ] UI does not expose SSH Tunnel, advanced SSL, or bastion-host entries.

### Testing Suggestions

- SQLite/Keychain storage boundary tests.
- Database connection tests for success, authentication failure, unreachable host, and missing database/schema.
- UI tests for connection list, create, edit, and delete.

### Dependencies

- Issue 0

## Issue 3: Read and refresh the default schema catalog after opening a connection

**Type**: AFK  
**Suggested label**: `ready-for-agent`  
**Blocked by**: Issue 2  
**User stories covered**: 4, 5

### Background

Glimpse's core differentiation comes from Database Catalog Context. V0.1 reads only the single Default Database/Schema configured on the connection, reads once when opening/connecting, caches the catalog, and lets the user refresh manually.

### Scope

- After opening a connection, read MySQL/TiDB metadata: database/schema, table, column, type, nullability, default, comment, primary key, unique index, normal index, index column order, and create table DDL.
- Display basic catalog information for tables, fields, and indexes in the object/context area.
- Implement catalog cache.
- Provide a manual refresh action.
- Show Metadata Permission Failure when permissions are insufficient.
- Do not read every database/schema visible to the account.
- Do not poll in the background or force refresh before every SQL generation.

### Acceptance Criteria

- [ ] Opening a connection reads tables from the Default Database/Schema.
- [ ] Users can inspect fields and indexes for a table.
- [ ] Manual refresh rereads the catalog and updates the UI.
- [ ] Permission failures show clear errors instead of invalidating the connection model.
- [ ] Catalog from non-default databases/schemas is not read.
- [ ] SQL generation does not implicitly refresh catalog.

### Testing Suggestions

- Metadata reader tests for tables, fields, indexes, and DDL.
- Catalog scope tests proving only Default Database/Schema is read.
- Permission failure tests.
- UI tests for table/field/index display and manual refresh state.

### Dependencies

- Issue 2

## Issue 4: Create Query Sessions, SQL drafts, and session restore

**Type**: AFK  
**Suggested label**: `ready-for-agent`  
**Blocked by**: Issue 0, Issue 2  
**User stories covered**: 18, 19, 20

### Background

The V0.1 unit of work is Query Session, not a global chat stream. A Query Session binds to one Database Connection and Default Database/Schema, and stores SQL Draft, AI Conversation History, Execution Result Metadata, and related context.

### Scope

- Create the Query Session data model and minimal UI entry point.
- Bind new sessions to one Database Connection and one Default Database/Schema.
- Maintain and persist SQL Draft in the SQL editor area.
- Restore the current or most recent Query Session after closing/restarting the app.
- Establish storage locations for AI Conversation History and Execution Result Metadata.
- Do not persist Result Set rows.

### Acceptance Criteria

- [ ] Users can create a Query Session for a database connection.
- [ ] Query Session clearly binds to one connection and one Default Database/Schema.
- [ ] SQL Draft can be saved automatically or explicitly and restored after restart.
- [ ] Query Session can store placeholder structures for AI conversation history and execution metadata.
- [ ] SQLite does not persist Result Set rows.

### Testing Suggestions

- Query Session create/read/update/delete tests.
- SQL Draft persistence and restore tests.
- Single-session-single-connection constraint tests.
- Regression tests proving Result Set rows are not persisted.

### Dependencies

- Issue 0
- Issue 2

## Issue 5: Discover candidate tables from catalog and show an adjustable set

**Type**: AFK  
**Suggested label**: `ready-for-agent`  
**Blocked by**: Issue 1, Issue 3, Issue 4  
**User stories covered**: 6, 7

### Background

V0.1 supports Auto Table Discovery: users can describe a query need without manually selecting tables. Glimpse may send Database Catalog Context for the Default Database/Schema to the model and receive a Candidate Table Set. Candidate tables must be visible and adjustable, but do not require blocking confirmation.

### Scope

- Build Auto Table Discovery requests from the current Query Session and catalog.
- Send the Default Database/Schema catalog as allowed model context.
- Parse the model's returned candidate table set.
- Display the Candidate Table Set in the UI.
- Let users add and remove candidate tables.
- Update Query Session context after candidate table changes.
- Do not implement Business Glossary or multi-schema discovery.

### Acceptance Criteria

- [ ] Users can trigger candidate table discovery from a natural-language query need.
- [ ] Model requests do not include database passwords, AI API keys, SSH keys, sample data, or result rows.
- [ ] Candidate Table Set is visible in the UI.
- [ ] Users can add or remove candidate tables.
- [ ] Query Session context updates after candidate table changes.
- [ ] Candidate tables do not require blocking confirmation before SQL generation.

### Testing Suggestions

- Prompt/context construction tests: allow catalog, exclude secrets and result rows.
- Candidate table parser tests for normal results, empty results, and unknown tables.
- UI tests for showing, adding, and removing candidate tables.
- Query Session update tests.

### Dependencies

- Issue 1
- Issue 3
- Issue 4

## Issue 6: Generate SQL from natural language and stream it into the editor

**Type**: AFK  
**Suggested label**: `ready-for-agent`  
**Blocked by**: Issue 1, Issue 4, Issue 5  
**User stories covered**: 8, 10, 12, 20

### Background

Natural-language SQL generation is a core V0.1 capability. Generation should use Query Session, Candidate Table Set, Database Catalog Context, and user input; stream SQL back; and write it into the SQL editor. Generated SQL must not execute automatically.

### Scope

- Provide natural-language input in the AI Assistant Panel.
- Build SQL generation requests from Query Session context and Candidate Table Set.
- Stream the generation process.
- Write generated SQL into the CodeMirror SQL editor.
- Persist AI Conversation History and SQL Draft.
- Show a manual execution entry point after generation, but do not execute automatically.
- Do not generate SQL Explanation.

### Acceptance Criteria

- [ ] Users can generate SQL from a query need.
- [ ] SQL generation streams partial output.
- [ ] The generated result appears in the SQL editor.
- [ ] Query Session persists the user request, AI response, and SQL Draft.
- [ ] Generated SQL is not executed automatically.
- [ ] UI does not require SQL Explanation.

### Testing Suggestions

- AI generation request construction tests.
- Streaming reducer/state tests.
- SQL editor write tests.
- Manual Execution Gate regression tests.
- AI Conversation History persistence tests.

### Dependencies

- Issue 1
- Issue 4
- Issue 5

## Issue 7: Iterate on current SQL using natural-language edits

**Type**: AFK  
**Suggested label**: `ready-for-agent`  
**Blocked by**: Issue 6  
**User stories covered**: 9, 10, 18

### Background

Real SQL work rarely ends after one generation. V0.1 needs SQL Iteration: the user can continue from the current SQL and request changes such as adding filters, changing aggregation, changing sort order, or switching time fields.

### Scope

- Support natural-language "modify current SQL" input in the AI Assistant Panel.
- Include current SQL, Query Session, Candidate Table Set, and relevant catalog in the request context.
- Stream the modified SQL result.
- Update the SQL editor with the modified SQL.
- Persist the AI Conversation History turn and SQL Draft.
- Do not regenerate from scratch each time.

### Acceptance Criteria

- [ ] Users can enter a modification intent based on current SQL.
- [ ] Modification requests include current SQL and relevant schema context.
- [ ] Modified SQL streams back.
- [ ] Modified SQL updates the editor.
- [ ] Modification history is stored in Query Session.

### Testing Suggestions

- SQL Iteration prompt/context tests.
- Streaming state tests.
- Editor update tests.
- Query Session history append tests.

### Dependencies

- Issue 6

## Issue 8: Implement Read-only Mode, manual execution gate, and SQL safety validation

**Type**: AFK  
**Suggested label**: `ready-for-agent`  
**Blocked by**: Issue 2, Issue 4, Issue 6  
**User stories covered**: 12, 13, 14

### Background

V0.1 only implements Read-only Mode. SQL execution must be manually triggered. Write and schema-changing statements must be hard-blocked. Missing `LIMIT`, potentially long-running queries, and large result sets should produce warnings only, without rewriting SQL.

### Scope

- Introduce the Execution Safety Mode concept and expose only Read-only Mode in V0.1.
- Provide a manual execution action in the SQL editor.
- Validate SQL before execution: allow read-oriented statements such as `SELECT`, `WITH`, and `EXPLAIN`; block write and schema-changing statements.
- Show warnings for query scale risks without blocking read-only execution.
- Execute read-only SQL and return execution state, errors, or result metadata.
- Persist Execution Result Metadata.
- Do not automatically execute AI-generated SQL.
- Do not implement Data Modification Mode or Full Access Mode.

### Acceptance Criteria

- [ ] AI-generated SQL only executes after user click.
- [ ] `SELECT`, `WITH`, and `EXPLAIN` can execute.
- [ ] `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, and `CREATE` are blocked.
- [ ] Missing `LIMIT` shows a warning but does not inject `LIMIT`.
- [ ] Successful and failed executions both persist Execution Result Metadata.
- [ ] Execution model leaves extension points for future safety modes.

### Testing Suggestions

- SQL validator tests for allowed, blocked, and warning-only cases.
- Manual Execution Gate tests.
- Execution state tests for running, success, and error.
- Execution Result Metadata persistence tests.

### Dependencies

- Issue 2
- Issue 4
- Issue 6

## Issue 9: Display a basic result table and support copying visible results

**Type**: AFK  
**Suggested label**: `ready-for-agent`  
**Blocked by**: Issue 8  
**User stories covered**: 15, 16, 19

### Background

V0.1 needs to display read-only query results, but it is not an advanced data grid and must not persist Result Set rows. Users should be able to copy SQL, cells, rows, or visible results.

### Scope

- Implement Basic Result Table: column headers, row numbers, horizontal scrolling.
- Display the Result Set returned by the current execution.
- Support copying cells, rows, visible results, and current SQL.
- Keep result rows only in current UI state, not Query Session history.
- Persist only Execution Result Metadata.
- Do not implement sorting, filtering, pinned columns, CSV Export, or result snapshots.

### Acceptance Criteria

- [ ] Successful execution shows column headers and row data.
- [ ] The table supports row numbers and horizontal scrolling.
- [ ] Users can copy cells, rows, visible results, and SQL.
- [ ] Query Session history does not persist Result Set rows.
- [ ] CSV export entry points are not shown.

### Testing Suggestions

- Result Table rendering tests for empty results, normal results, and wide results.
- Copy behavior tests.
- Regression tests proving Result Set rows are not persisted.
- Execution Result Metadata persistence tests.

### Dependencies

- Issue 8

## Issue 10: Repair current SQL with AI after execution errors

**Type**: AFK  
**Suggested label**: `ready-for-agent`  
**Blocked by**: Issue 1, Issue 4, Issue 8  
**User stories covered**: 10, 17, 18

### Background

SQL Repair is part of the V0.1 core loop. After execution failure, Glimpse can send SQL, error information, database dialect, and relevant schema to the model for repair, while excluding connection secrets and result rows.

### Scope

- Provide a "repair SQL" action when SQL execution fails.
- Build SQL Repair Context: current SQL, error message, database dialect, Candidate Table Set/relevant catalog.
- Stream the repair process.
- Write repaired SQL into the editor.
- Persist the repair interaction in AI Conversation History.
- Do not require users to manually copy error messages.

### Acceptance Criteria

- [ ] Users can trigger AI repair after SQL execution failure.
- [ ] Repair requests include SQL, error message, dialect, and relevant schema.
- [ ] Repair requests do not include database passwords, API keys, SSH keys, or result rows.
- [ ] Repaired SQL streams back and updates the SQL editor.
- [ ] Query Session persists the repair conversation.

### Testing Suggestions

- SQL Repair Context construction tests.
- Sensitive data exclusion tests.
- Streaming repair state tests.
- Editor update and Query Session append tests.

### Dependencies

- Issue 1
- Issue 4
- Issue 8

## Issue 11: Manage Query Session history and continuation workflow

**Type**: AFK  
**Suggested label**: `ready-for-agent`  
**Blocked by**: Issue 4, Issue 6, Issue 8, Issue 10  
**User stories covered**: 18, 19, 20

### Background

Users need to return to previous query tasks and continue working. Query Session history should show SQL drafts, AI conversation summaries, and execution metadata, but must not show or restore persisted result rows because result rows should not be persisted.

### Scope

- Provide a Query Session history list.
- Support opening a historical session and restoring SQL Draft, Candidate Table Set, AI Conversation History, and Execution Result Metadata.
- Show historical execution metadata such as success/failure, time, row count, and error message.
- Support deleting a single Query Session.
- Do not implement full-text search, tags, team sharing, cloud sync, or private session.

### Acceptance Criteria

- [ ] Users can view Query Session history.
- [ ] Opening a historical session restores SQL Draft and AI conversation.
- [ ] Historical execution metadata is visible.
- [ ] Historical sessions do not contain Result Set row data.
- [ ] Users can delete a single session.

### Testing Suggestions

- Query Session list and restore tests.
- Session deletion tests.
- Regression tests proving Result Set rows are not persisted.
- UI state tests for empty history, populated history, and refresh after deletion.

### Dependencies

- Issue 4
- Issue 6
- Issue 8
- Issue 10

## Issue 12: Add V0.1 privacy, safety, and scope regression tests

**Type**: AFK  
**Suggested label**: `ready-for-agent`  
**Blocked by**: Issue 1, Issue 2, Issue 3, Issue 8, Issue 10  
**User stories covered**: 3, 12, 13, 19

### Background

V0.1 trust boundaries rely on several hard rules: do not send secrets to the model, do not store plaintext secrets in SQLite, do not persist Result Set rows, do not auto-execute AI-generated SQL, and do not execute write or schema-changing SQL. These rules need concentrated regression coverage.

### Scope

- Add model context snapshot/structure tests ensuring secrets, sample data, and result rows do not enter AI requests.
- Add SQLite storage checks ensuring database passwords and AI API keys are not stored as plaintext.
- Add Result Set persistence regression tests.
- Add Manual Execution Gate regression tests.
- Add Read-only Mode hard-block regression tests.
- Add V0.1 out-of-scope UI checks: no SSH Tunnel, CSV Export, SQL Explanation, SQL autocomplete, Team Sharing, or Prompt Template Management entry points.

### Acceptance Criteria

- [ ] Tests prove AI requests do not include database passwords, AI API keys, SSH keys, sample data, or result rows.
- [ ] Tests prove SQLite does not store plaintext secrets.
- [ ] Tests prove Result Set rows do not enter Query Session history.
- [ ] Tests prove AI-generated SQL is not executed automatically.
- [ ] Tests prove write and schema-changing SQL is blocked.
- [ ] Tests prove V0.1 out-of-scope entry points are absent from the UI.

### Testing Suggestions

- Use unit tests for context builders, storage adapters, and SQL validators.
- Use UI/integration tests for key user paths and out-of-scope entry points.
- Assert prompt/context payload structure rather than relying on fragile string fragments.

### Dependencies

- Issue 1
- Issue 2
- Issue 3
- Issue 8
- Issue 10

## Review Notes

- Granularity: this draft uses 13 medium-sized vertical slices, suitable for later conversion into GitHub Issues.
- Dependencies: Issue 0 provides the app/UI foundation; Issues 1/2/3 establish AI and DB context; Issue 4 establishes Query Session; later issues close the SQL workflow loop.
- HITL/AFK: all issues are marked AFK because the PRD/CONTEXT/ADR provide enough boundary detail. Open Questions such as parser choice, timeout behavior, and catalog compression should be resolved in a later `my-implementation-planner` pass rather than blocking this issue draft.
