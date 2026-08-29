import { z } from "zod";
import { e2eBypassUserId } from "../../lib/auth/guard";
import { pesosToCents } from "../../lib/money";
import type { Result } from "../../lib/result";
import type { AiClient, Attachment } from "../ai/gateway";
import { extract } from "../ai/gateway";
import { prisma } from "../db/client";

// Extrae TODOS los movimientos de un extracto bancario en PDF -- a
// diferencia de extract-free-text.ts y extract-document.ts, que piden uno
// solo. No escribe nada: statement-batch.ts es quien persiste. No instala
// ninguna libreria de PDF -- el gateway acepta el documento directamente.

const PROMPT = `Eres un asistente que extrae TODOS los movimientos de dinero de un extracto
bancario colombiano en PDF. Responde SOLO con un arreglo JSON, sin texto alrededor, con esta forma
exacta -- un objeto por movimiento, uno por cada fila del extracto:
[
  {
    "description": string,
    "amountPesos": string de solo dígitos (nunca con punto ni coma),
    "direction": "in" | "out",
    "occurredOn": string ISO 8601, o null si la fecha no es legible,
    "accountName": string en minúsculas o null,
    "categoryName": string en minúsculas o null,
    "confidence": número entre 0 y 1, o null
  }
]`;

const movementSchema = z.object({
  description: z.string().min(1),
  amountPesos: z.string().min(1),
  direction: z.enum(["in", "out"]),
  occurredOn: z.string().nullable().optional(),
  accountName: z.string().nullable().optional(),
  categoryName: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
});

const modelPayloadSchema = z.array(movementSchema);

// §13 exige que TODA prueba inyecte un AiClient falso, e2e incluido -- pero
// tests/e2e/** no puede importar src/ (regla de §3) para pasar uno. La
// suite e2e corre contra un servidor real, así que la única forma de que
// respete esa regla es que el servidor mismo sustituya el cliente cuando
// corre bajo e2e. Reusa el mismo triple interlock de e2eBypassUserId()
// (paso 3): sin los tres, esto jamás se activa contra dev o produccion.
const E2E_FAKE_RESPONSE = JSON.stringify([
  {
    description: "Compra e2e",
    amountPesos: "50000",
    direction: "out",
    occurredOn: "2026-01-15",
    accountName: null,
    categoryName: null,
    confidence: null,
  },
]);

function resolveClient(client: AiClient | undefined): AiClient | undefined {
  if (client) return client;
  if (e2eBypassUserId()) {
    return {
      async complete() {
        return E2E_FAKE_RESPONSE;
      },
    };
  }
  return undefined;
}

export type StatementMovement = {
  description: string;
  amountCents: bigint;
  direction: "in" | "out";
  // A diferencia de extract-free-text.ts (que asume "hoy" cuando falta la
  // fecha): un extracto sin fecha legible se guarda null a proposito
  // (acceptance 3 de E2-T5) -- adivinar aca inventaria un dato que la
  // revision humana necesita corregir, no confirmar.
  occurredOn: Date | null;
  accountId: string | null;
  categoryId: string | null;
  confidence: number | null;
  raw: unknown;
};

export async function extractStatement(
  userId: string,
  bytes: Buffer,
  client?: AiClient,
): Promise<Result<StatementMovement[]>> {
  const attachment: Attachment = {
    kind: "document",
    mediaType: "application/pdf",
    data: bytes.toString("base64"),
  };

  const extraction = await extract(
    modelPayloadSchema,
    { prompt: PROMPT, attachments: [attachment] },
    resolveClient(client),
  );
  if (!extraction.ok) {
    return extraction;
  }

  const movements: StatementMovement[] = [];
  for (const payload of extraction.data) {
    let amountCents: bigint;
    try {
      amountCents = pesosToCents(payload.amountPesos);
    } catch {
      return {
        ok: false,
        error: {
          code: "extraction_failed",
          message: "Un monto extraído del extracto no es válido.",
        },
      };
    }

    const account = payload.accountName
      ? await prisma.account.findFirst({
          where: {
            userId,
            name: payload.accountName,
            archivedAt: null,
          },
        })
      : null;
    const category = payload.categoryName
      ? await prisma.category.findFirst({
          where: {
            userId,
            name: payload.categoryName,
            archivedAt: null,
          },
        })
      : null;

    movements.push({
      description: payload.description,
      amountCents,
      direction: payload.direction,
      occurredOn: payload.occurredOn ? new Date(payload.occurredOn) : null,
      accountId: account?.id ?? null,
      categoryId: category?.id ?? null,
      confidence: payload.confidence ?? null,
      raw: payload,
    });
  }

  return { ok: true, data: movements };
}
