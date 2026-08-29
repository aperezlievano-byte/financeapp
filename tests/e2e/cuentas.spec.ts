import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("creates, renames and archives an account through the interface", async ({
  page,
}) => {
  const name = `cuenta e2e ${randomUUID().slice(0, 8)}`;
  await page.goto("/cuentas");

  await page.getByLabel("Nombre", { exact: true }).fill(name);
  await page.getByLabel("Tipo").selectOption("savings");
  await page.getByRole("button", { name: "Crear" }).click();

  const item = page.getByRole("listitem").filter({ hasText: name });
  await expect(item).toBeVisible();

  const renamedName = `${name} renombrada`;
  await item.getByLabel(`Nuevo nombre para ${name}`).fill(renamedName);
  await item.getByRole("button", { name: "Renombrar" }).click();

  const renamedItem = page
    .getByRole("listitem")
    .filter({ hasText: renamedName });
  await expect(renamedItem).toBeVisible();

  await renamedItem.getByRole("button", { name: "Archivar" }).click();
  await expect(renamedItem.getByText("archivada")).toBeVisible();

  await page.goto("/");
  const accountSelect = page.getByLabel("Cuenta");
  const options = await accountSelect.locator("option").allTextContents();
  expect(options).not.toContain(renamedName);
});
