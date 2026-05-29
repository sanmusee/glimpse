# Use Tauri, React, Rust, and CodeMirror stack

Glimpse V0.1 will use Tauri 2 for the macOS desktop shell, Rust for local backend capabilities, React and TypeScript for the frontend, shadcn/ui and Tailwind CSS for UI, CodeMirror 6 for SQL editing, SQLite for local non-secret storage, and macOS Keychain for secrets.

## Considered Options

- Tauri 2 + React + Rust: lightweight desktop app with strong local capabilities and a mature frontend ecosystem for tool-style UI.
- Electron + React: mature and flexible, but heavier than desired for a small local developer tool.
- SwiftUI: native macOS feel, but less convenient for rapidly building a complex SQL editor, AI assistant panel, result table, and database object UI.

## Consequences

The app architecture should keep local database access, secret access, and filesystem-backed persistence in the Tauri/Rust layer, while the frontend owns editor ergonomics, result display, session UI, and AI interaction surfaces. CodeMirror 6 should be treated as the SQL editor foundation rather than a replaceable textarea.
