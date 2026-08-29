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

// El libro entero (tabs, FAB, bottom-sheet) reacciona por estado de React, a
// diferencia del formulario siempre-visible que reemplazo -- server-rendered
// pero inerte hasta que el bundle hidrata. page.goto() resuelve en 'load',
// no cuando React adjunta los onClick, asi que un click inmediato despues
// puede caer en una ventana donde el boton existe pero no hace nada todavia.
// networkidle da margen a que termine de hidratar antes de interactuar.
async function gotoLedger(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
}

// El alta es un bottom-sheet detras del FAB "+", no un formulario siempre
// visible -- abrirlo es el primer paso de cualquier test que registre un
// movimiento. Tipo/Cuenta/Categoria son chips (un boton por opcion), no
// <select>, asi que se seleccionan por click en el texto de la opcion.
async function openNewTransactionForm(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Nuevo movimiento" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

async function fillManualEntry(
  page: import("@playwright/test").Page,
  description: string,
  amountPesos: string,
) {
  await openNewTransactionForm(page);
  await page.getByRole("button", { name: "Gasto" }).click();
  await page.getByLabel("Descripción").fill(description);
  await page.getByLabel("Monto (pesos)").fill(amountPesos);
  // and archived_at is null: cuentas.spec.ts corre antes en la misma suite y
  // deja una cuenta archivada -- accounts nunca se trunca entre specs (a
  // diferencia de transactions), y sin este filtro psql puede devolver el
  // nombre de una cuenta que la UI real jamas muestra como chip (el query
  // del libro tambien filtra archivedAt: null), dejando el test esperando
  // para siempre un boton que no va a aparecer.
  const accountName = psql(
    `select name from accounts where user_id = '${APP_USER_ID}' and archived_at is null order by name limit 1`,
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: accountName, exact: true })
    .click();
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

test("shows the empty state for Hoy when there are no transactions", async ({
  page,
}) => {
  await gotoLedger(page);
  await expect(
    page.getByText("No hay movimientos registrados hoy."),
  ).toBeVisible();
});

test("a manual expense of 100000 pesos shows a row with the signed amount −$100.000", async ({
  page,
}) => {
  await gotoLedger(page);
  await fillManualEntry(page, "Prueba e2e", "100000");
  await page.getByRole("button", { name: "Registrar movimiento" }).click();

  const row = page.getByRole("listitem").filter({ hasText: "Prueba e2e" });
  await expect(row).toBeVisible();
  await expect(row.getByText("−$100.000")).toBeVisible();
});

test("soft-deleting a row needs a second tap to confirm, then removes it from the list but keeps the database row with deleted_at set", async ({
  page,
}) => {
  await gotoLedger(page);
  await fillManualEntry(page, "Para borrar", "5000");
  await page.getByRole("button", { name: "Registrar movimiento" }).click();

  const row = page.getByRole("listitem").filter({ hasText: "Para borrar" });
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: "Borrar movimiento" }).click();
  await expect(row).toBeVisible(); // el primer tap solo pide confirmacion
  await row.getByRole("button", { name: "Confirmar borrado" }).click();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Para borrar" }),
  ).toHaveCount(0);

  const deletedAt = psql(
    `select deleted_at from transactions where user_id = '${APP_USER_ID}' and description = 'Para borrar'`,
  );
  expect(deletedAt).not.toBe("");
});

// El libro ya no pagina a 50 filas: Historial necesita el historico completo
// para agrupar por mes, asi que el limite se reemplazo por la separacion
// entre pestañas -- un movimiento de un mes pasado nunca aparece en Hoy,
// pero si aparece en Historial al elegir ese mes.
test("a transaction from a past month is absent from Hoy but visible in Historial for that month", async ({
  page,
}) => {
  const accountId = psql(
    `select id from accounts where user_id = '${APP_USER_ID}' and archived_at is null order by name limit 1`,
  );
  const pastMonth = new Date();
  pastMonth.setMonth(pastMonth.getMonth() - 1);
  const pastDate = new Date(pastMonth.getFullYear(), pastMonth.getMonth(), 5)
    .toISOString()
    .slice(0, 10);
  const pastMonthKey = pastDate.slice(0, 7);

  psql(
    `insert into transactions (id, user_id, account_id, occurred_on, description, amount_cents, direction, source, source_ref, created_at)
     values (gen_random_uuid(), '${APP_USER_ID}', '${accountId}', '${pastDate}', 'Del mes pasado', 3000, 'out', 'manual', 'e2e-past-month', now())`,
  );

  await gotoLedger(page);
  await expect(
    page.getByRole("listitem").filter({ hasText: "Del mes pasado" }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Historial" }).click();
  await page.getByLabel("Mes").fill(pastMonthKey);
  await expect(
    page.getByRole("listitem").filter({ hasText: "Del mes pasado" }),
  ).toBeVisible();
});

test("every interactive control is reachable by keyboard with a visible focus indicator", async ({
  page,
}) => {
  const firstAccount = psql(
    `select name from accounts where user_id = '${APP_USER_ID}' and archived_at is null order by name limit 1`,
  );
  const firstCategory = psql(
    `select name from categories where user_id = '${APP_USER_ID}' and archived_at is null order by name limit 1`,
  );

  await gotoLedger(page);

  // document.activeElement en vez de locator(":focus"): el locator espera a
  // que haya un match y se cuelga si el foco pasa por un estado que no
  // matchea (por ejemplo, un segmento interno de <input type="date">).
  // aria-label se revisa antes que textContent porque es el nombre accesible
  // real de un boton icono como el FAB, cuyo texto visible es solo "+".
  async function focusedAccessibleText(): Promise<string> {
    return page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return "";
      if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
        const label = el.labels?.[0]?.textContent?.trim();
        if (label) return label;
      }
      const ariaLabel = el.getAttribute("aria-label");
      if (ariaLabel) return ariaLabel;
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

  // 12, no 4: el grupo de chips de Categoria puede tener varias opciones
  // sembradas por prisma/seed.ts entre "Sin categoría" y el boton de submit,
  // cada una su propio tab-stop -- a diferencia de un <select>, que era un
  // solo tab-stop sin importar cuantas <option> tuviera.
  const MAX_TABS_PER_CONTROL = 12;

  async function expectReachable(expectedLabel: string) {
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

  const topLevelOrder = [
    "Saltar al contenido",
    "Libro",
    "Cuentas",
    "Revisión",
    "Subir",
    "Importar",
    "Cerrar sesión",
    "Hoy",
    "Historial",
    "Resumen",
    "Nuevo movimiento",
  ];
  for (const expectedLabel of topLevelOrder) {
    await expectReachable(expectedLabel);
  }

  // El FAB recien alcanzado por Tab: Enter lo activa igual que un click.
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();

  // El modal mueve el foco a Descripción al abrir -- no hace falta Tab hasta
  // ahi, ya es el elemento activo.
  expect(await focusedAccessibleText()).toContain("Descripción");
  expect(await focusedHasVisibleRing()).toBe(true);

  const modalOrder = [
    "Monto (pesos)",
    "Fecha",
    firstAccount,
    "Sin categoría",
    firstCategory,
    "Registrar movimiento",
    "Cancelar",
  ];
  for (const expectedLabel of modalOrder) {
    await expectReachable(expectedLabel);
  }
});
