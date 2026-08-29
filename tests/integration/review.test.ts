import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { env } from "../../src/lib/env";
import { prisma } from "../../src/server/db/client";
import { commitPending, rejectPending } from "../../src/server/ledger/commit";

async function createPendingRow(
  overrides: Partial<{
    amountCents: bigint | null;
  }> = {},
) {
  const account = await prisma.account.findFirstOrThrow({
    where: { userId: env.APP_USER_ID, name: "cuenta de ahorros" },
  });

  return prisma.pendingTransaction.create({
    data: {
      userId: env.APP_USER_ID,
      status: "awaiting_review",
      source: "free_text",
      rawInput: `prueba revision ${randomUUID()}`,
      extraction: {},
      accountId: account.id,
      occurredOn: new Date(),
      description: "prueba",
      amountCents: "amountCents" in overrides ? overrides.amountCents : 50000n,
      direction: "out",
    },
  });
}

describe("commitPending validation", () => {
  it("returns validation_failed naming amount_cents when it's missing", async () => {
    const pending = await createPendingRow({ amountCents: null });

    const countBefore = await prisma.transaction.count();
    const result = await commitPending(pending.id, env.APP_USER_ID);
    const countAfter = await prisma.transaction.count();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation_failed");
      expect(result.error.message).toContain("amount_cents");
    }
    expect(countAfter).toBe(countBefore);
  });
});

describe("commitPending", () => {
  it("confirms a pending row: one transaction, committed_transaction_id set, one audit_log row", async () => {
    const pending = await createPendingRow();

    const result = await commitPending(pending.id, env.APP_USER_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const resolved = await prisma.pendingTransaction.findUniqueOrThrow({
      where: { id: pending.id },
    });
    expect(resolved.committedTransactionId).toBe(result.data.transactionId);

    const auditRows = await prisma.auditLog.findMany({
      where: {
        resourceType: "transaction",
        resourceId: result.data.transactionId,
        action: "pending.confirm",
      },
    });
    expect(auditRows).toHaveLength(1);
  });

  it("returns conflict on the second call and leaves the transactions count unchanged", async () => {
    const pending = await createPendingRow();

    const first = await commitPending(pending.id, env.APP_USER_ID);
    expect(first.ok).toBe(true);

    const countBefore = await prisma.transaction.count();
    const second = await commitPending(pending.id, env.APP_USER_ID);
    const countAfter = await prisma.transaction.count();

    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.code).toBe("conflict");
    }
    expect(countAfter).toBe(countBefore);
  });
});

describe("rejectPending", () => {
  it("sets status to rejected and writes zero transactions", async () => {
    const pending = await createPendingRow();

    const countBefore = await prisma.transaction.count();
    const result = await rejectPending(pending.id, env.APP_USER_ID);
    const countAfter = await prisma.transaction.count();

    expect(result.ok).toBe(true);
    expect(countAfter).toBe(countBefore);

    const resolved = await prisma.pendingTransaction.findUniqueOrThrow({
      where: { id: pending.id },
    });
    expect(resolved.status).toBe("rejected");
  });
});
