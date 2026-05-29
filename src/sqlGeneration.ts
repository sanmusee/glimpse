import type {
  DatabaseCatalogSnapshot,
  GlobalAiConfiguration,
  QuerySession,
} from "./platform/localPersistence";

export interface SqlGenerationRequestInput {
  queryNeed: string;
  session: QuerySession;
  catalog: DatabaseCatalogSnapshot;
}

export interface SqlModificationRequestInput {
  modificationIntent: string;
  currentSql: string;
  session: QuerySession;
  catalog: DatabaseCatalogSnapshot;
}

export interface SqlRepairRequestInput {
  currentSql: string;
  errorMessage: string;
  dialect: string;
  session: QuerySession;
  catalog: DatabaseCatalogSnapshot;
}

export interface SqlGenerationModelRequest {
  messages: Array<{ role: "system" | "user"; content: string }>;
}

type FetchLike = (
  input: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
  },
) => Promise<{
  ok: boolean;
  status?: number;
  body?: ReadableStream<Uint8Array> | null;
  text?: () => Promise<string>;
}>;

export interface GenerateSqlFromQueryNeedInput extends SqlGenerationRequestInput {
  configuration: GlobalAiConfiguration;
  apiKey: string;
  fetchModel?: FetchLike;
  onPartialSql?: (sql: string) => void;
}

export interface ModifySqlFromIntentInput extends SqlModificationRequestInput {
  configuration: GlobalAiConfiguration;
  apiKey: string;
  fetchModel?: FetchLike;
  onPartialSql?: (sql: string) => void;
}

export interface RepairSqlFromExecutionErrorInput extends SqlRepairRequestInput {
  configuration: GlobalAiConfiguration;
  apiKey: string;
  fetchModel?: FetchLike;
  onPartialSql?: (sql: string) => void;
}

export function buildSqlGenerationRequest({
  queryNeed,
  session,
  catalog,
}: SqlGenerationRequestInput): SqlGenerationModelRequest {
  const catalogContext = buildCandidateCatalogContext(session, catalog);

  return {
    messages: [
      {
        role: "system",
        content:
          "Generate SQL for the user's query need. Return only SQL text, with no explanation or markdown fences. Use only the provided default schema and candidate table context.",
      },
      {
        role: "user",
        content: JSON.stringify({
          queryNeed,
          querySession: {
            id: session.id,
            defaultDatabase: session.defaultDatabase,
            candidateTables: session.candidateTables,
          },
          defaultSchemaCatalog: catalogContext,
        }),
      },
    ],
  };
}

export function buildSqlModificationRequest({
  modificationIntent,
  currentSql,
  session,
  catalog,
}: SqlModificationRequestInput): SqlGenerationModelRequest {
  const catalogContext = buildCandidateCatalogContext(session, catalog);

  return {
    messages: [
      {
        role: "system",
        content:
          "Modify the existing SQL according to the user's intent. Return only the revised SQL text, with no explanation or markdown fences. Use the current SQL as the starting point and preserve its intent unless the user asks to change it. Use only the provided default schema and candidate table context.",
      },
      {
        role: "user",
        content: JSON.stringify({
          modificationIntent,
          currentSql,
          querySession: {
            id: session.id,
            defaultDatabase: session.defaultDatabase,
            candidateTables: session.candidateTables,
          },
          defaultSchemaCatalog: catalogContext,
        }),
      },
    ],
  };
}

export function buildSqlRepairRequest({
  currentSql,
  errorMessage,
  dialect,
  session,
  catalog,
}: SqlRepairRequestInput): SqlGenerationModelRequest {
  const catalogContext = buildCandidateCatalogContext(session, catalog);

  return {
    messages: [
      {
        role: "system",
        content:
          "Repair the failed SQL using the database error and schema context. Return only the repaired SQL text, with no explanation or markdown fences. Preserve the user's intent when possible. Use only the provided default schema and candidate table context.",
      },
      {
        role: "user",
        content: JSON.stringify({
          currentSql,
          errorMessage,
          dialect,
          querySession: {
            id: session.id,
            defaultDatabase: session.defaultDatabase,
            candidateTables: session.candidateTables,
          },
          defaultSchemaCatalog: catalogContext,
        }),
      },
    ],
  };
}

