import { invoke as tauriInvoke } from "@tauri-apps/api/core";

export type ThemePreference = "system" | "light" | "dark";
type TauriInvoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

export const AI_PROVIDER_API_KEY_SECRET_ID = "global-ai-provider-api-key";

export interface GlobalAiConfiguration {
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface PreferenceStore {
  getThemePreference(): Promise<ThemePreference>;
  setThemePreference(themePreference: ThemePreference): Promise<void>;
}

export interface AiConfigurationStore {
  getGlobalAiConfiguration(): Promise<GlobalAiConfiguration | null>;
  saveGlobalAiConfiguration(configuration: GlobalAiConfiguration): Promise<void>;
}

export interface SecretStore {
  getSecret(secretId: string): Promise<string | null>;
  setSecret(secretId: string, secretValue: string): Promise<void>;
  deleteSecret(secretId: string): Promise<void>;
}

export interface DatabaseConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  passwordSecretId: string;
  defaultDatabase: string;
}

export interface DatabaseConnectionInput {
  id?: string;
  name: string;
  host: string;
  port: number;
  username: string;
  passwordSecretId?: string;
  password?: string;
  defaultDatabase: string;
}

export type DatabaseConnectionTestResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export interface DatabaseConnectionStore {
  listDatabaseConnections(): Promise<DatabaseConnection[]>;
  saveDatabaseConnection(input: DatabaseConnectionInput): Promise<DatabaseConnection>;
  deleteDatabaseConnection(id: string): Promise<void>;
  testDatabaseConnection(input: DatabaseConnectionInput): Promise<DatabaseConnectionTestResult>;
}

export interface LocalPersistence {
  preferences: PreferenceStore;
  aiConfiguration: AiConfigurationStore;
  secrets: SecretStore;
  databaseConnections: DatabaseConnectionStore;
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function createInMemoryLocalPersistence(initial?: {
  themePreference?: ThemePreference;
  aiConfiguration?: GlobalAiConfiguration | null;
  databaseConnections?: DatabaseConnection[];
  testDatabaseConnection?: (
    input: DatabaseConnectionInput,
  ) => Promise<DatabaseConnectionTestResult> | DatabaseConnectionTestResult;
}): LocalPersistence {
  let themePreference = initial?.themePreference ?? "system";
  let aiConfiguration = initial?.aiConfiguration ?? null;
  const secrets = new Map<string, string>();
  const databaseConnections = new Map<string, DatabaseConnection>(
    initial?.databaseConnections?.map((connection) => [connection.id, connection]) ?? [],
  );

  return {
    preferences: {
      async getThemePreference() {
        return themePreference;
      },
      async setThemePreference(nextThemePreference) {
        themePreference = nextThemePreference;
      },
    },
    aiConfiguration: {
      async getGlobalAiConfiguration() {
        return aiConfiguration;
      },
      async saveGlobalAiConfiguration(nextConfiguration) {
        aiConfiguration = nextConfiguration;
      },
    },
    secrets: {
      async getSecret(secretId) {
        return secrets.get(secretId) ?? null;
      },
      async setSecret(secretId, secretValue) {
        secrets.set(secretId, secretValue);
      },
      async deleteSecret(secretId) {
        secrets.delete(secretId);
      },
    },
    databaseConnections: {
      async listDatabaseConnections() {
        return Array.from(databaseConnections.values());
      },
      async saveDatabaseConnection(input) {
        const id = input.id ?? createLocalId();
        const passwordSecretId = input.passwordSecretId ?? `database-connection:${id}:password`;
        const savedConnection: DatabaseConnection = {
          id,
          name: input.name,
          host: input.host,
          port: input.port,
          username: input.username,
          passwordSecretId,
          defaultDatabase: input.defaultDatabase,
        };

        databaseConnections.set(id, savedConnection);

        if (input.password) {
          secrets.set(passwordSecretId, input.password);
        }

        return savedConnection;
      },
      async deleteDatabaseConnection(id) {
        const existingConnection = databaseConnections.get(id);
        databaseConnections.delete(id);

        if (existingConnection) {
          secrets.delete(existingConnection.passwordSecretId);
        }
      },
      async testDatabaseConnection(input) {
        if (initial?.testDatabaseConnection) {
          return initial.testDatabaseConnection(input);
        }

        return { ok: true, message: "Connection test succeeded" };
      },
    },
  };
}

export const browserPreviewLocalPersistence = createInMemoryLocalPersistence();

export function createTauriLocalPersistence(invoke: TauriInvoke = tauriInvoke): LocalPersistence {
  return {
    preferences: {
      async getThemePreference() {
        const storedThemePreference = await invoke("get_theme_preference");
        return isThemePreference(storedThemePreference) ? storedThemePreference : "system";
      },
      async setThemePreference(themePreference) {
        await invoke("set_theme_preference", { themePreference });
      },
    },
    aiConfiguration: {
      async getGlobalAiConfiguration() {
        const configuration = await invoke("get_global_ai_configuration");
        return isGlobalAiConfiguration(configuration) ? configuration : null;
      },
      async saveGlobalAiConfiguration(configuration) {
        await invoke("save_global_ai_configuration", { configuration });
      },
    },
    secrets: {
      async getSecret(secretId) {
        const secretValue = await invoke("get_secret", { secretId });
        return typeof secretValue === "string" ? secretValue : null;
      },
      async setSecret(secretId, secretValue) {
        await invoke("set_secret", { secretId, secretValue });
      },
      async deleteSecret(secretId) {
        await invoke("delete_secret", { secretId });
      },
    },
    databaseConnections: {
      async listDatabaseConnections() {
        const connections = await invoke("list_database_connections");
        return Array.isArray(connections) ? (connections as DatabaseConnection[]) : [];
      },
      async saveDatabaseConnection(input) {
        const id = input.id ?? createLocalId();
        const passwordSecretId = input.passwordSecretId ?? `database-connection:${id}:password`;
        const connection = {
          id,
          name: input.name,
          host: input.host,
          port: input.port,
          username: input.username,
          passwordSecretId,
          defaultDatabase: input.defaultDatabase,
        };

        await invoke("save_database_connection", { connection });

        if (input.password) {
          await invoke("set_secret", { secretId: passwordSecretId, secretValue: input.password });
        }

        return connection;
      },
      async deleteDatabaseConnection(id) {
        await invoke("delete_database_connection", { id });
      },
      async testDatabaseConnection(input) {
        const result = await invoke("test_database_connection", { input });
        return isDatabaseConnectionTestResult(result)
          ? result
          : { ok: false, message: "Connection test returned an invalid response" };
      },
    },
  };
}

export function createDefaultLocalPersistence(): LocalPersistence {
  const isTauriRuntime =
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  return isTauriRuntime ? createTauriLocalPersistence() : browserPreviewLocalPersistence;
}

export const defaultLocalPersistence = createDefaultLocalPersistence();

function createLocalId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isGlobalAiConfiguration(value: unknown): value is GlobalAiConfiguration {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.baseUrl === "string" &&
    typeof candidate.model === "string" &&
    typeof candidate.temperature === "number" &&
    typeof candidate.maxTokens === "number"
  );
}

function isDatabaseConnectionTestResult(
  value: unknown,
): value is DatabaseConnectionTestResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as { ok?: unknown; message?: unknown };
  return typeof candidate.ok === "boolean" && typeof candidate.message === "string";
}
