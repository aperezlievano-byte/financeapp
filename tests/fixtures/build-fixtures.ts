import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";

// Builds the two binary fixtures at run time. Binary bytes cannot be authored
// as text in the blueprint, so the PNG travels as base64 and the workbook is
// produced by exceljs' own writer. Run with `pnpm fixtures`.
const here = dirname(fileURLToPath(import.meta.url));

function writePng(): void {
  const base64 = readFileSync(
    join(here, "receipt-sample.png.base64"),
    "utf8",
  ).trim();
  writeFileSync(
    join(here, "receipt-sample.png"),
    Buffer.from(base64, "base64"),
  );
}

async function writeWorkbook(): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("historico");
  sheet.addRow(["fecha", "descripcion", "monto"]);
  sheet.addRow(["2026-01-15", "Mercado del mes", -450000]);
  sheet.addRow(["2026-01-20", "Pago nomina", 3200000]);
  sheet.addRow(["2026-02-03", "Club de tiro", -100000]);
  await workbook.xlsx.writeFile(join(here, "historical-sample.xlsx"));
}

async function main(): Promise<void> {
  writePng();
  await writeWorkbook();
  console.log("fixtures written: receipt-sample.png, historical-sample.xlsx");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
