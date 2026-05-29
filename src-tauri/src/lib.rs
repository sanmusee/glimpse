use rusqlite::{params, Connection, OptionalExtension};
use std::{fs, path::PathBuf};
use tauri::Manager;

const THEME_PREFERENCE_KEY: &str = "theme_preference";
const DEFAULT_THEME_PREFERENCE: &str = "system";

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
fn get_secret(_secret_id: String) -> Result<Option<String>, String> {
    Err("Keychain secret store is reserved for #3/#4 and is not implemented in #2".to_string())
}

#[tauri::command(rename_all = "camelCase")]
fn set_secret(_secret_id: String, _secret_value: String) -> Result<(), String> {
    Err("Keychain secret store is reserved for #3/#4 and is not implemented in #2".to_string())
}

#[tauri::command(rename_all = "camelCase")]
fn delete_secret(_secret_id: String) -> Result<(), String> {
    Err("Keychain secret store is reserved for #3/#4 and is not implemented in #2".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_theme_preference,
            set_theme_preference,
            get_secret,
            set_secret,
            delete_secret
        ])
        .run(tauri::generate_context!())
        .expect("error while running Glimpse");
}
