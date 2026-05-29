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
});
