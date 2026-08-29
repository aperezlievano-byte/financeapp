import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { env } from "../../src/lib/env";
import { prisma } from "../../src/server/db/client";
import {
  archiveAccount,
  createAccount,
  renameAccount,
} from "../../src/server/ledger/catalog";

describe("createAccount", () => {
  it("returns conflict and creates no row when the name already exists", async () => {
    const name = `cuenta prueba ${randomUUID()}`;
    const first = await createAccount(env.APP_USER_ID, name, "savings");
    expect(first.ok).toBe(true);

    const countBefore = await prisma.account.count({
      where: { userId: env.APP_USER_ID, name },
    });

    const second = await createAccount(env.APP_USER_ID, name, "checking");
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.code).toBe("conflict");
    }

    const countAfter = await prisma.account.count({
      where: { userId: env.APP_USER_ID, name },
    });
    expect(countAfter).toBe(countBefore);
  });
});

describe("archiveAccount", () => {
  it("sets archived_at and leaves the account's transactions readable", async () => {
    const name = `cuenta con movimientos ${randomUUID()}`;
    const created = await createAccount(env.APP_USER_ID, name, "savings");
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const transaction = await prisma.transaction.create({
      data: {
        userId: env.APP_USER_ID,
        accountId: created.data.accountId,
        occurredOn: new Date(),
        description: "prueba de archivado",
        amountCents: 1000n,
        direction: "out",
        source: "manual",
      },
    });

    const archived = await archiveAccount(
      env.APP_USER_ID,
      created.data.accountId,
    );
    expect(archived.ok).toBe(true);

    const account = await prisma.account.findUniqueOrThrow({
      where: { id: created.data.accountId },
    });
    expect(account.archivedAt).not.toBeNull();

    const stillReadable = await prisma.transaction.findUnique({
      where: { id: transaction.id },
    });
    expect(stillReadable).not.toBeNull();
  });
});

describe("audit_log", () => {
  it("writes exactly one row for each of create, rename and archive", async () => {
    const name = `cuenta auditada ${randomUUID()}`;
    const created = await createAccount(env.APP_USER_ID, name, "savings");
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const createRows = await prisma.auditLog.findMany({
      where: {
        resourceType: "account",
        resourceId: created.data.accountId,
        action: "account.create",
      },
    });
    expect(createRows).toHaveLength(1);

    const renamed = await renameAccount(
      env.APP_USER_ID,
      created.data.accountId,
      `${name} renombrada`,
    );
    expect(renamed.ok).toBe(true);

    const renameRows = await prisma.auditLog.findMany({
      where: {
        resourceType: "account",
        resourceId: created.data.accountId,
        action: "account.update",
      },
    });
    expect(renameRows).toHaveLength(1);

    const archived = await archiveAccount(
      env.APP_USER_ID,
      created.data.accountId,
    );
    expect(archived.ok).toBe(true);

    const archiveRows = await prisma.auditLog.findMany({
      where: {
        resourceType: "account",
        resourceId: created.data.accountId,
        action: "account.archive",
      },
    });
    expect(archiveRows).toHaveLength(1);
  });
});
