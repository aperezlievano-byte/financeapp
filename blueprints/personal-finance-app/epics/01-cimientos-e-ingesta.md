# Epic 01: Cimientos e ingesta

> Al terminar este epic existe el libro contable con sus guardas append-only, la sesión de un solo
> usuario, y toda la cadena de ingesta por texto — incluido el bot de Telegram que confirma por chat.
> Todavía no hay interfaz web: eso es el epic 02.

| | |
|---|---|
| **Epic id** | `01-cimientos-e-ingesta` |
| **Tasks** | `E1-T1` … `E1-T7` |
| **Depends on** | nothing — start here |
| **Unlocks** | `02-interfaz-documentos-y-despliegue` |
| **Parallel with** | ninguno — es el primero |

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
| Build + smoke | `pnpm build && pnpm smoke` |
| Prisma client | `pnpm db:generate` |
| Migrar base de test | `pnpm db:migrate:test` |
| Sembrar base de test | `pnpm db:seed:test` |
| Postgres local | `docker compose up -d --wait` / `docker compose down` |

**Gate:** `pnpm typecheck && pnpm lint && pnpm test` passes before any task here is marked done.

If any task below verifies against a real service, start it first with the command above. The file
that defines it shipped in `workspace/` and is already at the project root — you do not write it,
and you never substitute a fake for a service the acceptance criteria name.

`docker-compose.yml`, `vitest.config.ts`, `playwright.config.ts`, `tests/setup.ts`,
`docker/init-test-db.sql`, `scripts/with-env.sh`, `scripts/with-test-env.sh` y `scripts/smoke.sh`
**ya están** en la raíz del proyecto: llegaron con la copia de `workspace/`. No los escribas.

## Directory subtree

Only the parts this epic touches:

```
prisma/
  schema.prisma        # única fuente de verdad del esquema — NEW (E1-T2)
  migrations/          # SQL generado por prisma migrate; una aplicada NUNCA se edita — NEW (E1-T2)
  seed.ts              # cuentas y categorías del único usuario — NEW (E1-T2)
src/
  proxy.ts             # NO middleware.ts — mismo nivel que app/ bajo --src-dir — NEW (E1-T1), edit (E1-T3)
  app/
    globals.css        # @theme con los tokens de diseño — NEW (E1-T1)
    login/
      page.tsx         # única ruta pública — NEW (E1-T1), edit (E1-T3)
      actions.ts       # acción de sign-in — NEW (E1-T3)
    api/
      health/route.ts               # base alcanzable + migraciones aplicadas — NEW (E1-T2)
      webhooks/telegram/route.ts    # verifica cabecera secreta, normaliza y encola — NEW (E1-T6)
  lib/
    env.ts             # único lugar que lee process.env — NEW (E1-T1)
    money.ts           # único lugar que formatea o parsea dinero — NEW (E1-T4)
    auth/guard.ts      # sesión y bypass e2e — NEW (E1-T3)
  server/
    db/client.ts       # único lugar que abre conexión — NEW (E1-T2)
    db/with-audit.ts   # envuelve toda escritura y escribe audit_log — NEW (E1-T4)
    ledger/commit.ts   # único escritor de transactions — NEW (E1-T4)
    ai/gateway.ts      # ÚNICO archivo que importa @anthropic-ai/sdk — NEW (E1-T5)
    ingest/channel.ts            # el puerto IngestChannel — NEW (E1-T6)
    ingest/telegram.ts           # implementación del puerto — NEW (E1-T6), edit (E1-T7)
    ingest/pipeline.ts           # normalizado -> dedupe -> allowlist -> extracción — NEW (E1-T7)
    ingest/conversation.ts       # estado "esperando confirmación", persistido — NEW (E1-T7)
    ingest/pending.ts            # único escritor de pending_transactions — NEW (E1-T5)
    ingest/extract-free-text.ts  # extractor de texto libre — NEW (E1-T5)
    telegram/client.ts           # llamadas HTTP a la API de Telegram — NEW (E1-T6)
tests/
  unit/env.test.ts                        # ramas obligatoria y opcional del entorno
  unit/guard.test.ts                      # bypass e2e y forbidden
  unit/money.test.ts                      # formato es-CO exacto
  integration/schema.test.ts              # tablas, checks y triggers append-only
  integration/commit.test.ts              # audit_log e idempotencia del commit
  integration/pending.test.ts             # pendiente escrito, transacción no
  integration/telegram-webhook.test.ts    # secreto, idempotencia y allowlist
  integration/telegram-confirm.test.ts    # sí / no / ninguno, y expiración
```

