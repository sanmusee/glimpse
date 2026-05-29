import "./styles.css";
import { useEffect, useRef, useState } from "react";
import {
  runStreamingAiProviderTest,
  type AiProviderTestResult,
} from "./aiProviderTestClient";
import {
  AI_PROVIDER_API_KEY_SECRET_ID,
  defaultLocalPersistence,
  type GlobalAiConfiguration,
  type LocalPersistence,
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

export function App({
  localPersistence = defaultLocalPersistence,
  aiProviderTester = runStreamingAiProviderTest,
}: AppProps) {
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");
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
      updateAiConfigurationField("apiKey", "");
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
          <div className="empty-state">
            <strong>Create database connection</strong>
            <p>Connect a MySQL/TiDB database to load the default schema catalog.</p>
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
          <div className="panel-title">Candidate Table Set</div>
          <div className="placeholder-row">No candidate tables yet</div>
        </section>
      </aside>
    </main>
  );
}
