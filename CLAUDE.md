# Personal Finance App

Libro de contabilidad personal de **un solo usuario** que reemplaza una hoja de
Excel. Captura transacciones por 5 canales; nada entra al ledger sin
confirmacion humana explicita.

## Commands

| Task | Command |
|---|---|
| Install | `pnpm install --frozen-lockfile` |
| Servicios locales | `docker compose up -d --wait` · `docker compose down` |
| Dev server | `pnpm dev` — http://localhost:3000 |
| Build | `pnpm build` |
| Typecheck | `pnpm typecheck` |
| Lint / format | `pnpm lint` · `pnpm format` |
| Unit + integration | `pnpm test` · un archivo: `pnpm test tests/unit/money.test.ts` |
| E2E | `pnpm test:e2e` · uno: `pnpm test:e2e tests/e2e/ledger.spec.ts` |
| Smoke del build | `pnpm build && pnpm smoke` |
| Prisma client | `pnpm db:generate` |
| Migrar (dev / test) | `pnpm db:migrate` · `pnpm db:migrate:test` |
| Seed (dev / test) | `pnpm db:seed` · `pnpm db:seed:test` |
| Inspeccionar datos | `pnpm db:studio` |
| Fixtures binarios | `pnpm fixtures` |

**Gate:** `pnpm typecheck && pnpm lint && pnpm test` pasa antes de marcar
cualquier tarea como hecha.

Node esta fijado en `.nvmrc`; el gestor de paquetes en `package.json`
(`packageManager`). Las versiones de dependencias viven en `pnpm-lock.yaml` —
leelo, nunca adivines una.

**Cargar `.env` no es automatico.** Next.js lo lee solo; Prisma, tsx y Vitest
no. Todo script de `package.json` que invoque una de esas herramientas pasa por
`scripts/with-env.sh` (o `scripts/with-test-env.sh`). Si agregas un comando
nuevo, envuelvelo igual.

## Stack

Next.js App Router · TypeScript · Tailwind v4 (config en CSS) · Prisma ·
Postgres (Docker en local, Supabase en produccion) · Supabase Auth ·
Supabase Storage · Anthropic SDK · Biome · Vitest · Playwright · Vercel.

## Architecture

**Camino de una peticion.** `proxy.ts` (resuelve el usuario con Supabase, deja
`x-user-id` en la peticion) → `src/app/(app)/<ruta>/page.tsx` (server
component, lee `x-user-id` con `headers()`) → `src/server/<dominio>/*.ts` →
`src/server/db/client.ts` → Postgres. Las mutaciones van por server actions en
`src/app/(app)/<ruta>/actions.ts`, nunca por `fetch` desde el cliente.

**Camino de un mensaje entrante.** `src/app/api/webhooks/telegram/route.ts`
(verifica cabecera secreta) → `src/server/ingest/telegram.ts` (implementa
`IngestChannel`) → insert en `inbound_messages` (deduplicacion) → allowlist →
`src/server/ingest/extract-free-text.ts` → `src/server/ai/gateway.ts` →
`pending_transactions`. Nunca escribe en `transactions`.

**Fronteras.** Cruzar una al reves rompe el build:

| Capa | Puede importar | Nunca |
|---|---|---|
| `src/app/**` (rutas) | `components`, `server`, `lib` | `src/server/db/client` directo |
| `src/components/**` | `lib` | `server/`, `db/` |
| `src/server/**` | `db`, `lib` | React, `components/`, **`next/*`** |
| `src/app/api/**` | `server`, `lib` | **`next/*`** — usa `Request`/`Response` web |
| `src/server/db/**` | nada interno | `server/<dominio>` |

`src/server/**` y `src/app/api/**` no importan `next/*` para que Vitest pueda
cargarlos sin bundler. La unica excepcion es `proxy.ts`, que no tiene tests.

**Donde vive cada cosa.**

| Tema | Fuente unica de verdad |
|---|---|
| Esquema | `prisma/schema.prisma` → `pnpm db:migrate` |
| Acceso a env | `src/lib/env.ts` — nunca leas `process.env` en otro archivo |
| Dinero | `src/lib/money.ts` — nunca llames a `Intl.NumberFormat` fuera de ahi |
| Escritura al ledger | `src/server/ledger/commit.ts` |
| Auditoria | `src/server/db/with-audit.ts` |
| SDK de Anthropic | `src/server/ai/gateway.ts` — el unico archivo que lo importa |
| Sesion | `src/lib/auth/guard.ts` |

