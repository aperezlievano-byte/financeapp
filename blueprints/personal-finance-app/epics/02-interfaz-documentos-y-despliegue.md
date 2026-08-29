# Epic 02: Interfaz, documentos y despliegue

> Al terminar este epic la app es usable por la web: el libro se ve y se edita, los pendientes se
> confirman en pantalla, entran recibos y extractos en PDF, el histórico del Excel queda migrado con
> paridad verificada, y todo está desplegado con un respaldo cuya restauración se probó de verdad.

| | |
|---|---|
| **Epic id** | `02-interfaz-documentos-y-despliegue` |
| **Tasks** | `E2-T1` … `E2-T7` |
| **Depends on** | `01-cimientos-e-ingesta` |
| **Unlocks** | nada — es el último |
| **Parallel with** | ninguno — depende del epic 01 completo |

You do not need any other file to complete this epic. Everything below is repeated here on purpose.

---

## Stack

Next.js (App Router) · TypeScript · Tailwind + shadcn/ui · PostgreSQL · Prisma · Supabase (auth y
storage) · Vercel.
Package manager: `pnpm`. Runtime pinned in `.nvmrc` (24). Dependency versions are in the lockfile —
read it, never guess one.

| Task | Command |
|---|---|
| Dev | `pnpm dev` |
| Typecheck | `pnpm typecheck` |
| Lint | `pnpm lint` |
| Test (one file) | `pnpm test <path>` |
| Test e2e (one file) | `pnpm test:e2e <path>` |
| Build + smoke | `pnpm build && pnpm smoke` |
| Fixtures binarios | `pnpm fixtures` |
| Postgres local | `docker compose up -d --wait` / `docker compose down` |

**Gate:** `pnpm typecheck && pnpm lint && pnpm test` passes before any task here is marked done.

If any task below verifies against a real service, start it first with the command above. The file
that defines it shipped in `workspace/` and is already at the project root — you do not write it,
and you never substitute a fake for a service the acceptance criteria name.

`playwright.config.ts` (e2e en el puerto 3101), `tests/e2e/global-setup.ts` y
`tests/fixtures/build-fixtures.ts` **ya están** en la raíz: llegaron con `workspace/`. No los
escribas. `pnpm fixtures` ejecuta el tercero.

## Directory subtree

Only the parts this epic touches:

```
.github/workflows/ci.yml   # el mismo gate del acceptance global — NEW (E2-T7)
scripts/
  backup.sh                # pg_dump del volumen local a backups/ — NEW (E2-T7)
  restore-check.sh         # restaura en otra base y compara conteos — NEW (E2-T7)
  parity-check.ts          # compara el libro contra la hoja de Excel — NEW (E2-T6)
  set-telegram-webhook.ts  # registra el webhook con PRODUCTION_URL — NEW (E2-T7)
src/
  app/(app)/
    layout.tsx             # shell: encabezado, navegación, tema — NEW (E2-T1)
    page.tsx               # "/" el libro (denso) — NEW (E2-T1)
    actions.ts             # alta manual y soft-delete — NEW (E2-T1)
    cuentas/{page.tsx,actions.ts}     # CRUD de cuentas — NEW (E2-T2)
    revision/{page.tsx,actions.ts}    # pendientes por confirmar (espacioso) — NEW (E2-T3)
    subir/{page.tsx,actions.ts}       # subida de PDFs e imágenes — NEW (E2-T4)
    importar/{page.tsx,actions.ts}    # importación única del Excel — NEW (E2-T6)
  components/
    money-cell.tsx         # monto: tabular-nums, signo y acento no textual — NEW (E2-T1)
    pending-card.tsx       # tarjeta de pendiente — NEW (E2-T3)
  server/
    ledger/catalog.ts              # cuentas y categorías — NEW (E2-T2)
    storage/index.ts               # putObject/getObject — NEW (E2-T4), edit (E2-T7)
    ingest/extract-document.ts     # extractor de imagen/PDF de un movimiento — NEW (E2-T4)
    ingest/extract-statement.ts    # extractor de extractos con muchos movimientos — NEW (E2-T5)
    ingest/statement-batch.ts      # agrupa los movimientos de un extracto — NEW (E2-T5)
    ingest/import-excel.ts         # importador del histórico — NEW (E2-T6)
  lib/money.ts             # exists, read-only — formatCOP y formatSignedCOP del epic 01
  lib/auth/guard.ts        # exists, read-only — requireUser del epic 01
  server/ledger/commit.ts  # exists, read-only — único escritor de transactions
  server/ingest/pending.ts # exists, read-only — único escritor de pending_transactions
tests/
  integration/accounts.test.ts     # conflicto de nombre, archivado, audit_log
  integration/review.test.ts       # confirmar, rechazar, doble confirmación
  integration/receipts.test.ts     # documento + pendiente, dedupe por sha256
  integration/statements.test.ts   # tres movimientos, fecha ilegible, duplicados legítimos
  integration/import-excel.test.ts # importación, reimportación, fila inválida
  e2e/ledger.spec.ts               # alta manual, vacío, soft-delete, teclado
  e2e/cuentas.spec.ts              # CRUD por la interfaz
  e2e/revision.spec.ts             # confirmar un pendiente por la interfaz
  e2e/subir.spec.ts                # subir un extracto y verlo en /revision
```

