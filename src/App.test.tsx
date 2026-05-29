import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import type {
  GenerateSqlFromQueryNeedInput,
  ModifySqlFromIntentInput,
  RepairSqlFromExecutionErrorInput,
} from "./sqlGeneration";
import {
  AI_PROVIDER_API_KEY_SECRET_ID,
  createInMemoryLocalPersistence,
  type CandidateTable,
  type DatabaseCatalogSnapshot,
} from "./platform/localPersistence";

const warehouseCatalog: DatabaseCatalogSnapshot = {
  connectionId: "db-1",
  database: "warehouse",
  refreshedAt: "2026-05-29T10:00:00Z",
  tables: [
    {
      name: "orders",
      comment: "Customer orders",
      columns: [
        {
          name: "id",
          dataType: "bigint",
          nullable: false,
          defaultValue: null,
          comment: "Primary identifier",
          isPrimaryKey: true,
        },
        {
          name: "customer_id",
          dataType: "bigint",
          nullable: false,
          defaultValue: null,
          comment: "Owning customer",
          isPrimaryKey: false,
        },
      ],
      indexes: [
        { name: "PRIMARY", kind: "primary", columns: ["id"] },
        { name: "idx_orders_customer", kind: "index", columns: ["customer_id"] },
      ],
      createTableDdl:
        "CREATE TABLE `orders` (`id` bigint NOT NULL, `customer_id` bigint NOT NULL)",
    },
  ],
};

const warehouseCatalogWithCustomers: DatabaseCatalogSnapshot = {
  ...warehouseCatalog,
  tables: [
    ...warehouseCatalog.tables,
    {
      name: "customers",
      comment: "Customer profile",
      columns: [
        {
          name: "id",
          dataType: "bigint",
          nullable: false,
          defaultValue: null,
          comment: "",
          isPrimaryKey: true,
        },
      ],
      indexes: [{ name: "PRIMARY", kind: "primary", columns: ["id"] }],
      createTableDdl: "CREATE TABLE `customers` (`id` bigint NOT NULL)",
    },
  ],
};

