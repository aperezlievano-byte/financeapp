import { describe, expect, it } from "vitest";
import { GET as healthGet } from "../../src/app/api/health/route";
import { env } from "../../src/lib/env";
import { prisma } from "../../src/server/db/client";

const SEEDED_ACCOUNT_NAMES = [
  "cuenta de ahorros",
  "cuenta corriente",
  "efectivo",
  "tarjeta de crédito",
];

const SEEDED_CATEGORY_NAMES = [
  "mercado",
  "servicios",
  "transporte",
  "salud",
  "ocio",
  "educación",
  "ingresos",
  "otros",
];

describe("schema, seed y guardas de integridad", () => {
  it("siembra exactamente las 4 cuentas y 8 categorias esperadas, sin duplicarlas", async () => {
    // Cuenta por nombre, no el total del usuario: E2-T2 crea cuentas de
    // verdad, asi que un conteo total ya no aisla lo que sembro seed.ts.
    const accountCount = await prisma.account.count({
      where: { userId: env.APP_USER_ID, name: { in: SEEDED_ACCOUNT_NAMES } },
    });
    const categoryCount = await prisma.category.count({
      where: { userId: env.APP_USER_ID, name: { in: SEEDED_CATEGORY_NAMES } },
    });

    expect(accountCount).toBe(4);
    expect(categoryCount).toBe(8);
  });

  it("rechaza una transaccion con amount_cents de 0", async () => {
    const account = await prisma.account.findFirstOrThrow({
      where: { userId: env.APP_USER_ID, name: "cuenta de ahorros" },
    });

    await expect(
      prisma.transaction.create({
        data: {
          userId: env.APP_USER_ID,
          accountId: account.id,
          occurredOn: new Date("2026-01-01"),
          description: "monto invalido",
          amountCents: 0n,
          direction: "out",
          source: "manual",
        },
      }),
    ).rejects.toThrow();
  });

  it("GET /api/health reporta la base como alcanzable", async () => {
    const response = await healthGet();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.db).toBe("reachable");
  });
});
