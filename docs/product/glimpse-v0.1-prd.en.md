# Glimpse V0.1 PRD

## Problem Statement

Technical users often know what data they want to inspect, but their flow is interrupted by the mechanics of SQL work: checking table schemas, confirming field meanings, inspecting indexes, writing complex queries, handling SQL dialect differences, fixing execution errors, and copying context back and forth between an AI chat tool and a database client.

General-purpose AI chat tools can help write SQL, but they do not have database context. Traditional database IDEs can execute SQL, but they do not use natural language and the current schema to help generate, modify, and repair SQL. Glimpse V0.1 solves this gap by giving technical users a local macOS tool that can complete the loop of "describe intent -> generate SQL -> modify SQL -> manually execute read-only SQL -> inspect results -> repair errors" using real database catalog context.

V0.1 is not trying to replace DataGrip, and it is not a ChatBI product, BI reporting system, or enterprise semantic layer. It focuses on a small, frequent developer SQL workflow and balances automation with control: AI reduces the path cost, while the developer keeps the critical control points.

## Solution

Glimpse V0.1 is a local macOS AI SQL client with a SQL editor-first layout. After the user configures a global AI provider and a MySQL/TiDB database connection, Glimpse reads catalog metadata for one default database/schema and may send that catalog to the user-configured OpenAI-compatible model for automatic table discovery, SQL generation, SQL iteration, and SQL repair.

The user can enter a natural-language query need directly. Glimpse discovers candidate tables and generates SQL. The Candidate Table Set must be visible and adjustable, but does not require a blocking confirmation step. AI-generated SQL is never executed automatically; the user must manually trigger execution. V0.1 only implements Read-only Mode: it allows read-oriented statements such as `SELECT`, `WITH`, and `EXPLAIN`, and blocks write or schema-changing statements.

Glimpse persists Query Sessions, SQL drafts, SQL history, AI conversation history, and execution metadata. Query results are displayed in the UI but result rows are not persisted. Non-secret configuration and work history are stored in SQLite; database passwords and AI API keys are stored in macOS Keychain. V0.1 is a local-only app with no Glimpse account, no cloud sync, and no remote history service.

## User Stories

1. As a backend developer, I want to configure and save a MySQL/TiDB connection so that I can quickly reopen the same development or testing database later.
2. As a technical user, I want to configure one global OpenAI-compatible AI provider so that different database connections can share the same model configuration.
3. As a technical user, I want database passwords and AI API keys to avoid plaintext storage in SQLite so that the local tool does not expand the risk of secret leakage.
4. As a technical user, I want Glimpse to automatically read tables, fields, comments, and indexes from the current default database/schema after connecting so that I do not need to manually copy DDL for AI SQL generation.
5. As a technical user, I want the catalog to be read when opening or connecting and refreshable manually so that I control when schema context is updated.
6. As a technical user, I want Glimpse to discover candidate tables after I enter a natural-language query need so that I do not have to manually locate all relevant tables in an object tree first.
7. As a technical user, I want candidate tables to be visible and adjustable so that I can correct the context if AI chooses the wrong tables.
8. As a technical user, I want to generate SQL from natural language so that I can quickly create common queries involving filters, aggregation, sorting, time ranges, simple joins, and top N logic.
9. As a technical user, I want to modify the current SQL using natural language so that one-off generation becomes an iterative SQL workflow.
10. As a technical user, I want AI SQL generation, modification, and repair to stream partial output so that the waiting experience has immediate feedback.
11. As a technical user, I want AI request failures to show clear errors and let me retry manually so that the tool does not automatically repeat requests or switch models unpredictably.
12. As a technical user, I want AI-generated SQL to require my manual execution action so that I can review and confirm it before it runs.
13. As a technical user, I want V0.1 to execute only read-only SQL and block write or schema-changing statements so that accidental destructive operations are less likely.
14. As a technical user, I want missing `LIMIT` clauses or potentially large result sets to produce warnings rather than forced SQL rewrites so that I retain developer control.
15. As a technical user, I want to see a basic result table after executing read-only SQL so that I can inspect query results.
16. As a technical user, I want to copy SQL, cells, rows, or visible results so that I can move results into other tools or discussions.
17. As a technical user, I want AI to repair failed SQL using the SQL text, error message, and schema context so that I do not need to copy context between a database client and an AI tool.
18. As a technical user, I want Query Sessions to save SQL drafts, AI conversation history, and execution metadata so that I can continue the same query task later.
19. As a technical user, I want result rows to avoid default persistence so that local history does not store real business data.
20. As a technical user, I want the main interface to center on the SQL editor and result table so that Glimpse feels like a developer SQL tool rather than a chat app.
21. As a technical user, I want Light, Dark, and System theme options so that Glimpse fits into my daily development environment.
22. As a technical user, I want the app to open directly into the main interface with empty states for AI and database setup so that first-run onboarding does not block exploration.

