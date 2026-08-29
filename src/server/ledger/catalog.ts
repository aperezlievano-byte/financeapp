import type { AccountKind } from "../../generated/prisma";
import type { Result } from "../../lib/result";
import { prisma } from "../db/client";
import { withAudit } from "../db/with-audit";

// Cuentas y categorias. Las categorias se siembran (§1) y son solo lectura
// acá; las cuentas nunca se borran, se archivan.

export async function listAccounts(userId: string) {
  return prisma.account.findMany({
    where: { userId, archivedAt: null },
    orderBy: { name: "asc" },
  });
}

export async function listCategories(userId: string) {
  return prisma.category.findMany({
    where: { userId, archivedAt: null },
    orderBy: { name: "asc" },
  });
}

export async function createAccount(
  userId: string,
  name: string,
  kind: AccountKind,
): Promise<Result<{ accountId: string }>> {
  const existing = await prisma.account.findUnique({
    where: { userId_name: { userId, name } },
  });
  if (existing) {
    return {
      ok: false,
      error: {
        code: "conflict",
        message: "Ya existe una cuenta con ese nombre.",
      },
    };
  }

  const accountId = await withAudit(
    {
      actorId: userId,
      actorKind: "user",
      action: "account.create",
      resourceType: "account",
    },
    async (tx) => {
      const created = await tx.account.create({ data: { userId, name, kind } });
      return { result: created.id, resourceId: created.id };
    },
  );

  return { ok: true, data: { accountId } };
}

export async function renameAccount(
  userId: string,
  accountId: string,
  name: string,
): Promise<Result<null>> {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account || account.userId !== userId) {
    return {
      ok: false,
      error: { code: "not_found", message: "Cuenta no encontrada." },
    };
  }

  const existing = await prisma.account.findUnique({
    where: { userId_name: { userId, name } },
  });
  if (existing && existing.id !== accountId) {
    return {
      ok: false,
      error: {
        code: "conflict",
        message: "Ya existe una cuenta con ese nombre.",
      },
    };
  }

  await withAudit(
    {
      actorId: userId,
      actorKind: "user",
      action: "account.update",
      resourceType: "account",
    },
    async (tx) => {
      await tx.account.update({ where: { id: accountId }, data: { name } });
      return { result: null, resourceId: accountId };
    },
  );

  return { ok: true, data: null };
}

export async function archiveAccount(
  userId: string,
  accountId: string,
): Promise<Result<null>> {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account || account.userId !== userId) {
    return {
      ok: false,
      error: { code: "not_found", message: "Cuenta no encontrada." },
    };
  }

  await withAudit(
    {
      actorId: userId,
      actorKind: "user",
      action: "account.archive",
      resourceType: "account",
    },
    async (tx) => {
      await tx.account.update({
        where: { id: accountId },
        data: { archivedAt: new Date() },
      });
      return { result: null, resourceId: accountId };
    },
  );

  return { ok: true, data: null };
}
