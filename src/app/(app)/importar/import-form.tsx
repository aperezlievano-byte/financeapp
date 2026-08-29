"use client";

import { useActionState } from "react";
import type { Result } from "../../../lib/result";
import type { ImportReport } from "../../../server/ingest/import-excel";
import { importExcelAction } from "./actions";

type Account = { id: string; name: string };

const INPUT_CLASS =
  "rounded-md border border-border-input bg-background px-3 py-2 text-fg focus:outline-none focus:ring-2 focus:ring-primary";
const LABEL_CLASS = "text-sm font-medium text-fg-muted";
const FOCUS_RING =
  "rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";

// Unico formulario de la app que necesita mostrar el resultado de una accion
// en la misma pantalla (conteo leidas/importadas/saltadas y el detalle de
// las que fallaron) -- por eso es el unico que usa "use client" (§ code
// rule 4: solo la hoja que necesita estado).
export function ImportForm({ accounts }: { accounts: Account[] }) {
  const [state, formAction, isPending] = useActionState<
    Result<ImportReport> | null,
    FormData
  >(async (_previous, formData) => importExcelAction(formData), null);

  return (
    <div className="flex flex-col gap-8">
      <form action={formAction} className="flex flex-col gap-4">
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

        <label htmlFor="file" className={LABEL_CLASS}>
          Archivo (.xlsx)
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".xlsx"
          required
          className={`${INPUT_CLASS} ${FOCUS_RING}`}
        />

        <button
          type="submit"
          disabled={isPending}
          className={`w-fit rounded-md bg-primary px-4 py-2 font-medium text-primary-fg disabled:opacity-50 ${FOCUS_RING}`}
        >
          {isPending ? "Leyendo la hoja…" : "Importar"}
        </button>
      </form>

      {state && !state.ok ? (
        <p className="text-sm text-destructive">{state.error.message}</p>
      ) : null}

      {state?.ok ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-fg">
            {state.data.read} filas leídas — {state.data.imported} importadas ,{" "}
            {state.data.skipped} saltadas por duplicado,{" "}
            {state.data.failed.length} fallidas.
          </p>
          {state.data.failed.length > 0 ? (
            <ul className="flex flex-col gap-1 text-sm text-destructive">
              {state.data.failed.map((failure) => (
                <li key={failure.row}>
                  Fila {failure.row}: {failure.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
