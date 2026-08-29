import { requireUser } from "../../../lib/auth/guard";
import { formatCOP } from "../../../lib/money";
import { prisma } from "../../../server/db/client";
import {
  archiveAccountAction,
  createAccountAction,
  renameAccountAction,
} from "./actions";

const KIND_LABELS: Record<string, string> = {
  savings: "Ahorros",
  checking: "Corriente",
  cash: "Efectivo",
  credit_card: "Tarjeta de crédito",
};

const INPUT_CLASS =
  "rounded-md border border-border-input bg-background px-3 py-2 text-fg focus:outline-none focus:ring-2 focus:ring-primary";
const LABEL_CLASS = "text-sm font-medium text-fg-muted";
const FOCUS_RING =
  "rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";

async function handleCreate(formData: FormData): Promise<void> {
  "use server";
  await createAccountAction(formData);
}

async function handleRename(formData: FormData): Promise<void> {
  "use server";
  await renameAccountAction(formData);
}

async function handleArchive(accountId: string): Promise<void> {
  "use server";
  await archiveAccountAction(accountId);
}

export default async function AccountsPage() {
  const user = await requireUser();
  if (!user.ok) {
    return null;
  }
  const userId = user.data;

  const [accounts, sums] = await Promise.all([
    prisma.account.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    prisma.transaction.groupBy({
      by: ["accountId", "direction"],
      where: { userId, deletedAt: null },
      _sum: { amountCents: true },
    }),
  ]);

  const balances = new Map<string, bigint>();
  for (const row of sums) {
    const current = balances.get(row.accountId) ?? 0n;
    const amount = row._sum.amountCents ?? 0n;
    balances.set(
      row.accountId,
      current + (row.direction === "in" ? amount : -amount),
    );
  }

  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-8 px-4 py-8 sm:px-6">
      <section aria-labelledby="nueva-cuenta" className="flex flex-col gap-6">
        <h1
          id="nueva-cuenta"
          className="font-display font-bold text-2xl text-fg"
        >
          Nueva cuenta
        </h1>
        <form action={handleCreate} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="name" className={LABEL_CLASS}>
              Nombre
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className={INPUT_CLASS}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="kind" className={LABEL_CLASS}>
              Tipo
            </label>
            <select id="kind" name="kind" required className={INPUT_CLASS}>
              <option value="savings">Ahorros</option>
              <option value="checking">Corriente</option>
              <option value="cash">Efectivo</option>
              <option value="credit_card">Tarjeta de crédito</option>
            </select>
          </div>
          <div>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 font-medium text-primary-fg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              Crear
            </button>
          </div>
        </form>
      </section>

      <section aria-labelledby="cuentas" className="flex flex-col gap-4">
        <h2 id="cuentas" className="font-display font-bold text-fg text-xl">
          Cuentas
        </h2>
        <ul className="flex flex-col gap-4">
          {accounts.map((account) => (
            <li
              key={account.id}
              className="flex flex-col gap-3 rounded-lg border border-border p-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-fg">{account.name}</p>
                  <p className="text-sm text-fg-muted">
                    {KIND_LABELS[account.kind]}
                    {account.archivedAt ? " — archivada" : ""}
                  </p>
                </div>
                <p className="tabular-nums text-fg">
                  {formatCOP(balances.get(account.id) ?? 0n)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <form action={handleRename} className="flex items-center gap-2">
                  <input type="hidden" name="accountId" value={account.id} />
                  <label htmlFor={`rename-${account.id}`} className="sr-only">
                    Nuevo nombre para {account.name}
                  </label>
                  <input
                    id={`rename-${account.id}`}
                    name="name"
                    type="text"
                    defaultValue={account.name}
                    className={`${INPUT_CLASS} w-40 py-1 text-sm`}
                  />
                  <button
                    type="submit"
                    className={`text-sm font-medium text-fg-muted hover:text-fg ${FOCUS_RING}`}
                  >
                    Renombrar
                  </button>
                </form>
                {!account.archivedAt && (
                  <form action={handleArchive.bind(null, account.id)}>
                    <button
                      type="submit"
                      className={`text-destructive text-sm hover:underline ${FOCUS_RING}`}
                    >
                      Archivar
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