Everything outside this subtree is out of scope. If a task seems to require editing a file not
listed here, stop and report — it means the epic boundary is wrong.

## Data model touched here

| Entity | Fields this epic adds or reads | Notes |
|---|---|---|
| `accounts` | `name`, `currency`, `archived_at` | Se edita en E2-T2. Nunca se borra, se archiva: archivar preserva las transacciones históricas |
| `categories` | `name`, `archived_at` | Se captura en v1, no se grafica |
| `transactions` | `amount_cents`, `direction`, `occurred_on`, `source`, `source_ref`, `deleted_at`, `category_id`, `note` | **Append-only.** Solo `deleted_at`, `category_id` y `note` cambian tras la inserción. `unique (user_id, source, source_ref)` da idempotencia a toda importación |
| `pending_transactions` | `status`, `extraction`, `raw_input`, `committed_transaction_id` | La pantalla de revisión filtra por `awaiting_review`. `committed_transaction_id` es `unique`: un pendiente no genera dos transacciones |
| `documents` | `sha256`, `storage_key`, `mime`, `status` | `unique (user_id, sha256)`: subir dos veces el mismo archivo no lo procesa dos veces. `storage_key` es llave del driver, no ruta del sistema de archivos |
| `audit_log` | `action`, `resource_type`, `resource_id` | Acciones de este epic: `account.create`, `account.update`, `account.archive`, `pending.confirm`, `pending.reject`, `document.upload`, `import.excel`, `transaction.soft_delete` |

## Contracts

**Consumed** — already exists, do not rebuild:

| From | Interface | Guarantee |
|---|---|---|
| `01-cimientos-e-ingesta` | `src/lib/money.ts` → `formatCOP`, `formatSignedCOP` | Formato es-CO exacto: `$1.234.567`, y el menos es U+2212 |
| `01-cimientos-e-ingesta` | `src/lib/auth/guard.ts` → `requireUser` | Devuelve el id del único usuario o un error con código `forbidden` |
| `01-cimientos-e-ingesta` | `src/server/ledger/commit.ts` → `createManual`, `commitPending` | Únicos escritores de `transactions`; `commitPending` devuelve `conflict` en la segunda llamada. "Read-only" quiere decir no reescribir estas dos firmas — E2-T1 le agrega `softDelete` ahí mismo, porque sigue siendo el único archivo con permiso de escribir `transactions` |
| `01-cimientos-e-ingesta` | `src/server/ingest/pending.ts` | Único escritor de `pending_transactions` |
| `01-cimientos-e-ingesta` | `src/server/ai/gateway.ts` | Única puerta al SDK de Anthropic; la salida se valida con zod o falla cerrado |
| `workspace/` | `playwright.config.ts`, `tests/e2e/global-setup.ts`, `tests/fixtures/build-fixtures.ts` | e2e en el puerto 3101; el global-setup migra, siembra y construye fixtures |

**Produced** — later epics depend on exactly these signatures. Changing one breaks them:

| Export | Signature | Used by |
|---|---|---|
| `src/server/storage/index.ts` → `putObject`, `getObject` | driver `local` o `supabase` según `STORAGE_DRIVER` | adaptador de WhatsApp y reportes, post-v1 |
| `src/server/ledger/catalog.ts` → cuentas y categorías | lectura para selectores | reportes por categoría, post-v1 |

Ningún epic posterior existe en v1: los consumidores listados son los Non-Goals que vienen después.

