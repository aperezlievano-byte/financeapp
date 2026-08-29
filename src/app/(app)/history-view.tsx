import { formatSignedCOP } from "../../lib/money";
import type { Result } from "../../lib/result";
import { EmptyState } from "./empty-state";
import type { TransactionVM } from "./ledger-types";
import { TransactionRow } from "./transaction-row";

type HistoryViewProps = {
  transactions: TransactionVM[];
  filterMonth: string;
  onFilterMonthChange: (month: string) => void;
  deleteAction: (transactionId: string) => Promise<Result<null>>;
};

function netOf(transactions: TransactionVM[]): {
  amountCents: bigint;
  direction: "in" | "out";
} {
  let net = 0n;
  for (const t of transactions) {
    const cents = BigInt(t.amountCentsStr);
    net += t.direction === "in" ? cents : -cents;
  }
  return net < 0n
    ? { amountCents: -net, direction: "out" }
    : { amountCents: net, direction: "in" };
}

function formatDayHeader(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00`);
  return date.toLocaleDateString("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function HistoryView({
  transactions,
  filterMonth,
  onFilterMonthChange,
  deleteAction,
}: HistoryViewProps) {
  const monthTransactions = transactions.filter((t) =>
    t.occurredOn.startsWith(filterMonth),
  );
  const monthTotal = netOf(monthTransactions);

  const grouped = new Map<string, TransactionVM[]>();
  for (const t of monthTransactions) {
    const existing = grouped.get(t.occurredOn) ?? [];
    existing.push(t);
    grouped.set(t.occurredOn, existing);
  }
  const sortedDays = [...grouped.keys()].sort((a, b) => b.localeCompare(a));

  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <label
          htmlFor="filterMonth"
          className="font-semibold text-fg-muted text-sm"
        >
          Mes
        </label>
        <input
          id="filterMonth"
          type="month"
          value={filterMonth}
          onChange={(event) => onFilterMonthChange(event.target.value)}
          className="rounded-md border border-border-input bg-background px-3 py-1.5 text-fg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {monthTransactions.length > 0 && (
        <div className="flex items-baseline justify-between border-border border-y bg-surface px-4 py-3 sm:px-6">
          <span className="text-fg-muted text-sm">Total del mes</span>
          <span className="font-display font-bold text-fg text-xl tabular-nums">
            {formatSignedCOP(monthTotal.amountCents, monthTotal.direction)}
          </span>
        </div>
      )}

      {sortedDays.length === 0 ? (
        <EmptyState icon="📅" text="Sin movimientos en este período." />
      ) : (
        sortedDays.map((day) => {
          const dayTotal = netOf(grouped.get(day) ?? []);
          return (
            <div key={day}>
              <div className="flex justify-between bg-background px-4 py-2 font-semibold text-fg-muted text-xs uppercase tracking-wide sm:px-6">
                <span>{formatDayHeader(day)}</span>
                <span>
                  {formatSignedCOP(dayTotal.amountCents, dayTotal.direction)}
                </span>
              </div>
              <ul>
                {(grouped.get(day) ?? []).map((t) => (
                  <TransactionRow
                    key={t.id}
                    transaction={t}
                    deleteAction={deleteAction}
                  />
                ))}
              </ul>
            </div>
          );
        })
      )}
    </div>
  );
}
