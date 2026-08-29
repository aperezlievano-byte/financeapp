"use client";

import { useMemo, useState } from "react";
import { formatSignedCOP } from "../../lib/money";
import type { Result } from "../../lib/result";
import { EmptyState } from "./empty-state";
import { HistoryView } from "./history-view";
import type {
  AccountOption,
  CategoryOption,
  TransactionVM,
} from "./ledger-types";
import { SummaryView } from "./summary-view";
import { TransactionFormModal } from "./transaction-form-modal";
import { TransactionRow } from "./transaction-row";

type LedgerViewProps = {
  transactions: TransactionVM[];
  accounts: AccountOption[];
  categories: CategoryOption[];
  createAction: (formData: FormData) => Promise<Result<null>>;
  deleteAction: (transactionId: string) => Promise<Result<null>>;
};

type View = "hoy" | "historial" | "resumen";

const TABS: { key: View; label: string }[] = [
  { key: "hoy", label: "Hoy" },
  { key: "historial", label: "Historial" },
  { key: "resumen", label: "Resumen" },
];

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

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

export function LedgerView({
  transactions,
  accounts,
  categories,
  createAction,
  deleteAction,
}: LedgerViewProps) {
  const [view, setView] = useState<View>("hoy");
  const [showForm, setShowForm] = useState(false);
  const [filterMonth, setFilterMonth] = useState(() => todayKey().slice(0, 7));

  const today = todayKey();
  const todayTransactions = useMemo(
    () => transactions.filter((t) => t.occurredOn === today),
    [transactions, today],
  );
  const todayTotal = useMemo(
    () => netOf(todayTransactions),
    [todayTransactions],
  );
  const dateLabel = new Date().toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="min-h-full pb-24">
      <header className="bg-primary px-4 pt-7 pb-5 text-primary-fg sm:px-6">
        <span className="inline-block rounded-full bg-highlight px-3 py-1 font-semibold text-highlight-fg text-xs">
          {dateLabel}
        </span>
        <h1 className="mt-4 font-display font-bold text-2xl">
          Mis movimientos
        </h1>
        <p className="mt-1 font-medium text-primary-fg/70 text-xs uppercase tracking-wide">
          Libro de contabilidad
        </p>
        <div className="mt-4">
          <div className="text-primary-fg/70 text-xs">Hoy</div>
          <div className="font-display font-bold text-4xl tabular-nums">
            {formatSignedCOP(todayTotal.amountCents, todayTotal.direction)}
          </div>
        </div>
      </header>

      <div className="flex border-border border-b bg-surface">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setView(tab.key)}
            className={`flex-1 border-b-2 py-3 font-medium text-sm transition-colors ${
              view === tab.key
                ? "border-highlight text-fg"
                : "border-transparent text-fg-muted hover:text-fg"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mx-auto max-w-[640px]">
        {view === "hoy" &&
          (todayTransactions.length === 0 ? (
            <EmptyState
              icon="🧾"
              text="No hay movimientos registrados hoy. Toca el botón + para agregar uno."
            />
          ) : (
            <ul>
              {todayTransactions.map((t) => (
                <TransactionRow
                  key={t.id}
                  transaction={t}
                  deleteAction={deleteAction}
                />
              ))}
            </ul>
          ))}

        {view === "historial" && (
          <HistoryView
            transactions={transactions}
            filterMonth={filterMonth}
            onFilterMonthChange={setFilterMonth}
            deleteAction={deleteAction}
          />
        )}

        {view === "resumen" && (
          <SummaryView
            transactions={transactions}
            filterMonth={filterMonth}
            onFilterMonthChange={setFilterMonth}
          />
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowForm(true)}
        aria-label="Nuevo movimiento"
        className="fixed right-6 bottom-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl text-primary-fg shadow-lg transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-highlight"
      >
        +
      </button>

      {showForm && (
        <TransactionFormModal
          accounts={accounts}
          categories={categories}
          createAction={createAction}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