## Conventions that bite in this area

- **Nada en `src/app/**` importa de la carpeta de otra ruta.** Lo compartido va a `src/lib/` o
  `src/server/`.
- **`tests/e2e/**` no importa nada de `src/`.** Verifica por la interfaz y consulta la base con
  `docker compose exec -T db psql`.
- **El color nunca es el único indicador de dirección.** Toda celda de monto lleva prefijo `+` o `−`.
  Es accesibilidad y además se distingue mejor de un vistazo. E2-T1 lo verifica.
- **Los montos usan `tabular-nums`** para que las columnas alineen verticalmente.
- **El libro es denso tipo hoja de cálculo; la pantalla de revisión es espaciosa.** En el libro se
  escanea, en revisión se decide. No unifiques la densidad.
- **Toda escritura pasa por los escritores únicos del epic 01.** No escribas `transactions` ni
  `pending_transactions` directo desde una acción de ruta.
- **`amount_cents` es siempre positivo.** El sentido lo da `direction`, nunca el signo del número.
- Alias `@/` solo en `src/app/**` y `src/components/**`; todo lo demás con rutas relativas sin extensión.

Full project rules: `CLAUDE.md`. Area rules: `.claude/rules/{name}.md`. Both sit in the project
root — the builder copied them there from the bundle's `workspace/` before task one.

---

## Tasks

Listed in the same order as `tasks.json`. That order is the build order — work top to bottom and do
not re-rank by priority or by what looks quick.

### `E2-T1` — Shell y libro de transacciones

**Depends on:** `E1-T3`, `E1-T4` · **Priority:** p0 — metadata for scope cuts, not a running order

**Este paso deja el producto usable sin una sola línea de IA**: alta manual, listado y borrado
lógico. Es el corte de alcance más importante del build — si todo lo demás se cayera, esto ya
reemplaza la hoja de Excel. El libro es denso, con `tabular-nums` y paginado a 50 filas por consulta.
`money-cell.tsx` es el componente que garantiza que el signo siempre esté presente además del color.

**Files**
- `src/app/(app)/layout.tsx` — new: shell, encabezado, navegación, enlace de "saltar al contenido"
  como primer elemento enfocable (`sr-only` hasta recibir foco). Sin `ThemeToggle`: no está
  especificado en ningún lado de este blueprint (§7 no lo describe, §3 no lista el componente,
  ningún criterio lo exige) — inventar uno acá sería diseñar, no construir
- `src/server/ledger/commit.ts` — edit: agrega `softDelete(transactionId, userId)`. Sigue siendo el
  único escritor de `transactions` — un `UPDATE` directo desde `actions.ts` rompería esa invariante y
  el `grep` de "único escritor" del epic 01
- `src/app/(app)/page.tsx` — new: el libro, denso
- `src/app/(app)/actions.ts` — new: alta manual, delegando el borrado lógico a `commit.ts`
- `src/components/money-cell.tsx` — new: `tabular-nums`, signo y acento no textual
- `tests/e2e/ledger.spec.ts` — new. `transactions` es append-only por trigger — ni un test puede
  hacer `DELETE`; el reset entre tests usa `TRUNCATE`, que no dispara triggers de `DELETE` en
  Postgres

**Acceptance**

Copied verbatim from this task's `acceptance` array in `tasks.json`. Each one is decidable by a
command below, on this machine, during the build.

1. WHEN a manual expense of 100000 pesos is submitted through the form THE SYSTEM SHALL show a row whose amount cell reads `−$100.000`.
2. WHEN the ledger is empty THE SYSTEM SHALL render the text `Todavía no hay movimientos.` instead of an empty table.
3. WHEN a row is soft-deleted THE SYSTEM SHALL remove it from the list and leave the database row present with a non-null `deleted_at`.
4. WHEN the ledger page is requested THE SYSTEM SHALL issue a query containing `LIMIT` and return at most 50 rows.
5. WHEN the page is traversed with the keyboard only THE SYSTEM SHALL reach every interactive control in visual order with a visible focus indicator.
6. WHEN every amount cell is inspected THE SYSTEM SHALL show a `+` or `−` prefix, so colour is never the only indicator of direction.

**Verify** — every command, in order, run from the project root. Each one exits 0 when this task is
correct; the last one exiting 0 is what makes the task done.

