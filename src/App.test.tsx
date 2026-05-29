import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { createInMemoryLocalPersistence } from "./platform/localPersistence";

describe("Glimpse app shell", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("opens directly into the SQL editor-first workbench with setup empty states", () => {
    render(<App localPersistence={createInMemoryLocalPersistence()} />);

    expect(screen.getByRole("main", { name: /glimpse workbench/i })).toBeInTheDocument();
    expect(screen.queryByText(/first-run wizard/i)).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: /sql editor/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /query results/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /ai assistant/i })).toBeInTheDocument();
    expect(screen.getByText(/configure global ai provider/i)).toBeInTheDocument();
    expect(screen.getByText(/create database connection/i)).toBeInTheDocument();
  });

  it.each(["light", "dark", "system"] as const)(
    "persists and restores the %s theme preference",
    async (themePreference) => {
      const localPersistence = createInMemoryLocalPersistence();
      const { unmount } = render(<App localPersistence={localPersistence} />);

      const themeSelect = screen.getByRole("combobox", { name: /theme preference/i });

      if (themePreference === "system") {
        fireEvent.change(themeSelect, { target: { value: "light" } });
        await waitFor(() => expect(document.documentElement).toHaveAttribute("data-theme", "light"));
      }

      fireEvent.change(themeSelect, {
        target: { value: themePreference },
      });

      await waitFor(() =>
        expect(document.documentElement).toHaveAttribute("data-theme", themePreference),
      );
      await expect(localPersistence.preferences.getThemePreference()).resolves.toBe(themePreference);
      expect(window.localStorage.getItem("glimpse.themePreference")).toBeNull();

      unmount();
      render(<App localPersistence={localPersistence} />);

      await waitFor(() =>
        expect(screen.getByRole("combobox", { name: /theme preference/i })).toHaveValue(
          themePreference,
        ),
      );
      expect(document.documentElement).toHaveAttribute("data-theme", themePreference);
    },
  );

  it("creates and lists a direct database connection without storing the password in metadata", async () => {
    const localPersistence = createInMemoryLocalPersistence();
    render(<App localPersistence={localPersistence} />);

    fireEvent.change(screen.getByLabelText(/connection name/i), {
      target: { value: "Analytics TiDB" },
    });
    fireEvent.change(screen.getByLabelText(/^host$/i), {
      target: { value: "analytics.internal" },
    });
    fireEvent.change(screen.getByLabelText(/^port$/i), {
      target: { value: "4000" },
    });
    fireEvent.change(screen.getByLabelText(/^username$/i), {
      target: { value: "analyst" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "not-in-sqlite" },
    });
    fireEvent.change(screen.getByLabelText(/default database/i), {
      target: { value: "warehouse" },
    });

    fireEvent.click(screen.getByRole("button", { name: /save connection/i }));

    expect(await screen.findByText("Analytics TiDB")).toBeInTheDocument();
    expect(screen.getByText("analytics.internal:4000 / warehouse")).toBeInTheDocument();

    const [savedConnection] =
      await localPersistence.databaseConnections.listDatabaseConnections();
    expect(savedConnection).toMatchObject({
      name: "Analytics TiDB",
      host: "analytics.internal",
      port: 4000,
      username: "analyst",
      defaultDatabase: "warehouse",
    });
    expect(savedConnection).not.toHaveProperty("password");
    await expect(localPersistence.secrets.getSecret(savedConnection.passwordSecretId)).resolves.toBe(
      "not-in-sqlite",
    );
  });

  it("edits and deletes a saved database connection", async () => {
    const localPersistence = createInMemoryLocalPersistence({
      databaseConnections: [
        {
          id: "db-1",
          name: "Warehouse",
          host: "warehouse.internal",
          port: 3306,
          username: "readonly",
          passwordSecretId: "database-connection:db-1:password",
          defaultDatabase: "analytics",
        },
      ],
    });
    render(<App localPersistence={localPersistence} />);

    expect(await screen.findByText("Warehouse")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /edit warehouse/i }));
    fireEvent.change(screen.getByLabelText(/default database/i), {
      target: { value: "mart" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save connection/i }));

    expect(await screen.findByText("warehouse.internal:3306 / mart")).toBeInTheDocument();
    await expect(localPersistence.databaseConnections.listDatabaseConnections()).resolves.toEqual([
      expect.objectContaining({
        id: "db-1",
        defaultDatabase: "mart",
      }),
    ]);

    fireEvent.click(screen.getByRole("button", { name: /delete warehouse/i }));

    await waitFor(() => expect(screen.queryByText("Warehouse")).not.toBeInTheDocument());
    await expect(localPersistence.databaseConnections.listDatabaseConnections()).resolves.toEqual(
      [],
    );
    await expect(
      localPersistence.secrets.getSecret("database-connection:db-1:password"),
    ).resolves.toBeNull();
  });

  it("manually tests a database connection and shows success or failure", async () => {
    const attempts: string[] = [];
    const localPersistence = createInMemoryLocalPersistence({
      testDatabaseConnection: (input) => {
        attempts.push(input.host);

        return attempts.length === 1
          ? { ok: false, message: "Authentication failed" }
          : { ok: true, message: "Connected to warehouse" };
      },
    });
    render(<App localPersistence={localPersistence} />);

    fireEvent.change(screen.getByLabelText(/connection name/i), {
      target: { value: "Warehouse" },
    });
    fireEvent.change(screen.getByLabelText(/^host$/i), {
      target: { value: "warehouse.internal" },
    });
    fireEvent.change(screen.getByLabelText(/^port$/i), {
      target: { value: "3306" },
    });
    fireEvent.change(screen.getByLabelText(/^username$/i), {
      target: { value: "readonly" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "secret" },
    });
    fireEvent.change(screen.getByLabelText(/default database/i), {
      target: { value: "warehouse" },
    });

    fireEvent.click(screen.getByRole("button", { name: /test connection/i }));
    expect(await screen.findByRole("status")).toHaveTextContent("Authentication failed");

    fireEvent.click(screen.getByRole("button", { name: /test connection/i }));
    expect(await screen.findByRole("status")).toHaveTextContent("Connected to warehouse");
    expect(attempts).toEqual(["warehouse.internal", "warehouse.internal"]);
    expect(screen.queryByText(/ssh tunnel/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/advanced ssl/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/bastion/i)).not.toBeInTheDocument();
  });

  it("saves and restores the global AI provider configuration", async () => {
    const localPersistence = createInMemoryLocalPersistence();
    const { unmount } = render(<App localPersistence={localPersistence} />);

    fireEvent.change(screen.getByLabelText(/base url/i), {
      target: { value: "https://api.example.test/v1" },
    });
    fireEvent.change(screen.getByLabelText(/api key/i), {
      target: { value: "sk-test-secret" },
    });
    fireEvent.change(screen.getByLabelText(/^model$/i), {
      target: { value: "gpt-4.1-mini" },
    });
    fireEvent.change(screen.getByLabelText(/temperature/i), {
      target: { value: "0.2" },
    });
    fireEvent.change(screen.getByLabelText(/max tokens/i), {
      target: { value: "1200" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save ai configuration/i }));

    await screen.findByText(/ai configuration saved/i);
    expect(screen.getByText(/api key saved/i)).toBeInTheDocument();

    unmount();
    render(<App localPersistence={localPersistence} />);

    await waitFor(() =>
      expect(screen.getByLabelText(/base url/i)).toHaveValue("https://api.example.test/v1"),
    );
    expect(screen.getByLabelText(/^model$/i)).toHaveValue("gpt-4.1-mini");
    expect(screen.getByLabelText(/temperature/i)).toHaveValue(0.2);
    expect(screen.getByLabelText(/max tokens/i)).toHaveValue(1200);
    expect(screen.getByText(/api key saved/i)).toBeInTheDocument();
  });

  it("runs the AI provider test manually and retries only when the user clicks again", async () => {
    const localPersistence = createInMemoryLocalPersistence();
    const aiProviderTester = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: "invalid api key" })
      .mockResolvedValueOnce({ ok: true, content: "Streaming AI response" });

    render(<App localPersistence={localPersistence} aiProviderTester={aiProviderTester} />);

    fireEvent.change(screen.getByLabelText(/base url/i), {
      target: { value: "https://api.example.test/v1" },
    });
    fireEvent.change(screen.getByLabelText(/api key/i), {
      target: { value: "sk-test-secret" },
    });
    fireEvent.change(screen.getByLabelText(/^model$/i), {
      target: { value: "gpt-4.1-mini" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save ai configuration/i }));
    await screen.findByText(/ai configuration saved/i);

    fireEvent.click(screen.getByRole("button", { name: /test ai provider/i }));

    await screen.findByText(/ai request failed: invalid api key/i);
    expect(aiProviderTester).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /test ai provider/i }));

    await screen.findByText(/streaming ai response/i);
    expect(aiProviderTester).toHaveBeenCalledTimes(2);
  });

  it("creates a query session for a saved database connection and binds the SQL draft editor to it", async () => {
    const localPersistence = createInMemoryLocalPersistence({
      databaseConnections: [
        {
          id: "db-1",
          name: "Warehouse",
          host: "warehouse.internal",
          port: 3306,
          username: "readonly",
          passwordSecretId: "database-connection:db-1:password",
          defaultDatabase: "analytics",
        },
      ],
    });
    render(<App localPersistence={localPersistence} />);

    fireEvent.click(await screen.findByRole("button", { name: /new session for warehouse/i }));

    expect(await screen.findByText(/warehouse \/ analytics/i)).toBeInTheDocument();
    const sqlEditor = screen.getByRole("textbox", { name: /sql draft/i });

    fireEvent.change(sqlEditor, { target: { value: "select * from orders" } });

    await waitFor(() => expect(sqlEditor).toHaveValue("select * from orders"));
    await expect(localPersistence.querySessions.getRestoredQuerySession()).resolves.toMatchObject({
      databaseConnectionId: "db-1",
      connectionName: "Warehouse",
      defaultDatabase: "analytics",
      sqlDraft: "select * from orders",
      aiConversationHistory: [],
      executionResultMetadata: [],
    });
  });

  it("restores the most recent query session and SQL draft after app restart", async () => {
    const localPersistence = createInMemoryLocalPersistence({
      databaseConnections: [
        {
          id: "db-1",
          name: "Warehouse",
          host: "warehouse.internal",
          port: 3306,
          username: "readonly",
          passwordSecretId: "database-connection:db-1:password",
          defaultDatabase: "analytics",
        },
      ],
    });
    const { unmount } = render(<App localPersistence={localPersistence} />);

    fireEvent.click(await screen.findByRole("button", { name: /new session for warehouse/i }));
    fireEvent.change(await screen.findByRole("textbox", { name: /sql draft/i }), {
      target: { value: "select count(*) from orders" },
    });
    await screen.findByDisplayValue("select count(*) from orders");

    unmount();
    render(<App localPersistence={localPersistence} />);

    expect(await screen.findByText(/warehouse \/ analytics/i)).toBeInTheDocument();
    expect(await screen.findByRole("textbox", { name: /sql draft/i })).toHaveValue(
      "select count(*) from orders",
    );
  });
});
