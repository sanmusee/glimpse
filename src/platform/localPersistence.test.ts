import { describe, expect, it } from "vitest";
import { createTauriLocalPersistence } from "./localPersistence";

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
});