```bash
pnpm typecheck
pnpm lint
pnpm test:e2e tests/e2e/ledger.spec.ts
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T1: shell y libro de transacciones"
git tag step-08-libro-ui
```

Run both after the last `Verify` command exits 0, before starting the next task.

### `E2-T2` — CRUD de cuentas

**Depends on:** `E2-T1` · **Priority:** p1 — metadata for scope cuts, not a running order

Cuentas nunca se borran: se archivan. Archivar preserva las transacciones históricas legibles y solo
retira la cuenta del selector de altas nuevas. El nombre es literal y en minúsculas porque es el que
el bot de Telegram repite al confirmar — `cuenta de ahorros` tiene que coincidir con lo que el
usuario escribe en el chat.

**Files**
- `src/server/ledger/catalog.ts` — new: cuentas y categorías
- `src/app/(app)/cuentas/page.tsx` — new
- `src/app/(app)/cuentas/actions.ts` — new
- `tests/integration/accounts.test.ts` — new
- `tests/e2e/cuentas.spec.ts` — new

**Acceptance**

1. WHEN an account is created with a name that already exists THE SYSTEM SHALL return code `conflict` and create no row.
2. WHEN an account with transactions is archived THE SYSTEM SHALL set `archived_at` and leave every one of its transactions readable.
3. WHEN an account is archived THE SYSTEM SHALL stop offering it in the new-transaction account selector.
4. WHEN any account is created, renamed or archived THE SYSTEM SHALL write exactly one `audit_log` row for that change.

**Verify**

```bash
pnpm typecheck
pnpm test tests/integration/accounts.test.ts
pnpm test:e2e tests/e2e/cuentas.spec.ts
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T2: CRUD de cuentas"
git tag step-09-cuentas
```

### `E2-T3` — Pantalla de revision

**Depends on:** `E1-T5`, `E2-T1` · **Priority:** p0 — metadata for scope cuts, not a running order

Esta es la pantalla que hace cumplir la regla de revisión humana obligatoria para todo lo que no es
alta manual. Es **espaciosa** a propósito: aquí se toman decisiones sobre dinero y necesita respirar.
Muestra el `raw_input` original junto a lo extraído para que el usuario pueda juzgar si la IA leyó
bien. Confirmar delega en `commitPending` del epic 01, que ya garantiza el `conflict` en la segunda
llamada — no reimplementes esa protección aquí.

**Files**
- `src/app/(app)/revision/page.tsx` — new: espaciosa
- `src/app/(app)/revision/actions.ts` — new: confirmar y rechazar
- `src/components/pending-card.tsx` — new
- `src/server/ledger/commit.ts` — retroactive: `commitPending` ahora nombra el campo faltante en el mensaje `validation_failed` (el criterio ya estaba en la Acceptance de este paso desde el principio, pero el paso 4 nunca lo había cumplido); gana `rejectPending(pendingId, userId)`, que junto a `commitPending` es el único lugar que resuelve el estado de un pendiente — ver decision log
- `tests/integration/review.test.ts` — new
- `tests/e2e/revision.spec.ts` — new. Su `psql()` lleva `-q` además de `-t -A`: sin `-q`, un `INSERT ... RETURNING` devuelve el id **más** el tag `INSERT 0 1` en otra línea, y el id capturado queda corrupto — ver decision log

**Acceptance**

1. WHEN a pending row without `amount_cents` is confirmed THE SYSTEM SHALL return code `validation_failed` whose message names the missing field and write no transaction.
2. WHEN a pending row is confirmed twice THE SYSTEM SHALL return code `conflict` on the second call and leave the `transactions` row count unchanged.
3. WHEN a pending row is confirmed THE SYSTEM SHALL write one `transactions` row, set `committed_transaction_id`, and write one `audit_log` row with action `pending.confirm`.
4. WHEN a pending row is rejected THE SYSTEM SHALL set its status to `rejected` and write zero `transactions` rows.
5. WHEN the review screen renders a pending row THE SYSTEM SHALL display its `raw_input` text on the page.

**Verify**

```bash
pnpm typecheck
pnpm test tests/integration/review.test.ts
pnpm test:e2e tests/e2e/revision.spec.ts
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T3: pantalla de revision"
git tag step-10-revision
```

### `E2-T4` — Almacenamiento y recibos

**Depends on:** `E2-T3` · **Priority:** p1 — metadata for scope cuts, not a running order

