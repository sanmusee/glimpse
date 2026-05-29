use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::process::Command;
use std::{fs, path::PathBuf};
use tauri::Manager;

const THEME_PREFERENCE_KEY: &str = "theme_preference";
const DEFAULT_THEME_PREFERENCE: &str = "system";
const KEYCHAIN_SERVICE: &str = "com.glimpse.app";

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct GlobalAiConfiguration {
    base_url: String,
    model: String,
    temperature: f64,
    max_tokens: i64,
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

    Ok(connection)
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
    let output = Command::new("/usr/bin/security")
        .args([
            "find-generic-password",
            "-a",
            &secret_id,
            "-s",
            KEYCHAIN_SERVICE,
            "-w",
        ])
        .output()
        .map_err(|error| format!("failed to read Keychain secret: {error}"))?;

    if output.status.success() {
        return Ok(Some(
            String::from_utf8_lossy(&output.stdout)
                .trim_end_matches('\n')
                .to_string(),
        ));
    }

    if output.status.code() == Some(44)
        || String::from_utf8_lossy(&output.stderr).contains("could not be found")
    {
        return Ok(None);
    }

    Err(format!(
        "failed to read Keychain secret: {}",
        String::from_utf8_lossy(&output.stderr)
    ))
}

#[tauri::command(rename_all = "camelCase")]
fn set_secret(secret_id: String, secret_value: String) -> Result<(), String> {
    let output = Command::new("/usr/bin/security")
        .args([
            "add-generic-password",
            "-a",
            &secret_id,
            "-s",
            KEYCHAIN_SERVICE,
            "-w",
            &secret_value,
            "-U",
        ])
        .output()
        .map_err(|error| format!("failed to write Keychain secret: {error}"))?;

    if output.status.success() {
        return Ok(());
    }

    Err(format!(
        "failed to write Keychain secret: {}",
        String::from_utf8_lossy(&output.stderr)
    ))
}

#[tauri::command(rename_all = "camelCase")]
fn delete_secret(secret_id: String) -> Result<(), String> {
    let output = Command::new("/usr/bin/security")
        .args([
            "delete-generic-password",
            "-a",
            &secret_id,
            "-s",
            KEYCHAIN_SERVICE,
        ])
        .output()
        .map_err(|error| format!("failed to delete Keychain secret: {error}"))?;

    if output.status.success()
        || output.status.code() == Some(44)
        || String::from_utf8_lossy(&output.stderr).contains("could not be found")
    {
        return Ok(());
    }

    Err(format!(
        "failed to delete Keychain secret: {}",
        String::from_utf8_lossy(&output.stderr)
    ))
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
            delete_secret
        ])
        .run(tauri::generate_context!())
        .expect("error while running Glimpse");
}