Everything outside this subtree is out of scope. If a task seems to require editing a file not
listed here, stop and report — it means the epic boundary is wrong.

## Data model touched here

| Entity | Fields this epic adds or reads | Notes |
|---|---|---|
| `accounts` | `name`, `currency`, `archived_at` | `name` literal y en minúsculas: `cuenta de ahorros` es el nombre que el bot repite al confirmar. Nunca se borra, se archiva |
| `categories` | `name`, `archived_at` | Se captura en v1, no se grafica |
| `transactions` | `amount_cents`, `direction`, `occurred_on`, `source`, `source_ref`, `deleted_at` | **Append-only forzado por trigger.** `amount_cents` siempre positivo (`check > 0`) y `bigint`; el sentido lo da `direction`. `source_ref` es la huella idempotente del origen |
| `pending_transactions` | `status`, `extraction`, `confidence`, `raw_input`, `committed_transaction_id` | Antesala obligatoria de `transactions` para todo `source` ≠ `manual`. `committed_transaction_id` es `unique` |
| `inbound_messages` | `channel`, `provider_message_id`, `sender`, `allowed` | `channel` es `text` **y no un enum, a propósito**. `unique (channel, provider_message_id)` es lo que impide que un reintento duplique un gasto |
| `conversation_states` | `channel`, `sender`, `prompt_text`, `expires_at`, `pending_id` | `unique (channel, sender)`. `expires_at = now() + 24h`; vencido se trata como `none` |
| `audit_log` | `action`, `resource_type`, `resource_id` | **Append-only forzado por trigger.** Sin claves foráneas a propósito |

## Contracts

**Consumed** — already exists, do not rebuild:

| From | Interface | Guarantee |
|---|---|---|
| `workspace/` | `docker-compose.yml`, `vitest.config.ts`, `tests/setup.ts` | Postgres en el puerto 5433 del host; `tests/setup.ts` se niega a correr contra una base que no termine en `_test` |
| `workspace/` | `scripts/with-env.sh`, `scripts/with-test-env.sh`, `scripts/smoke.sh` | Cargan `.env` y ejecutan; Prisma, tsx y Vitest no la cargan solos |

**Produced** — later epics depend on exactly these signatures. Changing one breaks them:

| Export | Signature | Used by |
|---|---|---|
| `src/lib/money.ts` → `formatCOP` | `(cents: bigint) => string` | `02-interfaz-documentos-y-despliegue` |
| `src/lib/money.ts` → `formatSignedCOP` | `(cents: bigint, direction: "in" \| "out") => string` | `02-interfaz-documentos-y-despliegue` |
| `src/lib/auth/guard.ts` → `requireUser` | `() => Promise<Result<UserId>>` | `02-interfaz-documentos-y-despliegue` |
| `src/server/ledger/commit.ts` → `createManual`, `commitPending` | escritores únicos de `transactions` | `02-interfaz-documentos-y-despliegue` |
| `src/server/ingest/pending.ts` → escritor de `pending_transactions` | único escritor | `02-interfaz-documentos-y-despliegue` |
| `src/server/ai/gateway.ts` → gateway | única puerta al SDK de Anthropic | `02-interfaz-documentos-y-despliegue` |
| `src/server/ingest/channel.ts` → `IngestChannel` | puerto: `{ remitente, texto?, adjuntos[], timestamp, idMensaje }` | adaptador de WhatsApp, post-v1 |

## Conventions that bite in this area

- **`src/server/**` y `src/app/api/**` no importan `next/*`.** Usan `Request`/`Response` web. Eso es
  lo que permite que Vitest los cargue sin bundler. Única excepción: `proxy.ts`, sin tests unitarios.