`storage/index.ts` abstrae el driver: `local` escribe bajo `STORAGE_LOCAL_DIR` en dev y tests,
`supabase` escribe en Supabase Storage en producción (E2-T7 lo activa). El dedupe es por
`sha256` con `unique (user_id, sha256)` — subir la misma foto dos veces no la procesa dos veces.
Corre `pnpm fixtures` primero: escribe `receipt-sample.png` desde el base64 que vino en `workspace/`.

**Files**
- `src/server/storage/index.ts` — new: `putObject`/`getObject`, driver local o supabase
- `src/server/ingest/extract-document.ts` — new: extractor de un movimiento desde imagen/PDF
- `src/app/(app)/subir/page.tsx` — new
- `src/app/(app)/subir/actions.ts` — new
- `src/server/ingest/pending.ts` — retroactive: `createPending` gana un segundo parámetro opcional (`db`, el `Prisma.TransactionClient` o el cliente global) para que `extract-document.ts` pueda escribir `documents` y el pendiente en la misma transacción que el `audit_log` de `document.upload`, sin dejar de ser el único lugar que arma el INSERT
- `tests/integration/receipts.test.ts` — new

**Acceptance**

1. WHEN a PNG receipt is uploaded THE SYSTEM SHALL write one `documents` row and one `pending_transactions` row with `source` equal to `receipt`.
2. WHEN the same file is uploaded a second time THE SYSTEM SHALL return code `conflict` and create no second `pending_transactions` row.
3. WHEN a file with an unsupported mime type is uploaded THE SYSTEM SHALL return code `validation_failed` and store nothing.
4. WHEN `STORAGE_DRIVER` is `local` THE SYSTEM SHALL write the object under `STORAGE_LOCAL_DIR` and read it back byte-identical.
5. WHEN an upload succeeds THE SYSTEM SHALL write one `audit_log` row with action `document.upload`.

**Verify**

```bash
pnpm fixtures
pnpm typecheck
pnpm test tests/integration/receipts.test.ts
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T4: almacenamiento y recibos"
git tag step-11-documentos
```

### `E2-T5` — Extractos bancarios en PDF

**Depends on:** `E2-T4` · **Priority:** p1 — metadata for scope cuts, not a running order

El paso más variable del build: cada banco emite un formato distinto. La mitigación es que **todo
pasa por revisión humana** y la cobertura es incremental, banco por banco — no persigas "todos los
bancos" aquí. Dos reglas que parecen menores y no lo son: un movimiento sin fecha legible se guarda
con `occurred_on` nulo en vez de adivinar una, y dos movimientos idénticos en fecha, descripción y
monto se conservan **ambos**, porque en un extracto real eso suele ser dos compras iguales el mismo
día, no un duplicado.

**Files**
- `src/server/ingest/extract-statement.ts` — new: extractor de muchos movimientos. Gana ademas un `resolveClient()` interno que sustituye el `AiClient` por uno falso cuando `e2eBypassUserId()` esta activo — ver decision log, es lo que hace posible `tests/e2e/subir.spec.ts`.
- `src/server/ingest/statement-batch.ts` — new: agrupa los movimientos de un extracto. `source_ref = sha256(indice|fecha|descripcion|monto|nombreArchivo)` — el indice es una correccion sobre el algoritmo tal como lo describe §9 paso 12, ver decision log.
- `prisma/schema.prisma` — retroactive: `PendingTransaction` gana `sourceRef String? @map("source_ref")` (migracion `add_pending_source_ref`), para que `commitPending` pueda propagarlo a `transactions.source_ref` y la unicidad `(user_id, source, source_ref)` de §4 rechace confirmar el mismo movimiento dos veces
- `src/server/ingest/pending.ts` — retroactive: `createPending` acepta `sourceRef` opcional
- `src/server/ledger/commit.ts` — retroactive: `commitPending` manda `pending.sourceRef` al crear la `transaction`, y atrapa la violacion de unicidad (`P2002`) como `conflict` en vez de dejarla propagarse sin capturar
- `src/app/(app)/subir/actions.ts` — retroactive: `uploadReceiptAction` rutea por `mimeType` — PDF a `processStatement`, imagen a `extractReceipt` — ver decision log
- `tests/integration/statements.test.ts` — new
- `tests/e2e/subir.spec.ts` — new

**Acceptance**

