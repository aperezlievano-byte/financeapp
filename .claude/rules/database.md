---
paths:
  - "prisma/**"
  - "src/server/db/**"
  - "src/server/ledger/**"
---

# Reglas: base de datos

- `src/server/db/client.ts` es el **único** archivo que abre una conexión. Todo lo demás lo importa.
- `src/server/ledger/commit.ts` es el **único** escritor de `transactions`.
  `src/server/ingest/pending.ts` es el único de `pending_transactions`.
- `transactions` y `audit_log` son **append-only, forzado por trigger en la base**. `DELETE` y
  `UPDATE` lanzan excepción. El borrado es lógico: `deleted_at`.
- Tras la inserción, en `transactions` solo cambian `deleted_at`, `category_id` y `note`.
- `amount_cents` es **siempre positivo** (`check > 0`) y `bigint`. El sentido lo da `direction`,
  nunca el signo del número. Un salario en centavos supera `int4`.
- Toda escritura al libro pasa por `with-audit.ts`, que escribe `audit_log` **en la misma
  transacción de base**. Si el audit falla, la escritura se revierte.
- `audit_log` no tiene claves foráneas **a propósito**: sobrevive al borrado lógico de cualquier cosa.
- Una migración ya aplicada **nunca se edita**. Se crea una nueva.
- No escribas el nombre del directorio que emite `prisma migrate` — Prisma lo elige.
- La idempotencia de toda importación y todo mensaje vive en `unique (user_id, source, source_ref)`.
