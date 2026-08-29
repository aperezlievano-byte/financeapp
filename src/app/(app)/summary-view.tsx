import { categoryColor } from "../../lib/category-color";
import { formatCOP } from "../../lib/money";
import { EmptyState } from "./empty-state";
import type { TransactionVM } from "./ledger-types";

type SummaryViewProps = {
  transactions: TransactionVM[];
  filterMonth: string;
  onFilterMonthChange: (month: string) => void;
};

type Bucket = { name: string; totalCents: bigint; color: string };

function bucketsBy(
  expenses: TransactionVM[],
  key: (t: TransactionVM) => string,
  color: (name: string) => string,
): Bucket[] {
  const totals = new Map<string, bigint>();
  for (const t of expenses) {
    const name = key(t);
    totals.set(name, (totals.get(name) ?? 0n) + BigInt(t.amountCentsStr));
  }
  return [...totals.entries()]
    .map(([name, totalCents]) => ({ name, totalCents, color: color(name) }))
    .sort((a, b) => (b.totalCents > a.totalCents ? 1 : -1));
}

function BarList({
  title,
  buckets,
  totalCents,
}: {
  title: string;
  buckets: Bucket[];
  totalCents: bigint;
}) {
  return (
    <div className="mx-4 mb-3 rounded-lg border border-border bg-surface p-4 sm:mx-6">
      <h3 className="mb-3 font-semibold text-fg-muted text-xs uppercase tracking-wide">
        {title}
      </h3>
      {buckets.length === 0 ? (
        <p className="text-fg-muted text-sm">Sin datos.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {buckets.map((bucket) => {
            const pct =
              totalCents > 0n
                ? Number((bucket.totalCents * 1000n) / totalCents) / 10
                : 0;
            return (
              <div key={bucket.name} className="flex items-center gap-3">
                <span className="w-24 shrink-0 truncate text-fg text-sm">
                  {bucket.name}
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-background">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${pct}%`, background: bucket.color }}
                  />
                </span>
                <span className="w-24 shrink-0 text-right text-fg-muted text-xs tabular-nums">
                  {formatCOP(bucket.totalCents)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SummaryView({
  transactions,
  filterMonth,
  onFilterMonthChange,
}: SummaryViewProps) {
  const monthExpenses = transactions.filter(
    (t) => t.occurredOn.startsWith(filterMonth) && t.direction === "out",
  );
  const totalCents = monthExpenses.reduce(
    (sum, t) => sum + BigInt(t.amountCentsStr),
    0n,
  );

  const byCategory = bucketsBy(
    monthExpenses,
    (t) => t.categoryName ?? "Sin categoría",
    (name) => categoryColor(name),
  );
  const byAccount = bucketsBy(
    monthExpenses,
    (t) => t.accountName,
    () => "var(--color-primary)",
  );

  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <label
          htmlFor="summaryMonth"
          className="font-semibold text-fg-muted text-sm"
        >
          Mes
        </label>
        <input
          id="summaryMonth"
          type="month"
          value={filterMonth}
          onChange={(event) => onFilterMonthChange(event.target.value)}
          className="rounded-md border border-border-input bg-background px-3 py-1.5 text-fg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="flex items-baseline justify-between border-border border-y bg-surface px-4 py-3 sm:px-6">
        <span className="text-fg-muted text-sm">Total de gastos</span>
        <span className="font-display font-bold text-fg text-xl tabular-nums">
          {formatCOP(totalCents)}
        </span>
      </div>

      {monthExpenses.length === 0 ? (
        <EmptyState icon="📊" text="Sin gastos en este período." />
      ) : (
        <div className="pt-4">
          <BarList
            title="Por categoría"
            buckets={byCategory}
            totalCents={totalCents}
          />
          <BarList
            title="Por cuenta"
            buckets={byAccount}
            totalCents={totalCents}
          />
        </div>
      )}
    </div>
  );
}
