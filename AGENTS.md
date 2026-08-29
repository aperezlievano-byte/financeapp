# Personal Finance App — agent instructions

Libro de contabilidad personal de un solo usuario que reemplaza una hoja de
Excel. Captura transacciones por 5 canales (manual, PDF, foto de recibo, texto
libre por Telegram, importacion de Excel); nada entra al ledger sin
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
| E2E | `pnpm test:e2e` |
| Smoke del build | `pnpm build && pnpm smoke` |
| Prisma client | `pnpm db:generate` |
| Migrar (dev / test) | `pnpm db:migrate` · `pnpm db:migrate:test` |
| Seed (dev / test) | `pnpm db:seed` · `pnpm db:seed:test` |
| Fixtures binarios | `pnpm fixtures` |

**Gate:** `pnpm typecheck && pnpm lint && pnpm test` pasa antes de marcar
cualquier tarea como hecha.

## Non-negotiable

1. **Un solo usuario, para siempre.** Nunca agregues roles, invitaciones,
   organizaciones ni multi-tenancy.
2. **Nada llega a `transactions` sin confirmacion humana.** Los unicos caminos
   de escritura son `confirmPendingTransaction()` y el alta manual del
   formulario. Ningun extractor escribe ahi jamas.
3. **El dinero es siempre entero en unidades minimas** (`amount_cents`). Ningun
   float toca una cifra monetaria.
4. **El SDK de Anthropic se importa en exactamente un archivo**
   (`src/server/ai/gateway.ts`).
5. **El puerto `IngestChannel` existe para agregar WhatsApp despues sin tocar
   webhook ni extraccion.** Implementa el puerto; no lo refactorices.
6. Nunca commitees secretos, `.env`, ni salida de build.
7. Nunca edites una migracion ya aplicada. Crea una nueva.
8. Nunca marques una tarea como hecha con un comando del gate en rojo.

Arquitectura completa, fronteras de importacion, tokens de diseno y tabla de
variables de entorno: ver `CLAUDE.md` en este mismo directorio.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