describe("Glimpse app shell", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("opens into the V0.2 workbench shell with only confirmed toolbar entry points", () => {
    render(<App localPersistence={createInMemoryLocalPersistence()} />);

    const workbench = screen.getByRole("main", { name: /glimpse v0\.2 workbench/i });
    expect(workbench).toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: /v0\.2 workbench toolbar/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /database connection tree/i }))
      .toBeInTheDocument();
    expect(screen.getByRole("region", { name: /sql editor/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /right-side content switcher/i }))
      .toBeInTheDocument();
    expect(screen.getByRole("region", { name: /active console result set/i }))
      .toBeInTheDocument();

    const toolbarButtons = screen
      .getAllByRole("button")
      .filter((button) => button.closest('[role="toolbar"]'))
      .map((button) => button.textContent);
    expect(toolbarButtons).toEqual([
      "Data Source Management",
      "Model Provider Management",
      "New Console",
      "Preferences",
      "SQL Run",
    ]);
    expect(workbench).not.toHaveTextContent("Theme preference");
  });

  it("opens directly into the V0.2 SQL workbench with setup empty states", () => {
    render(<App localPersistence={createInMemoryLocalPersistence()} />);

    expect(screen.getByRole("main", { name: /glimpse v0\.2 workbench/i })).toBeInTheDocument();
    expect(screen.queryByText(/first-run wizard/i)).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: /database connection tree/i }))
      .toBeInTheDocument();
    expect(screen.getByRole("region", { name: /sql editor/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /active console result set/i }))
      .toBeInTheDocument();
    expect(screen.getByRole("region", { name: /right-side content switcher/i }))
      .toBeInTheDocument();
    expect(screen.getByRole("region", { name: /ai assistant/i })).toBeInTheDocument();
    expect(screen.getByText(/configure global ai provider/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /data source management/i })).toBeInTheDocument();
    expect(screen.getByText(/no saved connections yet/i)).toBeInTheDocument();
  });

  it("renders saved database connections as first-level Database Connection Tree items", async () => {
    render(
      <App
        localPersistence={createInMemoryLocalPersistence({
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
            {
              id: "db-2",
              name: "Reporting",
              host: "reporting.internal",
              port: 4000,
              username: "analyst",
              passwordSecretId: "database-connection:db-2:password",
              defaultDatabase: "mart",
            },
          ],
        })}
      />,
    );

    const connectionTree = screen.getByRole("tree", { name: /database connection tree/i });

    expect(await screen.findByRole("treeitem", { name: /warehouse analytics/i }))
      .toBeInTheDocument();
    expect(screen.getByRole("treeitem", { name: /reporting mart/i })).toBeInTheDocument();
    expect(connectionTree).not.toHaveTextContent("orders");
    expect(connectionTree).not.toHaveTextContent("customers");
  });

  it("expands a saved connection into its default schema and table names", async () => {
    const localPersistence = createInMemoryLocalPersistence({
      databaseConnections: [
        {
          id: "db-1",
          name: "Warehouse",
          host: "warehouse.internal",
          port: 3306,
          username: "readonly",
          passwordSecretId: "database-connection:db-1:password",
          defaultDatabase: "warehouse",
        },
      ],
      readDatabaseCatalog: () => warehouseCatalogWithCustomers,
    });

    render(<App localPersistence={localPersistence} />);

    const connectionTree = screen.getByRole("tree", { name: /database connection tree/i });
    fireEvent.click(await screen.findByRole("button", { name: /expand warehouse/i }));

    expect(await screen.findByRole("treeitem", { name: /default schema warehouse/i }))
      .toBeInTheDocument();
    expect(connectionTree).toHaveTextContent("orders");
    expect(connectionTree).toHaveTextContent("customers");
  });

  it("shows an empty catalog state in the connection tree when the default schema has no tables", async () => {
    const emptyCatalog: DatabaseCatalogSnapshot = {
      ...warehouseCatalog,
      tables: [],
    };
    const localPersistence = createInMemoryLocalPersistence({
      databaseConnections: [
        {
          id: "db-1",
          name: "Warehouse",
          host: "warehouse.internal",
          port: 3306,
          username: "readonly",
          passwordSecretId: "database-connection:db-1:password",
          defaultDatabase: "warehouse",
        },
      ],
      readDatabaseCatalog: () => emptyCatalog,
    });

    render(<App localPersistence={localPersistence} />);

    const connectionTree = screen.getByRole("tree", { name: /database connection tree/i });
    fireEvent.click(await screen.findByRole("button", { name: /expand warehouse/i }));

    expect(await screen.findByRole("treeitem", { name: /default schema warehouse/i }))
      .toBeInTheDocument();
    expect(connectionTree).toHaveTextContent("No tables available in warehouse");
  });

  it("shows catalog loading state while expanding a connection tree item", async () => {
    let resolveCatalog: (catalog: DatabaseCatalogSnapshot) => void = () => {};
    const catalogPromise = new Promise<DatabaseCatalogSnapshot>((resolve) => {
      resolveCatalog = resolve;
    });
    const localPersistence = createInMemoryLocalPersistence({
      databaseConnections: [
        {
          id: "db-1",
          name: "Warehouse",
          host: "warehouse.internal",
          port: 3306,
          username: "readonly",
          passwordSecretId: "database-connection:db-1:password",
          defaultDatabase: "warehouse",
        },
      ],
      readDatabaseCatalog: () => catalogPromise,
    });

    render(<App localPersistence={localPersistence} />);

    const connectionTree = screen.getByRole("tree", { name: /database connection tree/i });
    fireEvent.click(await screen.findByRole("button", { name: /expand warehouse/i }));

    expect(connectionTree).toHaveTextContent("Reading catalog for warehouse");

    resolveCatalog(warehouseCatalog);
    expect(await screen.findByRole("treeitem", { name: /default schema warehouse/i }))
      .toBeInTheDocument();
  });

  it("keeps the connection tree at table level without field or index browsing", async () => {
    const localPersistence = createInMemoryLocalPersistence({
      databaseConnections: [
        {
          id: "db-1",
          name: "Warehouse",
          host: "warehouse.internal",
          port: 3306,
          username: "readonly",
          passwordSecretId: "database-connection:db-1:password",
          defaultDatabase: "warehouse",
        },
      ],
      readDatabaseCatalog: () => warehouseCatalog,
    });

    render(<App localPersistence={localPersistence} />);

    const connectionTree = screen.getByRole("tree", { name: /database connection tree/i });
    fireEvent.click(await screen.findByRole("button", { name: /expand warehouse/i }));

    expect(await screen.findByRole("treeitem", { name: /table orders/i })).toBeInTheDocument();
    expect(connectionTree).not.toHaveTextContent("customer_id");
    expect(connectionTree).not.toHaveTextContent("idx_orders_customer");
    expect(connectionTree).not.toHaveTextContent(/create table `orders`/i);
  });

  it("opens Data Source Management with saved data sources on the left and a create/edit form on the right", async () => {
    render(
      <App
        localPersistence={createInMemoryLocalPersistence({
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
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /data source management/i }));

    const dialog = screen.getByRole("dialog", { name: /data source management/i });
    expect(await screen.findByRole("list", { name: /saved data sources/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /warehouse analytics/i })).toBeInTheDocument();
    expect(dialog).toContainElement(
      screen.getByRole("form", { name: /database connection details/i }),
    );
    expect(screen.getByLabelText(/connection name/i)).toHaveValue("");
  });

  it("opens an empty Database Connection form from the add action after editing an existing data source", async () => {
    render(
      <App
        localPersistence={createInMemoryLocalPersistence({
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
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /data source management/i }));
    fireEvent.click(await screen.findByRole("button", { name: /warehouse analytics/i }));
    expect(screen.getByLabelText(/connection name/i)).toHaveValue("Warehouse");

    fireEvent.click(screen.getByRole("button", { name: /add database connection/i }));

    expect(screen.getByLabelText(/connection name/i)).toHaveValue("");
    expect(screen.getByLabelText(/^host$/i)).toHaveValue("");
    expect(screen.getByLabelText(/^port$/i)).toHaveValue("4000");
    expect(screen.getByLabelText(/^username$/i)).toHaveValue("");
    expect(screen.getByLabelText(/^password$/i)).toHaveValue("");
    expect(screen.getByLabelText(/default database/i)).toHaveValue("");
  });

  it("does not expose V0.1 out-of-scope entry points", () => {
    render(<App localPersistence={createInMemoryLocalPersistence()} />);

    const workbench = screen.getByRole("main", { name: /glimpse v0\.2 workbench/i });
    [
      /ssh tunnel/i,
      /csv export/i,
      /sql explanation/i,
      /sql autocomplete/i,
      /team sharing/i,
      /prompt template management/i,
    ].forEach((entryPoint) => {
      expect(workbench).not.toHaveTextContent(entryPoint);
    });
    expect(screen.queryByRole("button", { name: /csv/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /export/i })).not.toBeInTheDocument();
  });

  it.each(["light", "dark", "system"] as const)(
    "persists and restores the %s theme preference",
    async (themePreference) => {
      const localPersistence = createInMemoryLocalPersistence();
      const { unmount } = render(<App localPersistence={localPersistence} />);

      expect(screen.queryByRole("combobox", { name: /theme preference/i })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /^preferences$/i }));
      const preferencesDialog = screen.getByRole("dialog", { name: /preferences/i });
      const themeSelect = screen.getByRole("combobox", { name: /theme preference/i });
      expect(preferencesDialog).toContainElement(themeSelect);

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

      fireEvent.click(screen.getByRole("button", { name: /^preferences$/i }));
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

    fireEvent.click(screen.getByRole("button", { name: /data source management/i }));

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

    expect(await screen.findByRole("button", {
      name: /analytics tidb warehouse selected/i,
    })).toBeInTheDocument();
    expect(screen.getByRole("treeitem", { name: /analytics tidb warehouse/i }))
      .toBeInTheDocument();
    expect(screen.getByLabelText(/connection name/i)).toHaveValue("Analytics TiDB");

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

    expect(await screen.findByRole("treeitem", { name: /warehouse analytics/i }))
      .toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /data source management/i }));

    fireEvent.click(screen.getByRole("button", { name: /warehouse analytics/i }));
    expect(screen.getByLabelText(/connection name/i)).toHaveValue("Warehouse");
    fireEvent.change(screen.getByLabelText(/default database/i), {
      target: { value: "mart" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save connection/i }));

    expect(await screen.findByRole("button", { name: /warehouse mart selected/i }))
      .toBeInTheDocument();
    expect(screen.getByRole("treeitem", { name: /warehouse mart/i })).toBeInTheDocument();
    await expect(localPersistence.databaseConnections.listDatabaseConnections()).resolves.toEqual([
      expect.objectContaining({
        id: "db-1",
        defaultDatabase: "mart",
      }),
    ]);

    fireEvent.click(screen.getByRole("button", { name: /delete warehouse/i }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /warehouse mart/i })).not.toBeInTheDocument(),
    );
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

    fireEvent.click(screen.getByRole("button", { name: /data source management/i }));

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

  it("manages multiple model providers with a saved-provider list and create/edit form", async () => {
    const localPersistence = createInMemoryLocalPersistence({
      modelProviders: [
        {
          id: "provider-1",
          name: "OpenAI",
          baseUrl: "https://api.openai.com/v1",
          model: "gpt-5.5",
          temperature: 0.2,
          maxTokens: 1200,
          apiKeySecretId: "model-provider:provider-1:api-key",
          isDefault: true,
        },
        {
          id: "provider-2",
          name: "Local Proxy",
          baseUrl: "https://ai.example.test/v1",
          model: "glimpse-sql",
          temperature: 0.1,
          maxTokens: 800,
          apiKeySecretId: "model-provider:provider-2:api-key",
          isDefault: false,
        },
      ],
    });
    render(<App localPersistence={localPersistence} />);

    fireEvent.click(screen.getByRole("button", { name: /model provider management/i }));

    const dialog = await screen.findByRole("dialog", {
      name: /model provider management/i,
    });
    const modelProviderDialog = within(dialog);
    expect(dialog).toContainElement(
      screen.getByRole("list", { name: /saved model providers/i }),
    );
    expect(dialog).toContainElement(
      screen.getByRole("form", { name: /model provider form/i }),
    );
    expect(await screen.findByRole("button", { name: /openai default/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /local proxy/i })).toBeInTheDocument();

    fireEvent.click(modelProviderDialog.getByRole("button", { name: /add model provider/i }));
    expect(modelProviderDialog.getByLabelText(/provider name/i)).toHaveValue("");

    fireEvent.change(modelProviderDialog.getByLabelText(/provider name/i), {
      target: { value: "Anthropic Proxy" },
    });
    fireEvent.change(modelProviderDialog.getByLabelText(/base url/i), {
      target: { value: "https://anthropic-proxy.example.test/v1" },
    });
    fireEvent.change(modelProviderDialog.getByLabelText(/api key/i), {
      target: { value: "sk-provider-secret" },
    });
    fireEvent.change(modelProviderDialog.getByLabelText(/^model$/i), {
      target: { value: "claude-sql" },
    });
    fireEvent.change(modelProviderDialog.getByLabelText(/temperature/i), {
      target: { value: "0.3" },
    });
    fireEvent.change(modelProviderDialog.getByLabelText(/max tokens/i), {
      target: { value: "1600" },
    });
    fireEvent.click(modelProviderDialog.getByLabelText(/default model provider/i));
    fireEvent.click(modelProviderDialog.getByRole("button", { name: /save model provider/i }));

    expect(await screen.findByRole("button", { name: /anthropic proxy default selected/i }))
      .toBeInTheDocument();
    expect(modelProviderDialog.getByLabelText(/provider name/i)).toHaveValue("Anthropic Proxy");

    const providers = await localPersistence.modelProviders.listModelProviders();
    const savedProvider = providers.find((provider) => provider.name === "Anthropic Proxy");
    expect(savedProvider).toEqual(
      expect.objectContaining({
        baseUrl: "https://anthropic-proxy.example.test/v1",
        model: "claude-sql",
        isDefault: true,
      }),
    );
    expect(savedProvider).not.toHaveProperty("apiKey");
    await expect(localPersistence.modelProviders.getDefaultModelProvider()).resolves.toEqual(
      expect.objectContaining({ name: "Anthropic Proxy" }),
    );
    await expect(localPersistence.secrets.getSecret(savedProvider!.apiKeySecretId)).resolves.toBe(
      "sk-provider-secret",
    );

    fireEvent.click(screen.getByRole("button", { name: /local proxy/i }));
    fireEvent.click(screen.getByRole("button", { name: /set as default/i }));

    expect(await screen.findByRole("button", { name: /local proxy default selected/i }))
      .toBeInTheDocument();
    await expect(localPersistence.modelProviders.getDefaultModelProvider()).resolves.toEqual(
      expect.objectContaining({ id: "provider-2" }),
    );
  });

  it("opens a saved connection and displays catalog from only its default schema", async () => {
    const readScopes: Array<{ connectionId: string; defaultDatabase: string }> = [];
    const localPersistence = createInMemoryLocalPersistence({
      databaseConnections: [
        {
          id: "db-1",
          name: "Warehouse",
          host: "warehouse.internal",
          port: 3306,
          username: "readonly",
          passwordSecretId: "database-connection:db-1:password",
          defaultDatabase: "warehouse",
        },
      ],
      readDatabaseCatalog: (connection) => {
        readScopes.push({
          connectionId: connection.id,
          defaultDatabase: connection.defaultDatabase,
        });

        return warehouseCatalog;
      },
    });

    render(<App localPersistence={localPersistence} />);

    expect(await screen.findByText("Warehouse")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /open catalog warehouse/i }));

    const catalogRegion = await screen.findByRole("region", { name: /database catalog/i });
    expect(catalogRegion).toHaveTextContent("warehouse");
    expect(within(catalogRegion).getByText("orders")).toBeInTheDocument();
    expect(within(catalogRegion).getByText("Customer orders")).toBeInTheDocument();
    expect(within(catalogRegion).getByText("id bigint not null primary key")).toBeInTheDocument();
    expect(within(catalogRegion).getByText("idx_orders_customer index customer_id"))
      .toBeInTheDocument();
    expect(within(catalogRegion).getByText(/create table `orders`/i)).toBeInTheDocument();
    expect(readScopes).toEqual([{ connectionId: "db-1", defaultDatabase: "warehouse" }]);
    expect(JSON.stringify(readScopes)).not.toContain("mysql");
    expect(JSON.stringify(readScopes)).not.toContain("information_schema");
  });

  it("manually refreshes the catalog and updates the displayed cache", async () => {
    const refreshedCatalog: DatabaseCatalogSnapshot = {
      ...warehouseCatalog,
      refreshedAt: "2026-05-29T10:05:00Z",
      tables: [
        ...warehouseCatalog.tables,
        {
          name: "customers",
          comment: "Customer profile",
          columns: [
            {
              name: "id",
              dataType: "bigint",
              nullable: false,
              defaultValue: null,
              comment: "",
              isPrimaryKey: true,
            },
          ],
          indexes: [{ name: "PRIMARY", kind: "primary", columns: ["id"] }],
          createTableDdl: "CREATE TABLE `customers` (`id` bigint NOT NULL)",
        },
      ],
    };
    const catalogReads = [warehouseCatalog, refreshedCatalog];
    const localPersistence = createInMemoryLocalPersistence({
      databaseConnections: [
        {
          id: "db-1",
          name: "Warehouse",
          host: "warehouse.internal",
          port: 3306,
          username: "readonly",
          passwordSecretId: "database-connection:db-1:password",
          defaultDatabase: "warehouse",
        },
      ],
      readDatabaseCatalog: () => catalogReads.shift() ?? refreshedCatalog,
    });

    render(<App localPersistence={localPersistence} />);

    fireEvent.click(await screen.findByRole("button", { name: /open catalog warehouse/i }));
    const catalogRegion = screen.getByRole("region", { name: /database catalog/i });
    expect(await within(catalogRegion).findByText("orders")).toBeInTheDocument();
    expect(screen.queryByText("customers")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /refresh catalog/i }));

    expect(await within(catalogRegion).findByText("customers")).toBeInTheDocument();
    expect(within(catalogRegion).getByText(/2 tables loaded/i)).toBeInTheDocument();
    await expect(
      localPersistence.databaseCatalogs.getCatalogForSqlGeneration("db-1"),
    ).resolves.toEqual(refreshedCatalog);
  });

  it("shows metadata permission failure without invalidating the saved connection", async () => {
    const localPersistence = createInMemoryLocalPersistence({
      databaseConnections: [
        {
          id: "db-1",
          name: "Warehouse",
          host: "warehouse.internal",
          port: 3306,
          username: "readonly",
          passwordSecretId: "database-connection:db-1:password",
          defaultDatabase: "warehouse",
        },
      ],
      readDatabaseCatalog: () => {
        throw new Error("permission denied for information_schema");
      },
    });

    render(<App localPersistence={localPersistence} />);

    expect(await screen.findByText("Warehouse")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /open catalog warehouse/i }));

    const connectionTree = screen.getByRole("tree", { name: /database connection tree/i });
    await waitFor(() => expect(connectionTree).toHaveTextContent(/metadata permission failure/i));
    expect(connectionTree).toHaveTextContent(
      "permission denied",
    );
    expect(screen.getByText("Warehouse")).toBeInTheDocument();
    await expect(localPersistence.databaseConnections.listDatabaseConnections()).resolves.toEqual([
      expect.objectContaining({ id: "db-1", name: "Warehouse" }),
    ]);
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

    expect((await screen.findAllByText(/warehouse \/ analytics/i))[0]).toBeInTheDocument();
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

  it("creates a SQL Console from the selected Database Connection and never before selection", async () => {
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
        {
          id: "db-2",
          name: "Reporting",
          host: "reporting.internal",
          port: 4000,
          username: "analyst",
          passwordSecretId: "database-connection:db-2:password",
          defaultDatabase: "mart",
        },
      ],
    });
    render(<App localPersistence={localPersistence} />);

    const newConsoleButton = screen.getByRole("button", { name: /new console/i });
    expect(newConsoleButton).toBeDisabled();

    fireEvent.click(await screen.findByRole("treeitem", { name: /warehouse analytics/i }));
    expect(newConsoleButton).not.toBeDisabled();
    fireEvent.click(newConsoleButton);

    const sqlConsoleList = await screen.findByRole("list", { name: /sql console list/i });
    expect(
      within(sqlConsoleList).getByRole("button", {
        name: /open sql console warehouse analytics empty sql draft active/i,
      }),
    ).toBeInTheDocument();
    expect(within(sqlConsoleList).getByText(/warehouse \/ analytics/i)).toBeInTheDocument();
    await expect(localPersistence.querySessions.listQuerySessions()).resolves.toEqual([
      expect.objectContaining({
        databaseConnectionId: "db-1",
        connectionName: "Warehouse",
        defaultDatabase: "analytics",
      }),
    ]);
  });

  it("double-clicking a Database Connection opens its most recent SQL Console without creating another one", async () => {
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
        {
          id: "db-2",
          name: "Reporting",
          host: "reporting.internal",
          port: 4000,
          username: "analyst",
          passwordSecretId: "database-connection:db-2:password",
          defaultDatabase: "mart",
        },
      ],
    });
    const warehouseConsole = await localPersistence.querySessions.createQuerySession({
      databaseConnectionId: "db-1",
    });
    await localPersistence.querySessions.saveSqlDraft(
      warehouseConsole.id,
      "select * from warehouse_orders",
    );
    const reportingConsole = await localPersistence.querySessions.createQuerySession({
      databaseConnectionId: "db-2",
    });
    await localPersistence.querySessions.saveSqlDraft(reportingConsole.id, "select * from facts");

    render(<App localPersistence={localPersistence} />);

    expect(await screen.findByRole("textbox", { name: /sql draft/i })).toHaveValue(
      "select * from facts",
    );
    fireEvent.doubleClick(await screen.findByRole("treeitem", { name: /warehouse analytics/i }));

    expect(await screen.findByRole("textbox", { name: /sql draft/i })).toHaveValue(
      "select * from warehouse_orders",
    );
    await expect(localPersistence.querySessions.listQuerySessions()).resolves.toHaveLength(2);
  });

  it("double-clicking a Database Connection creates a SQL Console when none exists for it", async () => {
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

    fireEvent.doubleClick(await screen.findByRole("treeitem", { name: /warehouse analytics/i }));

    const sqlConsoleList = await screen.findByRole("list", { name: /sql console list/i });
    expect(
      within(sqlConsoleList).getByRole("button", {
        name: /open sql console warehouse analytics empty sql draft active/i,
      }),
    ).toBeInTheDocument();
    await expect(localPersistence.querySessions.listQuerySessions()).resolves.toEqual([
      expect.objectContaining({
        databaseConnectionId: "db-1",
        connectionName: "Warehouse",
        defaultDatabase: "analytics",
      }),
    ]);
  });

  it("switches the active SQL Console from the SQL Console List and shows its SQL Draft", async () => {
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
    const ordersConsole = await localPersistence.querySessions.createQuerySession({
      databaseConnectionId: "db-1",
    });
    await localPersistence.querySessions.saveSqlDraft(ordersConsole.id, "select * from orders");
    const customersConsole = await localPersistence.querySessions.createQuerySession({
      databaseConnectionId: "db-1",
    });
    await localPersistence.querySessions.saveSqlDraft(
      customersConsole.id,
      "select * from customers",
    );

    render(<App localPersistence={localPersistence} />);

    expect(await screen.findByRole("textbox", { name: /sql draft/i })).toHaveValue(
      "select * from customers",
    );
    const sqlConsoleList = await screen.findByRole("list", { name: /sql console list/i });
    fireEvent.click(
      within(sqlConsoleList).getByRole("button", {
        name: /open sql console warehouse analytics select \* from orders/i,
      }),
    );

    expect(await screen.findByRole("textbox", { name: /sql draft/i })).toHaveValue(
      "select * from orders",
    );
    expect(
      within(sqlConsoleList).getByRole("button", {
        name: /open sql console warehouse analytics select \* from orders active/i,
      }),
    ).toBeInTheDocument();
  });


  it("restores the active SQL Console's latest result set when switching back to it", async () => {
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
      executeSql: (input) => ({
        ok: true,
        rowCount: 1,
        columns: ["source_console"],
        rows: [[input.sql.includes("orders") ? "orders-result" : "customers-result"]],
      }),
    });
    const ordersConsole = await localPersistence.querySessions.createQuerySession({
      databaseConnectionId: "db-1",
    });
    await localPersistence.querySessions.saveSqlDraft(
      ordersConsole.id,
      "select source_console from orders limit 1",
    );
    const customersConsole = await localPersistence.querySessions.createQuerySession({
      databaseConnectionId: "db-1",
    });
    await localPersistence.querySessions.saveSqlDraft(
      customersConsole.id,
      "select source_console from customers limit 1",
    );

    render(<App localPersistence={localPersistence} />);

    fireEvent.click(await screen.findByRole("button", { name: /run sql in read-only mode/i }));
    expect(await screen.findByText("customers-result")).toBeInTheDocument();

    const sqlConsoleList = await screen.findByRole("list", { name: /sql console list/i });
    fireEvent.click(
      within(sqlConsoleList).getByRole("button", {
        name: /open sql console warehouse analytics select source_console from orders/i,
      }),
    );
    expect(await screen.findByText(/no query has run/i)).toBeInTheDocument();

    fireEvent.click(
      within(sqlConsoleList).getByRole("button", {
        name: /open sql console warehouse analytics select source_console from customers/i,
      }),
    );

    expect(await screen.findByText("customers-result")).toBeInTheDocument();
    expect(screen.queryByText("orders-result")).not.toBeInTheDocument();
  });

  it("keeps each SQL Console's latest success or error state separate while switching", async () => {
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
      executeSql: (input) =>
        input.sql.includes("broken_orders")
          ? {
              ok: false,
              errorMessage: "Unknown table 'broken_orders'",
            }
          : {
              ok: true,
              rowCount: 1,
              columns: ["console_name"],
              rows: [["customers-console"]],
            },
    });
    const ordersConsole = await localPersistence.querySessions.createQuerySession({
      databaseConnectionId: "db-1",
    });
    await localPersistence.querySessions.saveSqlDraft(
      ordersConsole.id,
      "select * from broken_orders limit 1",
    );
    const customersConsole = await localPersistence.querySessions.createQuerySession({
      databaseConnectionId: "db-1",
    });
    await localPersistence.querySessions.saveSqlDraft(
      customersConsole.id,
      "select console_name from customers limit 1",
    );

    render(<App localPersistence={localPersistence} />);

    fireEvent.click(await screen.findByRole("button", { name: /run sql in read-only mode/i }));
    expect(await screen.findByText("customers-console")).toBeInTheDocument();

    const sqlConsoleList = await screen.findByRole("list", { name: /sql console list/i });
    fireEvent.click(
      within(sqlConsoleList).getByRole("button", {
        name: /open sql console warehouse analytics select \* from broken_orders/i,
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: /sql draft/i })).toHaveValue(
        "select * from broken_orders limit 1",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /run sql in read-only mode/i }));

    expect(await screen.findByText(/execution failed: unknown table 'broken_orders'/i))
      .toBeInTheDocument();
    expect(screen.queryByText("customers-console")).not.toBeInTheDocument();

    fireEvent.click(
      within(sqlConsoleList).getByRole("button", {
        name: /open sql console warehouse analytics select console_name from customers/i,
      }),
    );

    expect(await screen.findByText("customers-console")).toBeInTheDocument();
    expect(screen.queryByText(/execution failed: unknown table 'broken_orders'/i))
      .not.toBeInTheDocument();
  });

  it("shows only the active SQL Console's latest result set without persistent result tabs", async () => {
    let executionCount = 0;
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
      executeSql: () => {
        executionCount += 1;

        return {
          ok: true,
          rowCount: 1,
          columns: ["run_label"],
          rows: [[executionCount === 1 ? "first-run-result" : "second-run-result"]],
        };
      },
    });

    render(<App localPersistence={localPersistence} />);

    fireEvent.click(await screen.findByRole("button", { name: /new session for warehouse/i }));
    fireEvent.change(await screen.findByRole("textbox", { name: /sql draft/i }), {
      target: { value: "select run_label from orders limit 1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /run sql in read-only mode/i }));
    expect(await screen.findByText("first-run-result")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /run sql in read-only mode/i }));

    const resultRegion = screen.getByRole("region", { name: /active console result set/i });
    expect(await within(resultRegion).findByText("second-run-result")).toBeInTheDocument();
    expect(within(resultRegion).queryByText("first-run-result")).not.toBeInTheDocument();
    expect(within(resultRegion).queryByRole("tab")).not.toBeInTheDocument();
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

    expect((await screen.findAllByText(/warehouse \/ analytics/i))[0]).toBeInTheDocument();
    expect(await screen.findByRole("textbox", { name: /sql draft/i })).toHaveValue(
      "select count(*) from orders",
    );
  });

  it("opens a historical Query Session with its saved draft, context, conversation, and execution metadata without result rows", async () => {
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
    const historicalSession = await localPersistence.querySessions.createQuerySession({
      databaseConnectionId: "db-1",
    });
    await localPersistence.querySessions.saveSqlDraft(
      historicalSession.id,
      "select id, private_value from orders limit 1",
    );
    await localPersistence.querySessions.saveCandidateTables(historicalSession.id, [
      { name: "orders", reason: "Contains private order facts" },
    ]);
    await localPersistence.querySessions.saveAiConversationHistory(historicalSession.id, [
      {
        id: "message-1",
        role: "user",
        content: "Show one private order",
        createdAt: "2026-05-29T10:00:00.000Z",
      },
      {
        id: "message-2",
        role: "assistant",
        content: "select id, private_value from orders limit 1",
        createdAt: "2026-05-29T10:00:01.000Z",
      },
    ]);
    await localPersistence.querySessions.saveExecutionResultMetadata(historicalSession.id, [
      {
        id: "execution-1",
        sql: "select id, private_value from orders limit 1",
        rowCount: 1,
        columns: ["id", "private_value"],
        executedAt: "2026-05-29T10:01:00.000Z",
        resultRows: [[1, "sensitive-row-value"]],
      } as never,
      {
        id: "execution-2",
        sql: "select missing_column from orders limit 1",
        rowCount: 0,
        columns: [],
        executedAt: "2026-05-29T10:02:00.000Z",
        errorMessage: "Unknown column 'missing_column'",
      },
    ]);
    const currentSession = await localPersistence.querySessions.createQuerySession({
      databaseConnectionId: "db-1",
    });
    await localPersistence.querySessions.saveSqlDraft(currentSession.id, "select 42");

    render(<App localPersistence={localPersistence} />);

    expect(await screen.findByRole("textbox", { name: /sql draft/i })).toHaveValue("select 42");

    fireEvent.click(
      screen.getByRole("button", {
        name: /open query session warehouse analytics select id, private_value/i,
      }),
    );

    expect(await screen.findByRole("textbox", { name: /sql draft/i })).toHaveValue(
      "select id, private_value from orders limit 1",
    );
    expect(screen.getByRole("region", { name: /candidate table set/i }))
      .toHaveTextContent("Contains private order facts");
    expect(screen.getByRole("region", { name: /ai conversation history/i }))
      .toHaveTextContent("Show one private order");
    expect(screen.getByRole("region", { name: /ai conversation history/i }))
      .toHaveTextContent("select id, private_value from orders limit 1");
    expect(screen.getByLabelText(/execution result metadata/i))
      .toHaveTextContent("Succeeded: 1 rows");
    expect(screen.getByLabelText(/execution result metadata/i))
      .toHaveTextContent("Failed: Unknown column 'missing_column'");
    expect(screen.getByLabelText(/execution result metadata/i))
      .toHaveTextContent("2026-05-29T10:01:00.000Z");
    expect(screen.queryByRole("table", { name: /current result set/i })).not.toBeInTheDocument();
    expect(screen.queryByText("sensitive-row-value")).not.toBeInTheDocument();
  });

  it("deletes one historical Query Session without changing the currently open session", async () => {
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
    const sessionToDelete = await localPersistence.querySessions.createQuerySession({
      databaseConnectionId: "db-1",
    });
    await localPersistence.querySessions.saveSqlDraft(sessionToDelete.id, "select * from orders");
    const currentSession = await localPersistence.querySessions.createQuerySession({
      databaseConnectionId: "db-1",
    });
    await localPersistence.querySessions.saveSqlDraft(currentSession.id, "select count(*)");

    render(<App localPersistence={localPersistence} />);

    expect(await screen.findByRole("textbox", { name: /sql draft/i }))
      .toHaveValue("select count(*)");

    fireEvent.click(
      screen.getByRole("button", {
        name: /delete query session warehouse analytics select \* from orders/i,
      }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("button", {
          name: /open query session warehouse analytics select \* from orders/i,
        }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("textbox", { name: /sql draft/i })).toHaveValue("select count(*)");
    await expect(localPersistence.querySessions.listQuerySessions()).resolves.toEqual([
      expect.objectContaining({
        id: currentSession.id,
        sqlDraft: "select count(*)",
      }),
    ]);
  });

  it("discovers candidate tables from a natural-language query and keeps the Query Session context adjustable", async () => {
    const localPersistence = createInMemoryLocalPersistence({
      aiConfiguration: {
        baseUrl: "https://ai.example.test/v1",
        model: "glimpse-sql",
        temperature: 0.2,
        maxTokens: 1000,
      },
      databaseConnections: [
        {
          id: "db-1",
          name: "Warehouse",
          host: "warehouse.internal",
          port: 3306,
          username: "readonly",
          passwordSecretId: "database-connection:db-1:password",
          defaultDatabase: "warehouse",
        },
      ],
      readDatabaseCatalog: () => warehouseCatalogWithCustomers,
    });
    await localPersistence.secrets.setSecret(AI_PROVIDER_API_KEY_SECRET_ID, "sk-test-secret");
    const candidateTableDiscoverer = vi.fn().mockResolvedValue([
      { name: "orders", reason: "Contains order facts" },
    ] satisfies CandidateTable[]);

    render(
      <App
        localPersistence={localPersistence}
        candidateTableDiscoverer={candidateTableDiscoverer}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /open catalog warehouse/i }));
    expect(
      await within(screen.getByRole("region", { name: /database catalog/i })).findByText(
        "customers",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /new session for warehouse/i }));
    fireEvent.change(await screen.findByRole("textbox", { name: /query need/i }), {
      target: { value: "Find monthly order totals" },
    });
    fireEvent.click(screen.getByRole("button", { name: /discover candidate tables/i }));

    const candidateTableSet = await screen.findByRole("region", {
      name: /candidate table set/i,
    });
    expect(candidateTableSet).toHaveTextContent("orders");
    expect(candidateTableSet).toHaveTextContent("Contains order facts");
    expect(screen.getByRole("button", { name: /remove orders/i })).toBeInTheDocument();
    await expect(localPersistence.querySessions.getRestoredQuerySession()).resolves.toMatchObject({
      candidateTables: [{ name: "orders", reason: "Contains order facts" }],
    });

    fireEvent.click(screen.getByRole("button", { name: /remove orders/i }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /remove orders/i })).not.toBeInTheDocument(),
    );
    await expect(localPersistence.querySessions.getRestoredQuerySession()).resolves.toMatchObject({
      candidateTables: [],
    });

    fireEvent.change(screen.getByRole("combobox", { name: /add candidate table/i }), {
      target: { value: "customers" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^add candidate table$/i }));

    expect(await screen.findByRole("button", { name: /remove customers/i })).toBeInTheDocument();
    await expect(localPersistence.querySessions.getRestoredQuerySession()).resolves.toMatchObject({
      candidateTables: [{ name: "customers", reason: "Added by user" }],
    });
    expect(candidateTableDiscoverer).toHaveBeenCalledWith(
      expect.objectContaining({
        queryNeed: "Find monthly order totals",
        apiKey: "sk-test-secret",
      }),
    );
  });

  it("generates SQL from the query need, streams it into the editor, and persists the conversation without executing", async () => {
    const executionAttempts: string[] = [];
    const localPersistence = createInMemoryLocalPersistence({
      aiConfiguration: {
        baseUrl: "https://ai.example.test/v1",
        model: "glimpse-sql",
        temperature: 0.2,
        maxTokens: 1000,
      },
      databaseConnections: [
        {
          id: "db-1",
          name: "Warehouse",
          host: "warehouse.internal",
          port: 3306,
          username: "readonly",
          passwordSecretId: "database-connection:db-1:password",
          defaultDatabase: "warehouse",
        },
      ],
      readDatabaseCatalog: () => warehouseCatalogWithCustomers,
      executeSql: (input) => {
        executionAttempts.push(input.sql);

        return {
          ok: true,
          rowCount: 0,
          columns: [],
          rows: [],
        };
      },
    });
    await localPersistence.secrets.setSecret(AI_PROVIDER_API_KEY_SECRET_ID, "sk-test-secret");
    const sqlGenerator = vi.fn(async ({ onPartialSql }: GenerateSqlFromQueryNeedInput) => {
      onPartialSql?.("select customer_id");
      onPartialSql?.(
        "select customer_id, count(*) as order_count from orders group by customer_id",
      );

      return "select customer_id, count(*) as order_count from orders group by customer_id";
    });

    render(<App localPersistence={localPersistence} sqlGenerator={sqlGenerator} />);

    fireEvent.click(await screen.findByRole("button", { name: /open catalog warehouse/i }));
    expect(
      await within(screen.getByRole("region", { name: /database catalog/i })).findByText(
        "customers",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /new session for warehouse/i }));
    fireEvent.change(await screen.findByRole("textbox", { name: /query need/i }), {
      target: { value: "Count orders by customer" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /add candidate table/i }), {
      target: { value: "orders" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^add candidate table$/i }));
    expect(await screen.findByRole("button", { name: /remove orders/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /generate sql/i }));

    const sqlEditor = await screen.findByRole("textbox", { name: /sql draft/i });
    await waitFor(() =>
      expect(sqlEditor).toHaveValue(
        "select customer_id, count(*) as order_count from orders group by customer_id",
      ),
    );
    expect(await screen.findByRole("button", { name: /run generated sql manually/i }))
      .toBeInTheDocument();
    expect(screen.getByText(/no query has run/i)).toBeInTheDocument();
    expect(executionAttempts).toEqual([]);
    expect(screen.queryByText(/sql explanation/i)).not.toBeInTheDocument();
    await expect(localPersistence.querySessions.getRestoredQuerySession()).resolves.toMatchObject({
      sqlDraft: "select customer_id, count(*) as order_count from orders group by customer_id",
      aiConversationHistory: [
        expect.objectContaining({
          role: "user",
          content: "Count orders by customer",
        }),
        expect.objectContaining({
          role: "assistant",
          content:
            "select customer_id, count(*) as order_count from orders group by customer_id",
        }),
      ],
      executionResultMetadata: [],
    });
    expect(sqlGenerator).toHaveBeenCalledWith(
      expect.objectContaining({
        queryNeed: "Count orders by customer",
        apiKey: "sk-test-secret",
        session: expect.objectContaining({
          candidateTables: [{ name: "orders", reason: "Added by user" }],
        }),
      }),
    );
  });

  it("uses the selected default model provider for AI SQL capabilities", async () => {
    const localPersistence = createInMemoryLocalPersistence({
      modelProviders: [
        {
          id: "provider-1",
          name: "OpenAI",
          baseUrl: "https://api.openai.com/v1",
          model: "gpt-5.5",
          temperature: 0.2,
          maxTokens: 1200,
          apiKeySecretId: "model-provider:provider-1:api-key",
          isDefault: false,
        },
        {
          id: "provider-2",
          name: "Default Proxy",
          baseUrl: "https://default-proxy.example.test/v1",
          model: "glimpse-sql-default",
          temperature: 0.1,
          maxTokens: 900,
          apiKeySecretId: "model-provider:provider-2:api-key",
          isDefault: true,
        },
      ],
      databaseConnections: [
        {
          id: "db-1",
          name: "Warehouse",
          host: "warehouse.internal",
          port: 3306,
          username: "readonly",
          passwordSecretId: "database-connection:db-1:password",
          defaultDatabase: "warehouse",
        },
      ],
      readDatabaseCatalog: () => warehouseCatalogWithCustomers,
    });
    await localPersistence.secrets.setSecret(
      "model-provider:provider-2:api-key",
      "sk-default-provider",
    );
    const sqlGenerator = vi.fn(async () => "select count(*) from orders");

    render(<App localPersistence={localPersistence} sqlGenerator={sqlGenerator} />);

    fireEvent.click(await screen.findByRole("button", { name: /open catalog warehouse/i }));
    expect(
      await within(screen.getByRole("region", { name: /database catalog/i })).findByText(
        "customers",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /new session for warehouse/i }));
    fireEvent.change(await screen.findByRole("textbox", { name: /query need/i }), {
      target: { value: "Count orders" },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate sql/i }));

    await screen.findByDisplayValue("select count(*) from orders");
    expect(sqlGenerator).toHaveBeenCalledWith(
      expect.objectContaining({
        configuration: {
          baseUrl: "https://default-proxy.example.test/v1",
          model: "glimpse-sql-default",
          temperature: 0.1,
          maxTokens: 900,
        },
        apiKey: "sk-default-provider",
      }),
    );
  });

  it("modifies the current SQL from a natural-language intent, streams it into the editor, and stores the Query Session history", async () => {
    const localPersistence = createInMemoryLocalPersistence({
      aiConfiguration: {
        baseUrl: "https://ai.example.test/v1",
        model: "glimpse-sql",
        temperature: 0.2,
        maxTokens: 1000,
      },
      databaseConnections: [
        {
          id: "db-1",
          name: "Warehouse",
          host: "warehouse.internal",
          port: 3306,
          username: "readonly",
          passwordSecretId: "database-connection:db-1:password",
          defaultDatabase: "warehouse",
        },
      ],
      readDatabaseCatalog: () => warehouseCatalogWithCustomers,
    });
    await localPersistence.secrets.setSecret(AI_PROVIDER_API_KEY_SECRET_ID, "sk-test-secret");
    const sqlModifier = vi.fn(async ({ onPartialSql }: ModifySqlFromIntentInput) => {
      onPartialSql?.("select id from orders");
      onPartialSql?.("select id from orders where created_at >= current_date - interval 30 day");

      return "select id from orders where created_at >= current_date - interval 30 day";
    });

    render(<App localPersistence={localPersistence} sqlModifier={sqlModifier} />);

    fireEvent.click(await screen.findByRole("button", { name: /open catalog warehouse/i }));
    expect(
      await within(screen.getByRole("region", { name: /database catalog/i })).findByText(
        "customers",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /new session for warehouse/i }));
    const sqlEditor = await screen.findByRole("textbox", { name: /sql draft/i });
    fireEvent.change(sqlEditor, { target: { value: "select id from orders" } });
    fireEvent.change(screen.getByRole("combobox", { name: /add candidate table/i }), {
      target: { value: "orders" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^add candidate table$/i }));
    expect(await screen.findByRole("button", { name: /remove orders/i })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: /modification intent/i }), {
      target: { value: "Add a date filter for the last 30 days" },
    });

    fireEvent.click(screen.getByRole("button", { name: /modify current sql/i }));

    await waitFor(() =>
      expect(sqlEditor).toHaveValue(
        "select id from orders where created_at >= current_date - interval 30 day",
      ),
    );
    await expect(localPersistence.querySessions.getRestoredQuerySession()).resolves.toMatchObject({
      sqlDraft: "select id from orders where created_at >= current_date - interval 30 day",
      aiConversationHistory: [
        expect.objectContaining({
          role: "user",
          content: "Add a date filter for the last 30 days",
        }),
        expect.objectContaining({
          role: "assistant",
          content: "select id from orders where created_at >= current_date - interval 30 day",
        }),
      ],
    });
    expect(sqlModifier).toHaveBeenCalledWith(
      expect.objectContaining({
        modificationIntent: "Add a date filter for the last 30 days",
        currentSql: "select id from orders",
        apiKey: "sk-test-secret",
        session: expect.objectContaining({
          candidateTables: [{ name: "orders", reason: "Added by user" }],
        }),
      }),
    );
  });

  it("executes read-only SQL only after a manual click and persists successful execution metadata", async () => {
    const executionAttempts: Array<{ connectionId: string; sql: string; safetyMode: string }> = [];
    const localPersistence = createInMemoryLocalPersistence({
      databaseConnections: [
        {
          id: "db-1",
          name: "Warehouse",
          host: "warehouse.internal",
          port: 3306,
          username: "readonly",
          passwordSecretId: "database-connection:db-1:password",
          defaultDatabase: "warehouse",
        },
      ],
      executeSql: (input) => {
        executionAttempts.push(input);

        return {
          ok: true,
          rowCount: 2,
          columns: ["id", "amount"],
          rows: [
            [1, 10],
            [2, 20],
          ],
        };
      },
    });

    render(<App localPersistence={localPersistence} />);

    fireEvent.click(await screen.findByRole("button", { name: /new session for warehouse/i }));
    fireEvent.change(await screen.findByRole("textbox", { name: /sql draft/i }), {
      target: { value: "select id, amount from orders" },
    });

    expect(executionAttempts).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: /run sql in read-only mode/i }));

    expect(await screen.findByText(/missing limit may return a large result set/i))
      .toBeInTheDocument();
    expect(await screen.findByText(/execution succeeded: 2 rows, 2 columns/i))
      .toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /sql draft/i })).toHaveValue(
      "select id, amount from orders",
    );
    expect(executionAttempts).toEqual([
      {
        connectionId: "db-1",
        sql: "select id, amount from orders",
        safetyMode: "readOnly",
      },
    ]);
    await expect(localPersistence.querySessions.getRestoredQuerySession()).resolves.toMatchObject({
      executionResultMetadata: [
        expect.objectContaining({
          sql: "select id, amount from orders",
          rowCount: 2,
          columns: ["id", "amount"],
          errorMessage: undefined,
        }),
      ],
    });
  });

  it("shows the current successful execution result in a basic horizontally scrollable table", async () => {
    const localPersistence = createInMemoryLocalPersistence({
      databaseConnections: [
        {
          id: "db-1",
          name: "Warehouse",
          host: "warehouse.internal",
          port: 3306,
          username: "readonly",
          passwordSecretId: "database-connection:db-1:password",
          defaultDatabase: "warehouse",
        },
      ],
      executeSql: () => ({
        ok: true,
        rowCount: 2,
        columns: ["id", "customer_name", "lifetime_value"],
        rows: [
          [1, "Acme", 1200],
          [2, "Globex", null],
        ],
      }),
    });

    render(<App localPersistence={localPersistence} />);

    fireEvent.click(await screen.findByRole("button", { name: /new session for warehouse/i }));
    fireEvent.change(await screen.findByRole("textbox", { name: /sql draft/i }), {
      target: { value: "select id, customer_name, lifetime_value from customers limit 10" },
    });
    fireEvent.click(screen.getByRole("button", { name: /run sql in read-only mode/i }));

    expect(await screen.findByRole("table", { name: /current result set/i }))
      .toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "#" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "customer_name" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Acme" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "NULL" })).toBeInTheDocument();
    expect(screen.getByLabelText(/scroll current result set horizontally/i))
      .toHaveClass("result-table-scroll");
  });

  it("shows column headers and an empty state for successful executions with no rows", async () => {
    const localPersistence = createInMemoryLocalPersistence({
      databaseConnections: [
        {
          id: "db-1",
          name: "Warehouse",
          host: "warehouse.internal",
          port: 3306,
          username: "readonly",
          passwordSecretId: "database-connection:db-1:password",
          defaultDatabase: "warehouse",
        },
      ],
      executeSql: () => ({
        ok: true,
        rowCount: 0,
        columns: ["id", "amount"],
        rows: [],
      }),
    });

    render(<App localPersistence={localPersistence} />);

    fireEvent.click(await screen.findByRole("button", { name: /new session for warehouse/i }));
    fireEvent.change(await screen.findByRole("textbox", { name: /sql draft/i }), {
      target: { value: "select id, amount from orders where false limit 10" },
    });
    fireEvent.click(screen.getByRole("button", { name: /run sql in read-only mode/i }));

    expect(await screen.findByRole("table", { name: /current result set/i }))
      .toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "amount" })).toBeInTheDocument();
    expect(screen.getByText(/no rows returned/i)).toBeInTheDocument();
  });

  it("lets users copy cells, rows, visible results, and the current SQL", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const localPersistence = createInMemoryLocalPersistence({
      databaseConnections: [
        {
          id: "db-1",
          name: "Warehouse",
          host: "warehouse.internal",
          port: 3306,
          username: "readonly",
          passwordSecretId: "database-connection:db-1:password",
          defaultDatabase: "warehouse",
        },
      ],
      executeSql: () => ({
        ok: true,
        rowCount: 2,
        columns: ["id", "customer_name", "lifetime_value"],
        rows: [
          [1, "Acme", 1200],
          [2, "Globex", null],
        ],
      }),
    });

    render(<App localPersistence={localPersistence} />);

    fireEvent.click(await screen.findByRole("button", { name: /new session for warehouse/i }));
    fireEvent.change(await screen.findByRole("textbox", { name: /sql draft/i }), {
      target: { value: "select id, customer_name, lifetime_value from customers limit 10" },
    });
    fireEvent.click(screen.getByRole("button", { name: /run sql in read-only mode/i }));
    await screen.findByRole("table", { name: /current result set/i });

    fireEvent.click(screen.getByRole("cell", { name: "Acme" }));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith("Acme"));

    fireEvent.click(screen.getByRole("rowheader", { name: "1" }));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith("1\tAcme\t1200"));

    fireEvent.click(screen.getByRole("button", { name: /copy visible results/i }));
    await waitFor(() =>
      expect(writeText).toHaveBeenLastCalledWith(
        "id\tcustomer_name\tlifetime_value\n1\tAcme\t1200\n2\tGlobex\tNULL",
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: /copy current sql/i }));
    await waitFor(() =>
      expect(writeText).toHaveBeenLastCalledWith(
        "select id, customer_name, lifetime_value from customers limit 10",
      ),
    );
    expect(screen.queryByRole("button", { name: /csv/i })).not.toBeInTheDocument();
  });

  it("does not carry result rows into Query Session history or newly opened sessions", async () => {
    const localPersistence = createInMemoryLocalPersistence({
      databaseConnections: [
        {
          id: "db-1",
          name: "Warehouse",
          host: "warehouse.internal",
          port: 3306,
          username: "readonly",
          passwordSecretId: "database-connection:db-1:password",
          defaultDatabase: "warehouse",
        },
      ],
      executeSql: () => ({
        ok: true,
        rowCount: 1,
        columns: ["id", "private_value"],
        rows: [[1, "sensitive-row-value"]],
      }),
    });

    render(<App localPersistence={localPersistence} />);

    fireEvent.click(await screen.findByRole("button", { name: /new session for warehouse/i }));
    fireEvent.change(await screen.findByRole("textbox", { name: /sql draft/i }), {
      target: { value: "select id, private_value from orders limit 1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /run sql in read-only mode/i }));

    expect(await screen.findByText("sensitive-row-value")).toBeInTheDocument();
    await expect(localPersistence.querySessions.getRestoredQuerySession()).resolves.toMatchObject({
      executionResultMetadata: [
        expect.objectContaining({
          rowCount: 1,
          columns: ["id", "private_value"],
        }),
      ],
    });
    await expect(localPersistence.querySessions.getRestoredQuerySession()).resolves.not.toEqual(
      expect.objectContaining({
        executionResultMetadata: expect.arrayContaining([
          expect.objectContaining({ rows: expect.any(Array) }),
        ]),
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: /new session for warehouse/i }));

    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: /sql draft/i })).toHaveValue(""),
    );
    expect(screen.queryByText("sensitive-row-value")).not.toBeInTheDocument();
  });

  it("persists failed read-only execution metadata and offers SQL repair without starting it automatically", async () => {
    const localPersistence = createInMemoryLocalPersistence({
      databaseConnections: [
        {
          id: "db-1",
          name: "Warehouse",
          host: "warehouse.internal",
          port: 3306,
          username: "readonly",
          passwordSecretId: "database-connection:db-1:password",
          defaultDatabase: "warehouse",
        },
      ],
      executeSql: () => ({
        ok: false,
        errorMessage: "Unknown column 'missing_column'",
      }),
    });

    render(<App localPersistence={localPersistence} />);

    fireEvent.click(await screen.findByRole("button", { name: /new session for warehouse/i }));
    fireEvent.change(await screen.findByRole("textbox", { name: /sql draft/i }), {
      target: { value: "select missing_column from orders limit 10" },
    });
    fireEvent.click(screen.getByRole("button", { name: /run sql in read-only mode/i }));

    expect(await screen.findByText(/execution failed: unknown column 'missing_column'/i))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: /repair sql/i })).toBeInTheDocument();
    await expect(localPersistence.querySessions.getRestoredQuerySession()).resolves.toMatchObject({
      executionResultMetadata: [
        expect.objectContaining({
          sql: "select missing_column from orders limit 10",
          rowCount: 0,
          columns: [],
          errorMessage: "Unknown column 'missing_column'",
        }),
      ],
    });
  });

  it("repairs SQL after an execution failure, streams it into the editor, and stores the repair conversation", async () => {
    const localPersistence = createInMemoryLocalPersistence({
      aiConfiguration: {
        baseUrl: "https://ai.example.test/v1",
        model: "glimpse-sql",
        temperature: 0.2,
        maxTokens: 1000,
      },
      databaseConnections: [
        {
          id: "db-1",
          name: "Warehouse",
          host: "warehouse.internal",
          port: 3306,
          username: "readonly",
          passwordSecretId: "database-connection:db-1:password",
          defaultDatabase: "warehouse",
        },
      ],
      readDatabaseCatalog: () => warehouseCatalogWithCustomers,
      executeSql: () => ({
        ok: false,
        errorMessage: "Unknown column 'missing_column'",
      }),
    });
    await localPersistence.secrets.setSecret(AI_PROVIDER_API_KEY_SECRET_ID, "sk-test-secret");
    const sqlRepairer = vi.fn(async ({ onPartialSql }: RepairSqlFromExecutionErrorInput) => {
      onPartialSql?.("select id");
      onPartialSql?.("select id from orders limit 10");

      return "select id from orders limit 10";
    });

    render(<App localPersistence={localPersistence} sqlRepairer={sqlRepairer} />);

    fireEvent.click(await screen.findByRole("button", { name: /open catalog warehouse/i }));
    expect(
      await within(screen.getByRole("region", { name: /database catalog/i })).findByText(
        "customers",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /new session for warehouse/i }));
    const sqlEditor = await screen.findByRole("textbox", { name: /sql draft/i });
    fireEvent.change(sqlEditor, {
      target: { value: "select missing_column from orders limit 10" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /add candidate table/i }), {
      target: { value: "orders" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^add candidate table$/i }));
    expect(await screen.findByRole("button", { name: /remove orders/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /run sql in read-only mode/i }));
    expect(await screen.findByText(/execution failed: unknown column 'missing_column'/i))
      .toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: /repair sql/i }));

    await waitFor(() => expect(sqlEditor).toHaveValue("select id from orders limit 10"));
    await expect(localPersistence.querySessions.getRestoredQuerySession()).resolves.toMatchObject({
      sqlDraft: "select id from orders limit 10",
      aiConversationHistory: [
        expect.objectContaining({
          role: "user",
          content:
            "Repair SQL after execution error: Unknown column 'missing_column'",
        }),
        expect.objectContaining({
          role: "assistant",
          content: "select id from orders limit 10",
        }),
      ],
      executionResultMetadata: [
        expect.objectContaining({
          sql: "select missing_column from orders limit 10",
          errorMessage: "Unknown column 'missing_column'",
        }),
      ],
    });
    expect(sqlRepairer).toHaveBeenCalledWith(
      expect.objectContaining({
        currentSql: "select missing_column from orders limit 10",
        errorMessage: "Unknown column 'missing_column'",
        dialect: "mysql",
        apiKey: "sk-test-secret",
        session: expect.objectContaining({
          candidateTables: [{ name: "orders", reason: "Added by user" }],
        }),
        catalog: expect.objectContaining({
          database: "warehouse",
        }),
      }),
    );
  });

  it.each([
    ["write", "delete from orders", /read-only mode blocks delete statements/i],
    [
      "schema-changing",
      "alter table orders add column private_note text",
      /read-only mode blocks alter statements/i,
    ],
  ])("blocks %s SQL before execution in Read-only Mode", async (_kind, sql, blockedReason) => {
    const executionAttempts: string[] = [];
    const localPersistence = createInMemoryLocalPersistence({
      databaseConnections: [
        {
          id: "db-1",
          name: "Warehouse",
          host: "warehouse.internal",
          port: 3306,
          username: "readonly",
          passwordSecretId: "database-connection:db-1:password",
          defaultDatabase: "warehouse",
        },
      ],
      executeSql: (input) => {
        executionAttempts.push(input.sql);

        return {
          ok: true,
          rowCount: 0,
          columns: [],
          rows: [],
        };
      },
    });

    render(<App localPersistence={localPersistence} />);

    fireEvent.click(await screen.findByRole("button", { name: /new session for warehouse/i }));
    fireEvent.change(await screen.findByRole("textbox", { name: /sql draft/i }), {
      target: { value: sql },
    });
    fireEvent.click(screen.getByRole("button", { name: /run sql in read-only mode/i }));

    expect(await screen.findByText(blockedReason)).toBeInTheDocument();
    expect(executionAttempts).toEqual([]);
    await expect(localPersistence.querySessions.getRestoredQuerySession()).resolves.toMatchObject({
      executionResultMetadata: [],
    });
  });
});