- **`src/server/ingest/channel.ts` y `pipeline.ts` no contienen la palabra `telegram` en ninguna
  forma.** Los pasos E1-T6 y E1-T7 lo verifican con un `grep` que falla si aparece. El acoplamiento
  al proveedor vive solo en `ingest/telegram.ts` y `telegram/client.ts`.
- **El id del modelo de Anthropic NUNCA se escribe en el código.** Va en `ANTHROPIC_MODEL_ID`. Un
  `grep` de E1-T5 falla si aparece `claude-`, `sonnet`, `opus` o `haiku` en `src`.
- **El archivo es `proxy.ts`, no `middleware.ts`.** Exporta `proxy`.
- **`amount_cents` es siempre positivo y `bigint`.** Un salario en centavos supera `int4`. El sentido
  lo da `direction`, nunca el signo del número.
- **El estado de conversación vive en la base, nunca en memoria del proceso.** Vercel es serverless.
  E1-T7 lo verifica con un `grep` que falla si aparece un `let …State` o `const …Cache` de módulo.
- Alias `@/` solo en `src/app/**` y `src/components/**`; todo lo demás con rutas relativas sin extensión.

Full project rules: `CLAUDE.md`. Area rules: `.claude/rules/{name}.md`. Both sit in the project
root — the builder copied them there from the bundle's `workspace/` before task one.

---

## Tasks

Listed in the same order as `tasks.json`. That order is the build order — work top to bottom and do
not re-rank by priority or by what looks quick.

### `E1-T1` — Esqueleto, entorno y /login servido

**Depends on:** nothing · **Priority:** p0 — metadata for scope cuts, not a running order

El Bootstrap ya dejó el andamio, `biome.json`, `.gitignore`, el repositorio y las dependencias. Este
paso escribe el código propio mínimo que hace verde el gate. La pieza clave es `src/lib/env.ts` con
un esquema zod de **dos niveles**: el conjunto siempre obligatorio se valida al importar, y el resto
queda opcional detrás de funciones `requireAnthropic()`, `requireTelegram()`,
`requireSupabaseStorage()` que lanzan solo cuando se invocan. Esa degradación es lo que impide que
E1-T5 rompa el gate de este paso. `proxy.ts` redirige a `/login` toda petición sin la cookie
`pfa_at`, pero **todavía no valida el token**: eso es E1-T3.

**Files**
- `src/lib/env.ts` — new
- `src/app/login/page.tsx` — new: Server Component con el formulario, sin acción todavía
- `src/proxy.ts` — new: exporta `proxy`, no `middleware`. Vive en `src/`, no en la raíz — con
  `--src-dir` Next 16 solo detecta `proxy.ts` al mismo nivel que `app/`
- `src/app/globals.css` — new: tokens dentro de `@theme` más `prefers-reduced-motion`
- `tests/unit/env.test.ts` — new

**Acceptance**

Copied verbatim from this task's `acceptance` array in `tasks.json`. Each one is decidable by a
command below, on this machine, during the build.

1. WHEN `pnpm install --frozen-lockfile` runs THE SYSTEM SHALL exit 0 without modifying `pnpm-lock.yaml`.
2. WHEN `pnpm lint` runs THE SYSTEM SHALL exit 0 with zero errors and zero warnings, including on the `@theme` block of `src/app/globals.css`.
3. WHEN `src/lib/env.ts` is imported with `DATABASE_URL` unset THE SYSTEM SHALL throw an error whose message contains `DATABASE_URL`.
4. WHEN `src/lib/env.ts` is imported with `ANTHROPIC_API_KEY` unset THE SYSTEM SHALL NOT throw.
5. WHEN `pnpm build && pnpm smoke` runs THE SYSTEM SHALL print `smoke ok: /login=200, / -> /login` and exit 0.

