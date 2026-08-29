import { z } from "zod";
import { pesosToCents } from "../../lib/money";
import type { Result } from "../../lib/result";
import type { AiClient } from "../ai/gateway";
import { extract } from "../ai/gateway";
import { prisma } from "../db/client";

// Prefijo estable primero (rol, formato de salida), variable despues (el
// texto del mensaje) -- ese orden es lo que permite que el prefijo se
// beneficie de cache en el proveedor (§17).
const PROMPT_PREFIX = `Eres un asistente que extrae un movimiento de dinero de un mensaje en
español coloquial colombiano. Responde SOLO con un objeto JSON, sin texto alrededor, con esta
forma exacta:
{
  "description": string,
  "amountPesos": string de solo dígitos (nunca con punto ni coma),
  "direction": "in" | "out",
  "occurredOn": string ISO 8601 o null,
  "accountName": string en minúsculas o null,
  "categoryName": string en minúsculas o null,
  "confidence": número entre 0 y 1, o null
}

Mensaje:`;

const modelPayloadSchema = z.object({
  description: z.string().min(1),
  amountPesos: z.string().min(1),
  direction: z.enum(["in", "out"]),
  occurredOn: z.string().nullable().optional(),
  accountName: z.string().nullable().optional(),
  categoryName: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
});

export type FreeTextExtraction = {
  description: string;
  amountCents: bigint;
  direction: "in" | "out";
  occurredOn: Date | null;
  accountId: string | null;
  categoryId: string | null;
  confidence: number | null;
  raw: unknown;
};

export async function extractFreeText(
  userId: string,
  text: string,
  client?: AiClient,
): Promise<Result<FreeTextExtraction>> {
  const extraction = await extract(
    modelPayloadSchema,
    { prompt: `${PROMPT_PREFIX} ${text}` },
    client,
  );

  if (!extraction.ok) {
    return extraction;
  }

  const payload = extraction.data;

  let amountCents: bigint;
  try {
    amountCents = pesosToCents(payload.amountPesos);
  } catch {
    return {
      ok: false,
      error: {
        code: "extraction_failed",
        message: "El monto extraído no es válido.",
      },
    };
  }

  const account = payload.accountName
    ? await prisma.account.findFirst({
        where: { userId, name: payload.accountName, archivedAt: null },
      })
    : null;

  const category = payload.categoryName
    ? await prisma.category.findFirst({
        where: { userId, name: payload.categoryName, archivedAt: null },
      })
    : null;

  return {
    ok: true,
    data: {
      description: payload.description,
      amountCents,
      direction: payload.direction,
      occurredOn: payload.occurredOn ? new Date(payload.occurredOn) : null,
      accountId: account?.id ?? null,
      categoryId: category?.id ?? null,
      confidence: payload.confidence ?? null,
      raw: payload,
    },
  };
}
