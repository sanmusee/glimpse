# Glimpse

Glimpse is a macOS AI SQL client for technical users who know what data they want to query and want AI help generating, modifying, explaining, and repairing SQL with database context.

## Language

**Glimpse**:
A lightweight developer tool for AI-assisted SQL work. It is not a full database IDE, a BI reporting system, or a ChatBI product for non-technical users.
_Avoid_: DataGrip replacement, BI platform, ChatBI

**Technical User**:
The first-stage user of Glimpse: backend developers, data developers, test developers, algorithm engineers, strategy engineers, or other users who understand basic SQL and database concepts.
_Avoid_: Business user, non-technical analyst

**Database Context**:
The metadata Glimpse uses to help AI produce SQL, including database type, database/schema name, selected table names, column names, column types, nullability, default values, column comments, primary keys, unique indexes, normal indexes, index column order, and create-table DDL.
_Avoid_: Database credentials, connection secrets, sample data, query results

**Database Catalog Context**:
The metadata catalog Glimpse reads from the single default database/schema specified in a connection configuration, including database/schema name, table names, column definitions, comments, primary keys, and indexes. In V0.1, Glimpse may send Database Catalog Context to the configured model provider for Auto Table Discovery.
_Avoid_: Database credentials, connection secrets, sample data, query results

**Catalog Refresh**:
The V0.1 behavior for loading Database Catalog Context: read the catalog when opening or connecting to a Database Connection, cache it for the session, and refresh only when the user explicitly triggers refresh.
_Avoid_: Background polling, refresh before every generation

**Default Database/Schema**:
The single database or schema selected in a connection configuration as the V0.1 catalog scope. Glimpse reads metadata for this scope instead of every database/schema visible to the configured account.
_Avoid_: All visible databases, implicit cross-schema catalog

**Selected Table Context**:
The subset of Database Context for tables explicitly selected by the user or chosen as candidates by Auto Table Discovery for the current SQL task.
_Avoid_: Hidden table choice, unreviewable model assumption

**Auto Table Discovery**:
The V0.1 capability where a user can describe a query need without manually selecting tables, and Glimpse identifies likely relevant tables from the connected database catalog.
_Avoid_: Manual table selection only

**Candidate Table Set**:
The table set Glimpse believes is relevant after Auto Table Discovery. This set becomes the working context for SQL generation, must be visible and adjustable by the user, but does not require a blocking confirmation step before SQL generation.
_Avoid_: Hidden table choice, unreviewable model assumption

**Metadata Connection**:
A real database connection used by Glimpse to read database, schema, table, column, and index metadata. In V0.1, Glimpse must support Metadata Connection for MySQL/TiDB even though it does not execute user queries; it does not require users to provide a special read-only metadata account upfront.
_Avoid_: Manual DDL paste as the primary workflow

**Database Connection**:
A saved database connection configuration. V0.1 supports multiple saved Database Connections, but each Query Session binds to exactly one Database Connection and one Default Database/Schema.
_Avoid_: Cross-connection query, cross-connection session

**Direct Database Connection**:
The V0.1 connection type for connecting directly to MySQL/TiDB using host, port, username, password, and Default Database/Schema.
_Avoid_: SSH tunnel, advanced SSL setup, bastion-host workflow in V0.1

**Connection Enhancement**:
A future capability for connection types and security options beyond Direct Database Connection, such as SSH Tunnel, advanced SSL configuration, or bastion-host workflows.
_Avoid_: Required V0.1 setup path

**Metadata Permission Failure**:
The state where Glimpse can connect to a database but cannot read some required metadata because the configured account lacks permission. In V0.1, this should be surfaced as a clear user-facing error rather than treated as an invalid connection model.
_Avoid_: Mandatory read-only account requirement

**Sensitive Connection Information**:
Database connection configuration or secrets that must not be sent to the model, including host, port, username, password, API key, SSH key, and other credentials.
_Avoid_: Model context

**Local SQLite Store**:
The V0.1 local persistence layer for non-secret configuration and work history, including connection names, host, port, Default Database/Schema, Query Sessions, SQL drafts, AI Conversation History, Execution Result Metadata, and user preferences.
_Avoid_: Database passwords, AI API keys, SSH keys

