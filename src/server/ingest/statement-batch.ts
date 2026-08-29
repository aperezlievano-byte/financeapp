import { createHash } from "node:crypto";
import type { Result } from "../../lib/result";
import type { AiClient } from "../ai/gateway";
import { prisma } from "../db/client";
import { withAudit } from "../db/with-audit";
import { putObject } from "../storage";
import type { FreeTextExtraction } from "./extract-free-text";
import { extractStatement } from "./extract-statement";
import { createPending } from "./pending";

// Orquesta la subida de un extracto: dedupe por sha256 del archivo completo
// (igual que extract-document.ts), pide los movimientos a extractStatement,
// y escribe documents + un pendiente por movimiento + un solo audit_log de
// document.upload, todo en una transaccion.

type UploadInput = {
  userId: string;
  filename: string;
  bytes: Buffer;
};

// sha256(indice|fecha|descripcion|monto|nombreArchivo). El indice rompe el
// empate entre dos movimientos identicos del mismo extracto (acceptance 4):
// sin el, ambos calcularian el mismo source_ref y confirmar el segundo
// chocaria contra la unicidad (user_id, source, source_ref) de §4 que
// commitPending ya hace valer.
function computeSourceRef(
  index: number,
  movement: {
    occurredOn: Date | null;
    description: string;
    amountCents: bigint;
  },
  filename: string,
): string {
  const dateKey = movement.occurredOn?.toISOString() ?? "";
  return createHash("sha256")
    .update(
      `${index}|${dateKey}|${movement.description}|${movement.amountCents}|${filename}`,
    )
    .digest("hex");
}

export async function processStatement(
  input: UploadInput,
  client?: AiClient,
): Promise<Result<{ documentId: string; pendingIds: string[] }>> {
  const sha256 = createHash("sha256").update(input.bytes).digest("hex");

  const existing = await prisma.document.findUnique({
    where: { userId_sha256: { userId: input.userId, sha256 } },
  });
  if (existing) {
    return {
      ok: false,
      error: { code: "conflict", message: "Este extracto ya fue subido." },
    };
  }

  const extraction = await extractStatement(input.userId, input.bytes, client);
  if (!extraction.ok) {
    return extraction;
  }

  const storageKey = `${input.userId}/${sha256}`;
  await putObject(storageKey, input.bytes, "application/pdf");

  const { documentId, pendingIds } = await withAudit(
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
          kind: "statement",
          storageKey,
          filename: input.filename,
          mimeType: "application/pdf",
          bytes: input.bytes.byteLength,
          sha256,
          status: "extracted",
        },
      });

      const pendingIds: string[] = [];
      for (const [index, movement] of extraction.data.entries()) {
        const sourceRef = computeSourceRef(index, movement, input.filename);

        // Salta movimientos que un pendiente anterior de este mismo extracto
        // ya confirmo -- p.ej. reprocesar tras confirmar solo algunas filas.
        // No aplica al re-upload exacto del mismo archivo: ese caso ya
        // devolvio conflict arriba, antes de llegar aca.
        const alreadyCommitted = await tx.transaction.findUnique({
          where: {
            userId_source_sourceRef: {
              userId: input.userId,
              source: "statement",
              sourceRef,
            },
          },
        });
        if (alreadyCommitted) {
          continue;
        }

        const freeTextShaped: FreeTextExtraction = {
          description: movement.description,
          amountCents: movement.amountCents,
          direction: movement.direction,
          occurredOn: movement.occurredOn,
          accountId: movement.accountId,
          categoryId: movement.categoryId,
          confidence: movement.confidence,
          raw: movement.raw,
        };

        const pending = await createPending(
          {
            userId: input.userId,
            source: "statement",
            rawInput: input.filename,
            extraction: freeTextShaped,
            documentId: document.id,
            sourceRef,
          },
          tx,
        );
        pendingIds.push(pending.id);
      }

      return {
        result: { documentId: document.id, pendingIds },
        resourceId: document.id,
      };
    },
  );

  return { ok: true, data: { documentId, pendingIds } };
}
