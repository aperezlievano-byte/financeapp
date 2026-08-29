import { MoneyCell } from "../../components/money-cell";
import { requireUser } from "../../lib/auth/guard";
import { prisma } from "../../server/db/client";
import { createTransaction, deleteTransaction } from "./actions";

const INPUT_CLASS =
  "rounded-md border border-border-input bg-background px-3 py-2 text-fg focus:outline-none focus:ring-2 focus:ring-primary";
const LABEL_CLASS = "text-sm font-medium text-fg-muted";
const FOCUS_RING =
  "rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";

// Los formularios planos esperan una accion que devuelva void; createTransaction
// y deleteTransaction devuelven Result<T> para poder reusarse desde otros
// llamadores, asi que estas envolturas descartan el resultado.
async function handleCreate(formData: FormData): Promise<void> {
  "use server";
  await createTransaction(formData);
}

async function handleDelete(transactionId: string): Promise<void> {
  "use server";
  await deleteTransaction(transactionId);
}

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
      take: 50,
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
    <div className="mx-auto flex max-w-[1120px] flex-col gap-8 px-6 py-8">
      <section aria-labelledby="alta-manual" className="flex flex-col gap-6">
        <h1 id="alta-manual" className="text-2xl font-semibold text-fg">
          Nuevo movimiento
        </h1>
        <form
          action={handleCreate}
          className="grid grid-cols-1 gap-6 sm:grid-cols-2"
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="description" className={LABEL_CLASS}>
              Descripción
            </label>
            <input
              id="description"
              name="description"
              type="text"
              required
              className={INPUT_CLASS}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="amountPesos" className={LABEL_CLASS}>
              Monto (pesos)
            </label>
            <input
              id="amountPesos"
              name="amountPesos"
              type="text"
              inputMode="numeric"
              pattern="[0-9]+"
              required
              className={INPUT_CLASS}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="direction" className={LABEL_CLASS}>
              Tipo
            </label>
            <select
              id="direction"
              name="direction"
              defaultValue="out"
              className={INPUT_CLASS}
            >
              <option value="out">Gasto</option>
              <option value="in">Ingreso</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="accountId" className={LABEL_CLASS}>
              Cuenta
            </label>
            <select
              id="accountId"
              name="accountId"
              required
              className={INPUT_CLASS}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="categoryId" className={LABEL_CLASS}>
              Categoría
            </label>
            <select id="categoryId" name="categoryId" className={INPUT_CLASS}>
              <option value="">Sin categoría</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="occurredOn" className={LABEL_CLASS}>
              Fecha
            </label>
            <input
              id="occurredOn"
              name="occurredOn"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
              className={INPUT_CLASS}
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className={`rounded-md bg-primary px-4 py-2 font-medium text-primary-fg focus:outline-none focus:ring-2 focus:ring-primary`}
            >
              Agregar
            </button>
          </div>
        </form>
      </section>

      <section aria-labelledby="libro" className="flex flex-col gap-4">
        <h2 id="libro" className="text-xl font-semibold text-fg">
          Movimientos
        </h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-fg-muted">Todavía no hay movimientos.</p>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-border border-b text-left">
                <th className="px-3 py-2 font-medium text-fg-muted">Fecha</th>
                <th className="px-3 py-2 font-medium text-fg-muted">
                  Descripción
                </th>
                <th className="px-3 py-2 font-medium text-fg-muted">Cuenta</th>
                <th className="px-3 py-2 font-medium text-fg-muted">
                  Categoría
                </th>
                <th className="px-3 py-2 text-right font-medium text-fg-muted">
                  Monto
                </th>
                <th className="px-3 py-2 text-right font-medium text-fg-muted">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.id} className="h-8 border-border border-b">
                  <td className="px-3 py-2 text-fg">
                    {transaction.occurredOn.toLocaleDateString("es-CO")}
                  </td>
                  <td className="px-3 py-2 text-fg">
                    {transaction.description}
                  </td>
                  <td className="px-3 py-2 text-fg-muted">
                    {transaction.account.name}
                  </td>
                  <td className="px-3 py-2 text-fg-muted">
                    {transaction.category?.name ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <MoneyCell
                      amountCents={transaction.amountCents}
                      direction={transaction.direction}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <form action={handleDelete.bind(null, transaction.id)}>
                      <button
                        type="submit"
                        className={`text-destructive text-sm hover:underline ${FOCUS_RING}`}
                      >
                        Borrar
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
