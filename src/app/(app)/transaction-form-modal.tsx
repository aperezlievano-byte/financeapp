"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { Result } from "../../lib/result";
import type { AccountOption, CategoryOption } from "./ledger-types";

type TransactionFormModalProps = {
  accounts: AccountOption[];
  categories: CategoryOption[];
  createAction: (formData: FormData) => Promise<Result<null>>;
  onClose: () => void;
};

const INPUT_CLASS =
  "rounded-md border border-border-input bg-background px-3 py-2 text-fg focus:outline-none focus:ring-2 focus:ring-primary";
const LABEL_CLASS =
  "text-xs font-semibold uppercase tracking-wide text-fg-muted";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TransactionFormModal({
  accounts,
  categories,
  createAction,
  onClose,
}: TransactionFormModalProps) {
  const [direction, setDirection] = useState<"in" | "out">("out");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [state, formAction, isPending] = useActionState<
    Result<null> | null,
    FormData
  >(async (_previous, formData) => {
    const result = await createAction(formData);
    if (result.ok) onClose();
    return result;
  }, null);

  const descriptionRef = useRef<HTMLInputElement>(null);

  // El foco entra al modal al abrir (primer campo real, no el boton de
  // cerrar) y Escape lo cierra -- patron minimo de dialogo accesible: sin
  // esto, un usuario de teclado que abre el FAB queda con el foco "afuera"
  // del contenido que acaba de aparecer.
  useEffect(() => {
    descriptionRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-fg/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-modal-title"
        className="relative max-h-[90vh] w-full overflow-y-auto rounded-t-xl bg-surface p-6"
      >
        <h2
          id="transaction-modal-title"
          className="font-display font-bold text-fg text-xl"
        >
          Nuevo movimiento
        </h2>
        <form action={formAction} className="mt-5 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className={LABEL_CLASS}>Tipo</span>
            <div className="flex gap-2">
              {(["out", "in"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDirection(value)}
                  className={`rounded-full border px-4 py-1.5 font-medium text-sm ${
                    direction === value
                      ? "border-primary bg-primary text-primary-fg"
                      : "border-border-input text-fg"
                  }`}
                >
                  {value === "out" ? "Gasto" : "Ingreso"}
                </button>
              ))}
            </div>
            <input type="hidden" name="direction" value={direction} />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="description" className={LABEL_CLASS}>
              Descripción
            </label>
            <input
              id="description"
              name="description"
              type="text"
              required
              ref={descriptionRef}
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
            <label htmlFor="occurredOn" className={LABEL_CLASS}>
              Fecha
            </label>
            <input
              id="occurredOn"
              name="occurredOn"
              type="date"
              required
              defaultValue={todayKey()}
              className={INPUT_CLASS}
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className={LABEL_CLASS}>Cuenta</span>
            <div className="flex flex-wrap gap-2">
              {accounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => setAccountId(account.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    accountId === account.id
                      ? "border-primary bg-primary text-primary-fg"
                      : "border-border-input text-fg"
                  }`}
                >
                  {account.name}
                </button>
              ))}
            </div>
            <input type="hidden" name="accountId" value={accountId} />
          </div>

          <div className="flex flex-col gap-2">
            <span className={LABEL_CLASS}>Categoría</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCategoryId("")}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  categoryId === ""
                    ? "border-primary bg-primary text-primary-fg"
                    : "border-border-input text-fg"
                }`}
              >
                Sin categoría
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setCategoryId(category.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    categoryId === category.id
                      ? "border-primary bg-primary text-primary-fg"
                      : "border-border-input text-fg"
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
            <input type="hidden" name="categoryId" value={categoryId} />
          </div>

          {state && !state.ok && (
            <p role="alert" className="text-destructive text-sm">
              {state.error.message}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="mt-2 rounded-md bg-primary px-4 py-3 font-display font-semibold text-lg text-primary-fg disabled:opacity-50"
          >
            {isPending ? "Guardando…" : "Registrar movimiento"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="py-2 text-fg-muted text-sm"
          >
            Cancelar
          </button>
        </form>
      </div>
    </div>
  );
}