**Verify** — every command, in order, run from the project root. Each one exits 0 when this task is
correct; the last one exiting 0 is what makes the task done.

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test tests/unit/env.test.ts
pnpm build && pnpm smoke
```

**Checkpoint**

```bash
git add -A && git commit -m "E1-T1: esqueleto, entorno y /login servido"
git tag step-01-skeleton
```

Run both after the last `Verify` command exits 0, before starting the next task.

### `E1-T2` — Esquema, migraciones, guardas append-only y semilla

**Depends on:** `E1-T1` · **Priority:** p0 — metadata for scope cuts, not a running order

Escribe el esquema completo de las 8 entidades y **dos** migraciones: la inicial que emite
`prisma migrate dev --name initial_schema`, y una segunda creada con `--create-only --name
append_only_guards` en cuyo `migration.sql` pegas el bloque SQL de guardas (checks,
`forbid_mutation`, `transactions_guard` y los tres triggers). **No escribas el nombre del directorio
que emite Prisma**: Prisma lo elige. Las guardas son lo que convierte "append-only" de convención en
garantía de la base — sin ellas, un `DELETE` accidental borra dinero real.

Instala también `pnpm add @prisma/adapter-pg@7.10.0 pg @prisma/client-runtime-utils@7.10.0` y
`pnpm add -D @types/pg`. El tercero no es evidente y **ningún comando de este paso lo detecta** —
solo un `pnpm build` real (recién en E1-T3) revela `Module not found:
Can't resolve '@prisma/client-runtime-utils'`: con `output` del cliente apuntando fuera de
`node_modules` (`src/generated/prisma`), pnpm en modo estricto no expone ahí las dependencias
transitivas del runtime de `@prisma/client` a menos que sean dependencia directa del `package.json`
raíz. Instálalo ahora, no esperes a que E1-T3 lo descubra.

**Files**
- `prisma.config.ts` — new, en la raíz del proyecto: Prisma 7 ya no acepta `url`/`directUrl` en
  `datasource` dentro de `schema.prisma` (error `P1012`); la conexión de la CLI vive acá vía
  `defineConfig({ datasource: { url: env("DIRECT_DATABASE_URL") }, migrations: { path:
  "prisma/migrations", seed: "tsx prisma/seed.ts" } })`, importado de `"prisma/config"`
- `prisma/schema.prisma` — new, con `datasource db { provider = "postgresql" }` sin `url` ni `directUrl`
- `prisma/migrations/**` — new: generado por Prisma; una migración aplicada NUNCA se edita
- `prisma/seed.ts` — new: 4 cuentas y 8 categorías, idempotente
- `src/server/db/client.ts` — new: único lugar que abre conexión. Prisma 7 exige un driver adapter
  explícito (`new PrismaClient()` vacío no conecta): construye `new PrismaPg(env.DATABASE_URL)` de
  `@prisma/adapter-pg` y lo pasa como `new PrismaClient({ adapter })`
- `tests/integration/schema.test.ts` — new

**Acceptance**

1. WHEN `pnpm db:migrate:test` runs against an empty database THE SYSTEM SHALL exit 0 and create every table defined in the schema.
2. WHEN `pnpm db:seed:test` runs twice in a row THE SYSTEM SHALL exit 0 both times and leave exactly 4 rows in `accounts` and 8 rows in `categories`.
3. WHEN a `DELETE` is issued against `transactions` THE SYSTEM SHALL raise an exception and psql SHALL exit with code 1 under `ON_ERROR_STOP=1` and `-c`.
4. WHEN an `UPDATE` is issued against `audit_log` THE SYSTEM SHALL raise an exception and psql SHALL exit with code 1 under `ON_ERROR_STOP=1` and `-c`.
5. WHEN a transaction row is inserted with `amount_cents` of 0 THE SYSTEM SHALL reject it with a check-constraint violation.
6. WHEN `GET /api/health` is called THE SYSTEM SHALL respond 200 with `{ ok: true }` and `data.db` equal to `reachable`.

**Verify**

```bash
docker compose up -d --wait
pnpm db:generate
pnpm db:migrate:test
pnpm db:seed:test && pnpm db:seed:test
pnpm typecheck
pnpm test tests/integration/schema.test.ts
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d personal_finance_test -c "delete from transactions"; test $? -eq 1
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d personal_finance_test -c "update audit_log set action='x'"; test $? -eq 1
```

