"use client";

import { useState } from "react";
import { MoneyCell } from "../../components/money-cell";
import { categoryColor } from "../../lib/category-color";
import type { Result } from "../../lib/result";
import type { TransactionVM } from "./ledger-types";

type TransactionRowProps = {
  transaction: TransactionVM;
  deleteAction: (transactionId: string) => Promise<Result<null>>;
};

// Confirmacion de dos toques para borrar (tocar borrar, tocar de nuevo para
// confirmar) en vez de un dialogo nativo -- mismo patron que el mockup que
// origino este rediseño, sin bloquear la pagina con un confirm().
export function TransactionRow({
  transaction,
  deleteAction,
}: TransactionRowProps) {
  const [confirming, setConfirming] = useState(false);
  const dotColor = transaction.categoryName
    ? categoryColor(transaction.categoryName)
    : "var(--color-border)";

  return (
    <li className="flex items-center gap-3 border-border border-b bg-surface px-4 py-3 sm:px-6">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ background: dotColor }}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-fg text-sm">
          {transaction.description}
        </p>
        <p className="truncate text-fg-muted text-xs">
          {transaction.accountName}
          {transaction.categoryName ? ` · ${transaction.categoryName}` : ""}
        </p>
      </div>
      <span className="font-display shrink-0 text-base">
        <MoneyCell
          amountCents={BigInt(transaction.amountCentsStr)}
          direction={transaction.direction}
        />
      </span>
      <form
        action={async () => {
          if (!confirming) {
            setConfirming(true);
            return;
          }
          await deleteAction(transaction.id);
        }}
      >
        <button
          type="submit"
          aria-label={confirming ? "Confirmar borrado" : "Borrar movimiento"}
          className={`shrink-0 rounded-full p-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            confirming
              ? "text-destructive"
              : "text-fg-muted hover:text-destructive"
          }`}
        >
          {confirming ? "✓" : "✕"}
        </button>
      </form>
    </li>
  );
}