**macOS Keychain Secret Store**:
The V0.1 local secret store for credentials and secret material, including database passwords, AI API keys, and future SSH keys.
_Avoid_: Plaintext secrets in SQLite

**Local-only App**:
The V0.1 product boundary where Glimpse has no Glimpse account system, no Glimpse-hosted cloud sync, and no remote history service. Database access, AI provider calls, local settings, and local history remain controlled by the user's machine and configured providers.
_Avoid_: Glimpse cloud account, hosted sync, remote query history

**SQL Editor-first Layout**:
The V0.1 primary UI structure where the SQL editor and query results are the main workspace, while AI assistance, table discovery, repair, and conversation live as supporting panels.
_Avoid_: Chat-first layout, BI dashboard-first layout

**Workbench Layout**:
The confirmed V0.1 baseline layout derived from UI prototype Variant A: session history and catalog context on the left, SQL editor and results in the center, and AI Assistant Panel, Candidate Table Set, and table details on the right. V0.1 uses fixed default side-panel widths with collapsible left and right panels; it does not support draggable panel resizing.
_Avoid_: Command-first top-band layout as the V0.1 baseline, timeline-first session layout as the V0.1 baseline, draggable panel resizing in V0.1

**Empty State Setup**:
The V0.1 onboarding style where the app opens directly into the main SQL Editor-first Layout and uses empty states to guide users to configure Global AI Configuration and their first Database Connection.
_Avoid_: Separate first-run wizard, marketing-style onboarding

**Theme Preference**:
The V0.1 user preference for Light, Dark, or System theme behavior.
_Avoid_: Single-theme-only app

**AI Assistant Panel**:
The supporting UI area for natural-language requests, SQL generation, SQL Iteration, Auto Table Discovery, and repair interactions.
_Avoid_: Replacing the SQL editor as the primary workspace

**Streaming AI Response**:
The V0.1 behavior where AI SQL generation, SQL Iteration, and SQL repair stream partial text back into the UI. Database query Result Sets do not stream in V0.1.
_Avoid_: Streaming database results in V0.1

**AI Request Failure**:
The state where the configured model provider returns an error, times out, or cannot complete a request. In V0.1, Glimpse shows the error clearly and lets the user manually retry; it does not automatically retry or fall back to another model.
_Avoid_: Automatic retry, model fallback in V0.1

**Prompt Template Management**:
A future capability for user-created or user-editable reusable prompts. It is not part of V0.1.
_Avoid_: User-managed prompt templates in V0.1

**Team Sharing**:
A future capability for sharing connection configuration, query templates, prompt templates, or team conventions. It is not part of V0.1.
_Avoid_: Team workspace, shared cloud configuration, collaborative query library in V0.1

**Business Glossary**:
A future capability for mapping business terms to tables, fields, metrics, or domain explanations. It is not part of V0.1.
_Avoid_: Semantic layer, metric platform, glossary management in V0.1

**V0.1 Technology Stack**:
The confirmed implementation stack for V0.1: Tauri 2 for the desktop app shell, Rust for local backend capabilities, React and TypeScript for the frontend, shadcn/ui and Tailwind CSS for UI, CodeMirror 6 for SQL editing, SQLite for local non-secret storage, and macOS Keychain for secrets.
_Avoid_: Electron, SwiftUI-first implementation, custom SQL editor

**OpenAI-compatible Model Provider**:
The globally configured AI model endpoint used by Glimpse through `base_url`, `api_key`, `model`, `temperature`, and `max_tokens`. It may point to OpenAI, DeepSeek, Qwen, an internal model service, Ollama, LM Studio, or another OpenAI-compatible service.
_Avoid_: Hard-coded OpenAI-only provider

**Global AI Configuration**:
The single V0.1 AI configuration shared across all database connections. Database connections do not override model provider settings in V0.1.
_Avoid_: Per-connection AI configuration

**Query History**:
Persisted local history of generated, edited, and executed SQL, including relevant execution errors and result metadata where useful.
_Avoid_: Ephemeral-only SQL work

**SQL Draft**:
A persisted local unfinished SQL workspace that a user can return to later.
_Avoid_: Unsaved editor-only state

**AI Conversation History**:
Persisted local history of AI interactions for SQL generation, modification, explanation, repair, and table discovery. In V0.1, Glimpse should save this history locally alongside SQL history and drafts.
_Avoid_: Current-session-only AI context

