import { readFileSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { pesosNumberToCents } from "../src/lib/money";
import { prisma } from "../src/server/db/client";

// Recalcula la suma directamente del .xlsx (misma logica que import-excel.ts,
// pero de solo lectura) y la compara contra la suma real del libro de LA
// cuenta que sembro seed.ts como "cuenta de ahorros" -- no contra cualquier
// cuenta con filas source='excel_import'. No hay ninguna columna que marque
// "esta es la cuenta del historico" (§9 paso 13 nunca la definio), y nada le
// impide a otra parte de la app escribir excel_import en otra cuenta por su
// cuenta (p.ej. un test de una fila que falla, en una cuenta aparte a
// proposito) -- sumar todas las cuentas indiscriminadamente cuenta esas
// filas ajenas como si fueran del historico y compara contra un total que
// nunca les correspondio. Ver decision log.
const TARGET_ACCOUNT_NAME = "cuenta de ahorros";

async function computeFileTotal(): Promise<bigint> {
  const buffer = readFileSync(
    join(process.cwd(), "tests/fixtures/historical-sample.xlsx"),
  );
  const workbook = new ExcelJS.Workbook();
  // Ver el comentario equivalente en import-excel.ts: exceljs@4.4.0 declara
  // `interface Buffer extends ArrayBuffer {}` en su .d.ts, y ese merge global
  // choca con el Buffer real de Node. La conversion es segura en runtime.
  // biome-ignore lint/suspicious/noExplicitAny: ver comentario arriba
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.worksheets[0];
  if (!sheet) return 0n;

  let total = 0n;
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const monto = row.getCell(3).value;
    if (typeof monto !== "number" || !Number.isFinite(monto)) return;
    const amountCents = pesosNumberToCents(monto);
    total += monto < 0 ? -amountCents : amountCents;
  });
  return total;
}

async function main(): Promise<void> {
  const fileTotal = await computeFileTotal();

  const account = await prisma.account.findFirst({
    where: { name: TARGET_ACCOUNT_NAME },
  });
  if (!account) {
    console.log(
      `No existe la cuenta "${TARGET_ACCOUNT_NAME}" -- nada que comparar.`,
    );
    process.exit(0);
  }

  const grouped = await prisma.transaction.groupBy({
    by: ["direction"],
    where: {
      accountId: account.id,
      source: "excel_import",
      deletedAt: null,
    },
    _sum: { amountCents: true },
  });

  if (grouped.length === 0) {
    console.log("Sin importaciones de Excel todavía -- nada que comparar.");
    process.exit(0);
  }

  let ledgerTotal = 0n;
  for (const row of grouped) {
    const amount = row._sum.amountCents ?? 0n;
    ledgerTotal += row.direction === "in" ? amount : -amount;
  }

  const diff = ledgerTotal - fileTotal;
  console.log(
    `${account.name}: libro=${ledgerTotal} hoja=${fileTotal} diferencia=${diff}`,
  );
  process.exit(diff === 0n ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
