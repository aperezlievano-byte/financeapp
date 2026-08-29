import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { env } from "../../src/lib/env";
import { prisma } from "../../src/server/db/client";
import { importExcel } from "../../src/server/ingest/import-excel";

function fixtureBuffer(): Buffer {
  return readFileSync(
    join(process.cwd(), "tests/fixtures/historical-sample.xlsx"),
  );
}

async function accountId(name = "cuenta de ahorros"): Promise<string> {
  const account = await prisma.account.findFirstOrThrow({
    where: { userId: env.APP_USER_ID, name },
  });
  return account.id;
}

// Filas construidas a mano, no la fixture compartida: import-excel.test.ts
// no puede usar contenido fijo para casos que van a importar de verdad (ver
// la regla nueva de .claude/rules/testing.md) porque source_ref no incluye
// nada mas que fecha|descripcion|monto -- a diferencia de statement-batch.ts,
// aca no hay un filename que romper el empate entre corridas.
async function buildWorkbookBuffer(
  rows: [unknown, unknown, unknown][],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("historico");
  sheet.addRow(["fecha", "descripcion", "monto"]);
  for (const row of rows) {
    sheet.addRow(row);
  }
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

describe("importExcel", () => {
  it("importing the historical workbook writes the three documented transactions with source excel_import", async () => {
    const result = await importExcel(
      env.APP_USER_ID,
      await accountId(),
      fixtureBuffer(),
    );

    // Idempotente: si esta suite ya corrio antes en la misma base de test,
    // las tres filas se cuentan como "saltadas", no "importadas" -- el
    // criterio real es que las tres existan, no que este llamado en
    // particular las haya creado.
    expect(result.read).toBe(3);
    expect(result.failed).toHaveLength(0);
    expect(result.imported + result.skipped).toBe(3);

    const expected: [string, bigint, "in" | "out"][] = [
      ["Mercado del mes", 45000000n, "out"],
      ["Pago nomina", 320000000n, "in"],
      ["Club de tiro", 10000000n, "out"],
    ];

    for (const [description, amountCents, direction] of expected) {
      const transaction = await prisma.transaction.findFirstOrThrow({
        where: {
          userId: env.APP_USER_ID,
          source: "excel_import",
          description,
        },
      });
      expect(transaction.amountCents).toBe(amountCents);
      expect(transaction.direction).toBe(direction);

      const auditRows = await prisma.auditLog.findMany({
        where: {
          resourceType: "transaction",
          resourceId: transaction.id,
          action: "import.excel",
        },
      });
      expect(auditRows).toHaveLength(1);
    }
  });

  it("importing the same workbook again leaves the transaction count unchanged and reports the rows as skipped", async () => {
    const account = await accountId();
    // Corre una vez para garantizar que las tres filas ya existen, sin
    // asumir el orden de los tests dentro del archivo.
    await importExcel(env.APP_USER_ID, account, fixtureBuffer());

    const countBefore = await prisma.transaction.count({
      where: { userId: env.APP_USER_ID, source: "excel_import" },
    });
    const second = await importExcel(env.APP_USER_ID, account, fixtureBuffer());
    const countAfter = await prisma.transaction.count({
      where: { userId: env.APP_USER_ID, source: "excel_import" },
    });

    expect(second.imported).toBe(0);
    expect(second.skipped).toBe(3);
    expect(second.failed).toHaveLength(0);
    expect(countAfter).toBe(countBefore);
  });

  it("a row with a non-numeric amount is reported as failed and the remaining rows still import", async () => {
    const uniqueDescription = `Fila válida ${randomUUID()}`;
    const buffer = await buildWorkbookBuffer([
      ["2026-03-01", uniqueDescription, -75000],
      ["2026-03-02", "Fila con monto inválido", "no es un número"],
    ]);

    // Cuenta distinta de la del historico canonico: parity-check.ts asume
    // que solo esa cuenta recibe excel_import de historical-sample.xlsx (ver
    // decision log de E2-T6) -- mezclar aca infla esa suma y rompe el script.
    const result = await importExcel(
      env.APP_USER_ID,
      await accountId("cuenta corriente"),
      buffer,
    );

    expect(result.read).toBe(2);
    expect(result.imported).toBe(1);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.row).toBe(3);

    const transaction = await prisma.transaction.findFirstOrThrow({
      where: {
        userId: env.APP_USER_ID,
        source: "excel_import",
        description: uniqueDescription,
      },
    });
    expect(transaction.amountCents).toBe(7500000n);
    expect(transaction.direction).toBe("out");
  });
});
