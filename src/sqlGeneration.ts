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

export function buildSqlGenerationRequest({
  queryNeed,
  session,
  catalog,
}: SqlGenerationRequestInput): SqlGenerationModelRequest {
  const candidateTableNames = new Set(session.candidateTables.map((table) => table.name));
  const catalogContext = {
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
    throw new Error(`SQL generation failed with HTTP ${response.status ?? "error"}: ${details}`);
  }

  if (!response.body) {
    throw new Error("SQL generation failed: streaming response body was empty");
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
