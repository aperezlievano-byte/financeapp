import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

// statement-sample.pdf es un fixture fijo (§10); se le agrega un UUID de
// cola en un archivo temporal para que cada corrida de la suite e2e tenga un
// sha256 distinto y no choque con el documents de una corrida anterior --
// nada trunca esa tabla entre corridas, a diferencia de transactions.
function uniqueStatementFile(): string {
  const base = readFileSync(
    join(process.cwd(), "tests/fixtures/statement-sample.pdf"),
  );
  const bytes = Buffer.concat([base, Buffer.from(randomUUID())]);
  const dir = mkdtempSync(join(tmpdir(), "pfa-e2e-"));
  const filePath = join(dir, "extracto.pdf");
  writeFileSync(filePath, bytes);
  return filePath;
}

test("uploads a statement through the interface and lists its movements on /revision", async ({
  page,
}) => {
  const filePath = uniqueStatementFile();

  await page.goto("/subir");
  await page
    .getByLabel("Archivo (PNG, JPEG o PDF, máx. 10 MB)")
    .setInputFiles(filePath);
  await page.getByRole("button", { name: "Subir" }).click();

  await page.goto("/revision");
  await expect(page.getByText("Compra e2e")).toBeVisible();
});
