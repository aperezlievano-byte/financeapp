import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { env } from "../../src/lib/env";
import type { AiClient } from "../../src/server/ai/gateway";
import { prisma } from "../../src/server/db/client";
import { extractReceipt } from "../../src/server/ingest/extract-document";
import { getObject, putObject } from "../../src/server/storage";

function fakeClient(response: string): AiClient {
  return {
    async complete() {
      return response;
    },
  };
}

const RECEIPT_RESPONSE = JSON.stringify({
  description: "Mercado",
  amountPesos: "75000",
  direction: "out",
  occurredOn: null,
  accountName: "cuenta de ahorros",
  categoryName: null,
  confidence: 0.8,
});

// receipt-sample.png es un fixture determinístico (§10) -- se le agrega un
// UUID de cola para que cada corrida tenga un sha256 distinto y no choque
// con documents de una corrida anterior. El cliente de IA está mockeado, así
// que los bytes extra no rompen nada: nadie decodifica la imagen de verdad.
function uniqueReceiptBytes(): Buffer {
  const base = readFileSync(
    join(process.cwd(), "tests/fixtures/receipt-sample.png"),
  );
  return Buffer.concat([base, Buffer.from(randomUUID())]);
}

describe("extractReceipt", () => {
  it("uploading a PNG receipt writes one documents row and one pending_transactions row with source receipt", async () => {
    const bytes = uniqueReceiptBytes();

    const result = await extractReceipt(
      {
        userId: env.APP_USER_ID,
        filename: "recibo.png",
        mimeType: "image/png",
        bytes,
      },
      fakeClient(RECEIPT_RESPONSE),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const document = await prisma.document.findUniqueOrThrow({
      where: { id: result.data.documentId },
    });
    expect(document.kind).toBe("receipt");

    const pending = await prisma.pendingTransaction.findUniqueOrThrow({
      where: { id: result.data.pendingId },
    });
    expect(pending.source).toBe("receipt");
    expect(pending.documentId).toBe(result.data.documentId);
  });

  it("uploading the same file twice returns conflict and creates no second pending row", async () => {
    const bytes = uniqueReceiptBytes();
    const client = fakeClient(RECEIPT_RESPONSE);

    const first = await extractReceipt(
      {
        userId: env.APP_USER_ID,
        filename: "recibo.png",
        mimeType: "image/png",
        bytes,
      },
      client,
    );
    expect(first.ok).toBe(true);

    const pendingCountBefore = await prisma.pendingTransaction.count();
    const second = await extractReceipt(
      {
        userId: env.APP_USER_ID,
        filename: "recibo.png",
        mimeType: "image/png",
        bytes,
      },
      client,
    );
    const pendingCountAfter = await prisma.pendingTransaction.count();

    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.code).toBe("conflict");
    }
    expect(pendingCountAfter).toBe(pendingCountBefore);
  });

  it("rejects an unsupported mime type with validation_failed and stores nothing", async () => {
    const bytes = uniqueReceiptBytes();

    const documentCountBefore = await prisma.document.count();
    const result = await extractReceipt(
      {
        userId: env.APP_USER_ID,
        filename: "recibo.txt",
        mimeType: "text/plain",
        bytes,
      },
      fakeClient(RECEIPT_RESPONSE),
    );
    const documentCountAfter = await prisma.document.count();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation_failed");
    }
    expect(documentCountAfter).toBe(documentCountBefore);
  });

  it("writes one audit_log row with action document.upload on a successful upload", async () => {
    const bytes = uniqueReceiptBytes();

    const result = await extractReceipt(
      {
        userId: env.APP_USER_ID,
        filename: "recibo.png",
        mimeType: "image/png",
        bytes,
      },
      fakeClient(RECEIPT_RESPONSE),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const auditRows = await prisma.auditLog.findMany({
      where: {
        resourceType: "document",
        resourceId: result.data.documentId,
        action: "document.upload",
      },
    });
    expect(auditRows).toHaveLength(1);
  });
});

describe("local storage driver", () => {
  it("writes an object under STORAGE_LOCAL_DIR and reads it back byte-identical", async () => {
    const key = `test/${randomUUID()}`;
    const bytes = Buffer.from(`contenido de prueba ${randomUUID()}`);

    await putObject(key, bytes, "text/plain");
    const readBack = await getObject(key);

    expect(readBack.equals(bytes)).toBe(true);
  });
});
