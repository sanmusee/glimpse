use mysql::prelude::Queryable;
use rusqlite::{params, Connection, OptionalExtension};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, fs, path::PathBuf};
use tauri::Manager;

const THEME_PREFERENCE_KEY: &str = "theme_preference";
const CURRENT_QUERY_SESSION_KEY: &str = "current_query_session_id";
const DEFAULT_THEME_PREFERENCE: &str = "system";
const KEYCHAIN_SERVICE: &str = "Glimpse";

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct DatabaseConnectionRecord {
    id: String,
    name: String,
    host: String,
    port: u16,
    username: String,
    password_secret_id: String,
    default_database: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DatabaseConnectionTestInput {
    host: String,
    port: u16,
    username: String,
    password_secret_id: Option<String>,
    password: Option<String>,
    default_database: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DatabaseConnectionTestResult {
    ok: bool,
    message: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct DatabaseCatalogColumn {
    name: String,
    data_type: String,
    nullable: bool,
    default_value: Option<String>,
    comment: String,
    is_primary_key: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct DatabaseCatalogIndex {
    name: String,
    kind: String,
    columns: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct DatabaseCatalogTable {
    name: String,
    comment: String,
    columns: Vec<DatabaseCatalogColumn>,
    indexes: Vec<DatabaseCatalogIndex>,
    create_table_ddl: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct DatabaseCatalogSnapshot {
    connection_id: String,
    database: String,
    refreshed_at: String,
    tables: Vec<DatabaseCatalogTable>,
}

#[derive(Clone, Debug)]
struct IndexAccumulator {
    kind: String,
    columns: Vec<(u32, String)>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct GlobalAiConfiguration {
    base_url: String,
    model: String,
    temperature: f64,
    max_tokens: i64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct QuerySessionCreateInput {
    database_connection_id: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AiConversationEntry {
    id: String,
    role: String,
    content: String,
    created_at: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExecutionResultMetadata {
    id: String,
    sql: String,
    row_count: i64,
    columns: Vec<String>,
    executed_at: String,
    error_message: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct QuerySessionRecord {
    id: String,
    database_connection_id: String,
    connection_name: String,
    default_database: String,
    sql_draft: String,
    ai_conversation_history: Vec<AiConversationEntry>,
    execution_result_metadata: Vec<ExecutionResultMetadata>,
    created_at: String,
    updated_at: String,
}

fn is_theme_preference(value: &str) -> bool {
    matches!(value, "system" | "light" | "dark")
}

fn local_store_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("failed to resolve app data directory: {error}"))?;

    fs::create_dir_all(&app_data_dir)
        .map_err(|error| format!("failed to create app data directory: {error}"))?;

    Ok(app_data_dir.join("glimpse.sqlite3"))
}

fn open_local_store(app: &tauri::AppHandle) -> Result<Connection, String> {
    let connection = Connection::open(local_store_path(app)?)
        .map_err(|error| format!("failed to open local SQLite store: {error}"))?;

    connection
        .execute(
            "CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )
        .map_err(|error| format!("failed to prepare app settings table: {error}"))?;

    connection
        .execute(
            "CREATE TABLE IF NOT EXISTS global_ai_configuration (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                base_url TEXT NOT NULL,
                model TEXT NOT NULL,
                temperature REAL NOT NULL,
                max_tokens INTEGER NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )
        .map_err(|error| format!("failed to prepare global AI configuration table: {error}"))?;

    connection
        .execute(
            "CREATE TABLE IF NOT EXISTS database_connections (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                host TEXT NOT NULL,
                port INTEGER NOT NULL,
                username TEXT NOT NULL,
                password_secret_id TEXT NOT NULL,
                default_database TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )
        .map_err(|error| format!("failed to prepare database connections table: {error}"))?;

    connection
        .execute(
            "CREATE TABLE IF NOT EXISTS database_catalog_cache (
                connection_id TEXT PRIMARY KEY,
                catalog_json TEXT NOT NULL,
                refreshed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(connection_id) REFERENCES database_connections(id) ON DELETE CASCADE
            )",
            [],
        )
        .map_err(|error| format!("failed to prepare database catalog cache table: {error}"))?;

    connection
        .execute(
            "CREATE TABLE IF NOT EXISTS query_sessions (
                id TEXT PRIMARY KEY,
                database_connection_id TEXT NOT NULL,
                default_database TEXT NOT NULL,
                sql_draft TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                last_opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )
        .map_err(|error| format!("failed to prepare query sessions table: {error}"))?;

    connection
        .execute(
            "CREATE TABLE IF NOT EXISTS query_session_ai_conversation_history (
                session_id TEXT PRIMARY KEY,
                entries_json TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )
        .map_err(|error| {
            format!("failed to prepare query session AI conversation history table: {error}")
        })?;

    connection
        .execute(
            "CREATE TABLE IF NOT EXISTS query_session_execution_metadata (
                session_id TEXT PRIMARY KEY,
                metadata_json TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )
        .map_err(|error| {
            format!("failed to prepare query session execution metadata table: {error}")
        })?;

    Ok(connection)
}

fn validate_database_connection(connection: &DatabaseConnectionRecord) -> Result<(), String> {
    if connection.name.trim().is_empty() {
        return Err("connection name is required".to_string());
    }

    if connection.host.trim().is_empty() {
        return Err("host is required".to_string());
    }

    if connection.port == 0 {
        return Err("port is required".to_string());
    }

    if connection.username.trim().is_empty() {
        return Err("username is required".to_string());
    }

    if connection.password_secret_id.trim().is_empty() {
        return Err("password secret id is required".to_string());
    }

    if connection.default_database.trim().is_empty() {
        return Err("default database/schema is required".to_string());
    }

    Ok(())
}

fn keychain_entry(secret_id: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYCHAIN_SERVICE, secret_id)
        .map_err(|error| format!("failed to open Keychain entry: {error}"))
}

fn read_database_connection_record(
    local_store: &Connection,
    id: &str,
) -> Result<DatabaseConnectionRecord, String> {
    local_store
        .query_row(
            "SELECT id, name, host, port, username, password_secret_id, default_database
             FROM database_connections
             WHERE id = ?1",
            [id],
            |row| {
                Ok(DatabaseConnectionRecord {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    host: row.get(2)?,
                    port: row.get(3)?,
                    username: row.get(4)?,
                    password_secret_id: row.get(5)?,
                    default_database: row.get(6)?,
                })
            },
        )
        .optional()
        .map_err(|error| format!("failed to read database connection: {error}"))?
        .ok_or_else(|| "database connection was not found".to_string())
}

fn current_catalog_timestamp(local_store: &Connection) -> Result<String, String> {
    local_store
        .query_row("SELECT strftime('%Y-%m-%dT%H:%M:%SZ', 'now')", [], |row| {
            row.get(0)
        })
        .map_err(|error| format!("failed to create catalog timestamp: {error}"))
}

fn save_catalog_cache(
    local_store: &Connection,
    catalog: &DatabaseCatalogSnapshot,
) -> Result<(), String> {
    let catalog_json = serde_json::to_string(catalog)
        .map_err(|error| format!("failed to serialize catalog cache: {error}"))?;

    local_store
        .execute(
            "INSERT INTO database_catalog_cache (connection_id, catalog_json, refreshed_at)
             VALUES (?1, ?2, CURRENT_TIMESTAMP)
             ON CONFLICT(connection_id) DO UPDATE SET
                catalog_json = excluded.catalog_json,
                refreshed_at = CURRENT_TIMESTAMP",
            params![catalog.connection_id, catalog_json],
        )
        .map_err(|error| format!("failed to save catalog cache: {error}"))?;

    Ok(())
}

fn quote_mysql_identifier(identifier: &str) -> String {
    format!("`{}`", identifier.replace('`', "``"))
}

fn metadata_failure(error: impl std::fmt::Display) -> String {
    format!("Metadata Permission Failure: failed to read database metadata: {error}")
}

fn read_remote_database_catalog(
    local_store: &Connection,
    connection: &DatabaseConnectionRecord,
) -> Result<DatabaseCatalogSnapshot, String> {
    let password = get_secret(connection.password_secret_id.clone())?
        .ok_or_else(|| "Saved password was not found in Keychain".to_string())?;
    let default_database = connection.default_database.clone();
    let builder = mysql::OptsBuilder::new()
        .ip_or_hostname(Some(connection.host.clone()))
        .tcp_port(connection.port)
        .user(Some(connection.username.clone()))
        .pass(Some(password))
        .db_name(Some(default_database.clone()));
    let pool = mysql::Pool::new(builder).map_err(metadata_failure)?;
    let mut database_connection = pool.get_conn().map_err(metadata_failure)?;

    let table_rows: Vec<(String, String)> = database_connection
        .exec(
            "SELECT TABLE_NAME, COALESCE(TABLE_COMMENT, '')
             FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
             ORDER BY TABLE_NAME",
            (default_database.clone(),),
        )
        .map_err(metadata_failure)?;
    let column_rows: Vec<(
        String,
        String,
        String,
        String,
        Option<String>,
        String,
        String,
        u32,
    )> = database_connection
        .exec(
            "SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE,
                        COLUMN_DEFAULT, COALESCE(COLUMN_COMMENT, ''), COLUMN_KEY, ORDINAL_POSITION
                 FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = ?
                 ORDER BY TABLE_NAME, ORDINAL_POSITION",
            (default_database.clone(),),
        )
        .map_err(metadata_failure)?;
    let index_rows: Vec<(String, String, u8, u32, String)> = database_connection
        .exec(
            "SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
             FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = ?
             ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX",
            (default_database.clone(),),
        )
        .map_err(metadata_failure)?;

    let mut columns_by_table: BTreeMap<String, Vec<DatabaseCatalogColumn>> = BTreeMap::new();
    for (
        table_name,
        column_name,
        data_type,
        nullable,
        default_value,
        comment,
        column_key,
        _ordinal_position,
    ) in column_rows
    {
        columns_by_table
            .entry(table_name)
            .or_default()
            .push(DatabaseCatalogColumn {
                name: column_name,
                data_type,
                nullable: nullable == "YES",
                default_value,
                comment,
                is_primary_key: column_key == "PRI",
            });
    }

    let mut indexes_by_table: BTreeMap<String, BTreeMap<String, IndexAccumulator>> =
        BTreeMap::new();
    for (table_name, index_name, non_unique, sequence, column_name) in index_rows {
        let kind = if index_name == "PRIMARY" {
            "primary"
        } else if non_unique == 0 {
            "unique"
        } else {
            "index"
        };
        let index_entry = indexes_by_table
            .entry(table_name)
            .or_default()
            .entry(index_name)
            .or_insert_with(|| IndexAccumulator {
                kind: kind.to_string(),
                columns: Vec::new(),
            });

        index_entry.columns.push((sequence, column_name));
    }

    let mut tables = Vec::new();
    for (table_name, table_comment) in table_rows {
        let ddl_query = format!(
            "SHOW CREATE TABLE {}.{}",
            quote_mysql_identifier(&default_database),
            quote_mysql_identifier(&table_name)
        );
        let create_table_ddl = database_connection
            .query_first::<(String, String), _>(ddl_query)
            .map_err(metadata_failure)?
            .map(|(_table_name, create_statement)| create_statement);
        let indexes = indexes_by_table
            .remove(&table_name)
            .unwrap_or_default()
            .into_iter()
            .map(|(index_name, mut index)| {
                index
                    .columns
                    .sort_by_key(|(sequence, _column_name)| *sequence);
                DatabaseCatalogIndex {
                    name: index_name,
                    kind: index.kind,
                    columns: index
                        .columns
                        .into_iter()
                        .map(|(_sequence, column_name)| column_name)
                        .collect(),
                }
            })
            .collect();

        tables.push(DatabaseCatalogTable {
            name: table_name.clone(),
            comment: table_comment,
            columns: columns_by_table.remove(&table_name).unwrap_or_default(),
            indexes,
            create_table_ddl,
        });
    }

    Ok(DatabaseCatalogSnapshot {
        connection_id: connection.id.clone(),
        database: default_database,
        refreshed_at: current_catalog_timestamp(local_store)?,
        tables,
    })
}

fn parse_json_array<T: DeserializeOwned>(value: String) -> Result<Vec<T>, String> {
    serde_json::from_str(&value)
        .map_err(|error| format!("failed to parse query session JSON: {error}"))
}

fn read_query_session_by_id(
    connection: &Connection,
    session_id: &str,
) -> Result<Option<QuerySessionRecord>, String> {
    connection
        .query_row(
            "SELECT
                qs.id,
                qs.database_connection_id,
                COALESCE(dc.name, 'Deleted connection') AS connection_name,
                qs.default_database,
                qs.sql_draft,
                COALESCE(ai.entries_json, '[]') AS ai_conversation_history,
                COALESCE(metadata.metadata_json, '[]') AS execution_result_metadata,
                qs.created_at,
                qs.updated_at
             FROM query_sessions qs
             LEFT JOIN database_connections dc ON dc.id = qs.database_connection_id
             LEFT JOIN query_session_ai_conversation_history ai ON ai.session_id = qs.id
             LEFT JOIN query_session_execution_metadata metadata ON metadata.session_id = qs.id
             WHERE qs.id = ?1",
            [session_id],
            |row| {
                Ok(QuerySessionRecord {
                    id: row.get(0)?,
                    database_connection_id: row.get(1)?,
                    connection_name: row.get(2)?,
                    default_database: row.get(3)?,
                    sql_draft: row.get(4)?,
                    ai_conversation_history: parse_json_array(row.get(5)?).map_err(|error| {
                        rusqlite::Error::FromSqlConversionFailure(
                            5,
                            rusqlite::types::Type::Text,
                            error.into(),
                        )
                    })?,
                    execution_result_metadata: parse_json_array(row.get(6)?).map_err(|error| {
                        rusqlite::Error::FromSqlConversionFailure(
                            6,
                            rusqlite::types::Type::Text,
                            error.into(),
                        )
                    })?,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            },
        )
        .optional()
        .map_err(|error| format!("failed to read query session: {error}"))
}

fn set_current_query_session(connection: &Connection, session_id: &str) -> Result<(), String> {
    connection
        .execute(
            "INSERT INTO app_settings (key, value, updated_at)
             VALUES (?1, ?2, CURRENT_TIMESTAMP)
             ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = CURRENT_TIMESTAMP",
            params![CURRENT_QUERY_SESSION_KEY, session_id],
        )
        .map_err(|error| format!("failed to save current query session: {error}"))?;

    connection
        .execute(
            "UPDATE query_sessions
             SET last_opened_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?1",
            [session_id],
        )
        .map_err(|error| format!("failed to touch current query session: {error}"))?;

    Ok(())
}

#[tauri::command]
fn get_theme_preference(app: tauri::AppHandle) -> Result<String, String> {
    let connection = open_local_store(&app)?;
    let stored_theme_preference = connection
        .query_row(
            "SELECT value FROM app_settings WHERE key = ?1",
            [THEME_PREFERENCE_KEY],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| format!("failed to read theme preference: {error}"))?;

    Ok(stored_theme_preference
        .filter(|value| is_theme_preference(value))
        .unwrap_or_else(|| DEFAULT_THEME_PREFERENCE.to_string()))
}

#[tauri::command(rename_all = "camelCase")]
fn set_theme_preference(app: tauri::AppHandle, theme_preference: String) -> Result<(), String> {
    if !is_theme_preference(&theme_preference) {
        return Err("invalid theme preference".to_string());
    }

    let connection = open_local_store(&app)?;
    connection
        .execute(
            "INSERT INTO app_settings (key, value, updated_at)
             VALUES (?1, ?2, CURRENT_TIMESTAMP)
             ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = CURRENT_TIMESTAMP",
            params![THEME_PREFERENCE_KEY, theme_preference],
        )
        .map_err(|error| format!("failed to save theme preference: {error}"))?;

    Ok(())
}

#[tauri::command]
fn get_global_ai_configuration(
    app: tauri::AppHandle,
) -> Result<Option<GlobalAiConfiguration>, String> {
    let connection = open_local_store(&app)?;
    connection
        .query_row(
            "SELECT base_url, model, temperature, max_tokens
             FROM global_ai_configuration WHERE id = 1",
            [],
            |row| {
                Ok(GlobalAiConfiguration {
                    base_url: row.get(0)?,
                    model: row.get(1)?,
                    temperature: row.get(2)?,
                    max_tokens: row.get(3)?,
                })
            },
        )
        .optional()
        .map_err(|error| format!("failed to read global AI configuration: {error}"))
}

#[tauri::command(rename_all = "camelCase")]
fn save_global_ai_configuration(
    app: tauri::AppHandle,
    configuration: GlobalAiConfiguration,
) -> Result<(), String> {
    if configuration.base_url.trim().is_empty() {
        return Err("AI provider base URL is required".to_string());
    }

    if configuration.model.trim().is_empty() {
        return Err("AI provider model is required".to_string());
    }

    let connection = open_local_store(&app)?;
    connection
        .execute(
            "INSERT INTO global_ai_configuration
                (id, base_url, model, temperature, max_tokens, updated_at)
             VALUES (1, ?1, ?2, ?3, ?4, CURRENT_TIMESTAMP)
             ON CONFLICT(id) DO UPDATE SET
                base_url = excluded.base_url,
                model = excluded.model,
                temperature = excluded.temperature,
                max_tokens = excluded.max_tokens,
                updated_at = CURRENT_TIMESTAMP",
            params![
                configuration.base_url,
                configuration.model,
                configuration.temperature,
                configuration.max_tokens
            ],
        )
        .map_err(|error| format!("failed to save global AI configuration: {error}"))?;

    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
fn get_secret(secret_id: String) -> Result<Option<String>, String> {
    match keychain_entry(&secret_id)?.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(format!("failed to read Keychain secret: {error}")),
    }
}

#[tauri::command(rename_all = "camelCase")]
fn set_secret(secret_id: String, secret_value: String) -> Result<(), String> {
    keychain_entry(&secret_id)?
        .set_password(&secret_value)
        .map_err(|error| format!("failed to save Keychain secret: {error}"))
}

#[tauri::command(rename_all = "camelCase")]
fn delete_secret(secret_id: String) -> Result<(), String> {
    match keychain_entry(&secret_id)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format!("failed to delete Keychain secret: {error}")),
    }
}

#[tauri::command]
fn list_database_connections(
    app: tauri::AppHandle,
) -> Result<Vec<DatabaseConnectionRecord>, String> {
    let connection = open_local_store(&app)?;
    let mut statement = connection
        .prepare(
            "SELECT id, name, host, port, username, password_secret_id, default_database
             FROM database_connections
             ORDER BY updated_at DESC, name ASC",
        )
        .map_err(|error| format!("failed to prepare database connection query: {error}"))?;

    let rows = statement
        .query_map([], |row| {
            Ok(DatabaseConnectionRecord {
                id: row.get(0)?,
                name: row.get(1)?,
                host: row.get(2)?,
                port: row.get(3)?,
                username: row.get(4)?,
                password_secret_id: row.get(5)?,
                default_database: row.get(6)?,
            })
        })
        .map_err(|error| format!("failed to read database connections: {error}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("failed to parse database connections: {error}"))
}

#[tauri::command(rename_all = "camelCase")]
fn save_database_connection(
    app: tauri::AppHandle,
    connection: DatabaseConnectionRecord,
) -> Result<DatabaseConnectionRecord, String> {
    validate_database_connection(&connection)?;
    let local_store = open_local_store(&app)?;

    local_store
        .execute(
            "INSERT INTO database_connections (
                id, name, host, port, username, password_secret_id, default_database, updated_at
             )
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, CURRENT_TIMESTAMP)
             ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                host = excluded.host,
                port = excluded.port,
                username = excluded.username,
                password_secret_id = excluded.password_secret_id,
                default_database = excluded.default_database,
                updated_at = CURRENT_TIMESTAMP",
            params![
                connection.id,
                connection.name,
                connection.host,
                connection.port,
                connection.username,
                connection.password_secret_id,
                connection.default_database
            ],
        )
        .map_err(|error| format!("failed to save database connection: {error}"))?;

    Ok(connection)
}

#[tauri::command(rename_all = "camelCase")]
fn delete_database_connection(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let local_store = open_local_store(&app)?;
    let password_secret_id = local_store
        .query_row(
            "SELECT password_secret_id FROM database_connections WHERE id = ?1",
            [&id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| format!("failed to read database connection before delete: {error}"))?;

    local_store
        .execute("DELETE FROM database_connections WHERE id = ?1", [&id])
        .map_err(|error| format!("failed to delete database connection: {error}"))?;
    local_store
        .execute(
            "DELETE FROM database_catalog_cache WHERE connection_id = ?1",
            [&id],
        )
        .map_err(|error| format!("failed to delete database catalog cache: {error}"))?;

    if let Some(secret_id) = password_secret_id {
        delete_secret(secret_id)?;
    }

    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
fn get_cached_catalog(
    app: tauri::AppHandle,
    connection_id: String,
) -> Result<Option<DatabaseCatalogSnapshot>, String> {
    let local_store = open_local_store(&app)?;
    let catalog_json = local_store
        .query_row(
            "SELECT catalog_json FROM database_catalog_cache WHERE connection_id = ?1",
            [&connection_id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| format!("failed to read catalog cache: {error}"))?;

    catalog_json
        .map(|json| {
            serde_json::from_str(&json)
                .map_err(|error| format!("failed to parse catalog cache: {error}"))
        })
        .transpose()
}

#[tauri::command(rename_all = "camelCase")]
fn open_connection_catalog(
    app: tauri::AppHandle,
    connection_id: String,
) -> Result<DatabaseCatalogSnapshot, String> {
    refresh_connection_catalog(app, connection_id)
}

#[tauri::command(rename_all = "camelCase")]
fn refresh_connection_catalog(
    app: tauri::AppHandle,
    connection_id: String,
) -> Result<DatabaseCatalogSnapshot, String> {
    let local_store = open_local_store(&app)?;
    let connection = read_database_connection_record(&local_store, &connection_id)?;
    let catalog = read_remote_database_catalog(&local_store, &connection)?;

    save_catalog_cache(&local_store, &catalog)?;

    Ok(catalog)
}

#[tauri::command(rename_all = "camelCase")]
fn test_database_connection(
    input: DatabaseConnectionTestInput,
) -> Result<DatabaseConnectionTestResult, String> {
    if input.host.trim().is_empty()
        || input.port == 0
        || input.username.trim().is_empty()
        || input.default_database.trim().is_empty()
    {
        return Ok(DatabaseConnectionTestResult {
            ok: false,
            message: "Host, port, username, and default database/schema are required".to_string(),
        });
    }

    let password = match (input.password, input.password_secret_id) {
        (Some(password), _) if !password.is_empty() => password,
        (_, Some(password_secret_id)) => match get_secret(password_secret_id)? {
            Some(password) => password,
            None => {
                return Ok(DatabaseConnectionTestResult {
                    ok: false,
                    message: "Saved password was not found in Keychain".to_string(),
                })
            }
        },
        _ => {
            return Ok(DatabaseConnectionTestResult {
                ok: false,
                message: "Password is required for connection testing".to_string(),
            })
        }
    };

    let builder = mysql::OptsBuilder::new()
        .ip_or_hostname(Some(input.host))
        .tcp_port(input.port)
        .user(Some(input.username))
        .pass(Some(password))
        .db_name(Some(input.default_database));

    match mysql::Pool::new(builder).and_then(|pool| pool.get_conn()) {
        Ok(mut database_connection) => match database_connection.query_drop("SELECT 1") {
            Ok(()) => Ok(DatabaseConnectionTestResult {
                ok: true,
                message: "Connection test succeeded".to_string(),
            }),
            Err(error) => Ok(DatabaseConnectionTestResult {
                ok: false,
                message: format!("Database test query failed: {error}"),
            }),
        },
        Err(error) => Ok(DatabaseConnectionTestResult {
            ok: false,
            message: format!("Database connection failed: {error}"),
        }),
    }
}

#[tauri::command]
fn list_query_sessions(app: tauri::AppHandle) -> Result<Vec<QuerySessionRecord>, String> {
    let connection = open_local_store(&app)?;
    let mut statement = connection
        .prepare(
            "SELECT
                qs.id,
                qs.database_connection_id,
                COALESCE(dc.name, 'Deleted connection') AS connection_name,
                qs.default_database,
                qs.sql_draft,
                COALESCE(ai.entries_json, '[]') AS ai_conversation_history,
                COALESCE(metadata.metadata_json, '[]') AS execution_result_metadata,
                qs.created_at,
                qs.updated_at
             FROM query_sessions qs
             LEFT JOIN database_connections dc ON dc.id = qs.database_connection_id
             LEFT JOIN query_session_ai_conversation_history ai ON ai.session_id = qs.id
             LEFT JOIN query_session_execution_metadata metadata ON metadata.session_id = qs.id
             ORDER BY qs.last_opened_at DESC, qs.updated_at DESC",
        )
        .map_err(|error| format!("failed to prepare query session list: {error}"))?;

    let rows = statement
        .query_map([], |row| {
            Ok(QuerySessionRecord {
                id: row.get(0)?,
                database_connection_id: row.get(1)?,
                connection_name: row.get(2)?,
                default_database: row.get(3)?,
                sql_draft: row.get(4)?,
                ai_conversation_history: parse_json_array(row.get(5)?).map_err(|error| {
                    rusqlite::Error::FromSqlConversionFailure(
                        5,
                        rusqlite::types::Type::Text,
                        error.into(),
                    )
                })?,
                execution_result_metadata: parse_json_array(row.get(6)?).map_err(|error| {
                    rusqlite::Error::FromSqlConversionFailure(
                        6,
                        rusqlite::types::Type::Text,
                        error.into(),
                    )
                })?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|error| format!("failed to read query sessions: {error}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("failed to parse query sessions: {error}"))
}

#[tauri::command(rename_all = "camelCase")]
fn create_query_session(
    app: tauri::AppHandle,
    input: QuerySessionCreateInput,
) -> Result<QuerySessionRecord, String> {
    let connection = open_local_store(&app)?;
    let default_database = connection
        .query_row(
            "SELECT default_database
             FROM database_connections
             WHERE id = ?1",
            [&input.database_connection_id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| format!("failed to read database connection for query session: {error}"))?
        .ok_or_else(|| "database connection was not found".to_string())?;
    let session_id = format!("query-session-{}", uuid_like_id());

    connection
        .execute(
            "INSERT INTO query_sessions (
                id, database_connection_id, default_database, sql_draft,
                created_at, updated_at, last_opened_at
             )
             VALUES (?1, ?2, ?3, '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            params![session_id, input.database_connection_id, default_database],
        )
        .map_err(|error| format!("failed to create query session: {error}"))?;

    set_current_query_session(&connection, &session_id)?;
    read_query_session_by_id(&connection, &session_id)?
        .ok_or_else(|| "created query session was not found".to_string())
}

#[tauri::command]
fn get_restored_query_session(app: tauri::AppHandle) -> Result<Option<QuerySessionRecord>, String> {
    let connection = open_local_store(&app)?;
    let current_session_id = connection
        .query_row(
            "SELECT value FROM app_settings WHERE key = ?1",
            [CURRENT_QUERY_SESSION_KEY],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| format!("failed to read current query session: {error}"))?;

    if let Some(session_id) = current_session_id {
        if let Some(session) = read_query_session_by_id(&connection, &session_id)? {
            set_current_query_session(&connection, &session.id)?;
            return Ok(Some(session));
        }
    }

    let session_id = connection
        .query_row(
            "SELECT id
             FROM query_sessions
             ORDER BY last_opened_at DESC, updated_at DESC
             LIMIT 1",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| format!("failed to read most recent query session: {error}"))?;

    match session_id {
        Some(session_id) => {
            set_current_query_session(&connection, &session_id)?;
            read_query_session_by_id(&connection, &session_id)
        }
        None => Ok(None),
    }
}

#[tauri::command(rename_all = "camelCase")]
fn save_query_session_sql_draft(
    app: tauri::AppHandle,
    session_id: String,
    sql_draft: String,
) -> Result<QuerySessionRecord, String> {
    let connection = open_local_store(&app)?;
    connection
        .execute(
            "UPDATE query_sessions
             SET sql_draft = ?1, updated_at = CURRENT_TIMESTAMP, last_opened_at = CURRENT_TIMESTAMP
             WHERE id = ?2",
            params![sql_draft, session_id],
        )
        .map_err(|error| format!("failed to save SQL draft: {error}"))?;

    set_current_query_session(&connection, &session_id)?;
    read_query_session_by_id(&connection, &session_id)?
        .ok_or_else(|| "query session was not found".to_string())
}

#[tauri::command(rename_all = "camelCase")]
fn save_query_session_ai_conversation_history(
    app: tauri::AppHandle,
    session_id: String,
    entries: Vec<AiConversationEntry>,
) -> Result<QuerySessionRecord, String> {
    let connection = open_local_store(&app)?;
    let entries_json = serde_json::to_string(&entries)
        .map_err(|error| format!("failed to serialize AI conversation history: {error}"))?;

    connection
        .execute(
            "INSERT INTO query_session_ai_conversation_history
                (session_id, entries_json, updated_at)
             VALUES (?1, ?2, CURRENT_TIMESTAMP)
             ON CONFLICT(session_id) DO UPDATE SET
                entries_json = excluded.entries_json,
                updated_at = CURRENT_TIMESTAMP",
            params![session_id, entries_json],
        )
        .map_err(|error| format!("failed to save AI conversation history: {error}"))?;

    set_current_query_session(&connection, &session_id)?;
    read_query_session_by_id(&connection, &session_id)?
        .ok_or_else(|| "query session was not found".to_string())
}

#[tauri::command(rename_all = "camelCase")]
fn save_query_session_execution_metadata(
    app: tauri::AppHandle,
    session_id: String,
    metadata: Vec<ExecutionResultMetadata>,
) -> Result<QuerySessionRecord, String> {
    let connection = open_local_store(&app)?;
    let metadata_json = serde_json::to_string(&metadata)
        .map_err(|error| format!("failed to serialize execution metadata: {error}"))?;

    connection
        .execute(
            "INSERT INTO query_session_execution_metadata
                (session_id, metadata_json, updated_at)
             VALUES (?1, ?2, CURRENT_TIMESTAMP)
             ON CONFLICT(session_id) DO UPDATE SET
                metadata_json = excluded.metadata_json,
                updated_at = CURRENT_TIMESTAMP",
            params![session_id, metadata_json],
        )
        .map_err(|error| format!("failed to save execution metadata: {error}"))?;

    set_current_query_session(&connection, &session_id)?;
    read_query_session_by_id(&connection, &session_id)?
        .ok_or_else(|| "query session was not found".to_string())
}

fn uuid_like_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();

    format!("{timestamp:x}")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_theme_preference,
            set_theme_preference,
            get_global_ai_configuration,
            save_global_ai_configuration,
            get_secret,
            set_secret,
            delete_secret,
            list_database_connections,
            save_database_connection,
            delete_database_connection,
            test_database_connection,
            get_cached_catalog,
            open_connection_catalog,
            refresh_connection_catalog,
            list_query_sessions,
            create_query_session,
            get_restored_query_session,
            save_query_session_sql_draft,
            save_query_session_ai_conversation_history,
            save_query_session_execution_metadata
        ])
        .run(tauri::generate_context!())
        .expect("error while running Glimpse");
}
