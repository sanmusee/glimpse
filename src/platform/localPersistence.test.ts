import { describe, expect, it } from "vitest";
import {
  AI_PROVIDER_API_KEY_SECRET_ID,
  createInMemoryLocalPersistence,
  createTauriLocalPersistence,
} from "./localPersistence";

describe("local persistence boundary", () => {
  it("routes theme preference through desktop SQLite commands", async () => {
    const calls: Array<{ command: string; args?: unknown }> = [];
    const localPersistence = createTauriLocalPersistence(async (command, args) => {
      calls.push({ command, args });
      return command === "get_theme_preference" ? "dark" : null;
    });

    await expect(localPersistence.preferences.getThemePreference()).resolves.toBe("dark");
    await localPersistence.preferences.setThemePreference("light");

    expect(calls).toEqual([
      { command: "get_theme_preference", args: undefined },
      { command: "set_theme_preference", args: { themePreference: "light" } },
    ]);
  });

  it("routes secrets through desktop Keychain commands", async () => {
    const calls: Array<{ command: string; args?: unknown }> = [];
    const localPersistence = createTauriLocalPersistence(async (command, args) => {
      calls.push({ command, args });
      return command === "get_secret" ? "secret-value" : null;
    });

    await expect(localPersistence.secrets.getSecret("ai-provider-api-key")).resolves.toBe(
      "secret-value",
    );
    await localPersistence.secrets.setSecret("database-password", "secret-value");
    await localPersistence.secrets.deleteSecret("database-password");

    expect(calls).toEqual([
      { command: "get_secret", args: { secretId: "ai-provider-api-key" } },
      {
        command: "set_secret",
        args: { secretId: "database-password", secretValue: "secret-value" },
      },
      { command: "delete_secret", args: { secretId: "database-password" } },
    ]);
  });

  it("routes global AI configuration through SQLite commands without the API key", async () => {
    const calls: Array<{ command: string; args?: unknown }> = [];
    const localPersistence = createTauriLocalPersistence(async (command, args) => {
      calls.push({ command, args });
      return command === "get_global_ai_configuration"
        ? {
            baseUrl: "https://api.example.test/v1",
            model: "gpt-4.1-mini",
            temperature: 0.2,
            maxTokens: 1200,
          }
        : null;
    });

    await expect(localPersistence.aiConfiguration.getGlobalAiConfiguration()).resolves.toEqual({
      baseUrl: "https://api.example.test/v1",
      model: "gpt-4.1-mini",
      temperature: 0.2,
      maxTokens: 1200,
    });
    await localPersistence.aiConfiguration.saveGlobalAiConfiguration({
      baseUrl: "https://api.example.test/v1",
      model: "gpt-4.1-mini",
      temperature: 0.2,
      maxTokens: 1200,
    });

    expect(JSON.stringify(calls)).not.toContain("sk-test-secret");
    expect(calls).toEqual([
      { command: "get_global_ai_configuration", args: undefined },
      {
        command: "save_global_ai_configuration",
        args: {
          configuration: {
            baseUrl: "https://api.example.test/v1",
            model: "gpt-4.1-mini",
            temperature: 0.2,
            maxTokens: 1200,
          },
        },
      },
    ]);
  });

  it("keeps database passwords and AI API keys out of SQLite command payloads", async () => {
    const calls: Array<{ command: string; args?: unknown }> = [];
    const localPersistence = createTauriLocalPersistence(async (command, args) => {
      calls.push({ command, args });
      return null;
    });

    await localPersistence.aiConfiguration.saveGlobalAiConfiguration({
      baseUrl: "https://api.example.test/v1",
      model: "gpt-4.1-mini",
      temperature: 0.2,
      maxTokens: 1200,
    });
    await localPersistence.secrets.setSecret(
      AI_PROVIDER_API_KEY_SECRET_ID,
      "sk-plaintext-api-key",
    );
    await localPersistence.databaseConnections.saveDatabaseConnection({
      id: "db-1",
      name: "Warehouse",
      host: "warehouse.internal",
      port: 3306,
      username: "readonly",
      password: "plaintext-database-password",
      defaultDatabase: "warehouse",
    });

    const sqliteCalls = calls.filter(({ command }) => command !== "set_secret");

    expect(JSON.stringify(sqliteCalls)).not.toContain("sk-plaintext-api-key");
    expect(JSON.stringify(sqliteCalls)).not.toContain("plaintext-database-password");
    expect(calls.filter(({ command }) => command === "set_secret")).toEqual([
      {
        command: "set_secret",
        args: {
          secretId: AI_PROVIDER_API_KEY_SECRET_ID,
          secretValue: "sk-plaintext-api-key",
        },
      },
      {
        command: "set_secret",
        args: {
          secretId: "database-connection:db-1:password",
          secretValue: "plaintext-database-password",
        },
      },
    ]);
  });

  it("routes database connection metadata through SQLite commands and passwords through Keychain", async () => {
    const calls: Array<{ command: string; args?: Record<string, unknown> }> = [];
    const localPersistence = createTauriLocalPersistence(async (command, args) => {
      calls.push({ command, args });

      if (command === "list_database_connections") {
        return [
          {
            id: "db-1",
            name: "Warehouse",
            host: "warehouse.internal",
            port: 3306,
            username: "readonly",
            passwordSecretId: "database-connection:db-1:password",
            defaultDatabase: "warehouse",
          },
        ];
      }

      if (command === "test_database_connection") {
        return { ok: true, message: "Connected" };
      }

      return null;
    });

    await expect(localPersistence.databaseConnections.listDatabaseConnections()).resolves.toEqual([
      expect.objectContaining({ id: "db-1", name: "Warehouse" }),
    ]);
    await localPersistence.databaseConnections.saveDatabaseConnection({
      id: "db-2",
      name: "Analytics",
      host: "analytics.internal",
      port: 4000,
      username: "analyst",
      password: "not-in-sqlite",
      defaultDatabase: "analytics",
    });
    await expect(
      localPersistence.databaseConnections.testDatabaseConnection({
        id: "db-2",
        name: "Analytics",
        host: "analytics.internal",
        port: 4000,
        username: "analyst",
        password: "not-in-sqlite",
        defaultDatabase: "analytics",
      }),
    ).resolves.toEqual({ ok: true, message: "Connected" });
    await localPersistence.databaseConnections.deleteDatabaseConnection("db-2");

    expect(calls).toEqual([
      { command: "list_database_connections", args: undefined },
      {
        command: "save_database_connection",
        args: {
          connection: {
            id: "db-2",
            name: "Analytics",
            host: "analytics.internal",
            port: 4000,
            username: "analyst",
            passwordSecretId: "database-connection:db-2:password",
            defaultDatabase: "analytics",
          },
        },
      },
      {
        command: "set_secret",
        args: {
          secretId: "database-connection:db-2:password",
          secretValue: "not-in-sqlite",
        },
      },
      {
        command: "test_database_connection",
        args: {
          input: {
            id: "db-2",
            name: "Analytics",
            host: "analytics.internal",
            port: 4000,
            username: "analyst",
            password: "not-in-sqlite",
            defaultDatabase: "analytics",
          },
        },
      },
      { command: "delete_database_connection", args: { id: "db-2" } },
    ]);
  });

  it("routes catalog open and manual refresh through metadata commands while SQL generation uses only cached catalog", async () => {
    const calls: Array<{ command: string; args?: unknown }> = [];
    const catalog = {
      connectionId: "db-1",
      database: "warehouse",
      refreshedAt: "2026-05-29T10:00:00Z",
      tables: [
        {
          name: "orders",
          comment: "",
          columns: [],
          indexes: [],
          createTableDdl: "CREATE TABLE `orders` (`id` bigint)",
        },
      ],
    };
    const localPersistence = createTauriLocalPersistence(async (command, args) => {
      calls.push({ command, args });

      if (
        command === "open_connection_catalog" ||
        command === "refresh_connection_catalog" ||
        command === "get_cached_catalog"
      ) {
        return catalog;
      }

      return null;
    });

    await expect(localPersistence.databaseCatalogs.openConnectionCatalog("db-1")).resolves.toEqual(
      catalog,
    );
    await expect(localPersistence.databaseCatalogs.refreshCatalog("db-1")).resolves.toEqual(
      catalog,
    );
    await expect(
      localPersistence.databaseCatalogs.getCatalogForSqlGeneration("db-1"),
    ).resolves.toEqual(catalog);

    expect(calls).toEqual([
      { command: "open_connection_catalog", args: { connectionId: "db-1" } },
      { command: "refresh_connection_catalog", args: { connectionId: "db-1" } },
      { command: "get_cached_catalog", args: { connectionId: "db-1" } },
    ]);
  });

  it("uses cached catalog for SQL generation context without implicit metadata refresh", async () => {
    let metadataReads = 0;
    const catalog = {
      connectionId: "db-1",
      database: "warehouse",
      refreshedAt: "2026-05-29T10:00:00Z",
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
      readDatabaseCatalog: () => {
        metadataReads += 1;
        return catalog;
      },
    });

    await localPersistence.databaseCatalogs.openConnectionCatalog("db-1");
    await expect(
      localPersistence.databaseCatalogs.getCatalogForSqlGeneration("db-1"),
    ).resolves.toEqual(catalog);
    await expect(
      localPersistence.databaseCatalogs.getCatalogForSqlGeneration("db-1"),
    ).resolves.toEqual(catalog);

    expect(metadataReads).toBe(1);
  });

  it("routes query sessions through SQLite commands and strips result rows from execution metadata", async () => {
    const calls: Array<{ command: string; args?: Record<string, unknown> }> = [];
    const restoredSession = {
      id: "session-1",
      databaseConnectionId: "db-1",
      connectionName: "Warehouse",
      defaultDatabase: "analytics",
      sqlDraft: "select 1",
      aiConversationHistory: [],
      executionResultMetadata: [],
      candidateTables: [],
      createdAt: "2026-05-29T00:00:00.000Z",
      updatedAt: "2026-05-29T00:00:00.000Z",
    };
    const localPersistence = createTauriLocalPersistence(async (command, args) => {
      calls.push({ command, args });

      if (command === "list_query_sessions") {
        return [restoredSession];
      }

      if (
        command === "create_query_session" ||
        command === "get_restored_query_session" ||
        command === "open_query_session" ||
        command === "save_query_session_sql_draft" ||
        command === "save_query_session_ai_conversation_history" ||
        command === "save_query_session_execution_metadata"
      ) {
        return restoredSession;
      }

      return null;
    });

    await expect(localPersistence.querySessions.listQuerySessions()).resolves.toEqual([
      restoredSession,
    ]);
    await localPersistence.querySessions.createQuerySession({ databaseConnectionId: "db-1" });
    await localPersistence.querySessions.getRestoredQuerySession();
    await localPersistence.querySessions.openQuerySession("session-1");
    await localPersistence.querySessions.saveSqlDraft("session-1", "select * from orders");
    await localPersistence.querySessions.saveAiConversationHistory("session-1", [
      {
        id: "message-1",
        role: "user",
        content: "show revenue",
        createdAt: "2026-05-29T00:01:00.000Z",
      },
    ]);
    await localPersistence.querySessions.saveCandidateTables("session-1", [
      { name: "orders", reason: "Contains order facts" },
    ]);
    await localPersistence.querySessions.saveExecutionResultMetadata("session-1", [
      {
        id: "execution-1",
        sql: "select * from orders",
        rowCount: 2,
        columns: ["id", "amount"],
        executedAt: "2026-05-29T00:02:00.000Z",
        resultRows: [{ id: 1, amount: "sensitive-row-value" }],
      } as never,
    ]);
    await localPersistence.querySessions.deleteQuerySession("session-1");

    expect(JSON.stringify(calls)).not.toContain("sensitive-row-value");
    expect(calls).toEqual([
      { command: "list_query_sessions", args: undefined },
      {
        command: "create_query_session",
        args: { input: { databaseConnectionId: "db-1" } },
      },
      { command: "get_restored_query_session", args: undefined },
      { command: "open_query_session", args: { sessionId: "session-1" } },
      {
        command: "save_query_session_sql_draft",
        args: { sessionId: "session-1", sqlDraft: "select * from orders" },
      },
      {
        command: "save_query_session_ai_conversation_history",
        args: {
          sessionId: "session-1",
          entries: [
            {
              id: "message-1",
              role: "user",
              content: "show revenue",
              createdAt: "2026-05-29T00:01:00.000Z",
            },
          ],
        },
      },
      {
        command: "save_query_session_candidate_tables",
        args: {
          sessionId: "session-1",
          candidateTables: [{ name: "orders", reason: "Contains order facts" }],
        },
      },
      {
        command: "save_query_session_execution_metadata",
        args: {
          sessionId: "session-1",
          metadata: [
            {
              id: "execution-1",
              sql: "select * from orders",
              rowCount: 2,
              columns: ["id", "amount"],
              executedAt: "2026-05-29T00:02:00.000Z",
              errorMessage: undefined,
            },
          ],
        },
      },
      { command: "delete_query_session", args: { sessionId: "session-1" } },
    ]);
  });

  it("routes SQL execution through the desktop command with the selected safety mode", async () => {
    const calls: Array<{ command: string; args?: unknown }> = [];
    const localPersistence = createTauriLocalPersistence(async (command, args) => {
      calls.push({ command, args });

      if (command === "execute_sql") {
        return {
          ok: true,
          rowCount: 2,
          columns: ["id", "amount"],
          rows: [
            [1, 10],
            [2, 20],
          ],
        };
      }

      return null;
    });

    await expect(
      localPersistence.sqlExecution.executeSql({
        connectionId: "db-1",
        sql: "select id, amount from orders",
        safetyMode: "readOnly",
      }),
    ).resolves.toEqual({
      ok: true,
      rowCount: 2,
      columns: ["id", "amount"],
      rows: [
        [1, 10],
        [2, 20],
      ],
    });

    expect(calls).toEqual([
      {
        command: "execute_sql",
        args: {
          input: {
            connectionId: "db-1",
            sql: "select id, amount from orders",
            safetyMode: "readOnly",
          },
        },
      },
    ]);
  });
});
