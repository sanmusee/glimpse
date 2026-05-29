use mysql::prelude::Queryable;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::Manager;

const THEME_PREFERENCE_KEY: &str = "theme_preference";
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

    if let Some(secret_id) = password_secret_id {
        delete_secret(secret_id)?;
    }

    Ok(())
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_theme_preference,
            set_theme_preference,
            get_secret,
            set_secret,
            delete_secret,
            list_database_connections,
            save_database_connection,
            delete_database_connection,
            test_database_connection
        ])
        .run(tauri::generate_context!())
        .expect("error while running Glimpse");
}
