import { describe, expect, it } from "vitest";
import { env } from "../../src/lib/env";
import { prisma } from "../../src/server/db/client";
import { commitPending, createManual } from "../../src/server/ledger/commit";

describe("createManual", () => {
  it("writes exactly one audit_log row with action transaction.create", async () => {
    const account = await prisma.account.findFirstOrThrow({
      where: { userId: env.APP_USER_ID, name: "cuenta de ahorros" },
    });

    const result = await createManual({
      userId: env.APP_USER_ID,
      accountId: account.id,
      occurredOn: new Date("2026-01-15"),
      description: "prueba de auditoria",
      amountCents: 5000000n,
      direction: "out",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const auditRows = await prisma.auditLog.findMany({
      where: {
        resourceType: "transaction",
        resourceId: result.data.transactionId,
        action: "transaction.create",
      },
    });

    expect(auditRows).toHaveLength(1);
  });
});

describe("commitPending", () => {
  it("returns conflict on the second call and leaves the transactions row count unchanged", async () => {
    const account = await prisma.account.findFirstOrThrow({
      where: { userId: env.APP_USER_ID, name: "cuenta de ahorros" },
    });

    const pending = await prisma.pendingTransaction.create({
      data: {
        userId: env.APP_USER_ID,
        status: "awaiting_review",
        source: "free_text",
        rawInput: "prueba commitPending",
        extraction: {},
        accountId: account.id,
        occurredOn: new Date("2026-01-16"),
        description: "prueba commitPending",
        amountCents: 1000000n,
        direction: "out",
      },
    });

    const first = await commitPending(pending.id, env.APP_USER_ID);
    expect(first.ok).toBe(true);

    const countBefore = await prisma.transaction.count();

    const second = await commitPending(pending.id, env.APP_USER_ID);
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.code).toBe("conflict");
    }

    const countAfter = await prisma.transaction.count();
    expect(countAfter).toBe(countBefore);
  });
});
