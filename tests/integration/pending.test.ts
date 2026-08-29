import { describe, expect, it } from "vitest";
import { env } from "../../src/lib/env";
import type { AiClient } from "../../src/server/ai/gateway";
import { prisma } from "../../src/server/db/client";
import { extractFreeText } from "../../src/server/ingest/extract-free-text";
import { createPending } from "../../src/server/ingest/pending";

function fakeClient(response: string): AiClient {
  return {
    async complete() {
      return response;
    },
  };
}

describe("createPending", () => {
  it("writes exactly one pending_transactions row and zero transactions rows for a successful extraction", async () => {
    const client = fakeClient(
      JSON.stringify({
        description: "Club de tiro",
        amountPesos: "100000",
        direction: "out",
        occurredOn: null,
        accountName: "cuenta de ahorros",
        categoryName: null,
        confidence: 0.9,
      }),
    );

    const rawInput = "pagué el club de tiro por 100000 de mi cuenta de ahorros";
    const extraction = await extractFreeText(env.APP_USER_ID, rawInput, client);
    expect(extraction.ok).toBe(true);
    if (!extraction.ok) return;

    const transactionCountBefore = await prisma.transaction.count();

    const pending = await createPending({
      userId: env.APP_USER_ID,
      source: "free_text",
      rawInput,
      extraction: extraction.data,
    });

    const pendingRows = await prisma.pendingTransaction.findMany({
      where: { id: pending.id },
    });
    expect(pendingRows).toHaveLength(1);
    expect(pendingRows[0]?.status).toBe("awaiting_review");

    const transactionCountAfter = await prisma.transaction.count();
    expect(transactionCountAfter).toBe(transactionCountBefore);
  });
});