Las dos últimas líneas están envueltas a propósito: el éxito de la guarda **es** un error de SQL, así
que `test $? -eq 1` hace que la línea salga 0 cuando la guarda funciona. **No es `-eq 3`** aunque ese
sea el código que la documentación de psql promete para "error de script bajo `ON_ERROR_STOP`": esa
semántica es de `-f` (archivo de script); `-c` (comando inline, el que usa esta línea) cae en el mismo
código 1 que cualquier error fatal de psql. Confirmado corriendo ambas formas contra Postgres 17. No
las "limpies" quitando el envoltorio — sin él, el gate queda rojo para siempre.

**Checkpoint**

```bash
git add -A && git commit -m "E1-T2: esquema, migraciones, guardas append-only y semilla"
git tag step-02-schema
```

### `E1-T3` — Sesion de un solo usuario

**Depends on:** `E1-T2` · **Priority:** p0 — metadata for scope cuts, not a running order

Conecta la acción de sign-in y haz que `proxy.ts` valide el token, no solo la presencia de la cookie.
`e2eBypassUserId()` es el punto delicado: existe para que Playwright no tenga que autenticarse, y
por eso exige **tres** condiciones simultáneas — `E2E_USER_ID` presente, `DATABASE_URL` terminando en
`_test`, y `DATABASE_URL` igual a `E2E_DATABASE_URL`. Si cualquiera falla, devuelve null. Esa
conjunción es lo que impide que el bypass se active jamás contra la base real.

**Files**
- `src/lib/result.ts` — new: el sobre `Result<T>`/`ErrorCode` de §5, en un solo lugar — toda frontera
  lo usa, sin excepciones
- `src/lib/auth/guard.ts` — new: `requireUser()`, `resolveSession(accessToken)`,
  `refreshSession(refreshToken)` y `e2eBypassUserId()`. También exporta `ACCESS_COOKIE`,
  `REFRESH_COOKIE` y `SESSION_COOKIE_OPTIONS` para que `login/actions.ts` y `proxy.ts` no dupliquen
  los nombres de cookie ni sus flags
- `src/app/login/actions.ts` — new: `signIn` y `signOut` contra Supabase Auth
- `src/app/login/page.tsx` — edit: pasa a Client Component (`useActionState` lo exige) y conecta la
  acción
- `src/proxy.ts` — edit: ahora valida el token
- `tests/unit/guard.test.ts` — new

**Acceptance**

1. WHEN `E2E_USER_ID` is set, `DATABASE_URL` ends with `_test` and equals `E2E_DATABASE_URL` THE SYSTEM SHALL return that user id from `e2eBypassUserId()`.
2. WHEN `E2E_USER_ID` is set but `DATABASE_URL` does not end with `_test` THE SYSTEM SHALL return null from `e2eBypassUserId()`.
3. WHEN `E2E_USER_ID` is set but differs from `E2E_DATABASE_URL` THE SYSTEM SHALL return null from `e2eBypassUserId()`.
4. WHEN `requireUser()` receives an `x-user-id` header different from `APP_USER_ID` THE SYSTEM SHALL return an error with code `forbidden`.
5. WHEN sign-in is called with wrong credentials THE SYSTEM SHALL return code `unauthorized` with the message `Correo o contraseña incorrectos.` and set no cookie.

**Verify**

```bash
pnpm typecheck
pnpm lint
pnpm test tests/unit/guard.test.ts
pnpm build && pnpm smoke
```

**Checkpoint**

```bash
git add -A && git commit -m "E1-T3: sesion de un solo usuario"
git tag step-03-auth
```

### `E1-T4` — Dinero, auditoria y el unico escritor del libro

**Depends on:** `E1-T2` · **Priority:** p0 — metadata for scope cuts, not a running order

Tres piezas que se sostienen entre sí. `money.ts` es el único lugar que formatea o parsea dinero, y
el formato es **es-CO**: punto como separador de miles, coma decimal, y el signo menos es **U+2212**
(`−`), no el guion ASCII. `with-audit.ts` envuelve toda escritura y escribe `audit_log` **en la misma
transacción de base** — si el audit falla, la escritura se revierte. `ledger/commit.ts` es el único
escritor de `transactions`, y el `grep` del Verify lo hace cumplir mecánicamente.

