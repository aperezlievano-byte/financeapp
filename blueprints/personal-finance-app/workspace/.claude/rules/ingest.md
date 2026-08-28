---
paths:
  - "src/server/ingest/**"
  - "src/server/telegram/**"
  - "src/app/api/webhooks/**"
---

# Reglas: ingesta

- `src/server/ingest/channel.ts` define el puerto `IngestChannel` con la forma normalizada
  `{ remitente, texto?, adjuntos[], timestamp, idMensaje }`.
- **`channel.ts` y `pipeline.ts` no contienen la palabra `telegram` en ninguna forma.** Un `grep` en
  los gates de E1-T6 y E1-T7 falla si aparece. El acoplamiento al proveedor vive solo en
  `ingest/telegram.ts` y `telegram/client.ts`. Esto es lo que hace que agregar WhatsApp sea cambiar
  una pieza y no rediseñar.
- El route handler del webhook **solo verifica el secreto, normaliza y encola**. Nada de extracción
  ni de lógica de negocio ahí.
- **Allowlist de remitente obligatoria:** solo `TELEGRAM_ALLOWED_CHAT_ID` se procesa. Un bot de
  Telegram es públicamente alcanzable por cualquiera que sepa su nombre. El rechazo es silencioso
  hacia el remitente, pero se registra con `allowed=false`.
- **Idempotencia por `unique (channel, provider_message_id)`.** Telegram reintenta webhooks; sin esto
  un reintento duplica un gasto.
- El estado "esperando confirmación" vive en `conversation_states`, **en la base, nunca en memoria
  del proceso**. Vercel es serverless: un `Map` de módulo funciona en local y falla intermitentemente
  en producción.
- Todo lo que no es alta manual pasa por `pending_transactions` antes del libro. Sin excepción.
- `channel` es `text` y **no un enum**, a propósito: agregar WhatsApp no debe requerir migración.