**Query Session**:
A persisted unit of SQL work that starts from a user query need and contains the bound database connection, Default Database/Schema, Candidate Table Set, SQL drafts, generated SQL, explanations, AI Conversation History, execution attempts, Execution Result Metadata, and errors.
_Avoid_: Unstructured global chat history, unrelated SQL snippets in one timeline

**Execution Result Metadata**:
Persisted metadata about a SQL execution attempt, such as executed SQL, timestamp, duration, row count, success/failure state, and error message.
_Avoid_: Full result set persistence

**Result Set**:
The actual rows and values returned by executing SQL. In V0.1, Result Sets are displayed in the UI but are not persisted as part of Query Session history.
_Avoid_: Saved business data by default

**Result Copying**:
The V0.1 ability to copy visible query results and SQL from the UI without persisting result rows or exporting files.
_Avoid_: CSV export in V0.1, saved result snapshots

**Basic Result Table**:
The V0.1 result display for read-only SQL execution, including column headers, row numbers, horizontal scrolling, and copying cells, rows, or visible results.
_Avoid_: Advanced sorting, filtering, pinned columns, full data-grid behavior in V0.1

**CSV Export**:
A future capability for exporting Result Sets to CSV files. It is not part of the V0.1 scope.
_Avoid_: Required V0.1 result workflow


**SQL Repair Context**:
The model context used to repair a failed SQL attempt, including the SQL text, database error message, database dialect, and relevant Database Catalog Context or Selected Table Context.
_Avoid_: Sensitive Connection Information, Result Set rows, credentials

**SQL Assistance Loop**:
The core Glimpse workflow: discover or select tables, read context, describe a query need, generate SQL, execute allowed read-only SQL, then iterate or repair SQL based on user intent or execution errors.
_Avoid_: Autonomous database agent, black-box query execution

**SQL Iteration**:
The V0.1 capability where a user asks Glimpse to modify the current SQL using natural language, such as adding a condition, changing grouping, changing sort order, switching time fields, or adding a derived metric.
_Avoid_: Regenerate from scratch every time

**Manual SQL Formatting**:
The V0.1 editor action where the user explicitly triggers SQL formatting. Glimpse should not automatically reformat generated or edited SQL without user action.
_Avoid_: Automatic formatting, silent SQL rewriting

**Basic SQL Editor**:
The V0.1 CodeMirror-based SQL editor capability, including SQL syntax highlighting and normal editing ergonomics, but excluding table-name, column-name, or SQL-aware autocomplete.
_Avoid_: SQL autocomplete in V0.1

**V0.1 Minimum Loop**:
The first usable version of Glimpse: configure a MySQL/TiDB Metadata Connection, read metadata automatically, use Auto Table Discovery or user-reviewed table selection, generate SQL, modify current SQL through SQL Iteration, execute allowed read-only SQL, display results, repair SQL, and support copying SQL.
_Avoid_: Paste-only prototype, write SQL execution, manual table selection as the only path, SQL explanation as a required V0.1 capability

**SQL Explanation**:
A future capability where Glimpse explains generated or edited SQL in terms of tables, fields, filters, aggregation, ordering, and intent fit. It is not part of the V0.1 minimum loop.
_Avoid_: Required V0.1 explanation panel

**Read-only SQL Execution**:
The V0.1 execution capability that allows Glimpse to run only read-oriented statements such as `SELECT`, `WITH`, and `EXPLAIN`, then show query results or errors to the user.
_Avoid_: INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, hidden execution

**Manual Execution Gate**:
The rule that AI-generated SQL must be shown to the user before execution, and Glimpse only executes after an explicit user action.
_Avoid_: Auto-execute generated SQL, hidden execution

**Developer Freedom Execution Mode**:
The V0.1 execution policy for query scale controls: Glimpse blocks write or schema-changing SQL, but only warns about missing `LIMIT`, long-running queries, or large result sets instead of automatically rewriting SQL or forcing limits.
_Avoid_: Automatic LIMIT injection, silent SQL rewriting, write SQL passthrough

**Execution Safety Mode**:
A user-selected mode that controls which SQL operations Glimpse may execute. V0.1 implements Read-only Mode only, while Data Modification Mode and Full Access Mode are planned future modes that the execution design should be able to support.
_Avoid_: One-size-fits-all execution policy

