import { Prisma } from "../../generated/prisma";
import type { Result } from "../../lib/result";
import { prisma } from "../db/client";
import { withAudit } from "../db/with-audit";

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

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

  const missingFields: string[] = [];
  if (pending.amountCents === null) missingFields.push("amount_cents");
  if (pending.direction === null) missingFields.push("direction");
  if (pending.occurredOn === null) missingFields.push("occurred_on");
  if (pending.description === null) missingFields.push("description");
  if (pending.accountId === null) missingFields.push("account_id");

  // Repite la misma disyuncion (no solo missingFields.length) para que
  // TypeScript pueda angostar los campos como no-nulos mas abajo.
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
        message: `Faltan campos para confirmar el pendiente: ${missingFields.join(", ")}.`,
      },
    };
  }

  const accountId = pending.accountId;
  const occurredOn = pending.occurredOn;
  const description = pending.description;
  const amountCents = pending.amountCents;
  const direction = pending.direction;

  try {
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
            // Presente solo para pendientes de extracto (paso 12): permite
            // que la unicidad (user_id, source, source_ref) de §4 rechace la
            // confirmacion si el mismo movimiento ya fue committeado por otro
            // pendiente -- p.ej. al reprocesar un extracto ya confirmado en
            // parte. manual y receipt siempre mandan null, que nunca colisiona.
            sourceRef: pending.sourceRef,
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
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      return {
        ok: false,
        error: {
          code: "conflict",
          message: "Este movimiento ya fue confirmado por otro pendiente.",
        },
      };
    }
    throw error;
  }
}

// Rechaza un pendiente: nunca escribe transactions. Junto a commitPending
// arriba, esta funcion es el unico lugar que resuelve el estado de un
// pendiente -- pending.ts (paso 5) solo escribe la creacion inicial.
export async function rejectPending(
  pendingId: string,
  userId: string,
): Promise<Result<null>> {
  const pending = await prisma.pendingTransaction.findUnique({
    where: { id: pendingId },
  });

  if (!pending || pending.userId !== userId) {
    return {
      ok: false,
      error: { code: "not_found", message: "Pendiente no encontrado." },
    };
  }

  if (pending.status !== "awaiting_review") {
    return {
      ok: false,
      error: { code: "conflict", message: "Este pendiente ya fue resuelto." },
    };
  }

  await withAudit(
    {
      actorId: userId,
      actorKind: "user",
      action: "pending.reject",
      resourceType: "pending_transaction",
    },
    async (tx) => {
      await tx.pendingTransaction.update({
        where: { id: pendingId },
        data: { status: "rejected", resolvedAt: new Date() },
      });
      return { result: null, resourceId: pendingId };
    },
  );

  return { ok: true, data: null };
}
