import { createHash } from "node:crypto";
import { z } from "zod";
import { pesosToCents } from "../../lib/money";
import type { Result } from "../../lib/result";
import type { AiClient, Attachment } from "../ai/gateway";
import { extract } from "../ai/gateway";
import { prisma } from "../db/client";
import { withAudit } from "../db/with-audit";
import { putObject } from "../storage";
import type { FreeTextExtraction } from "./extract-free-text";
import { createPending } from "./pending";

// Sube un recibo (imagen o PDF), lo dedupea por sha256, y pide al gateway
// UN movimiento (a diferencia de extract-statement.ts del paso 12, que pide
// una lista). Escribe documents + el pendiente en la misma transaccion que
// el audit_log de document.upload, para que nunca quede un documento sin su
// pendiente o viceversa.

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "application/pdf",
]);
const MAX_BYTES = 10 * 1024 * 1024;

const PROMPT = `Eres un asistente que extrae un movimiento de dinero de la foto o el PDF de un
recibo colombiano. Responde SOLO con un objeto JSON, sin texto alrededor, con esta forma exacta:
{
  "description": string,
  "amountPesos": string de solo dígitos (nunca con punto ni coma),
  "direction": "in" | "out",
  "occurredOn": string ISO 8601 o null,
  "accountName": string en minúsculas o null,
  "categoryName": string en minúsculas o null,
  "confidence": número entre 0 y 1, o null
}`;

const modelPayloadSchema = z.object({
  description: z.string().min(1),
  amountPesos: z.string().min(1),
  direction: z.enum(["in", "out"]),
  occurredOn: z.string().nullable().optional(),
  accountName: z.string().nullable().optional(),
  categoryName: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
});

type UploadInput = {
  userId: string;
  filename: string;
  mimeType: string;
  bytes: Buffer;
};

export async function extractReceipt(
  input: UploadInput,
  client?: AiClient,
): Promise<Result<{ documentId: string; pendingId: string }>> {
  if (!ALLOWED_MIME_TYPES.has(input.mimeType)) {
    return {
      ok: false,
      error: {
        code: "validation_failed",
        message: "Tipo de archivo no soportado.",
      },
    };
  }
  if (input.bytes.byteLength > MAX_BYTES) {
    return {
      ok: false,
      error: {
        code: "validation_failed",
        message: "El archivo supera los 10 MB.",
      },
    };
  }

  const sha256 = createHash("sha256").update(input.bytes).digest("hex");

  const existing = await prisma.document.findUnique({
    where: { userId_sha256: { userId: input.userId, sha256 } },
  });
  if (existing) {
    return {
      ok: false,
      error: { code: "conflict", message: "Este archivo ya fue subido." },
    };
  }

  const attachment: Attachment =
    input.mimeType === "application/pdf"
      ? {
          kind: "document",
          mediaType: "application/pdf",
          data: input.bytes.toString("base64"),
        }
      : {
          kind: "image",
          mediaType: input.mimeType as "image/png" | "image/jpeg",
          data: input.bytes.toString("base64"),
        };

  const extraction = await extract(
    modelPayloadSchema,
    { prompt: PROMPT, attachments: [attachment] },
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
        where: {
          userId: input.userId,
          name: payload.accountName,
          archivedAt: null,
        },
      })
    : null;
  const category = payload.categoryName
    ? await prisma.category.findFirst({
        where: {
          userId: input.userId,
          name: payload.categoryName,
          archivedAt: null,
        },
      })
    : null;

  const receiptExtraction: FreeTextExtraction = {
    description: payload.description,
    amountCents,
    direction: payload.direction,
    // Mismo criterio que extract-free-text.ts: sin fecha explícita implica
    // hoy, nunca "sin determinar" (commitPending exige occurredOn).
    occurredOn: payload.occurredOn ? new Date(payload.occurredOn) : new Date(),
    accountId: account?.id ?? null,
    categoryId: category?.id ?? null,
    confidence: payload.confidence ?? null,
    raw: payload,
  };

  const storageKey = `${input.userId}/${sha256}`;
  await putObject(storageKey, input.bytes, input.mimeType);

  const { documentId, pendingId } = await withAudit(
    {
      actorId: input.userId,
      actorKind: "user",
      action: "document.upload",
      resourceType: "document",
    },
    async (tx) => {
      const document = await tx.document.create({
        data: {
          userId: input.userId,
          kind: "receipt",
          storageKey,
          filename: input.filename,
          mimeType: input.mimeType,
          bytes: input.bytes.byteLength,
          sha256,
          status: "extracted",
        },
      });
      const pending = await createPending(
        {
          userId: input.userId,
          source: "receipt",
          rawInput: input.filename,
          extraction: receiptExtraction,
          documentId: document.id,
        },
        tx,
      );
      return {
        result: { documentId: document.id, pendingId: pending.id },
        resourceId: document.id,
      };
    },
  );

  return { ok: true, data: { documentId, pendingId } };
}
