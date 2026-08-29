import type { z } from "zod";
import { requireAnthropic } from "../../lib/env";
import type { Result } from "../../lib/result";

// El unico archivo que importa @anthropic-ai/sdk, y lo hace de forma
// perezosa (dentro de complete()) para que la suite unitaria corra sin
// ANTHROPIC_API_KEY: los tests inyectan un AiClient falso y nunca llegan
// a este import.

export type Attachment =
  | {
      kind: "image";
      mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
      data: string;
    }
  | { kind: "document"; mediaType: "application/pdf"; data: string };

export type AiClient = {
  complete(prompt: string, attachments?: Attachment[]): Promise<string>;
};

const CALL_TIMEOUT_MS = 30_000;
const RETRY_DELAY_MS = 2_000;

function isRetryable(error: unknown): boolean {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: unknown }).status === 429
  ) {
    return true;
  }
  return (
    error instanceof Error &&
    /network|ECONNRESET|ETIMEDOUT/i.test(error.message)
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function defaultClient(): AiClient {
  const { ANTHROPIC_API_KEY, ANTHROPIC_MODEL_ID } = requireAnthropic();

  return {
    async complete(prompt, attachments) {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({
        apiKey: ANTHROPIC_API_KEY,
        timeout: CALL_TIMEOUT_MS,
      });

      const content: Array<
        | { type: "text"; text: string }
        | {
            type: "image";
            source: {
              type: "base64";
              media_type:
                | "image/jpeg"
                | "image/png"
                | "image/gif"
                | "image/webp";
              data: string;
            };
          }
        | {
            type: "document";
            source: {
              type: "base64";
              media_type: "application/pdf";
              data: string;
            };
          }
      > = [{ type: "text", text: prompt }];

      for (const attachment of attachments ?? []) {
        if (attachment.kind === "image") {
          content.push({
            type: "image",
            source: {
              type: "base64",
              media_type: attachment.mediaType,
              data: attachment.data,
            },
          });
        } else {
          content.push({
            type: "document",
            source: {
              type: "base64",
              media_type: attachment.mediaType,
              data: attachment.data,
            },
          });
        }
      }

      const call = () =>
        client.messages.create({
          model: ANTHROPIC_MODEL_ID,
          max_tokens: 1024,
          messages: [{ role: "user", content }],
        });

      let response: Awaited<ReturnType<typeof call>>;
      try {
        response = await call();
      } catch (error) {
        if (!isRetryable(error)) {
          throw error;
        }
        await sleep(RETRY_DELAY_MS);
        response = await call();
      }

      const block = response.content[0];
      if (block?.type !== "text") {
        throw new Error("El modelo no devolvió texto.");
      }
      return block.text;
    },
  };
}

export async function extract<T>(
  schema: z.ZodType<T>,
  input: { prompt: string; attachments?: Attachment[] },
  client: AiClient = defaultClient(),
): Promise<Result<T>> {
  let raw: string;
  try {
    raw = await client.complete(input.prompt, input.attachments);
  } catch {
    return {
      ok: false,
      error: {
        code: "extraction_failed",
        message: "No se pudo contactar al modelo.",
      },
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      error: {
        code: "extraction_failed",
        message: "El modelo no devolvió JSON válido.",
      },
    };
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      error: {
        code: "extraction_failed",
        message: "La respuesta no pasó el esquema.",
      },
    };
  }

  return { ok: true, data: result.data };
}