1. WHEN a statement PDF yielding three movements is uploaded THE SYSTEM SHALL write three `pending_transactions` rows with `source` equal to `statement`.
2. WHEN the same statement file is uploaded again THE SYSTEM SHALL return code `conflict` and create zero new `pending_transactions` rows.
3. WHEN a movement in the statement has no readable date THE SYSTEM SHALL store it with a null `occurred_on` and status `awaiting_review` rather than guessing one.
4. WHEN two movements in one statement have identical date, description and amount THE SYSTEM SHALL keep both as separate pending rows.
5. WHEN a statement is uploaded through the interface THE SYSTEM SHALL list its movements on `/revision`.

**Verify**

```bash
pnpm typecheck
pnpm test tests/integration/statements.test.ts
pnpm test:e2e tests/e2e/subir.spec.ts
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T5: extractos bancarios en PDF"
git tag step-12-extractos
```

### `E2-T6` — Importacion del Excel historico y paridad

**Depends on:** `E2-T5` · **Priority:** p1 — metadata for scope cuts, not a running order

Importación de **una sola vez** del histórico, no un canal recurrente. A diferencia de todo lo demás
que no es manual, esto escribe directo a `transactions` con `source` igual a `excel_import`: son
datos que el usuario ya revisó durante años en su hoja. La idempotencia viene del hash de fila en
`source_ref` bajo `unique (user_id, source, source_ref)`. Una fila con monto no numérico se reporta
como fallida y **las demás igual se importan** — un archivo real siempre trae basura en alguna fila.
`parity-check.ts` es el que decide si el corte puede ocurrir.

**Files**
- `src/server/ingest/import-excel.ts` — new. La hoja no trae columna de cuenta (solo `fecha`, `descripcion`, `monto`): el usuario elige la cuenta destino una vez, en el formulario de `/importar` — todo el archivo entra a esa cuenta. `source_ref = sha256(fecha|descripcion|monto)`, sin componente de posición (a diferencia de `statement-batch.ts` del paso 12): es una hoja curada a mano una sola vez, no un extracto de banco con filas potencialmente idénticas por diseño.
- `src/app/(app)/importar/page.tsx` — new
- `src/app/(app)/importar/actions.ts` — new
- `src/app/(app)/importar/import-form.tsx` — new: **el primer componente `"use client"` de la app.** Es el único formulario que necesita mostrar en la misma pantalla el resultado estructurado de la acción (conteo leídas/importadas/saltadas y el detalle de las que fallaron) en vez de solo revalidar y seguir — los demás formularios descartan el `Result` y dependen de `revalidatePath`. Usa `useActionState` (React 19 / Next 16); cumple la regla 4 de código (`"use client"` solo en la hoja que necesita estado).
- `scripts/parity-check.ts` — new: compara el libro contra la hoja para **la cuenta `"cuenta de ahorros"` por nombre**, no para cualquier cuenta con filas `source='excel_import'` — ver decision log
- `src/lib/money.ts` — retroactive: gana `pesosNumberToCents(monto: number): bigint`, para convertir el `number` que devuelve una celda de Excel (a diferencia de `pesosToCents`, que espera la cadena de dígitos que manda el modelo de IA)
- `src/server/ledger/commit.ts` — retroactive: gana `importRow()`, el único camino que escribe `transactions` sin pasar por revisión (paso 13); atrapa la violación de unicidad `(user_id, source, source_ref)` como `conflict`
- `pnpm-workspace.yaml` — retroactive: `overrides: '@types/node': ^20` — ver decision log
- `tests/integration/import-excel.test.ts` — new

**Acceptance**

1. WHEN the historical workbook is imported THE SYSTEM SHALL write three `transactions` rows with `source` equal to `excel_import`.
2. WHEN the same workbook is imported a second time THE SYSTEM SHALL leave the `transactions` row count unchanged and report the skipped rows.
3. WHEN a row has a non-numeric amount THE SYSTEM SHALL report that row as failed and still import the remaining rows.
4. WHEN `scripts/parity-check.ts` runs after a successful import THE SYSTEM SHALL exit 0 with a per-account difference of 0.
5. WHEN a row is imported THE SYSTEM SHALL write one `audit_log` row with action `import.excel`.

**Verify**

```bash
pnpm fixtures
pnpm typecheck
pnpm test tests/integration/import-excel.test.ts
sh scripts/with-test-env.sh pnpm exec tsx scripts/parity-check.ts
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T6: importacion del Excel historico y paridad"
git tag step-13-excel
```