**Files**
- `src/lib/money.ts` — new
- `src/server/db/with-audit.ts` — new
- `src/server/ledger/commit.ts` — new: `createManual` y `commitPending`
- `tests/unit/money.test.ts` — new
- `tests/integration/commit.test.ts` — new

**Acceptance**

1. WHEN `formatCOP(123456700n)` is called THE SYSTEM SHALL return the exact string `$1.234.567`.
2. WHEN `formatCOP(123456789n)` is called THE SYSTEM SHALL return the exact string `$1.234.567,89`.
3. WHEN `formatSignedCOP(45000000n, "out")` is called THE SYSTEM SHALL return the exact string `−$450.000` using U+2212 as the sign.
4. WHEN `createManual` inserts one transaction THE SYSTEM SHALL write exactly one `audit_log` row with `action` equal to `transaction.create` in the same database transaction.
5. WHEN `commitPending` is called twice with the same pending id THE SYSTEM SHALL return code `conflict` on the second call and leave the `transactions` row count unchanged.
6. WHEN `grep` searches `src` (excluding `src/generated/`, que es tipos generados por Prisma y no código de la aplicación) for a write to `transactions` outside `src/server/ledger/commit.ts` THE SYSTEM SHALL find no file.

**Verify**

```bash
pnpm typecheck
pnpm test tests/unit/money.test.ts tests/integration/commit.test.ts
grep -rln --include=*.ts --exclude-dir=generated -e "transaction\.create" -e "transaction\.update" -e "transaction\.updateMany" src | grep -vx "src/server/ledger/commit.ts"; test $? -eq 1
```

**`--exclude-dir=generated` es obligatorio, no cosmético.** El `.d.ts` que emite `prisma generate` en
`src/generated/prisma/` trae ejemplos en sus comentarios TSDoc — literalmente
`prisma.transaction.create({...})` — que sin esta exclusión hacen que el grep encuentre un archivo
que no es código propio y el gate quede rojo para siempre. Confirmado corriendo el comando contra el
cliente generado real.

La última línea sale 0 cuando **ninguna** ruta sobrevive al filtro. Un `test $? -eq 2` sería error de
`grep` y debe fallar.

**Checkpoint**

```bash
git add -A && git commit -m "E1-T4: dinero, auditoria y el unico escritor del libro"
git tag step-04-ledger-core
```

### `E1-T5` — Gateway de IA y extractor de texto libre

**Depends on:** `E1-T4` · **Priority:** p0 — metadata for scope cuts, not a running order

La rebanada vertical más barata de validar: texto libre, sin OCR y sin archivos. `ai/gateway.ts` es
el **único** archivo que importa `@anthropic-ai/sdk`, y lo importa **de forma perezosa** para que la
suite unitaria corra sin `ANTHROPIC_API_KEY`. La salida del modelo se valida con zod; si no pasa el
esquema, se devuelve `extraction_failed` y **no se escribe nada** — el sistema falla cerrado y jamás
inventa un movimiento. Todo lo extraído entra a `pending_transactions`, nunca directo al libro.

**Files**
- `src/server/ai/gateway.ts` — new
- `src/server/ingest/extract-free-text.ts` — new
- `src/server/ingest/pending.ts` — new: único escritor de `pending_transactions`
- `tests/unit/extract-free-text.test.ts` — new
- `tests/integration/pending.test.ts` — new

**Acceptance**

1. WHEN the free-text extractor receives `pagué el club de tiro por 100000 de mi cuenta de ahorros` with a stubbed AI client THE SYSTEM SHALL produce `amountCents` equal to `10000000` and `direction` equal to `out`.
2. WHEN the AI client returns a payload that fails the schema THE SYSTEM SHALL return code `extraction_failed` and write no row.
3. WHEN an extraction succeeds THE SYSTEM SHALL write exactly one `pending_transactions` row with `status` equal to `awaiting_review` and zero `transactions` rows.
4. WHEN the unit test suite runs without `ANTHROPIC_API_KEY` set THE SYSTEM SHALL exit 0, because the SDK is imported lazily and the tests inject a fake client.
5. WHEN `grep` searches `src` for an import of `@anthropic-ai/sdk` outside `src/server/ai/gateway.ts` THE SYSTEM SHALL find no file.

