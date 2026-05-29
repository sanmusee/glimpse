import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import type { ExecutionSafetyMode } from "../sqlExecution";

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

export interface DatabaseCatalogColumn {
  name: string;
  dataType: string;
  nullable: boolean;
  defaultValue: string | null;
  comment: string;
  isPrimaryKey: boolean;
}

export interface DatabaseCatalogIndex {
  name: string;
  kind: "primary" | "unique" | "index";
  columns: string[];
}

export interface DatabaseCatalogTable {
  name: string;
  comment: string;
  columns: DatabaseCatalogColumn[];
  indexes: DatabaseCatalogIndex[];
  createTableDdl: string | null;
}

export interface DatabaseCatalogSnapshot {
  connectionId: string;
  database: string;
  refreshedAt: string;
  tables: DatabaseCatalogTable[];
}

export interface CandidateTable {
  name: string;
  reason: string;
}

export interface DatabaseConnectionStore {
  listDatabaseConnections(): Promise<DatabaseConnection[]>;
  saveDatabaseConnection(input: DatabaseConnectionInput): Promise<DatabaseConnection>;
  deleteDatabaseConnection(id: string): Promise<void>;
  testDatabaseConnection(input: DatabaseConnectionInput): Promise<DatabaseConnectionTestResult>;
}

export interface DatabaseCatalogStore {
  openConnectionCatalog(connectionId: string): Promise<DatabaseCatalogSnapshot>;
  refreshCatalog(connectionId: string): Promise<DatabaseCatalogSnapshot>;
  getCatalogForSqlGeneration(connectionId: string): Promise<DatabaseCatalogSnapshot | null>;
}

