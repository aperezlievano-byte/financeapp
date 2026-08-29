import { formatSignedCOP } from "../lib/money";

type PendingCardData = {
  id: string;
  rawInput: string;
  description: string | null;
  amountCents: bigint | null;
  direction: "in" | "out" | null;
  accountName: string | null;
  categoryName: string | null;
};

type PendingCardProps = {
  pending: PendingCardData;
  confirmAction: (formData: FormData) => void | Promise<void>;
  rejectAction: (formData: FormData) => void | Promise<void>;
};

const FOCUS_RING =
  "rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";

// Espaciosa a proposito (§7): acá se decide sobre dinero. Muestra raw_input
// junto a lo extraído para que el usuario juzgue si la IA leyó bien.
export function PendingCard({
  pending,
  confirmAction,
  rejectAction,
}: PendingCardProps) {
  return (
    <li className="flex flex-col gap-6 rounded-lg border border-border p-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-fg-muted">Mensaje original</p>
        <p className="text-fg">{pending.rawInput}</p>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-fg-muted">Descripción</p>
          <p className="text-fg">{pending.description ?? "—"}</p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-fg-muted">Monto</p>
          <p className="tabular-nums text-fg">
            {pending.amountCents !== null && pending.direction !== null
              ? formatSignedCOP(pending.amountCents, pending.direction)
              : "—"}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-fg-muted">Cuenta</p>
          <p className="text-fg">{pending.accountName ?? "—"}</p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-fg-muted">Categoría</p>
          <p className="text-fg">{pending.categoryName ?? "—"}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <form action={confirmAction}>
          <button
            type="submit"
            className={`rounded-md bg-primary px-4 py-2 font-medium text-primary-fg ${FOCUS_RING}`}
          >
            Confirmar
          </button>
        </form>
        <form action={rejectAction}>
          <button
            type="submit"
            className={`text-destructive text-sm hover:underline ${FOCUS_RING}`}
          >
            Rechazar
          </button>
        </form>
      </div>
    </li>
  );
}
