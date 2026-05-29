import "./styles.css";
import { useEffect, useRef, useState } from "react";
import {
  runStreamingAiProviderTest,
  type AiProviderTestResult,
} from "./aiProviderTestClient";
import {
  AI_PROVIDER_API_KEY_SECRET_ID,
  defaultLocalPersistence,
  type DatabaseConnection,
  type DatabaseConnectionInput,
  type DatabaseCatalogSnapshot,
  type GlobalAiConfiguration,
  type LocalPersistence,
  type QuerySession,
  type ThemePreference,
} from "./platform/localPersistence";

interface AppProps {
  localPersistence?: LocalPersistence;
  aiProviderTester?: (
    configuration: GlobalAiConfiguration,
    apiKey: string,
  ) => Promise<AiProviderTestResult>;
}

interface AiConfigurationFormState {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: string;
  maxTokens: string;
}

const emptyAiConfigurationForm: AiConfigurationFormState = {
  baseUrl: "",
  apiKey: "",
  model: "",
  temperature: "0.2",
  maxTokens: "1000",
};

const emptyDatabaseConnectionForm: DatabaseConnectionInput = {
  name: "",
  host: "",
  port: 4000,
  username: "",
  password: "",
  defaultDatabase: "",
};

export function App({
  localPersistence = defaultLocalPersistence,
  aiProviderTester = runStreamingAiProviderTest,
}: AppProps) {
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");
  const [databaseConnections, setDatabaseConnections] = useState<DatabaseConnection[]>([]);
  const [querySessions, setQuerySessions] = useState<QuerySession[]>([]);
  const [currentQuerySession, setCurrentQuerySession] = useState<QuerySession | null>(null);
  const [databaseConnectionForm, setDatabaseConnectionForm] =
    useState<DatabaseConnectionInput>(emptyDatabaseConnectionForm);
  const [connectionTestMessage, setConnectionTestMessage] = useState<string | null>(null);
  const [activeCatalog, setActiveCatalog] = useState<DatabaseCatalogSnapshot | null>(null);
  const [catalogStatus, setCatalogStatus] = useState<string | null>(null);
  const [aiConfigurationForm, setAiConfigurationForm] = useState<AiConfigurationFormState>(
    emptyAiConfigurationForm,
  );
  const [aiConfigurationStatus, setAiConfigurationStatus] = useState("Not configured");
  const [aiProviderTestStatus, setAiProviderTestStatus] = useState("");
  const [hasSavedApiKey, setHasSavedApiKey] = useState(false);
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

    Promise.all([
      localPersistence.querySessions.listQuerySessions(),
      localPersistence.querySessions.getRestoredQuerySession(),
    ]).then(([sessions, restoredSession]) => {
      if (!isCurrent) {
        return;
      }

      setQuerySessions(sessions);
      setCurrentQuerySession(restoredSession);
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

  useEffect(() => {
    let isCurrent = true;

    Promise.all([
      localPersistence.aiConfiguration.getGlobalAiConfiguration(),
      localPersistence.secrets.getSecret(AI_PROVIDER_API_KEY_SECRET_ID),
    ]).then(([storedConfiguration, storedApiKey]) => {
      if (!isCurrent) {
        return;
      }

      if (storedConfiguration) {
        setAiConfigurationForm({
          baseUrl: storedConfiguration.baseUrl,
          apiKey: "",
          model: storedConfiguration.model,
          temperature: String(storedConfiguration.temperature),
          maxTokens: String(storedConfiguration.maxTokens),
        });
        setAiConfigurationStatus("AI configuration loaded");
      }

      setHasSavedApiKey(Boolean(storedApiKey));
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
    setDatabaseConnectionForm(emptyDatabaseConnectionForm);
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

    if (activeCatalog?.connectionId === connection.id) {
      setActiveCatalog(null);
    }
  };

  const openCatalog = async (connection: DatabaseConnection) => {
    setCatalogStatus(`Reading catalog for ${connection.defaultDatabase}`);

    try {
      const catalog = await localPersistence.databaseCatalogs.openConnectionCatalog(connection.id);
      setActiveCatalog(catalog);
      setCatalogStatus(`Catalog loaded from ${catalog.database}`);
    } catch (error) {
      setCatalogStatus(formatCatalogError(error));
    }
  };

  const refreshCatalog = async () => {
    if (!activeCatalog) {
      return;
    }

    setCatalogStatus(`Refreshing catalog for ${activeCatalog.database}`);

    try {
      const catalog = await localPersistence.databaseCatalogs.refreshCatalog(
        activeCatalog.connectionId,
      );
      setActiveCatalog(catalog);
      setCatalogStatus(`Catalog refreshed from ${catalog.database}`);
    } catch (error) {
      setCatalogStatus(formatCatalogError(error));
    }
  };

  const createQuerySession = async (connection: DatabaseConnection) => {
    const createdSession = await localPersistence.querySessions.createQuerySession({
      databaseConnectionId: connection.id,
    });

    setCurrentQuerySession(createdSession);
    setQuerySessions((currentSessions) => [
      createdSession,
      ...currentSessions.filter((session) => session.id !== createdSession.id),
    ]);
  };

  const updateSqlDraft = async (sqlDraft: string) => {
    if (!currentQuerySession) {
      return;
    }

    const optimisticSession = { ...currentQuerySession, sqlDraft };
    setCurrentQuerySession(optimisticSession);
    setQuerySessions((currentSessions) =>
      currentSessions.map((session) =>
        session.id === optimisticSession.id ? optimisticSession : session,
      ),
    );

    const savedSession = await localPersistence.querySessions.saveSqlDraft(
      currentQuerySession.id,
      sqlDraft,
    );
    setCurrentQuerySession(savedSession);
    setQuerySessions((currentSessions) =>
      currentSessions.map((session) =>
        session.id === savedSession.id ? savedSession : session,
      ),
    );
  };

  const updateAiConfigurationField = (
    field: keyof AiConfigurationFormState,
    value: string,
  ) => {
    setAiConfigurationForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  };

  const saveAiConfiguration = async () => {
    const configuration: GlobalAiConfiguration = {
      baseUrl: aiConfigurationForm.baseUrl.trim(),
      model: aiConfigurationForm.model.trim(),
      temperature: Number(aiConfigurationForm.temperature),
      maxTokens: Number(aiConfigurationForm.maxTokens),
    };

    await localPersistence.aiConfiguration.saveGlobalAiConfiguration(configuration);

    if (aiConfigurationForm.apiKey.trim()) {
      await localPersistence.secrets.setSecret(
        AI_PROVIDER_API_KEY_SECRET_ID,
        aiConfigurationForm.apiKey,
      );
      setHasSavedApiKey(true);
      setAiConfigurationForm((currentForm) => ({ ...currentForm, apiKey: "" }));
    }

    setAiConfigurationStatus("AI configuration saved");
  };

  const testAiProvider = async () => {
    setAiProviderTestStatus("Testing AI provider");

    const configuration: GlobalAiConfiguration = {
      baseUrl: aiConfigurationForm.baseUrl.trim(),
      model: aiConfigurationForm.model.trim(),
      temperature: Number(aiConfigurationForm.temperature),
      maxTokens: Number(aiConfigurationForm.maxTokens),
    };
    const apiKey =
      aiConfigurationForm.apiKey ||
      (await localPersistence.secrets.getSecret(AI_PROVIDER_API_KEY_SECRET_ID));

    if (!apiKey) {
      setAiProviderTestStatus("AI request failed: API key is missing");
      return;
    }

    const result = await aiProviderTester(configuration, apiKey);
    setAiProviderTestStatus(
      result.ok ? `Streaming AI response: ${result.content}` : `AI request failed: ${result.error}`,
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
                      <button type="button" onClick={() => openCatalog(connection)}>
                        Open catalog {connection.name}
                      </button>
                      <button type="button" onClick={() => deleteDatabaseConnection(connection)}>
                        Delete {connection.name}
                      </button>
                      <button type="button" onClick={() => createQuerySession(connection)}>
                        New session for {connection.name}
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
          {querySessions.length === 0 ? (
            <div className="placeholder-row">No saved sessions yet</div>
          ) : (
            <div className="session-list" aria-label="Saved query sessions">
              {querySessions.map((session) => (
                <button
                  className="session-row"
                  type="button"
                  key={session.id}
                  onClick={() => setCurrentQuerySession(session)}
                >
                  <strong>{session.connectionName}</strong>
                  <span>
                    {session.connectionName} / {session.defaultDatabase}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      </aside>

      <section className="workspace">
        <section aria-label="SQL editor" className="panel editor-panel">
          <div className="panel-title">SQL Draft</div>
          <textarea
            aria-label="SQL Draft"
            className="editor-surface"
            disabled={!currentQuerySession}
            onChange={(event) => updateSqlDraft(event.target.value)}
            placeholder={`-- AI-generated SQL will appear here.
-- Review it before running in Read-only Mode.`}
            value={currentQuerySession?.sqlDraft ?? ""}
          />
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
          <form
            className="ai-config-form"
            onSubmit={(event) => {
              event.preventDefault();
              saveAiConfiguration();
            }}
          >
            <label className="field">
              <span>Base URL</span>
              <input
                value={aiConfigurationForm.baseUrl}
                onChange={(event) => updateAiConfigurationField("baseUrl", event.target.value)}
                placeholder="https://api.openai.com/v1"
              />
            </label>
            <label className="field">
              <span>API key</span>
              <input
                type="password"
                value={aiConfigurationForm.apiKey}
                onChange={(event) => updateAiConfigurationField("apiKey", event.target.value)}
                placeholder={hasSavedApiKey ? "Stored in Keychain" : "Paste API key"}
              />
            </label>
            <label className="field">
              <span>Model</span>
              <input
                value={aiConfigurationForm.model}
                onChange={(event) => updateAiConfigurationField("model", event.target.value)}
                placeholder="gpt-4.1-mini"
              />
            </label>
            <div className="field-grid">
              <label className="field compact-field">
                <span>Temperature</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={aiConfigurationForm.temperature}
                  onChange={(event) =>
                    updateAiConfigurationField("temperature", event.target.value)
                  }
                />
              </label>
              <label className="field compact-field">
                <span>Max tokens</span>
                <input
                  type="number"
                  min="1"
                  value={aiConfigurationForm.maxTokens}
                  onChange={(event) => updateAiConfigurationField("maxTokens", event.target.value)}
                />
              </label>
            </div>
            <button className="primary-button" type="submit">
              Save AI configuration
            </button>
            <button className="secondary-button" type="button" onClick={testAiProvider}>
              Test AI provider
            </button>
            <div className="status-line">{aiConfigurationStatus}</div>
            {aiProviderTestStatus ? (
              <div className="status-line">{aiProviderTestStatus}</div>
            ) : null}
            {hasSavedApiKey ? <div className="status-line">API key saved</div> : null}
          </form>
        </section>

        <section className="panel">
          <section aria-label="Database catalog" className="catalog-panel">
            <div className="panel-title">Database Catalog</div>
            <div className="catalog-toolbar">
              <button
                className="secondary-button"
                type="button"
                onClick={refreshCatalog}
                disabled={!activeCatalog}
              >
                Refresh catalog
              </button>
              {catalogStatus ? <div className="status-line">{catalogStatus}</div> : null}
            </div>
            {activeCatalog ? (
              <div className="catalog-content">
                <div className="catalog-summary">
                  <strong>{activeCatalog.database}</strong>
                  <span>
                    {activeCatalog.tables.length} table
                    {activeCatalog.tables.length === 1 ? "" : "s"} loaded
                  </span>
                </div>
                {activeCatalog.tables.map((table) => (
                  <article className="catalog-table" key={table.name}>
                    <header>
                      <strong>{table.name}</strong>
                      {table.comment ? <span>{table.comment}</span> : null}
                    </header>
                    <div className="catalog-subtitle">Fields</div>
                    <ul>
                      {table.columns.map((column) => (
                        <li key={column.name}>
                          <span>
                            {column.name} {column.dataType}{" "}
                            {column.nullable ? "nullable" : "not null"}
                            {column.isPrimaryKey ? " primary key" : ""}
                            {column.defaultValue ? ` default ${column.defaultValue}` : ""}
                          </span>
                          {column.comment ? <small>{column.comment}</small> : null}
                        </li>
                      ))}
                    </ul>
                    <div className="catalog-subtitle">Indexes</div>
                    <ul>
                      {table.indexes.map((index) => (
                        <li key={index.name}>
                          {index.name} {index.kind} {index.columns.join(", ")}
                        </li>
                      ))}
                    </ul>
                    {table.createTableDdl ? (
                      <pre className="ddl-block">{table.createTableDdl}</pre>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <div className="placeholder-row">Open a connection to inspect its default schema.</div>
            )}
          </section>
        </section>

        <section className="panel">
          <div className="panel-title">Candidate Table Set</div>
          <div className="placeholder-row">No candidate tables yet</div>
        </section>
      </aside>
    </main>
  );
}

function formatCatalogError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes("permission")
    ? `Metadata Permission Failure: ${message}`
    : `Catalog read failed: ${message}`;
}