**Read-only Mode**:
An Execution Safety Mode that allows read-oriented SQL such as `SELECT`, `WITH`, and `EXPLAIN`, while blocking write and schema-changing statements.
_Avoid_: Write SQL execution

**Data Modification Mode**:
An Execution Safety Mode intended to allow data-changing statements while still restricting broader schema or administrative operations. The exact allowed statement set is not yet confirmed.
_Avoid_: Full database administration access

**Full Access Mode**:
An Execution Safety Mode intended to allow all SQL operations permitted by the configured database account. The exact confirmation and warning behavior is not yet confirmed.
_Avoid_: Silent destructive execution

## Flagged Ambiguities

**Safe model context**:
Glimpse may send Database Catalog Context, Selected Table Context, SQL text, and database error messages to the configured model provider, but must not send Sensitive Connection Information, sample data, or query results by default.

**Auto Table Discovery model boundary**:
V0.1 Auto Table Discovery may send the Database Catalog Context for the connection's Default Database/Schema to the configured model provider. This expands model-visible context beyond manually selected tables, while still excluding credentials, connection configuration, sample data, query results, and unrelated databases/schemas.

**Execution Safety Mode scope**:
V0.1 implements Read-only Mode only. Data Modification Mode and Full Access Mode are future planned modes, so execution validation and UI concepts should avoid assuming that read-only is the only mode forever.

## Example Dialogue

Developer: Can Glimpse send table schema and index information to the model?
Domain Expert: Yes. In V0.1 it may send full database catalog metadata for Auto Table Discovery and selected/candidate table metadata for SQL generation. It should not send database connection configuration, passwords, API keys, SSH keys, sample data, or query results by default.

Developer: Can V0.1 skip database connections and ask users to paste DDL manually?
Domain Expert: No. V0.1 should connect to MySQL/TiDB and read metadata automatically. It can skip executing SQL, but metadata collection is part of the core value.

Developer: Does the user need to create a special metadata-only database account before using Glimpse?
Domain Expert: No. Glimpse should try with the configured account and explain any metadata permission failures clearly.

Developer: Does V0.1 require users to manually select relevant tables before asking for SQL?
Domain Expert: No. V0.1 should support Auto Table Discovery from the connected database catalog, while still making the Candidate Table Set reviewable.

Developer: Should Auto Table Discovery narrow tables locally before sending context to the model?
Domain Expert: No. V0.1 may send the full Database Catalog Context to the configured model provider and let the model help identify relevant tables.

Developer: Does "full catalog" mean every database visible to the account?
Domain Expert: No. In V0.1 it means the catalog for the single Default Database/Schema configured for that connection.

Developer: Does V0.1 only generate SQL for copying elsewhere?
Domain Expert: No. V0.1 should execute allowed read-only SQL inside Glimpse and show results, while blocking write or schema-changing statements.

Developer: Should Glimpse automatically add `LIMIT` or enforce result-size limits before executing read-only SQL?
Domain Expert: No. In V0.1, Glimpse should hard-block write and schema-changing SQL, but only warn about query scale risks such as missing `LIMIT`, long-running queries, or large result sets.

Developer: Should AI-generated SQL execute automatically after generation?
Domain Expert: No. Glimpse should show generated SQL and require the user to manually click execute.

Developer: Should V0.1 include data-changing and full-access execution modes?
Domain Expert: No. V0.1 should implement Read-only Mode only, while keeping Execution Safety Mode extensible for future Data Modification Mode and Full Access Mode.

Developer: Does each database connection choose its own AI model provider?
Domain Expert: No. V0.1 uses one Global AI Configuration shared by all connections.

Developer: Should V0.1 persist AI conversation history or only SQL history?
Domain Expert: V0.1 should persist SQL history, SQL drafts, and AI Conversation History locally.

Developer: How should Glimpse organize persisted SQL and AI history?
Domain Expert: V0.1 should organize work by Query Session rather than one unstructured global history list.

Developer: Should query result rows be saved in history?
Domain Expert: No. V0.1 should persist Execution Result Metadata but not full Result Sets.

Developer: Can Glimpse send SQL execution errors to the model for repair?
Domain Expert: Yes. V0.1 may send SQL text, error messages, dialect, and relevant schema context to the model for SQL repair, while still excluding credentials and result rows.

