import { describe, expect, it, vi } from "vitest";
import { buildSqlGenerationRequest, generateSqlFromQueryNeed } from "./sqlGeneration";
import type { DatabaseCatalogSnapshot, QuerySession } from "./platform/localPersistence";

const session: QuerySession = {
  id: "session-1",
  databaseConnectionId: "db-1",
  connectionName: "Warehouse",
  defaultDatabase: "warehouse",
  sqlDraft:
    "select 'db-password-secret', 'sk-ai-api-key', 'ssh-private-key', 'sample-row-value' from previous_results",
  candidateTables: [{ name: "orders", reason: "Contains order facts" }],
  aiConversationHistory: [
    {
      id: "message-1",
      role: "user",
      content: "previous request with sample-row-value",
      createdAt: "2026-05-29T09:01:00.000Z",
    },
  ],
  executionResultMetadata: [
    {
      id: "execution-1",
      sql: "select * from orders",
      rowCount: 1,
      columns: ["id", "secret_value", "sensitive-row-value"],
      executedAt: "2026-05-29T10:00:00.000Z",
    },
  ],
  createdAt: "2026-05-29T09:00:00.000Z",
  updatedAt: "2026-05-29T09:00:00.000Z",
};

const catalog: DatabaseCatalogSnapshot = {
  connectionId: "db-1",
  database: "warehouse",
  refreshedAt: "2026-05-29T10:00:00.000Z",
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
      ],
      indexes: [{ name: "PRIMARY", kind: "primary", columns: ["id"] }],
      createTableDdl: "CREATE TABLE `orders` (`id` bigint NOT NULL)",
    },
    {
      name: "payments",
      comment: "Payment facts outside the current candidate set",
      columns: [],
      indexes: [],
      createTableDdl: "CREATE TABLE `payments` (`id` bigint NOT NULL)",
    },
  ],
};

describe("SQL generation", () => {
  it("builds model context from the Query Session, Candidate Table Set, and catalog without secrets or result rows", () => {
    const request = buildSqlGenerationRequest({
      queryNeed: "Find monthly order totals",
      session,
      catalog,
    });
    const serializedRequest = JSON.stringify(request);

    expect(serializedRequest).toContain("Find monthly order totals");
    expect(serializedRequest).toContain("session-1");
    expect(serializedRequest).toContain("warehouse");
    expect(serializedRequest).toContain("orders");
    expect(serializedRequest).toContain("Contains order facts");
    expect(serializedRequest).toContain("CREATE TABLE `orders`");
    expect(serializedRequest).not.toContain("payments");
    expect(serializedRequest).not.toContain("db-password-secret");
    expect(serializedRequest).not.toContain("sk-ai-api-key");
    expect(serializedRequest).not.toContain("ssh-private-key");
    expect(serializedRequest).not.toContain("sensitive-row-value");
    expect(serializedRequest).not.toContain("sample-row-value");
    expect(serializedRequest).not.toContain("previous_results");
  });

  it("streams partial SQL from an OpenAI-compatible response", async () => {
    const partialSql: string[] = [];
    const fetchModel = vi.fn(
      async (
        _input: string,
        _init: { method: "POST"; headers: Record<string, string>; body: string },
      ) => ({
        ok: true,
        body: streamFromText(
          [
            'data: {"choices":[{"delta":{"content":"select"}}]}',
            'data: {"choices":[{"delta":{"content":" * from orders"}}]}',
            "data: [DONE]",
            "",
          ].join("\n\n"),
        ),
      }),
    );

    await expect(
      generateSqlFromQueryNeed({
        queryNeed: "Find monthly order totals",
        session,
        catalog,
        configuration: {
          baseUrl: "https://ai.example.test/v1",
          model: "glimpse-sql",
          temperature: 0.2,
          maxTokens: 1000,
        },
        apiKey: "sk-ai-api-key",
        fetchModel,
        onPartialSql: (sql) => partialSql.push(sql),
      }),
    ).resolves.toBe("select * from orders");

    expect(partialSql).toEqual(["select", "select * from orders"]);
    expect(fetchModel).toHaveBeenCalledWith(
      "https://ai.example.test/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sk-ai-api-key",
          "Content-Type": "application/json",
        }),
      }),
    );
    const [, requestInit] = fetchModel.mock.calls[0];
    expect(String(requestInit.body)).toContain('"stream":true');
    expect(String(requestInit.body)).not.toContain("sk-ai-api-key");
    expect(String(requestInit.body)).not.toContain("sensitive-row-value");
  });
});

function streamFromText(text: string) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}
