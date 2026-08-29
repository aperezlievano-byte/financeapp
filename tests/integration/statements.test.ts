import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { env } from "../../src/lib/env";
import type { AiClient } from "../../src/server/ai/gateway";
import { prisma } from "../../src/server/db/client";
import { processStatement } from "../../src/server/ingest/statement-batch";
import { commitPending } from "../../src/server/ledger/commit";

function fakeClient(response: string): AiClient {
  return {
    async complete() {
      return response;
    },
  };
}

function movement(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    description: "Mercado del mes",
    amountPesos: "75000",
    direction: "out",
    occurredOn: "2026-01-15T00:00:00.000Z",
    accountName: "cuenta de ahorros",
    categoryName: null,
    confidence: 0.8,
    ...overrides,
  };
}

// statement-sample.pdf es un fixture minimo (§10); el contenido no importa
// porque el cliente de IA esta mockeado -- se le agrega un UUID de cola para
// que cada corrida tenga un sha256 distinto y no choque con documents de una
// corrida anterior.
function uniqueStatementBytes(): Buffer {
  const base = readFileSync(
    join(process.cwd(), "tests/fixtures/statement-sample.pdf"),
  );
  return Buffer.concat([base, Buffer.from(randomUUID())]);
}

// source_ref incluye el filename (junto con indice, fecha, descripcion y
// monto -- ver statement-batch.ts). Un filename fijo hace que confirmar un
// movimiento en una corrida deje una fila en transactions cuyo source_ref
// vuelve a calcularse igual en la proxima corrida, y processStatement lo
// salta como "ya confirmado" -- nada trunca transactions entre corridas de
// vitest. Por eso cada test usa un filename unico.
function uniqueFilename(): string {
  return `extracto-${randomUUID()}.pdf`;
}

describe("processStatement", () => {
  it("a statement yielding three movements writes three pending rows with source statement", async () => {
    const bytes = uniqueStatementBytes();
    const response = JSON.stringify([
      movement({ description: "Movimiento 1" }),
      movement({ description: "Movimiento 2" }),
      movement({ description: "Movimiento 3" }),
    ]);

    const result = await processStatement(
      { userId: env.APP_USER_ID, filename: uniqueFilename(), bytes },
      fakeClient(response),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.pendingIds).toHaveLength(3);

    const pendings = await prisma.pendingTransaction.findMany({
      where: { id: { in: result.data.pendingIds } },
    });
    expect(pendings).toHaveLength(3);
    for (const pending of pendings) {
      expect(pending.source).toBe("statement");
      expect(pending.documentId).toBe(result.data.documentId);
    }
  });

  it("uploading the same statement file again returns conflict and creates no new pending rows", async () => {
    const bytes = uniqueStatementBytes();
    const filename = uniqueFilename();
    const client = fakeClient(JSON.stringify([movement()]));

    const first = await processStatement(
      { userId: env.APP_USER_ID, filename, bytes },
      client,
    );
    expect(first.ok).toBe(true);

    const countBefore = await prisma.pendingTransaction.count();
    const second = await processStatement(
      { userId: env.APP_USER_ID, filename, bytes },
      client,
    );
    const countAfter = await prisma.pendingTransaction.count();

    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.code).toBe("conflict");
    }
    expect(countAfter).toBe(countBefore);
  });

  it("a movement with no readable date is stored with occurred_on null and status awaiting_review", async () => {
    const bytes = uniqueStatementBytes();
    const response = JSON.stringify([movement({ occurredOn: null })]);

    const result = await processStatement(
      { userId: env.APP_USER_ID, filename: uniqueFilename(), bytes },
      fakeClient(response),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const pending = await prisma.pendingTransaction.findUniqueOrThrow({
      where: { id: result.data.pendingIds[0] },
    });
    expect(pending.occurredOn).toBeNull();
    expect(pending.status).toBe("awaiting_review");
  });

  it("keeps two movements with identical date, description and amount as separate pending rows, both confirmable", async () => {
    const bytes = uniqueStatementBytes();
    const identical = movement({ description: "Compra idéntica" });
    const response = JSON.stringify([identical, identical]);

    const result = await processStatement(
      { userId: env.APP_USER_ID, filename: uniqueFilename(), bytes },
      fakeClient(response),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.pendingIds).toHaveLength(2);

    const [firstCommit, secondCommit] = await Promise.all(
      result.data.pendingIds.map((pendingId) =>
        commitPending(pendingId, env.APP_USER_ID),
      ),
    );
    expect(firstCommit.ok).toBe(true);
    expect(secondCommit.ok).toBe(true);
    if (!firstCommit.ok || !secondCommit.ok) return;
    expect(firstCommit.data.transactionId).not.toBe(
      secondCommit.data.transactionId,
    );
  });
});
