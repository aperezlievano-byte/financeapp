import { requireUser } from "../../lib/auth/guard";
import { prisma } from "../../server/db/client";
import { createTransaction, deleteTransaction } from "./actions";
import { LedgerView } from "./ledger-view";

export default async function LedgerPage() {
  const user = await requireUser();
  if (!user.ok) {
    // proxy.ts ya redirige antes de que una peticion sin sesion llegue aca.
    return null;
  }
  const userId = user.data;

  const [transactions, accounts, categories] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, deletedAt: null },
      orderBy: { occurredOn: "desc" },
      include: { account: true, category: true },
    }),
    prisma.account.findMany({
      where: { userId, archivedAt: null },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: { userId, archivedAt: null },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <LedgerView
      transactions={transactions.map((t) => ({
        id: t.id,
        occurredOn: t.occurredOn.toISOString().slice(0, 10),
        description: t.description,
        amountCentsStr: t.amountCents.toString(),
        direction: t.direction,
        accountName: t.account.name,
        categoryName: t.category?.name ?? null,
      }))}
      accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      createAction={createTransaction}
      deleteAction={deleteTransaction}
    />
  );
}
