---
name: add-migration
description: Usar al agregar o cambiar una tabla, columna, índice o constraint del esquema de Prisma en este proyecto. Cubre el orden correcto (schema, migrate, generate, test) y las guardas append-only que hay que preservar. Trigger cuando digas "agregar campo", "nueva tabla", "cambiar el esquema" o "migración".
---

# Agregar una migración

## When to use
Cualquier cambio a `prisma/schema.prisma`: tabla nueva, columna, índice, constraint.

## Steps

1. Levanta la base: `docker compose up -d --wait`
2. Edita `prisma/schema.prisma`.
3. Genera la migración: `sh scripts/with-env.sh pnpm exec prisma migrate dev --name <nombre_descriptivo>`
   **No escribas el nombre del directorio que emite** — Prisma lo elige.
   **Siempre por `scripts/with-env.sh`:** Prisma no carga `.env` por su cuenta y sin él falla de
   inmediato con `Environment variable not found: DATABASE_URL`.
4. Si el cambio necesita SQL propio (trigger, check, función), créala con
   `sh scripts/with-env.sh pnpm exec prisma migrate dev --create-only --name <nombre>` y pega el
   SQL dentro del `migration.sql` que ese comando emitió.
5. Regenera el cliente: `pnpm db:generate`
6. Aplica en la base de test: `pnpm db:migrate:test`
7. Verifica: `pnpm test tests/integration/schema.test.ts`

## Reglas que no se rompen

- **Una migración ya aplicada nunca se edita.** Se crea una nueva.
- Las guardas append-only de `transactions` y `audit_log` (`forbid_mutation`, `transactions_guard`,
  los tres triggers) deben seguir vivas después del cambio. `tests/integration/schema.test.ts` lo prueba.
- `amount_cents` sigue siendo `bigint` con `check > 0`.
- Si agregas una variable de entorno, actualiza `.env.example` y el esquema zod de `src/lib/env.ts`.

## Verify
```bash
pnpm db:migrate:test
pnpm test tests/integration/schema.test.ts
```