**Verify**

```bash
pnpm typecheck
pnpm test tests/unit/extract-free-text.test.ts tests/integration/pending.test.ts
grep -rln --include=*.ts "@anthropic-ai/sdk" src | grep -vx "src/server/ai/gateway.ts"; test $? -eq 1
grep -rn --include=*.ts -e "claude-" -e "sonnet" -e "opus" -e "haiku" src; test $? -eq 1
```

**Checkpoint**

```bash
git add -A && git commit -m "E1-T5: gateway de IA y extractor de texto libre"
git tag step-05-ai-gateway
```

### `E1-T6` — Puerto IngestChannel y webhook de Telegram

**Depends on:** `E1-T5` · **Priority:** p0 — metadata for scope cuts, not a running order

Aquí se define la abstracción que hace que agregar WhatsApp después sea cambiar una pieza y no
rediseñar. `ingest/channel.ts` declara el puerto `IngestChannel` con la forma normalizada
`{ remitente, texto?, adjuntos[], timestamp, idMensaje }` y **no menciona Telegram en ninguna forma**.
El route handler **solo verifica el secreto, normaliza y encola** — nada de extracción ni de lógica
de negocio ahí. Dos garantías de seguridad se ganan en este paso: la cabecera
`X-Telegram-Bot-Api-Secret-Token` contra `TELEGRAM_WEBHOOK_SECRET`, y la allowlist de remitente. Un
bot de Telegram es públicamente alcanzable por cualquiera que sepa su nombre; sin allowlist, un
extraño inyecta transacciones en la fuente de verdad. El rechazo es **silencioso hacia el remitente**
pero se registra con `allowed=false`.

**Files**
- `src/server/ingest/channel.ts` — new: el puerto, cero referencias a Telegram
- `src/server/ingest/telegram.ts` — new: implementación del puerto
- `src/server/telegram/client.ts` — new: llamadas HTTP a la API de Telegram
- `src/app/api/webhooks/telegram/route.ts` — new: verifica, normaliza y encola
- `tests/integration/telegram-webhook.test.ts` — new

**Acceptance**

1. WHEN a POST arrives with a wrong `X-Telegram-Bot-Api-Secret-Token` header THE SYSTEM SHALL respond 401 and write zero rows to `inbound_messages`.
2. WHEN the same Telegram update is delivered twice THE SYSTEM SHALL respond 200 both times and leave exactly one row in `inbound_messages`.
3. WHEN a message arrives from a sender other than `TELEGRAM_ALLOWED_CHAT_ID` THE SYSTEM SHALL respond 200, store the row with `allowed` false, write zero `pending_transactions` rows and send no reply.
4. WHEN an allowed message arrives THE SYSTEM SHALL store the row with `allowed` true and return `data.accepted` true.
5. WHEN `grep` searches `src/server/ingest/channel.ts` for the word `telegram` in any case THE SYSTEM SHALL find no match.

**Verify**

```bash
pnpm typecheck
pnpm test tests/integration/telegram-webhook.test.ts
grep -ri telegram src/server/ingest/channel.ts; test $? -eq 1
```

**Checkpoint**

```bash
git add -A && git commit -m "E1-T6: puerto IngestChannel y webhook de Telegram"
git tag step-06-telegram
```

### `E1-T7` — Confirmacion por chat con estado persistido

**Depends on:** `E1-T6` · **Priority:** p0 — metadata for scope cuts, not a running order

Cierra el circuito: el bot propone y el usuario confirma en el mismo chat, respetando la regla de
revisión humana obligatoria. El estado "esperando confirmación" vive en `conversation_states`, en la
base, **nunca en memoria del proceso** — Vercel es serverless y no conserva estado entre
invocaciones, así que un `Map` de módulo funcionaría en local y fallaría en producción de forma
intermitente. `pipeline.ts` orquesta normalizado → dedupe → allowlist → extracción y **tampoco
menciona Telegram**. Una respuesta que no es sí ni no reenvía el `prompt_text` guardado sin
cambiarlo.

