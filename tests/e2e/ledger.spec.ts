import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";

const APP_USER_ID =
  process.env.E2E_USER_ID ?? "00000000-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execSync(
    `docker compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d personal_finance_test -t -A -c "${sql.replace(/"/g, '\\"')}"`,
  )
    .toString()
    .trim();
}

async function fillManualEntry(
  page: import("@playwright/test").Page,
  description: string,
  amountPesos: string,
) {
  await page.getByLabel("Descripción").fill(description);
  await page.getByLabel("Monto (pesos)").fill(amountPesos);
  await page.getByLabel("Tipo").selectOption("out");
  const accountSelect = page.getByLabel("Cuenta");
  const firstValue = await accountSelect
    .locator("option")
    .first()
    .getAttribute("value");
  await accountSelect.selectOption(firstValue ?? "");
  await page.getByLabel("Fecha").fill(new Date().toISOString().slice(0, 10));
}

// transactions es append-only por trigger -- ni siquiera un test puede
// borrar filas con DELETE. TRUNCATE no dispara triggers de DELETE en
// Postgres, asi que es la unica forma de resetear el estado entre tests sin
// tocar la garantia real del producto (que es sobre DELETE, no sobre
// herramientas de infraestructura contra una base de test efimera).
test.beforeEach(() => {
  psql(
    "truncate table pending_transactions, transactions restart identity cascade",
  );
});

test("shows the empty state when there are no transactions", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Todavía no hay movimientos.")).toBeVisible();
});

test("a manual expense of 100000 pesos shows a row with the signed amount −$100.000", async ({
  page,
}) => {
  await page.goto("/");
  await fillManualEntry(page, "Prueba e2e", "100000");
  await page.getByRole("button", { name: "Agregar" }).click();

  const row = page.getByRole("row", { name: /Prueba e2e/ });
  await expect(row).toBeVisible();
  await expect(row.getByText("−$100.000")).toBeVisible();
});

test("soft-deleting a row removes it from the list but keeps the database row with deleted_at set", async ({
  page,
}) => {
  await page.goto("/");
  await fillManualEntry(page, "Para borrar", "5000");
  await page.getByRole("button", { name: "Agregar" }).click();

  const row = page.getByRole("row", { name: /Para borrar/ });
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: "Borrar" }).click();
  await expect(page.getByRole("row", { name: /Para borrar/ })).toHaveCount(0);

  const deletedAt = psql(
    `select deleted_at from transactions where user_id = '${APP_USER_ID}' and description = 'Para borrar'`,
  );
  expect(deletedAt).not.toBe("");
});

test("returns at most 50 rows even when more exist", async ({ page }) => {
  const accountId = psql(
    `select id from accounts where user_id = '${APP_USER_ID}' order by name limit 1`,
  );
  const values = Array.from(
    { length: 55 },
    (_, i) =>
      `(gen_random_uuid(), '${APP_USER_ID}', '${accountId}', current_date, 'seed ${i}', ${1000 + i}, 'out', 'manual', 'seed-limit-${i}', now())`,
  ).join(",\n");
  psql(
    `insert into transactions (id, user_id, account_id, occurred_on, description, amount_cents, direction, source, source_ref, created_at) values ${values}`,
  );

  await page.goto("/");
  await expect(page.locator("tbody tr")).toHaveCount(50);
});

test("every interactive control is reachable by keyboard with a visible focus indicator", async ({
  page,
}) => {
  await page.goto("/");

  const expectedOrder = [
    "Saltar al contenido",
    "Libro",
    "Cuentas",
    "Revisión",
    "Subir",
    "Importar",
    "Cerrar sesión",
    "Descripción",
    "Monto (pesos)",
    "Tipo",
    "Cuenta",
    "Categoría",
    "Fecha",
    "Agregar",
  ];

  // document.activeElement en vez de locator(":focus"): el locator espera a
  // que haya un match y se cuelga si el foco pasa por un estado que no
  // matchea (por ejemplo, un segmento interno de <input type="date">).
  async function focusedAccessibleText(): Promise<string> {
    return page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return "";
      if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
        const label = el.labels?.[0]?.textContent?.trim();
        if (label) return label;
      }
      return el.textContent?.trim() ?? "";
    });
  }

  async function focusedHasVisibleRing(): Promise<boolean> {
    return page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return false;
      const style = getComputedStyle(el);
      return style.boxShadow !== "none" || style.outlineStyle !== "none";
    });
  }

  // Un <input type="date"> nativo consume varios Tab para sus segmentos
  // dia/mes/anio antes de dejar el control -- no asumimos un Tab por
  // control, buscamos cada etiqueta esperada dentro de un presupuesto corto.
  const MAX_TABS_PER_CONTROL = 4;

  for (const expectedLabel of expectedOrder) {
    let found = false;

    for (let attempt = 0; attempt < MAX_TABS_PER_CONTROL; attempt++) {
      await page.keyboard.press("Tab");
      const accessibleText = await focusedAccessibleText();
      if (accessibleText.includes(expectedLabel)) {
        found = true;
        break;
      }
    }

    expect(found, `no se alcanzó "${expectedLabel}" por teclado`).toBe(true);
    expect(await focusedHasVisibleRing()).toBe(true);
  }
});
