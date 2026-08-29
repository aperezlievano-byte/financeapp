import { describe, expect, it } from "vitest";
import { GET as healthGet } from "../../src/app/api/health/route";
import { env } from "../../src/lib/env";
import { prisma } from "../../src/server/db/client";

describe("schema, seed y guardas de integridad", () => {
  it("siembra exactamente 4 cuentas y 8 categorias para el unico usuario", async () => {
    const accountCount = await prisma.account.count({
      where: { userId: env.APP_USER_ID },
    });
    const categoryCount = await prisma.category.count({
      where: { userId: env.APP_USER_ID },
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