## Code rules

1. **Alias `@/` solo en `src/app/**` y `src/components/**`.** Todo lo demas
   (`src/lib`, `src/server`, `tests`, `scripts`, `prisma`) usa rutas relativas
   sin extension. Motivo: tsx, Vitest y Playwright resuelven relativo sin
   configuracion; el alias solo lo resuelve Next.
2. **`tests/e2e/**` no importa nada de `src/`.** Verifica por la UI y consulta
   la base con `docker compose exec -T db psql`.
3. **Un componente por archivo, maximo 300 lineas.**
4. **Server-first.** `"use client"` solo en la hoja que necesita estado.
5. **Valida en el borde.** Todo route handler y toda server action parsea su
   entrada con un esquema zod antes de tocar logica de negocio.
6. **Errores como resultado tipado**, no strings lanzados:
   `{ ok: true, data } | { ok: false, error: { code, message } }`.
7. **Sin barrel files.**
8. **Ninguna dependencia nueva sin una razon en el mensaje del commit.**

## Design system

Tokens definidos una vez en `src/app/globals.css` dentro de `@theme`. Los
componentes solo usan nombres de token.

**Rediseño cálido (2026-08-29):** reemplaza la paleta azul/system-font
original a pedido explícito del usuario, inspirado en un mockup propio
(`expense-tracker.jsx`, otra conversación de Claude). Decision registrada en
`blueprints/personal-finance-app/blueprint.md` §20.3.

| Rol | Valor (claro / oscuro) | Uso |
|---|---|---|
| Primary | `#2C1810` / `#E8A87C` | Botones primarios, header, focus ring |
| Highlight | `#E8A87C` (igual en ambos) | Pill activo, acento sobre primary |
| Background | `#F7F3EE` / `#1C1410` | Fondo de pagina |
| Foreground | `#2C1810` / `#F7F3EE` | Texto |
| Surface | `#FFFFFF` / `#2C1810` | Tarjetas, paneles, filas de lista |
| Border | `#DDD5CA` / `#4A3A2C` | Divisores, inputs |
| Muted text | `#8A7060` / `#C9A98A` | Texto secundario |
| Income | `#059669` | Ingresos — **siempre** con prefijo `+` |
| Expense | `#E11D48` | Gastos — **siempre** con prefijo `−` (U+2212) |
| Destructive | `#E11D48` | Errores, borrar |

- **Tipografia:** `next/font/google` — Source Sans 3 (`--font-sans`, cuerpo) y
  Playfair Display (`--font-display`, títulos y montos grandes). Autohosteado
  por Next en build time (sin request a Google en runtime), así que no
  reintroduce el riesgo de build que motivó el "sin webfont" original — ver
  el comentario en `src/app/layout.tsx`. Cada token de fuente en `@theme`
  referencia la variable que inyecta `next/font` con fallback a system-font,
  nunca al revés, para que un fallo de carga jamás rompa el layout.
- **Escala:** 12 / 14 / 16 / 20 / 24 / 32 px. Body 14px/1.5.
- **Espaciado:** base 4px — 4, 8, 12, 16, 24, 32, 48. Sin valores arbitrarios.
- **Radio:** `--radius` base 10px (`0.625rem`); `--radius-lg` (tarjetas,
  bottom-sheet) 16px; `--radius-xl` 22px. Los chips y el FAB usan
  `rounded-full`.
- **Elevacion:** plano — solo bordes, **excepto** el FAB ("+") y el
  bottom-sheet de alta rápida, que llevan `shadow-lg`/`shadow-*` porque son
  overlays flotantes sobre el resto de la interfaz, no tarjetas en el flujo
  normal. Todo lo demás (tarjetas, filas, inputs) sigue siendo solo bordes.
- **Movimiento:** 150ms `ease-out`, solo `opacity` y `transform`. Respeta
  `prefers-reduced-motion`.
