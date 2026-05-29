import { describe, expect, it, vi } from "vitest";
import { runStreamingAiProviderTest } from "./aiProviderTestClient";

function streamFromText(text: string) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

describe("AI provider streaming test client", () => {
  it("collects text from an OpenAI-compatible streaming response", async () => {
    const fetch = vi.fn(async () => ({
      ok: true,
      body: streamFromText(
        [
          'data: {"choices":[{"delta":{"content":"Hello"}}]}',
          'data: {"choices":[{"delta":{"content":" world"}}]}',
          "data: [DONE]",
          "",
        ].join("\n\n"),
      ),
    })) as unknown as typeof globalThis.fetch;

    const result = await runStreamingAiProviderTest(
      {
        baseUrl: "https://api.example.test/v1",
        model: "gpt-4.1-mini",
        temperature: 0.2,
        maxTokens: 64,
      },
      "sk-test-secret",
      fetch,
    );

    expect(result).toEqual({ ok: true, content: "Hello world" });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.test/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sk-test-secret",
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("returns a clear failure for provider errors", async () => {
    const fetch = vi.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => "invalid api key",
    })) as unknown as typeof globalThis.fetch;

    await expect(
      runStreamingAiProviderTest(
        {
          baseUrl: "https://api.example.test/v1",
          model: "gpt-4.1-mini",
          temperature: 0.2,
          maxTokens: 64,
        },
        "sk-test-secret",
        fetch,
      ),
    ).resolves.toEqual({
      ok: false,
      error: "AI request failed with HTTP 401: invalid api key",
    });
  });
});
