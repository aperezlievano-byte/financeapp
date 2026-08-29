import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

const APP_USER_ID =
  process.env.E2E_USER_ID ?? "00000000-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execSync(
    `docker compose exec -T db psql -v ON_ERROR_STOP=1 -q -U postgres -d personal_finance_test -t -A -c "${sql.replace(/"/g, '\\"')}"`,
  )
    .toString()
    .trim();
}

test("confirms a pending row from the review screen", async ({ page }) => {
  const rawInput = `mensaje e2e ${randomUUID()}`;
  const accountId = psql(
    `select id from accounts where user_id = '${APP_USER_ID}' order by name limit 1`,
  );
  const pendingId = psql(
    `insert into pending_transactions (id, user_id, status, source, raw_input, extraction, account_id, occurred_on, description, amount_cents, direction, created_at) values (gen_random_uuid(), '${APP_USER_ID}', 'awaiting_review', 'free_text', '${rawInput}', '{}', '${accountId}', current_date, 'prueba revision e2e', 75000, 'out', now()) returning id`,
  );

  await page.goto("/revision");
  await expect(page.getByText(rawInput)).toBeVisible();

  const card = page.locator("li").filter({ hasText: rawInput });
  await card.getByRole("button", { name: "Confirmar" }).click();

  await expect(page.getByText(rawInput)).not.toBeVisible();

  const committed = psql(
    `select committed_transaction_id from pending_transactions where id = '${pendingId}'`,
  );
  expect(committed).not.toBe("");
});