## Implementation Decisions

- Product shape: V0.1 is a local macOS app with no Glimpse account, cloud sync, remote history service, or team workspace.
- Technology stack: Tauri 2, Rust, React, TypeScript, shadcn/ui, Tailwind CSS, CodeMirror 6, SQLite, and macOS Keychain.
- Database support: V0.1 supports direct MySQL/TiDB connections only. It does not support SSH Tunnel, advanced SSL configuration, bastion-host workflows, StarRocks, PostgreSQL, or ClickHouse.
- Connection model: multiple saved Database Connections are supported. Each Query Session binds to exactly one Database Connection and one Default Database/Schema.
- Catalog scope: Glimpse reads only the single Default Database/Schema configured for the connection. It does not automatically read every database visible to the account.
- Catalog refresh: read and cache the catalog when connecting or opening a connection; provide manual refresh; do not poll in the background or force refresh before every SQL generation.
- Metadata content: read database/schema, table, column name, column type, nullability, default value, column comment, primary key, unique index, normal index, index column order, create table DDL, and related context.
- AI configuration: V0.1 uses one Global AI Configuration with `base_url`, `api_key`, `model`, `temperature`, and `max_tokens`; per-connection AI overrides are not supported.
- Model context: Glimpse may send Database Catalog Context, Selected Table Context, SQL text, database dialect, and database error messages. It must not send database connection configuration, passwords, API keys, SSH keys, sample data, or result rows.
- Auto Table Discovery: V0.1 supports Auto Table Discovery and may send the full Default Database/Schema catalog to the model. The Candidate Table Set must be visible and adjustable, but does not require confirmation before SQL generation.
- SQL generation and iteration: support natural-language SQL generation and SQL Iteration based on the current SQL; do not require regenerating from scratch each time.
- AI response behavior: SQL generation, SQL Iteration, and SQL repair use Streaming AI Response; database query results do not stream.
- AI errors: AI Request Failure shows errors clearly and supports manual retry; V0.1 does not automatically retry or fall back to another model.
- Execution mode: V0.1 only implements Read-only Mode, but execution should be modeled as an Execution Safety Mode concept so future Data Modification Mode and Full Access Mode can be added.
- Execution trigger: AI-generated SQL must pass through the Manual Execution Gate; users manually trigger execution; automatic execution is not allowed.
- SQL validation: Read-only Mode allows read-oriented statements such as `SELECT`, `WITH`, and `EXPLAIN`; it blocks write or schema-changing statements such as `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, and `CREATE`.
- Query scale control: missing `LIMIT`, potentially long-running queries, or large result sets produce warnings only. V0.1 does not automatically inject `LIMIT` or silently rewrite user SQL.
- SQL repair: Glimpse may send SQL, error information, database dialect, and relevant schema to the model for repair; connection secrets and result rows remain excluded.
- Local storage: SQLite stores non-secret configuration and work history, including connection name, host, port, Default Database/Schema, Query Session, SQL Draft, AI Conversation History, Execution Result Metadata, and user preferences.
- Secret storage: macOS Keychain stores database passwords, AI API keys, and future SSH keys. SQLite must not store plaintext secrets.
- Query Session: first-class unit of SQL work containing the query need, bound connection, Default Database/Schema, Candidate Table Set, SQL Draft, generated SQL, AI Conversation History, execution attempts, Execution Result Metadata, and errors.
- Result persistence: Result Sets are displayed in the UI but are not persisted. History stores only executed SQL, timestamp, duration, row count, success/failure state, error messages, and similar metadata.
- Result table: V0.1 provides a Basic Result Table with column headers, row numbers, horizontal scrolling, and copying cells, rows, or visible results. It does not implement advanced data-grid behavior.
- Editor: CodeMirror 6 provides the Basic SQL Editor, including SQL syntax highlighting and basic editing ergonomics. Manual SQL Formatting is supported. SQL-aware autocomplete is not supported.
- UI information architecture: use a SQL Editor-first Layout. The SQL editor and query results are the primary workspace; the AI Assistant Panel handles natural-language requests, auto table discovery, SQL generation, SQL iteration, and repair.
- Onboarding: no separate first-run wizard. Open directly into the main interface and use Empty State Setup to guide global AI configuration and first database connection creation.
- Theme: support Light, Dark, and System Theme Preference.

## Testing Decisions

- Tests should verify externally observable behavior and avoid binding to internal implementation details.
- SQL safety validation must be tested: allow read-oriented statements, block write and schema-changing statements, and keep query scale risks as warnings.
- Manual Execution Gate must be tested: AI-generated SQL is not executed automatically and only runs after explicit user action.
- Execution Safety Mode modeling must be tested: V0.1 defaults to and exposes only Read-only Mode, while the structure allows future Data Modification Mode and Full Access Mode.
- Database Connection behavior must be tested: multiple connection configurations are supported, and each Query Session binds to one connection and one Default Database/Schema.
- Catalog Refresh must be tested: catalog is read on open/connect, manual refresh can update it, and generation does not implicitly refresh every time.
- Auto Table Discovery must be tested: candidate tables come from the Default Database/Schema catalog, the Candidate Table Set is visible and adjustable, and no blocking confirmation is required.
- Model context construction must be tested: catalog, SQL, and error messages may be included; passwords, API keys, SSH keys, result rows, and sample data must not be included.
- SQL Repair Context must be tested: execution errors can enter repair requests while preserving sensitive-information boundaries.
- Local storage must be tested: SQLite stores non-secret data, Keychain stores secrets, and SQLite records do not contain plaintext database passwords or AI API keys.
- Query Session persistence must be tested: SQL drafts, AI conversations, and execution metadata can be restored; Result Set rows must not be persisted.
- Basic Result Table behavior must be tested: show column headers, row numbers, horizontal scrolling, and copy visible results.
- AI Request Failure must be tested: failure state is clear, manual retry is available, and automatic retry/fallback does not occur.
- Theme Preference can be covered by UI state tests: Light, Dark, and System preferences can be saved and restored.
- Database access, Keychain, and AI provider boundaries can be mocked. SQL validation, Query Session state, and prompt/context construction should use real code paths where practical.
- The repo currently has no app code or test framework. Specific tools and test layers should be decided during technical design based on the Tauri/Rust/React project structure.

## Out of Scope

- DataGrip replacement.
- Full database IDE.
- ChatBI or natural-language analytics platform for non-technical business users.
- BI reporting system.
- Enterprise metrics platform.
- Complex business semantic layer or Business Glossary.
- ER diagram modeling.
- Table design and database migration.
- Data editing.
- Data Modification Mode.
- Full Access Mode.
- Executing write or schema-changing SQL.
- Automatic execution of AI-generated SQL.
- SSH Tunnel, advanced SSL configuration, or bastion-host connections.
- Cross-connection queries.
- Multi-database or multi-schema catalog scope.
- StarRocks, PostgreSQL, or ClickHouse support.
- SQL Explanation.
- SQL-aware autocomplete.
- CSV Export.
- Persisting Result Set rows.
- Prompt Template Management.
- Team Sharing.
- Glimpse account.
- Cloud sync.
- Remote history service.
- Automatic model retry or fallback.
- User-managed prompt templates.

## Open Questions

- Should read-only SQL validation use a Rust SQL parser, a sqlglot binding, or a conservative parser/rule combination? This should be decided during technical design.
- How should MySQL/TiDB edge cases such as `WITH`, `EXPLAIN`, multiple statements, comments, and stored procedure calls be classified by the SQL validator?
- Does V0.1 need explicit query timeout and cancellation behavior? Query scale limits are warning-only, but execution state and long-running-query UX still need technical design.
- What are the rendering, memory, and copy limits for large Result Sets in the Basic Result Table?
- What are the retention policy, cleanup entry points, and maximum storage size for Query Sessions?
- Should AI Conversation History support clear-all, delete-by-session, or private-session behavior?
- How should Database Catalog Context be compressed for prompts, and what should happen when schema size exceeds token limits?
- After users adjust the Candidate Table Set, should Glimpse regenerate SQL automatically or wait for a manual regenerate action?
- How should AI provider connection testing, model list retrieval, and streaming protocol compatibility work?
- What minimum permissions are required for MySQL/TiDB metadata reading, and what should permission-failure messages and recovery guidance say?
- Are packaging, signing, notarization, and auto-update included in the V0.1 delivery scope?

## Further Notes

- The core V0.1 product principle is "programmer control, AI assistance": AI can discover candidate tables, generate SQL, modify SQL, and repair SQL, but execution must remain visible, reviewable, and user-triggered.
- V0.1 differs from the original PDF in several confirmed ways: Auto Table Discovery is included, built-in Read-only SQL Execution is included, V0.1 SQL Explanation is removed, and SQL Iteration and SQL Repair remain in scope.
- Some early ADRs reflect intermediate decision states. The final PRD follows the latest boundaries in `CONTEXT.md` and `docs/product/v0.1-boundaries.zh.md`.
- Future capabilities include Data Modification Mode, Full Access Mode, SSH Tunnel/SSL/bastion-host connection enhancements, SQL Explanation, SQL-aware autocomplete, CSV Export, Prompt Template Management, Team Sharing, Business Glossary, and multi-database/schema catalog support.

## Suggested Epic / Feature Breakdown

- App shell and foundation: Tauri 2, React, TypeScript, shadcn/ui, Tailwind, theme preference.
- Local storage and secrets: SQLite schema, Keychain integration, configuration/history persistence.
- Global AI configuration: OpenAI-compatible provider settings, streaming requests, failure display, manual retry.
- Database connection management: direct MySQL/TiDB connection, multiple saved connections, Default Database/Schema, connection testing.
- Catalog reading and refresh: metadata reader, catalog cache, manual refresh, permission failure handling.
- Query Session: session data model, SQL Draft, AI Conversation History, Execution Result Metadata.
- Auto Table Discovery: catalog prompt construction, Candidate Table Set display and adjustment.
- SQL generation and SQL Iteration: natural-language generation, current-SQL modification, streaming UI.
- SQL safety validation and Execution Safety Mode: Read-only Mode, hard blocks, warning-only scale risks, future mode extension points.
- Manual execution and result display: Manual Execution Gate, execution state, Basic Result Table, result copying.
- SQL Repair: error capture, SQL Repair Context, streaming repair response.
- SQL editor: CodeMirror 6, syntax highlighting, basic editing, manual formatting.
- Empty State Setup and main interface: SQL editor-first layout, AI Assistant Panel, empty-state configuration guidance.
