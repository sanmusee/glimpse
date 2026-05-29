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

export interface QuerySession {
  id: string;
  databaseConnectionId: string;
  connectionName: string;
  defaultDatabase: string;
  sqlDraft: string;
  aiConversationHistory: AiConversationEntry[];
  executionResultMetadata: ExecutionResultMetadata[];
  createdAt: string;
  updatedAt: string;
}

export interface AiConversationEntry {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface ExecutionResultMetadata {
  id: string;
  sql: string;
  rowCount: number;
  columns: string[];
  executedAt: string;
  errorMessage?: string;
}

export interface QuerySessionStore {
  listQuerySessions(): Promise<QuerySession[]>;
  createQuerySession(input: { databaseConnectionId: string }): Promise<QuerySession>;
  getRestoredQuerySession(): Promise<QuerySession | null>;
  saveSqlDraft(sessionId: string, sqlDraft: string): Promise<QuerySession>;
  saveAiConversationHistory(
    sessionId: string,
    entries: AiConversationEntry[],
  ): Promise<QuerySession>;
  saveExecutionResultMetadata(
    sessionId: string,
    metadata: ExecutionResultMetadata[],
  ): Promise<QuerySession>;
}

export interface LocalPersistence {
  preferences: PreferenceStore;
  aiConfiguration: AiConfigurationStore;
  secrets: SecretStore;
  databaseConnections: DatabaseConnectionStore;
  querySessions: QuerySessionStore;
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
  const querySessions = new Map<string, QuerySession>();
  let currentQuerySessionId: string | null = null;

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
    querySessions: {
      async listQuerySessions() {
        return Array.from(querySessions.values()).sort((left, right) =>
          right.updatedAt.localeCompare(left.updatedAt),
        );
      },
      async createQuerySession(input) {
        const databaseConnection = databaseConnections.get(input.databaseConnectionId);

        if (!databaseConnection) {
          throw new Error("Database connection was not found");
        }

        const now = new Date().toISOString();
        const session: QuerySession = {
          id: createLocalId(),
          databaseConnectionId: databaseConnection.id,
          connectionName: databaseConnection.name,
          defaultDatabase: databaseConnection.defaultDatabase,
          sqlDraft: "",
          aiConversationHistory: [],
          executionResultMetadata: [],
          createdAt: now,
          updatedAt: now,
        };

        querySessions.set(session.id, session);
        currentQuerySessionId = session.id;

        return session;
      },
      async getRestoredQuerySession() {
        if (currentQuerySessionId && querySessions.has(currentQuerySessionId)) {
          return querySessions.get(currentQuerySessionId) ?? null;
        }

        const [mostRecentSession] = await this.listQuerySessions();
        currentQuerySessionId = mostRecentSession?.id ?? null;

        return mostRecentSession ?? null;
      },
      async saveSqlDraft(sessionId, sqlDraft) {
        const session = querySessions.get(sessionId);

        if (!session) {
          throw new Error("Query Session was not found");
        }

        const updatedSession = {
          ...session,
          sqlDraft,
          updatedAt: new Date().toISOString(),
        };
        querySessions.set(sessionId, updatedSession);
        currentQuerySessionId = sessionId;

        return updatedSession;
      },
      async saveAiConversationHistory(sessionId, entries) {
        const session = querySessions.get(sessionId);

        if (!session) {
          throw new Error("Query Session was not found");
        }

        const updatedSession = {
          ...session,
          aiConversationHistory: entries,
          updatedAt: new Date().toISOString(),
        };
        querySessions.set(sessionId, updatedSession);
        currentQuerySessionId = sessionId;

        return updatedSession;
      },
      async saveExecutionResultMetadata(sessionId, metadata) {
        const session = querySessions.get(sessionId);

        if (!session) {
          throw new Error("Query Session was not found");
        }

        const updatedSession = {
          ...session,
          executionResultMetadata: metadata.map(stripResultRowsFromExecutionMetadata),
          updatedAt: new Date().toISOString(),
        };
        querySessions.set(sessionId, updatedSession);
        currentQuerySessionId = sessionId;

        return updatedSession;
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
    querySessions: {
      async listQuerySessions() {
        const sessions = await invoke("list_query_sessions");
        return Array.isArray(sessions) ? (sessions as QuerySession[]) : [];
      },
      async createQuerySession(input) {
        const session = await invoke("create_query_session", { input });
        return session as QuerySession;
      },
      async getRestoredQuerySession() {
        const session = await invoke("get_restored_query_session");
        return session ? (session as QuerySession) : null;
      },
      async saveSqlDraft(sessionId, sqlDraft) {
        const session = await invoke("save_query_session_sql_draft", {
          sessionId,
          sqlDraft,
        });
        return session as QuerySession;
      },
      async saveAiConversationHistory(sessionId, entries) {
        const session = await invoke("save_query_session_ai_conversation_history", {
          sessionId,
          entries,
        });
        return session as QuerySession;
      },
      async saveExecutionResultMetadata(sessionId, metadata) {
        const session = await invoke("save_query_session_execution_metadata", {
          sessionId,
          metadata: metadata.map(stripResultRowsFromExecutionMetadata),
        });
        return session as QuerySession;
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

function stripResultRowsFromExecutionMetadata(
  metadata: ExecutionResultMetadata,
): ExecutionResultMetadata {
  return {
    id: metadata.id,
    sql: metadata.sql,
    rowCount: metadata.rowCount,
    columns: metadata.columns,
    executedAt: metadata.executedAt,
    errorMessage: metadata.errorMessage,
  };
}