export async function generateSqlFromQueryNeed({
  queryNeed,
  session,
  catalog,
  configuration,
  apiKey,
  fetchModel = fetch,
  onPartialSql,
}: GenerateSqlFromQueryNeedInput): Promise<string> {
  const request = buildSqlGenerationRequest({ queryNeed, session, catalog });
  return streamSqlCompletion({
    request,
    configuration,
    apiKey,
    fetchModel,
    onPartialSql,
    failureLabel: "SQL generation",
  });
}

export async function modifySqlFromIntent({
  modificationIntent,
  currentSql,
  session,
  catalog,
  configuration,
  apiKey,
  fetchModel = fetch,
  onPartialSql,
}: ModifySqlFromIntentInput): Promise<string> {
  const request = buildSqlModificationRequest({
    modificationIntent,
    currentSql,
    session,
    catalog,
  });

  return streamSqlCompletion({
    request,
    configuration,
    apiKey,
    fetchModel,
    onPartialSql,
    failureLabel: "SQL modification",
  });
}

export async function repairSqlFromExecutionError({
  currentSql,
  errorMessage,
  dialect,
  session,
  catalog,
  configuration,
  apiKey,
  fetchModel = fetch,
  onPartialSql,
}: RepairSqlFromExecutionErrorInput): Promise<string> {
  const request = buildSqlRepairRequest({
    currentSql,
    errorMessage,
    dialect,
    session,
    catalog,
  });

  return streamSqlCompletion({
    request,
    configuration,
    apiKey,
    fetchModel,
    onPartialSql,
    failureLabel: "SQL repair",
  });
}

async function streamSqlCompletion({
  request,
  configuration,
  apiKey,
  fetchModel,
  onPartialSql,
  failureLabel,
}: {
  request: SqlGenerationModelRequest;
  configuration: GlobalAiConfiguration;
  apiKey: string;
  fetchModel: FetchLike;
  onPartialSql?: (sql: string) => void;
  failureLabel: string;
}): Promise<string> {
  const response = await fetchModel(`${configuration.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: configuration.model,
      temperature: configuration.temperature,
      max_tokens: configuration.maxTokens,
      stream: true,
      messages: request.messages,
    }),
  });

  if (!response.ok) {
    const details = response.text ? await response.text() : "unknown error";
    throw new Error(`${failureLabel} failed with HTTP ${response.status ?? "error"}: ${details}`);
  }

  if (!response.body) {
    throw new Error(`${failureLabel} failed: streaming response body was empty`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sql = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const dataLine = chunk
        .split("\n")
        .find((line) => line.startsWith("data: "))
        ?.slice("data: ".length);

      if (!dataLine || dataLine === "[DONE]") {
        continue;
      }

      const event = JSON.parse(dataLine) as {
        choices?: Array<{ delta?: { content?: string } }>;
      };
      const nextToken = event.choices?.[0]?.delta?.content ?? "";
      if (!nextToken) {
        continue;
      }

      sql += nextToken;
      onPartialSql?.(sql);
    }
  }

  return sql;
}

function buildCandidateCatalogContext(
  session: QuerySession,
  catalog: DatabaseCatalogSnapshot,
) {
  const candidateTableNames = new Set(session.candidateTables.map((table) => table.name));

  return {
    database: catalog.database,
    tables: catalog.tables
      .filter((table) => candidateTableNames.has(table.name))
      .map((table) => ({
        name: table.name,
        comment: table.comment,
        columns: table.columns.map((column) => ({
          name: column.name,
          dataType: column.dataType,
          nullable: column.nullable,
          defaultValue: column.defaultValue,
          comment: column.comment,
          isPrimaryKey: column.isPrimaryKey,
        })),
        indexes: table.indexes,
        createTableDdl: table.createTableDdl,
      })),
  };
}
