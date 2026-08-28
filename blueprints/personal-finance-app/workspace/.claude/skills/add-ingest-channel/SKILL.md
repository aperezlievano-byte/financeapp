---
name: add-ingest-channel
description: Usar al agregar un canal de entrada nuevo (WhatsApp, SMS, email) sobre el puerto IngestChannel existente. Explica qué implementar, qué NO tocar del core, y las dos garantías de seguridad obligatorias. Trigger cuando digas "agregar WhatsApp", "nuevo canal", "recibir por SMS" o "otro proveedor de mensajería".
---

# Agregar un canal de ingesta

## When to use
Agregar WhatsApp, SMS, email o cualquier proveedor de mensajería nuevo. El puerto ya existe: esto es
implementarlo, no rediseñarlo.

## Steps

1. Implementa el puerto `IngestChannel` de `src/server/ingest/channel.ts` en un archivo nuevo
   `src/server/ingest/<proveedor>.ts`. La forma normalizada es
   `{ remitente, texto?, adjuntos[], timestamp, idMensaje }`.
2. El cliente HTTP del proveedor va aparte, en `src/server/<proveedor>/client.ts`.
3. Agrega el route handler en `src/app/api/webhooks/<proveedor>/route.ts`. **Solo verifica el
   secreto, normaliza y encola.** Nada de extracción ni de lógica de negocio ahí.
4. Agrega las variables al `.env.example` y al esquema zod de `src/lib/env.ts`, detrás de una función
   `require<Proveedor>()` que lance solo al invocarse.
5. `channel` es `text`, no un enum: **no hace falta migración** para el valor nuevo.
6. Escribe `tests/integration/<proveedor>-webhook.test.ts` cubriendo secreto, idempotencia y allowlist.

## Lo que NO se toca

- **`channel.ts` y `pipeline.ts` no pueden mencionar al proveedor.** Ni el nuevo ni Telegram. Los
  gates hacen `grep` y fallan si aparece.
- No dupliques el extractor de texto libre ni el pipeline. Se reusan tal cual.

## Las dos garantías obligatorias

- **Allowlist de remitente.** Un webhook público es alcanzable por cualquiera. Rechazo silencioso
  hacia el remitente, registrado con `allowed=false`.
- **Idempotencia** por `unique (channel, provider_message_id)`. Todo proveedor reintenta; sin esto un
  reintento duplica un gasto.

## Verify
```bash
pnpm typecheck
pnpm test tests/integration/<proveedor>-webhook.test.ts
grep -ri <proveedor> src/server/ingest/channel.ts; test $? -eq 1
grep -ri <proveedor> src/server/ingest/pipeline.ts; test $? -eq 1
```
