import { requireUser } from "../../../lib/auth/guard";
import { listAccounts } from "../../../server/ledger/catalog";
import { ImportForm } from "./import-form";

export default async function ImportarPage() {
  const user = await requireUser();
  if (!user.ok) {
    return null;
  }

  const accounts = await listAccounts(user.data);

  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-8 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold text-fg">Importar histórico</h1>
      <ImportForm accounts={accounts} />
    </div>
  );
}
