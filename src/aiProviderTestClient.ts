import type { GlobalAiConfiguration } from "./platform/localPersistence";

export type AiProviderTestResult =
  | { ok: true; content: string }
  | { ok: false; error: string };

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

export async function runStreamingAiProviderTest(
  configuration: GlobalAiConfiguration,
  apiKey: string,
  fetch: FetchLike = globalThis.fetch,
): Promise<AiProviderTestResult> {
  try {
    const response = await fetch(`${configuration.baseUrl.replace(/\/$/, "")}/chat/completions`, {
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
        messages: [
          {
            role: "user",
            content: "Reply with a short confirmation that this model is reachable.",
          },
        ],
      }),
    });

    if (!response.ok) {
      const details = response.text ? await response.text() : "unknown error";
      return {
        ok: false,
        error: `AI request failed with HTTP ${response.status ?? "error"}: ${details}`,
      };
    }

    if (!response.body) {
      return { ok: false, error: "AI request failed: streaming response body was empty" };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";

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
        content += event.choices?.[0]?.delta?.content ?? "";
      }
    }

    return { ok: true, content };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "AI request failed",
    };
  }
}
