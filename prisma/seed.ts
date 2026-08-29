import { env } from "../src/lib/env";
import { prisma } from "../src/server/db/client";

// Idempotente (upsert por (userId, name)): tests/e2e/global-setup.ts lo llama
// en cada corrida. Cero transacciones -- el libro arranca vacio.

const ACCOUNTS: {
  name: string;
  kind: "savings" | "checking" | "cash" | "credit_card";
}[] = [
  { name: "cuenta de ahorros", kind: "savings" },
  { name: "cuenta corriente", kind: "checking" },
  { name: "efectivo", kind: "cash" },
  { name: "tarjeta de crédito", kind: "credit_card" },
];

const CATEGORIES = [
  "mercado",
  "servicios",
  "transporte",
  "salud",
  "ocio",
  "educación",
  "ingresos",
  "otros",
];

async function main(): Promise<void> {
  const userId = env.APP_USER_ID;

  for (const account of ACCOUNTS) {
    await prisma.account.upsert({
      where: { userId_name: { userId, name: account.name } },
      update: {},
      create: { userId, name: account.name, kind: account.kind },
    });
  }

  for (const name of CATEGORIES) {
    await prisma.category.upsert({
      where: { userId_name: { userId, name } },
      update: {},
      create: { userId, name },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