**Files**
- `src/server/ingest/conversation.ts` — new: estado persistido, `expires_at = now() + 24h`
- `src/server/ingest/pipeline.ts` — new: normalizado -> dedupe -> allowlist -> extracción
- `src/app/api/webhooks/telegram/route.ts` — edit: llama a `processMessage` después de escribir
  `inbound_messages`, envuelto en `try/catch` — un fallo del pipeline no debe tumbar el webhook
  (`reply` de `telegram.ts` ya quedó implementado en E1-T6, no hace falta tocarlo acá)
- `tests/integration/telegram-confirm.test.ts` — new: prueba `pipeline.ts` directo contra un
  `IngestChannel` falso, no el webhook real

**Acceptance**

1. WHEN an allowed free-text message is processed THE SYSTEM SHALL reply with exactly `Detecté: Club de tiro, $100.000, cuenta de ahorros — ¿confirmo?` on the first line and `Responde Sí o No.` on the second.
2. WHEN the sender replies `sí` THE SYSTEM SHALL write exactly one `transactions` row, set the pending status to `confirmed` and delete the conversation state.
3. WHEN the sender replies `no` THE SYSTEM SHALL set the pending status to `rejected` and write zero `transactions` rows.
4. WHEN the sender replies something that is neither yes nor no THE SYSTEM SHALL resend the stored `prompt_text` unchanged and leave the conversation state in place.
5. WHEN a conversation state older than its `expires_at` is read THE SYSTEM SHALL treat it as absent and start a new extraction.
6. WHEN `grep` searches `src/server/ingest/pipeline.ts` for the word `telegram` in any case THE SYSTEM SHALL find no match.

**Verify**

```bash
pnpm typecheck
pnpm test tests/integration/telegram-confirm.test.ts
grep -ri telegram src/server/ingest/pipeline.ts; test $? -eq 1
grep -rn "let .*State\|const .*Cache" src/server/ingest/conversation.ts; test $? -eq 1
```

**Checkpoint**

```bash
git add -A && git commit -m "E1-T7: confirmacion por chat con estado persistido"
git tag step-07-chat-confirm
```

---

## Epic acceptance

The epic is done when every task is `done` **and**:

1. WHEN un mensaje permitido con `pagué el club de tiro por 100000 de mi cuenta de ahorros` entra por el webhook y el remitente responde `sí` THE SYSTEM SHALL dejar exactamente una fila en `transactions`, una en `audit_log` con `action` igual a `transaction.create`, y cero filas en `conversation_states`.
2. WHEN el mismo update de Telegram se entrega dos veces seguidas THE SYSTEM SHALL dejar exactamente una fila en `inbound_messages` y una sola transacción.

```bash
pnpm typecheck && pnpm lint && pnpm test
pnpm test tests/integration/telegram-webhook.test.ts tests/integration/telegram-confirm.test.ts
```

Run from the project root. Both criteria must be decidable by these commands.

## Pitfalls

- **Escribir `middleware.ts` en vez de `proxy.ts`.** El blueprint fija `proxy.ts` y exporta `proxy`.
  Next los trata distinto; equivocarse deja el redirect anónimo sin efecto y el smoke test falla.
- **Formatear dinero con el default en-US.** `$1,234,567` está mal en Colombia. El formato es
  `$1.234.567` y el menos es U+2212. El test de E1-T4 compara la cadena exacta.
- **Importar `@anthropic-ai/sdk` en el nivel superior del módulo.** Rompe la suite unitaria cuando no
  hay `ANTHROPIC_API_KEY`. El import va perezoso, dentro de la función.
- **Guardar el estado de conversación en un `Map` de módulo.** Funciona en `pnpm dev` y falla en
  Vercel de forma intermitente, que es la peor manera de fallar. Va en la base.
- **Dejar que el route handler haga la extracción.** El webhook solo verifica, normaliza y encola.
  Meter la lógica ahí acopla el core al proveedor y rompe el `grep` de E1-T6.
- **Editar una migración ya aplicada.** Nunca. Se crea una nueva.
- **Quitar el envoltorio `; test $? -eq N` de un Verify.** Esas líneas gatean rutas de error donde el
  éxito *es* un exit distinto de cero. Sin el envoltorio el gate queda rojo para siempre.

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
