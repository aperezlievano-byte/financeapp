import type { Prisma } from "../../generated/prisma";
import { prisma } from "./client";

// Envuelve toda escritura al libro: el trabajo y la fila de audit_log corren
// en la misma transaccion de base. Si el audit falla, la escritura se
// revierte -- no hay camino que inserte sin dejar rastro.

type AuditBase = {
  actorId: string;
  actorKind: string;
  action: string;
  resourceType: string;
};

type AuditWork<T> = (tx: Prisma.TransactionClient) => Promise<{
  result: T;
  resourceId: string;
  before?: unknown;
  after?: unknown;
  requestId?: string;
}>;

export async function withAudit<T>(
  base: AuditBase,
  work: AuditWork<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const { result, resourceId, before, after, requestId } = await work(tx);

    await tx.auditLog.create({
      data: {
        actorId: base.actorId,
        actorKind: base.actorKind,
        action: base.action,
        resourceType: base.resourceType,
        resourceId,
        before: before as Prisma.InputJsonValue | undefined,
        after: after as Prisma.InputJsonValue | undefined,
        requestId,
      },
    });

    return result;
  });
}
