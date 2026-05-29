import "./styles.css";
import { useEffect, useRef, useState } from "react";
import {
  defaultLocalPersistence,
  type LocalPersistence,
  type ThemePreference,
} from "./platform/localPersistence";

interface AppProps {
  localPersistence?: LocalPersistence;
}

export function App({ localPersistence = defaultLocalPersistence }: AppProps) {
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");
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

  const updateThemePreference = (nextThemePreference: ThemePreference) => {
    userSelectedThemePreference.current = true;
    setThemePreference(nextThemePreference);
    document.documentElement.setAttribute("data-theme", nextThemePreference);
    localPersistence.preferences.setThemePreference(nextThemePreference);
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
        </section>

        <section className="panel">
          <div className="panel-title">Candidate Table Set</div>
          <div className="placeholder-row">No candidate tables yet</div>
        </section>
      </aside>
    </main>
  );
}
