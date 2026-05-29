import type {
  CandidateTable,
  DatabaseCatalogSnapshot,
  GlobalAiConfiguration,
  QuerySession,
} from "./platform/localPersistence";

export interface CandidateTableDiscoveryRequestInput {
  queryNeed: string;
  session: QuerySession;
  catalog: DatabaseCatalogSnapshot;
}

export interface CandidateTableDiscoveryModelRequest {
  messages: Array<{ role: "system" | "user"; content: string }>;
  responseFormat: { type: "json_object" };
}

export interface CandidateTableDiscoveryResponseInput {
  content: string;
  catalog: DatabaseCatalogSnapshot;
}

export interface DiscoverCandidateTablesInput {
  queryNeed: string;
  session: QuerySession;
  catalog: DatabaseCatalogSnapshot;
  configuration: GlobalAiConfiguration;
  apiKey: string;
  fetchModel?: typeof fetch;
}

export function buildCandidateTableDiscoveryRequest({
  queryNeed,
  session,
  catalog,
}: CandidateTableDiscoveryRequestInput): CandidateTableDiscoveryModelRequest {
  const catalogContext = {
    database: catalog.database,
    tables: catalog.tables.map((table) => ({
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
          "You discover candidate database tables for a SQL task. Return JSON with a candidateTables array of { name, reason }. Use only tables from the provided default schema catalog.",
      },
      {
        role: "user",
        content: JSON.stringify({
          queryNeed,
          querySession: {
            id: session.id,
            defaultDatabase: session.defaultDatabase,
          },
          defaultSchemaCatalog: catalogContext,
        }),
      },
    ],
    responseFormat: { type: "json_object" },
  };
}

export function parseCandidateTableDiscoveryResponse({
  content,
  catalog,
}: CandidateTableDiscoveryResponseInput): CandidateTable[] {
  const parsed = JSON.parse(content) as { candidateTables?: unknown };
  const knownTableNames = new Set(catalog.tables.map((table) => table.name));

  return Array.isArray(parsed.candidateTables)
    ? parsed.candidateTables.flatMap((candidate) => {
        if (!candidate || typeof candidate !== "object") {
          return [];
        }

        const table = candidate as { name?: unknown; reason?: unknown };
        if (typeof table.name !== "string" || !knownTableNames.has(table.name)) {
          return [];
        }

        return [
          {
            name: table.name,
            reason: typeof table.reason === "string" ? table.reason : "",
          },
        ];
      })
    : [];
}

export async function discoverCandidateTables({
  queryNeed,
  session,
  catalog,
  configuration,
  apiKey,
  fetchModel = fetch,
}: DiscoverCandidateTablesInput): Promise<CandidateTable[]> {
  const request = buildCandidateTableDiscoveryRequest({ queryNeed, session, catalog });
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
      messages: request.messages,
      response_format: request.responseFormat,
    }),
  });

  if (!response.ok) {
    throw new Error(`Candidate table discovery failed with HTTP ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = data.choices?.[0]?.message?.content;

  return parseCandidateTableDiscoveryResponse({
    content: typeof content === "string" ? content : "{}",
    catalog,
  });
}