### `E2-T7` — Respaldo, restauracion y despliegue

**Depends on:** `E2-T6` · **Priority:** p0 — metadata for scope cuts, not a running order

El paso que hace la app confiable como fuente de verdad del dinero. `restore-check.sh` no comprueba
que el respaldo *exista*: **restaura el dump más reciente en otra base y compara conteos tabla por
tabla**. Un respaldo que nunca se restauró no es un respaldo, es un archivo. `storage/index.ts` se
edita para que el driver `supabase` **falle con un error nombrado** si falta
`SUPABASE_SERVICE_ROLE_KEY`, en vez de caer silenciosamente al driver local y escribir archivos de
producción en el disco efímero de Vercel. `set-telegram-webhook.ts` solo sale 0 después de que
`getWebhookInfo` confirme la URL registrada.

**Files**
- `scripts/backup.sh` — new: `pg_dump` a `backups/`
- `scripts/restore-check.sh` — new: restaura en otra base y compara conteos
- `scripts/set-telegram-webhook.ts` — new: registra el webhook con `PRODUCTION_URL`
- `.github/workflows/ci.yml` — new: el mismo gate del acceptance global. Levanta Postgres con el `docker-compose.yml` del propio repo, no el bloque `services:` nativo de Actions; el primer paso es `cp .env.example .env` (ningún paso del gate necesita una credencial real). `pnpm db:migrate` + `pnpm db:seed` corren antes que `sh scripts/backup.sh`, que corre inmediatamente antes de `sh scripts/restore-check.sh` — ver decision log, sin esos tres pasos en ese orden el gate es irrecuperable en un runner limpio
- `src/server/storage/index.ts` — edit: activa el driver `supabase`, falla nombrado si falta la llave
- `src/lib/env.ts` — retroactive: gana `requireProductionUrl()`
- `src/server/telegram/client.ts` — retroactive: gana `setWebhook`/`getWebhookInfo`
- `tests/unit/storage.test.ts` — new: el driver `supabase` sin la llave falla nombrado, nunca cae al local
- `.claude/settings.json` — retroactive: `pnpm db:migrate`/`pnpm db:seed` (dev, sin `:test`) entran al allowlist — ver decision log

**Acceptance**

1. WHEN `sh scripts/backup.sh` runs THE SYSTEM SHALL write one new dump file into `backups/` and exit 0.
2. WHEN `sh scripts/restore-check.sh` runs THE SYSTEM SHALL restore the newest dump into a separate database, report an identical row count for every table, and exit 0.
3. WHEN `STORAGE_DRIVER` is `supabase` and `SUPABASE_SERVICE_ROLE_KEY` is absent THE SYSTEM SHALL fail with a named error instead of falling back to the local driver.
4. WHEN `scripts/set-telegram-webhook.ts` runs THE SYSTEM SHALL exit 0 only after `getWebhookInfo` reports the URL built from `PRODUCTION_URL`.
5. WHEN the CI workflow runs THE SYSTEM SHALL execute, in order, `docker compose up -d --wait`, `pnpm install --frozen-lockfile`, `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm db:migrate:test`, `pnpm db:seed:test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm smoke`, `pnpm fixtures`, `pnpm test`, `pnpm test:e2e`, `sh scripts/backup.sh`, `sh scripts/restore-check.sh`, and a check that `git tag -l 'step-*'` counts 14, and exit 0 only if every one of them exits 0.

**Verify**

```bash
pnpm typecheck
pnpm lint
sh scripts/with-env.sh pnpm exec prisma migrate deploy
sh scripts/backup.sh
sh scripts/restore-check.sh
pnpm build && pnpm smoke
pnpm test
pnpm test:e2e
grep -qF 'docker compose up -d --wait' .github/workflows/ci.yml
grep -qF 'pnpm install --frozen-lockfile' .github/workflows/ci.yml
grep -qF 'pnpm db:generate' .github/workflows/ci.yml
grep -qE 'pnpm db:migrate[[:space:]]*$' .github/workflows/ci.yml
grep -qE 'pnpm db:seed[[:space:]]*$' .github/workflows/ci.yml
grep -qF 'pnpm db:migrate:test' .github/workflows/ci.yml
grep -qF 'pnpm db:seed:test' .github/workflows/ci.yml
grep -qF 'pnpm typecheck' .github/workflows/ci.yml
grep -qF 'pnpm lint' .github/workflows/ci.yml
grep -qF 'pnpm build' .github/workflows/ci.yml
grep -qF 'pnpm smoke' .github/workflows/ci.yml
grep -qF 'pnpm fixtures' .github/workflows/ci.yml
grep -qE 'pnpm test[[:space:]]*$' .github/workflows/ci.yml
grep -qF 'pnpm test:e2e' .github/workflows/ci.yml
grep -qF 'sh scripts/backup.sh' .github/workflows/ci.yml
grep -qF 'sh scripts/restore-check.sh' .github/workflows/ci.yml
grep -qF "git tag -l 'step-*'" .github/workflows/ci.yml
```