export interface QuerySession {
  id: string;
  databaseConnectionId: string;
  connectionName: string;
  defaultDatabase: string;
  sqlDraft: string;
  candidateTables: CandidateTable[];
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

export interface SqlExecutionInput {
  connectionId: string;
  sql: string;
  safetyMode: ExecutionSafetyMode;
}

export type SqlResultCellValue = string | number | boolean | null;
export type SqlResultRow = SqlResultCellValue[];

export type SqlExecutionResult =
  | {
      ok: true;
      rowCount: number;
      columns: string[];
      rows: SqlResultRow[];
    }
  | {
      ok: false;
      errorMessage: string;
    };

export interface SqlExecutionStore {
  executeSql(input: SqlExecutionInput): Promise<SqlExecutionResult>;
}

export interface QuerySessionStore {
  listQuerySessions(): Promise<QuerySession[]>;
  createQuerySession(input: { databaseConnectionId: string }): Promise<QuerySession>;
  getRestoredQuerySession(): Promise<QuerySession | null>;
  openQuerySession(sessionId: string): Promise<QuerySession>;
  deleteQuerySession(sessionId: string): Promise<void>;
  saveSqlDraft(sessionId: string, sqlDraft: string): Promise<QuerySession>;
  saveCandidateTables(
    sessionId: string,
    candidateTables: CandidateTable[],
  ): Promise<QuerySession>;
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
  databaseCatalogs: DatabaseCatalogStore;
  querySessions: QuerySessionStore;
  sqlExecution: SqlExecutionStore;
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
  readDatabaseCatalog?: (
    connection: DatabaseConnection,
  ) => Promise<DatabaseCatalogSnapshot> | DatabaseCatalogSnapshot;
  executeSql?: (
    input: SqlExecutionInput,
  ) => Promise<SqlExecutionResult> | SqlExecutionResult;
}): LocalPersistence {
  let themePreference = initial?.themePreference ?? "system";
  let aiConfiguration = initial?.aiConfiguration ?? null;
  const secrets = new Map<string, string>();
  const databaseConnections = new Map<string, DatabaseConnection>(
    initial?.databaseConnections?.map((connection) => [connection.id, connection]) ?? [],
  );
  const catalogCache = new Map<string, DatabaseCatalogSnapshot>();
  const querySessions = new Map<string, QuerySession>();
  let currentQuerySessionId: string | null = null;

  const readDatabaseCatalog = async (connectionId: string) => {
    const connection = databaseConnections.get(connectionId);

    if (!connection) {
      throw new Error("Database connection was not found");
    }

    const catalog = initial?.readDatabaseCatalog
      ? await initial.readDatabaseCatalog(connection)
      : {
          connectionId: connection.id,
          database: connection.defaultDatabase,
          refreshedAt: new Date().toISOString(),
          tables: [],
        };

    catalogCache.set(connectionId, catalog);
    return catalog;
  };

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
        catalogCache.delete(id);

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
    databaseCatalogs: {
      async openConnectionCatalog(connectionId) {
        return readDatabaseCatalog(connectionId);
      },
      async refreshCatalog(connectionId) {
        return readDatabaseCatalog(connectionId);
      },
      async getCatalogForSqlGeneration(connectionId) {
        return catalogCache.get(connectionId) ?? null;
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
          candidateTables: [],
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
      async openQuerySession(sessionId) {
        const session = querySessions.get(sessionId);

        if (!session) {
          throw new Error("Query Session was not found");
        }

        const updatedSession = {
          ...session,
          updatedAt: new Date().toISOString(),
        };
        querySessions.set(sessionId, updatedSession);
        currentQuerySessionId = sessionId;

        return updatedSession;
      },
      async deleteQuerySession(sessionId) {
        querySessions.delete(sessionId);

        if (currentQuerySessionId === sessionId) {
          const [mostRecentSession] = await this.listQuerySessions();
          currentQuerySessionId = mostRecentSession?.id ?? null;
        }
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
      async saveCandidateTables(sessionId, candidateTables) {
        const session = querySessions.get(sessionId);

        if (!session) {
          throw new Error("Query Session was not found");
        }

        const updatedSession = {
          ...session,
          candidateTables,
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
    sqlExecution: {
      async executeSql(input) {
        if (initial?.executeSql) {
          return initial.executeSql(input);
        }

        return {
          ok: false,
          errorMessage: "SQL execution is not available in browser preview",
        };
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
    databaseCatalogs: {
      async openConnectionCatalog(connectionId) {
        const catalog = await invoke("open_connection_catalog", { connectionId });
        return assertDatabaseCatalogSnapshot(catalog);
      },
      async refreshCatalog(connectionId) {
        const catalog = await invoke("refresh_connection_catalog", { connectionId });
        return assertDatabaseCatalogSnapshot(catalog);
      },
      async getCatalogForSqlGeneration(connectionId) {
        const catalog = await invoke("get_cached_catalog", { connectionId });
        return catalog === null ? null : assertDatabaseCatalogSnapshot(catalog);
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
      async openQuerySession(sessionId) {
        const session = await invoke("open_query_session", { sessionId });
        return session as QuerySession;
      },
      async deleteQuerySession(sessionId) {
        await invoke("delete_query_session", { sessionId });
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
      async saveCandidateTables(sessionId, candidateTables) {
        const session = await invoke("save_query_session_candidate_tables", {
          sessionId,
          candidateTables,
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
    sqlExecution: {
      async executeSql(input) {
        const result = await invoke("execute_sql", { input });
        return isSqlExecutionResult(result)
          ? result
          : { ok: false, errorMessage: "SQL execution returned an invalid response" };
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

function isSqlExecutionResult(value: unknown): value is SqlExecutionResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (candidate.ok === true) {
    return (
      typeof candidate.rowCount === "number" &&
      Array.isArray(candidate.columns) &&
      Array.isArray(candidate.rows)
    );
  }

  return candidate.ok === false && typeof candidate.errorMessage === "string";
}

function assertDatabaseCatalogSnapshot(value: unknown): DatabaseCatalogSnapshot {
  if (!isDatabaseCatalogSnapshot(value)) {
    throw new Error("Catalog command returned an invalid response");
  }

  return value;
}

function isDatabaseCatalogSnapshot(value: unknown): value is DatabaseCatalogSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.connectionId === "string" &&
    typeof candidate.database === "string" &&
    typeof candidate.refreshedAt === "string" &&
    Array.isArray(candidate.tables)
  );
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
