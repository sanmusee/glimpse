import "./styles.css";
import { useEffect, useRef, useState } from "react";
import {
  type DatabaseConnection,
  type DatabaseConnectionInput,
  defaultLocalPersistence,
  type LocalPersistence,
  type ThemePreference,
} from "./platform/localPersistence";

interface AppProps {
  localPersistence?: LocalPersistence;
}

export function App({ localPersistence = defaultLocalPersistence }: AppProps) {
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");
  const [databaseConnections, setDatabaseConnections] = useState<DatabaseConnection[]>([]);
  const [databaseConnectionForm, setDatabaseConnectionForm] = useState<DatabaseConnectionInput>({
    name: "",
    host: "",
    port: 4000,
    username: "",
    password: "",
    defaultDatabase: "",
  });
  const [connectionTestMessage, setConnectionTestMessage] = useState<string | null>(null);
  const userSelectedThemePreference = useRef(false);

  useEffect(() => {
    let isCurrent = true;

    localPersistence.preferences.getThemePreference().then((storedThemePreference) => {
      if (!isCurrent || userSelectedThemePreference.current) {
        return;
      }

      setThemePreference(storedThemePreference);
      document.documentElement.setAttribute("data-theme", storedThemePreference);
    });

    return () => {
      isCurrent = false;
    };
  }, [localPersistence]);

  useEffect(() => {
    let isCurrent = true;

    localPersistence.databaseConnections.listDatabaseConnections().then((connections) => {
      if (isCurrent) {
        setDatabaseConnections(connections);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [localPersistence]);

  const updateThemePreference = (nextThemePreference: ThemePreference) => {
    userSelectedThemePreference.current = true;
    setThemePreference(nextThemePreference);
    document.documentElement.setAttribute("data-theme", nextThemePreference);
    localPersistence.preferences.setThemePreference(nextThemePreference);
  };

  const updateDatabaseConnectionForm = (
    field: keyof DatabaseConnectionInput,
    value: string,
  ) => {
    setDatabaseConnectionForm((currentForm) => ({
      ...currentForm,
      [field]: field === "port" ? Number(value) : value,
    }));
  };

  const saveDatabaseConnection = async () => {
    const savedConnection =
      await localPersistence.databaseConnections.saveDatabaseConnection(databaseConnectionForm);

    setDatabaseConnections((currentConnections) => [
      savedConnection,
      ...currentConnections.filter((connection) => connection.id !== savedConnection.id),
    ]);
    setDatabaseConnectionForm({
      name: "",
      host: "",
      port: 4000,
      username: "",
      password: "",
      defaultDatabase: "",
    });
  };

  const testDatabaseConnection = async () => {
    const result =
      await localPersistence.databaseConnections.testDatabaseConnection(databaseConnectionForm);
    setConnectionTestMessage(result.message);
  };

  const editDatabaseConnection = (connection: DatabaseConnection) => {
    setDatabaseConnectionForm({
      id: connection.id,
      name: connection.name,
      host: connection.host,
      port: connection.port,
      username: connection.username,
      passwordSecretId: connection.passwordSecretId,
      password: "",
      defaultDatabase: connection.defaultDatabase,
    });
  };

  const deleteDatabaseConnection = async (connection: DatabaseConnection) => {
    await localPersistence.databaseConnections.deleteDatabaseConnection(connection.id);
    setDatabaseConnections((currentConnections) =>
      currentConnections.filter((currentConnection) => currentConnection.id !== connection.id),
    );
  };

  return (
    <main aria-label="Glimpse workbench" className="app-shell">
      <aside className="sidebar sidebar-left" aria-label="Session and catalog">
        <header className="brand-bar">
          <div className="brand-mark">G</div>
          <div>
            <strong>Glimpse</strong>
            <span>V0.1 Workbench</span>
          </div>
        </header>

        <section className="panel">
          <div className="panel-title">Preferences</div>
          <label className="field">
            <span>Theme preference</span>
            <select
              value={themePreference}
              onChange={(event) => updateThemePreference(event.target.value as ThemePreference)}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </section>

        <section className="panel">
          <div className="panel-title">Database</div>
          <div className="connection-form" aria-label="Database connection form">
            <div className="empty-state">
              <strong>Create database connection</strong>
              <p>Connect a MySQL/TiDB database to load the default schema catalog.</p>
            </div>
            <label className="field">
              <span>Connection name</span>
              <input
                value={databaseConnectionForm.name}
                onChange={(event) => updateDatabaseConnectionForm("name", event.target.value)}
              />
            </label>
            <label className="field">
              <span>Host</span>
              <input
                value={databaseConnectionForm.host}
                onChange={(event) => updateDatabaseConnectionForm("host", event.target.value)}
              />
            </label>
            <label className="field">
              <span>Port</span>
              <input
                inputMode="numeric"
                value={databaseConnectionForm.port}
                onChange={(event) => updateDatabaseConnectionForm("port", event.target.value)}
              />
            </label>
            <label className="field">
              <span>Username</span>
              <input
                value={databaseConnectionForm.username}
                onChange={(event) => updateDatabaseConnectionForm("username", event.target.value)}
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={databaseConnectionForm.password}
                onChange={(event) => updateDatabaseConnectionForm("password", event.target.value)}
              />
            </label>
            <label className="field">
              <span>Default Database/Schema</span>
              <input
                value={databaseConnectionForm.defaultDatabase}
                onChange={(event) =>
                  updateDatabaseConnectionForm("defaultDatabase", event.target.value)
                }
              />
            </label>
            <div className="form-actions">
              <button type="button" onClick={testDatabaseConnection}>
                Test connection
              </button>
              <button className="primary-action" type="button" onClick={saveDatabaseConnection}>
                Save connection
              </button>
            </div>
            {connectionTestMessage ? (
              <div className="connection-test-status" role="status">
                {connectionTestMessage}
              </div>
            ) : null}
            <div className="connection-list" aria-label="Saved database connections">
              {databaseConnections.length === 0 ? (
                <div className="placeholder-row">No saved connections yet</div>
              ) : (
                databaseConnections.map((connection) => (
                  <article className="connection-row" key={connection.id}>
                    <div>
                      <strong>{connection.name}</strong>
                      <span>
                        {connection.host}:{connection.port} / {connection.defaultDatabase}
                      </span>
                    </div>
                    <div className="connection-actions">
                      <button type="button" onClick={() => editDatabaseConnection(connection)}>
                        Edit {connection.name}
                      </button>
                      <button type="button" onClick={() => deleteDatabaseConnection(connection)}>
                        Delete {connection.name}
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-title">Query Sessions</div>
          <div className="placeholder-row">No saved sessions yet</div>
        </section>
      </aside>

      <section className="workspace">
        <section aria-label="SQL editor" className="panel editor-panel">
          <div className="panel-title">SQL Draft</div>
          <pre className="editor-surface">
            {`-- AI-generated SQL will appear here.
-- Review it before running in Read-only Mode.`}
          </pre>
        </section>

        <section aria-label="Query results" className="panel results-panel">
          <div className="panel-title">Result</div>
          <div className="empty-state">
            <strong>No query has run</strong>
            <p>Results will appear here after manual read-only execution.</p>
          </div>
        </section>
      </section>

      <aside className="sidebar sidebar-right" aria-label="AI assistant and context">
        <section aria-label="AI assistant" className="panel">
          <div className="panel-title">AI Assistant</div>
          <div className="empty-state">
            <strong>Configure global AI provider</strong>
            <p>Add an OpenAI-compatible provider before generating SQL.</p>
          </div>
        </section>

        <section className="panel">
          <div className="panel-title">Candidate Table Set</div>
          <div className="placeholder-row">No candidate tables yet</div>
        </section>
      </aside>
    </main>
  );
}