Las últimas diecisiete líneas son las que hacen verificable el criterio 5: comprueban que `ci.yml`
contenga literalmente cada comando del gate global, en vez de confiar en que alguien lo transcribió
bien. Son `grep` sueltos y no un bucle a propósito — sin control de flujo, cada línea sale 0 por su
cuenta y el allowlist de `.claude/settings.json` las cubre con `Bash(grep:*)`.

**Checkpoint**

```bash
git add -A && git commit -m "E2-T7: respaldo, restauracion y despliegue"
git tag step-14-deploy
git ls-files --error-unmatch .github/workflows/ci.yml   # expect: exit 0 — ya commiteado arriba
```

---

## Epic acceptance

The epic is done when every task is `done` **and**:

1. WHEN un gasto manual, un recibo en imagen y un extracto en PDF se registran por la interfaz y se confirman en `/revision` THE SYSTEM SHALL mostrarlos los tres en el libro con su prefijo de signo y una fila de `audit_log` por cada uno.
2. WHEN `sh scripts/restore-check.sh` corre sobre el respaldo más reciente THE SYSTEM SHALL reportar conteos idénticos para toda tabla y salir 0.

```bash
pnpm typecheck && pnpm lint && pnpm test
pnpm test:e2e
sh scripts/restore-check.sh
```

Run from the project root. Both criteria must be decidable by these commands.

## Pitfalls

- **Escribir `transactions` o `pending_transactions` directo desde una acción de ruta.** Los
  escritores únicos del epic 01 existen para que el `audit_log` y la idempotencia no dependan de que
  alguien se acuerde. El `grep` de E1-T4 falla si aparece otra escritura.
- **Usar solo color para entrada vs. salida.** Falla la accesibilidad y falla el criterio 6 de E2-T1.
  El prefijo `+`/`−` es obligatorio, el color es un refuerzo.
- **Formatear montos sin `tabular-nums`.** Las columnas dejan de alinear y una tabla de dinero
  desalineada se lee mal de inmediato.
- **Adivinar la fecha de un movimiento ilegible en un extracto.** Se guarda `occurred_on` nulo. Una
  fecha inventada en la fuente de verdad del dinero es peor que un campo vacío.
- **Deduplicar dos movimientos idénticos de un mismo extracto.** Suelen ser dos compras reales
  iguales el mismo día. Se conservan ambos.
- **Dar por bueno un respaldo que nunca se restauró.** `restore-check.sh` existe precisamente porque
  "el backup está activado" no es evidencia de nada.
- **Dejar que el driver `supabase` caiga al local cuando falta la llave.** Escribiría archivos de
  producción en el disco efímero de Vercel y se perderían sin ruido. Falla nombrado.
- **Unificar la densidad del libro y la de revisión.** Son deliberadamente distintas: escanear vs.
  decidir.

## Before moving on

- [ ] Every task in this epic is `done` in `tasks.json` — no task left `in_progress`.
- [ ] Every `verify` command of every task in this epic passed, not just the first one.
- [ ] No `verify` command was edited, and none was skipped because a file it names did not exist.
- [ ] **Every task in this epic has its `checkpoint` tag in version control** — one tag per task,
      matching the `checkpoint` value in `tasks.json`. `git tag -l 'step-*'` lists them.
- [ ] Gate command passes clean, run from the project root.
- [ ] Every "Produced" contract above exists with the stated signature.
- [ ] No file outside the subtree was modified.
- [ ] `.env.example` updated if this epic added a variable — este epic no agrega ninguna: todas ya
      están en el `.env.example` que llegó con `workspace/`.
- [ ] One commit per task, each prefixed with its task id, each followed by its checkpoint tag.