Developer: Does V0.1 need to explain generated SQL?
Domain Expert: No. V0.1 can skip SQL Explanation and focus on generation, execution, and repair.

Developer: Can the user ask Glimpse to modify the current SQL instead of starting over?
Domain Expert: Yes. V0.1 should support SQL Iteration based on the current SQL and Query Session context.

Developer: Must the user confirm discovered tables before SQL generation?
Domain Expert: No. The Candidate Table Set should be visible and adjustable, but not a required blocking confirmation step.

Developer: Can V0.1 store multiple database connections?
Domain Expert: Yes. V0.1 supports multiple saved Database Connections, while each Query Session uses one connection and one Default Database/Schema.

Developer: Does V0.1 need SSH Tunnel or advanced SSL configuration?
Domain Expert: No. V0.1 supports Direct Database Connection for MySQL/TiDB. SSH Tunnel, advanced SSL, and bastion-host workflows are future Connection Enhancements.

Developer: Where should V0.1 store local data and secrets?
Domain Expert: V0.1 uses SQLite for non-secret configuration and work history, and macOS Keychain for database passwords, AI API keys, and future SSH keys.

Developer: Does V0.1 need a Glimpse account or cloud sync?
Domain Expert: No. V0.1 is a Local-only App with no Glimpse account system, no Glimpse-hosted cloud sync, and no remote history service.

Developer: Should the V0.1 interface be chat-first?
Domain Expert: No. V0.1 should use a SQL Editor-first Layout, with AI assistance in supporting panels.

Developer: Which UI prototype variant should V0.1 use as its baseline?
Domain Expert: V0.1 should use the Workbench Layout from prototype Variant A: left session/catalog context, center SQL editor/results, and right AI/candidate/context panels.

Developer: Should V0.1 support dragging to resize Workbench side panels?
Domain Expert: No. V0.1 should use fixed default side-panel widths with collapsible left and right panels, not draggable resizing.

Developer: What technology stack should V0.1 use?
Domain Expert: V0.1 should use Tauri 2, Rust, React, TypeScript, shadcn/ui, Tailwind CSS, CodeMirror 6, SQLite, and macOS Keychain.

Developer: How should V0.1 refresh database catalog metadata?
Domain Expert: Read catalog metadata when opening or connecting to a Database Connection, cache it, and provide manual refresh. Do not poll in the background or refresh before every generation.

Developer: Should V0.1 export query results to CSV?
Domain Expert: No. V0.1 should support copying SQL and visible results, while CSV Export is a future capability.

Developer: How advanced should the V0.1 result grid be?
Domain Expert: V0.1 should provide a Basic Result Table with headers, row numbers, horizontal scrolling, and copy interactions, but not advanced data-grid features.

Developer: Should Glimpse automatically format generated SQL?
Domain Expert: No. V0.1 should provide Manual SQL Formatting as an explicit editor action.

Developer: Does V0.1 need table or column autocomplete in the SQL editor?
Domain Expert: No. V0.1 should provide a Basic SQL Editor with syntax highlighting and editing ergonomics, while SQL-aware autocomplete is future scope.

Developer: Should AI generation wait for a full response before updating the UI?
Domain Expert: No. V0.1 should use Streaming AI Response for SQL generation, SQL Iteration, and repair, while database query results return normally.

Developer: Should Glimpse automatically retry failed AI requests?
Domain Expert: No. V0.1 should show AI Request Failure clearly and let the user manually retry.

Developer: Does V0.1 need user-managed prompt templates?
Domain Expert: No. V0.1 can use internal prompts, but Prompt Template Management is future scope.

Developer: Should V0.1 have a separate first-run setup wizard?
Domain Expert: No. V0.1 should open into the main SQL Editor-first Layout and use Empty State Setup to guide AI and database configuration.

Developer: Which themes should V0.1 support?
Domain Expert: V0.1 should support Light, Dark, and System Theme Preference.

Developer: Does V0.1 need team sharing?
Domain Expert: No. Team Sharing is future scope and should not be part of the local-only V0.1.

Developer: Does V0.1 need a business glossary or semantic layer?
Domain Expert: No. V0.1 should rely on database catalog metadata, comments, and user input. Business Glossary is future scope.
