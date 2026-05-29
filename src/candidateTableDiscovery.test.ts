import { describe, expect, it, vi } from "vitest";
import {
  buildCandidateTableDiscoveryRequest,
  discoverCandidateTables,
  parseCandidateTableDiscoveryResponse,
} from "./candidateTableDiscovery";
import type { DatabaseCatalogSnapshot, QuerySession } from "./platform/localPersistence";

const session: QuerySession = {
  id: "session-1",
  databaseConnectionId: "db-1",
  connectionName: "Warehouse",
  defaultDatabase: "warehouse",
  sqlDraft:
    "select 'db-password-secret', 'sk-ai-api-key', 'ssh-private-key', 'sample-row-value' from previous_results",
  candidateTables: [],
  aiConversationHistory: [],
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
  ],
};

describe("candidate table discovery", () => {
  it("builds model context from the Query Session and default schema catalog without secrets or result rows", () => {
    const request = buildCandidateTableDiscoveryRequest({
      queryNeed: "Find total customer orders",
      session,
      catalog,
    });
    const serializedRequest = JSON.stringify(request);

    expect(serializedRequest).toContain("Find total customer orders");
    expect(serializedRequest).toContain("warehouse");
    expect(serializedRequest).toContain("orders");
    expect(serializedRequest).toContain("CREATE TABLE `orders`");
    expect(serializedRequest).not.toContain("db-password-secret");
    expect(serializedRequest).not.toContain("sk-ai-api-key");
    expect(serializedRequest).not.toContain("ssh-private-key");
    expect(serializedRequest).not.toContain("sensitive-row-value");
    expect(serializedRequest).not.toContain("sample-row-value");
    expect(serializedRequest).not.toContain("previous_results");
  });

  it("parses known candidate tables from model JSON", () => {
    const candidateTables = parseCandidateTableDiscoveryResponse({
      content: JSON.stringify({
        candidateTables: [
          { name: "orders", reason: "Contains customer order facts" },
          { name: "missing_table", reason: "Not in the connected catalog" },
        ],
      }),
      catalog,
    });

    expect(candidateTables).toEqual([
      { name: "orders", reason: "Contains customer order facts" },
    ]);
  });

  it("parses an empty candidate table set when the model returns no tables", () => {
    expect(
      parseCandidateTableDiscoveryResponse({
        content: JSON.stringify({ candidateTables: [] }),
        catalog,
      }),
    ).toEqual([]);
  });

  it("sends the discovery request to the configured model and keeps secrets out of the model body", async () => {
    const fetchModel = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                candidateTables: [{ name: "orders", reason: "Matches order metrics" }],
              }),
            },
          },
        ],
      }),
    });

    await expect(
      discoverCandidateTables({
        queryNeed: "Find order count",
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
      }),
    ).resolves.toEqual([{ name: "orders", reason: "Matches order metrics" }]);

    expect(fetchModel).toHaveBeenCalledWith(
      "https://ai.example.test/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sk-ai-api-key",
        }),
      }),
    );
    const [, requestInit] = fetchModel.mock.calls[0];
    expect(String(requestInit.body)).toContain("orders");
    expect(String(requestInit.body)).not.toContain("sk-ai-api-key");
    expect(String(requestInit.body)).not.toContain("sensitive-row-value");
  });
});
