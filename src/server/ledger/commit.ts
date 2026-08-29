import type { Result } from "../../lib/result";
import { prisma } from "../db/client";
import { withAudit } from "../db/with-audit";

type CreateManualInput = {
  userId: string;
  accountId: string;
  categoryId?: string | null;
  occurredOn: Date;
  description: string;
  amountCents: bigint;
  direction: "in" | "out";
};

// El unico escritor de transactions. Todo alta manual pasa por acá; ningun
// extractor escribe directo.
export async function createManual(
  input: CreateManualInput,
): Promise<Result<{ transactionId: string }>> {
  const transactionId = await withAudit(
    {
      actorId: input.userId,
      actorKind: "user",
      action: "transaction.create",
      resourceType: "transaction",
    },
    async (tx) => {
      const created = await tx.transaction.create({
        data: {
          userId: input.userId,
          accountId: input.accountId,
          categoryId: input.categoryId ?? null,
          occurredOn: input.occurredOn,
          description: input.description,
          amountCents: input.amountCents,
          direction: input.direction,
          source: "manual",
        },
      });
      return { result: created.id, resourceId: created.id };
    },
  );

  return { ok: true, data: { transactionId } };
}

// Borrado logico: la unica escritura de deleted_at. La fila sigue existiendo
// -- transactions es append-only por trigger, un DELETE real esta prohibido
// en la base.
export async function softDelete(
  transactionId: string,
  userId: string,
): Promise<Result<null>> {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
  });

  if (!transaction || transaction.userId !== userId) {
    return {
      ok: false,
      error: { code: "not_found", message: "Movimiento no encontrado." },
    };
  }

  await withAudit(
    {
      actorId: userId,
      actorKind: "user",
      action: "transaction.soft_delete",
      resourceType: "transaction",
    },
    async (tx) => {
      await tx.transaction.update({
        where: { id: transactionId },
        data: { deletedAt: new Date() },
      });
      return { result: null, resourceId: transactionId };
    },
  );

  return { ok: true, data: null };
}

// Confirma un pendiente: escribe transactions, marca el pendiente como
// confirmado, y ambas cosas junto con audit_log en una sola transaccion.
// Confirmar dos veces no crea dos transacciones -- devuelve conflict.
export async function commitPending(
  pendingId: string,
  userId: string,
): Promise<Result<{ transactionId: string }>> {
  const pending = await prisma.pendingTransaction.findUnique({
    where: { id: pendingId },
  });

  if (!pending || pending.userId !== userId) {
    return {
      ok: false,
      error: { code: "not_found", message: "Pendiente no encontrado." },
    };
  }

  if (pending.committedTransactionId) {
    return {
      ok: false,
      error: { code: "conflict", message: "Este pendiente ya fue confirmado." },
    };
  }

  if (
    pending.amountCents === null ||
    pending.direction === null ||
    pending.occurredOn === null ||
    pending.description === null ||
    pending.accountId === null
  ) {
    return {
      ok: false,
      error: {
        code: "validation_failed",
        message: "Faltan campos para confirmar el pendiente.",
      },
    };
  }

  const accountId = pending.accountId;
  const occurredOn = pending.occurredOn;
  const description = pending.description;
  const amountCents = pending.amountCents;
  const direction = pending.direction;

  const transactionId = await withAudit(
    {
      actorId: userId,
      actorKind: "user",
      action: "pending.confirm",
      resourceType: "transaction",
    },
    async (tx) => {
      const created = await tx.transaction.create({
        data: {
          userId,
          accountId,
          categoryId: pending.categoryId,
          occurredOn,
          description,
          amountCents,
          direction,
          source: pending.source,
        },
      });

      await tx.pendingTransaction.update({
        where: { id: pendingId },
        data: {
          status: "confirmed",
          resolvedAt: new Date(),
          committedTransactionId: created.id,
        },
      });

      return { result: created.id, resourceId: created.id };
    },
  );

  return { ok: true, data: { transactionId } };
}
