import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import { pesosNumberToCents } from "../../lib/money";
import { importRow } from "../ledger/commit";

// Importacion de una sola vez del historico: lee el .xlsx, y por cada fila
// escribe una transaction directo (via commit.ts), sin pasar por revision --
// son datos que Alejandro ya confirmo al escribirlos en su hoja. Reimportar
// el mismo archivo no duplica: source_ref = sha256(fecha|descripcion|monto)
// y la unicidad (user_id, source, source_ref) de §4 hace que importRow
// devuelva conflict, que aca se cuenta como "saltada".

export type ImportRowFailure = { row: number; reason: string };

export type ImportReport = {
  read: number;
  imported: number;
  skipped: number;
  failed: ImportRowFailure[];
};

export async function importExcel(
  userId: string,
  accountId: string,
  buffer: Buffer,
): Promise<ImportReport> {
  const workbook = new ExcelJS.Workbook();
  // exceljs@4.4.0 declara `interface Buffer extends ArrayBuffer {}` en su
  // propio .d.ts -- ese merge ambiente global choca con el Buffer real de
  // Node (que no expone miembros de ArrayBuffer como resizable/maxByteLength)
  // y ningun Buffer real satisface el tipo resultante. skipLibCheck no
  // alcanza porque el problema es el merge, no un error dentro del .d.ts.
  // `as unknown as Buffer` tampoco alcanza -- el cast resuelve al mismo
  // Buffer ya fusionado, asi que sigue fallando contra si mismo. Hace falta
  // `any` para escapar la comprobacion por completo. La conversion es segura:
  // exceljs solo usa el buffer como bytes en runtime.
  // biome-ignore lint/suspicious/noExplicitAny: ver comentario arriba
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.worksheets[0];

  const report: ImportReport = {
    read: 0,
    imported: 0,
    skipped: 0,
    failed: [],
  };

  if (!sheet) {
    return report;
  }

  const rows: {
    rowNumber: number;
    fecha: unknown;
    descripcion: unknown;
    monto: unknown;
  }[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // encabezado: fecha, descripcion, monto
    rows.push({
      rowNumber,
      fecha: row.getCell(1).value,
      descripcion: row.getCell(2).value,
      monto: row.getCell(3).value,
    });
  });

  for (const { rowNumber, fecha, descripcion, monto } of rows) {
    report.read += 1;

    if (typeof monto !== "number" || !Number.isFinite(monto)) {
      report.failed.push({
        row: rowNumber,
        reason: "El monto no es un número válido.",
      });
      continue;
    }
    if (typeof descripcion !== "string" || descripcion.trim() === "") {
      report.failed.push({ row: rowNumber, reason: "Falta la descripción." });
      continue;
    }
    const occurredOn = new Date(String(fecha));
    if (Number.isNaN(occurredOn.getTime())) {
      report.failed.push({ row: rowNumber, reason: "La fecha no es válida." });
      continue;
    }

    const amountCents = pesosNumberToCents(monto);
    const direction: "in" | "out" = monto < 0 ? "out" : "in";
    const sourceRef = createHash("sha256")
      .update(`${String(fecha)}|${descripcion}|${monto}`)
      .digest("hex");

    const result = await importRow({
      userId,
      accountId,
      occurredOn,
      description: descripcion,
      amountCents,
      direction,
      sourceRef,
    });

    if (result.ok) {
      report.imported += 1;
    } else if (result.error.code === "conflict") {
      report.skipped += 1;
    } else {
      report.failed.push({ row: rowNumber, reason: result.error.message });
    }
  }

  return report;
}