- **Densidad:** el libro (`/`) es una app de una sola columna con tabs
  Hoy/Historial/Resumen, filas de lista (no tabla), un FAB para alta rápida y
  el formulario en un bottom-sheet modal — ver `src/app/(app)/ledger-view.tsx`
  y los archivos que importa. Tipo/Cuenta/Categoría son chips (`<button>`),
  no `<select>`. La pantalla de revision de pendientes y los formularios de
  las demas rutas mantienen espaciado generoso.
- **Numeros:** toda celda de dinero lleva `font-variant-numeric: tabular-nums`
  y tipografía `font-display` cuando es un monto destacado (hero, filas).
- **Color de categoría:** derivado del nombre vía `src/lib/category-color.ts`
  (hash determinístico sobre una paleta fija) — las categorías son filas de
  usuario, no un enum, así que no hay una tabla de colores fija que asignar.

## Environment

| Variable | Requerida | Usada por | Origen |
|---|---|---|---|
| `APP_USER_ID` | si | `prisma/seed.ts`, e2e | UUID del unico usuario |
| `DATABASE_URL` | si | Prisma | docker-compose / Supabase pooler |
| `DIRECT_DATABASE_URL` | si | migraciones | docker-compose / Supabase directa |
| `TEST_DATABASE_URL` | si | `scripts/with-test-env.sh` | docker-compose |
| `NEXT_PUBLIC_SUPABASE_URL` | si | `src/lib/auth/guard.ts` | Supabase > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | si | `src/lib/auth/guard.ts` | Supabase > API |
| `SUPABASE_SERVICE_ROLE_KEY` | solo prod | `src/server/storage/index.ts` | Supabase > API |
| `STORAGE_DRIVER` | si | `src/server/storage/index.ts` | `local` o `supabase` |
| `STORAGE_LOCAL_DIR` | si | `src/server/storage/index.ts` | `.storage` |
| `ANTHROPIC_API_KEY` | desde paso 5 | `src/server/ai/gateway.ts` | console.anthropic.com |
| `ANTHROPIC_MODEL_ID` | desde paso 5 | `src/server/ai/gateway.ts` | skill `claude-api` |
| `TELEGRAM_BOT_TOKEN` | desde paso 6 | `src/server/telegram/client.ts` | @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | desde paso 6 | webhook route | tu la eliges |
| `TELEGRAM_ALLOWED_CHAT_ID` | desde paso 6 | `src/server/ingest/telegram.ts` | @userinfobot |
| `PRODUCTION_URL` | paso 14 | `scripts/set-telegram-webhook.ts` | Vercel |

`.env.example` esta commiteado y se mantiene sincronizado. `.env` con valores
reales nunca. `E2E_DATABASE_URL` y `E2E_USER_ID` las define solo
`playwright.config.ts` y no aparecen en ningun `.env`.

## Rules

| Archivo | Aplica a |
|---|---|
| `.claude/rules/database.md` | `prisma/**`, `src/server/db/**` |
| `.claude/rules/ingest.md` | `src/server/ingest/**`, `src/server/telegram/**`, `src/app/api/webhooks/**` |
| `.claude/rules/ai.md` | `src/server/ai/**` |
| `.claude/rules/ui.md` | `src/app/**`, `src/components/**` |
| `.claude/rules/testing.md` | `tests/**` |

## Non-negotiable

1. **Un solo usuario, para siempre.** Nunca agregues roles, invitaciones,
   organizaciones ni multi-tenancy. Toda consulta recibe `userId` como
   argumento igual.
2. **Nada llega a `transactions` sin confirmacion humana.** Los unicos caminos
   de escritura son `confirmPendingTransaction()` y el alta manual del
   formulario. Ningun extractor escribe ahi jamas.
3. **El dinero es siempre entero en unidades minimas** (`amount_cents`).
   Ningun float toca una cifra monetaria, nunca.
4. **El SDK de Anthropic se importa en exactamente un archivo**
   (`src/server/ai/gateway.ts`). Haz grep antes de agregar un segundo import.
5. **El puerto `IngestChannel` existe para que WhatsApp entre despues sin tocar
   webhook ni extraccion.** Cuando llegue ese dia, implementa el puerto; no lo
   refactorices.
6. Nunca commitees secretos, `.env`, ni salida de build.
7. Nunca edites una migracion **ya aplicada**. Crea una nueva.
8. Nunca marques una tarea como hecha con un comando del gate en rojo.
