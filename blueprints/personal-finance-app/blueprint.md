# Personal Finance App — Blueprint

> Generado por The Architect el 2026-08-27
> Shape: internal-tool · `knowledge/shapes/internal-tool.md`
> Runtime track: ts-node · `knowledge/runtime-tracks/ts-node.md`
> Modo de emisión: bundle · Versión del blueprint: 1
> Versiones verificadas por última vez: 2026-08-28 (`stack-researcher`, contra registro en vivo — `/the-architect:architect-refresh`; procedencia por paquete en §11)

---

## 1. Project Overview & Non-Goals

### Vision

Alejandro lleva su plata en una hoja de Excel. La hoja funciona y muere en la captura: cada gasto exige abrir el archivo, encontrar la fila y no equivocarse, así que se desactualiza justo cuando importa. Esta aplicación reemplaza esa hoja y se vuelve la **fuente de verdad** de su dinero: un libro append-only de un solo usuario, en pesos colombianos, donde registrar un movimiento cuesta escribir una frase en Telegram — "pagué el club de tiro por 100000 de mi cuenta de ahorros" — o subir el PDF del extracto.

Lo que la hace fuente de verdad y no un cuaderno son dos reglas innegociables: **nada entra al libro sin confirmación humana explícita**, y **nada sale del libro nunca** — `transactions` es append-only, el borrado es lógico, y todo cambio queda en un `audit_log` que la propia base impide modificar. La IA propone; la persona decide. Si el extractor se degrada mañana, el libro sigue correcto: lo peor que pasa es teclear más.

### Users

| Persona | A qué viene | Frecuencia |
|---|---|---|
| Alejandro (único usuario) | Registrar un gasto por chat en menos de 15 segundos | varias veces al día |
| Alejandro | Confirmar o rechazar lo que la IA extrajo | diaria |
| Alejandro | Cargar el extracto bancario del mes | mensual |
| Alejandro | Importar el histórico del Excel | **una sola vez** |

### Goals — alcance v1

1. El libro acepta transacciones por cinco caminos: formulario manual, texto libre en la web, texto libre por Telegram, foto de recibo y PDF de extracto — más la importación única del Excel.
2. Ninguna transacción existe en el libro sin confirmación humana explícita, ni con confianza alta.
3. El libro es íntegro por construcción: append-only, soft-delete y auditoría forzados por la base, no por disciplina del código.
4. El canal de mensajería es un puerto (`IngestChannel`); Telegram es la primera implementación y WhatsApp entra después sin tocar el núcleo.
5. Los montos se muestran en formato es-CO (`$1.234.567`) y se guardan como enteros en centavos; ningún float toca dinero.
6. El histórico del Excel queda cargado y cuadrado contra la hoja original por una verificación automática de paridad.

### Non-Goals — explícitamente fuera de alcance para v1

| No construimos | Por qué no ahora | Revisar cuando |
|---|---|---|
| Dashboards y gráficas | El problema es la captura. Una gráfica sobre datos incompletos es peor que ninguna. | Existan 6 meses continuos de datos confirmados |
| Reportes por tarjeta de crédito | Modela un ciclo de facturación entero y un segundo concepto de saldo | Haya que conciliar un extracto de tarjeta |
| Análisis por categoría | Las categorías **sí se capturan**; graficarlas no mejora la captura | El dashboard entre en alcance |
| Multi-moneda | Todo es COP. Obliga a tasas, fecha de conversión y un segundo monto por fila | Aparezca una cuenta en otra moneda |
| Multi-usuario, roles, invitaciones | Es una herramienta de una persona; roles son medio SaaS y no compran nada | Una segunda persona escriba en el libro |
| Sync automático con el banco | Depende de agregadores con contrato y latencia de aprobación; el PDF da el mismo dato | Un agregador en Colombia sea contratable en una semana |
| CRUD de categorías en la UI | Se siembran y se editan con `pnpm db:studio`. Las cuentas **sí** tienen CRUD (paso 9) | Haga falta una categoría nueva más de una vez al mes |
| Visor de `audit_log` en la UI | El log se escribe siempre (paso 4) y se lee con `pnpm db:studio` | Haya que explicar un movimiento viejo sin abrir Studio |

**El builder no debe implementar nada de esta tabla**, ni como añadido pequeño en un paso adyacente. Si un paso parece exigir un non-goal, es un defecto del blueprint: detente y repórtalo.

### Success metrics

| Métrica | Objetivo | Cómo se mide |
|---|---|---|
| Captura sin teclado completo | ≥70% de las transacciones del mes con `source` ≠ `manual` | `select source, count(*) from transactions where deleted_at is null and occurred_on >= date_trunc('month', now()) group by source;` |
| Confirmación humana efectiva | 0 filas sin pendiente confirmado | `select count(*) from transactions t where t.source <> 'manual' and not exists (select 1 from pending_transactions p where p.committed_transaction_id = t.id);` → `0` |
| Paridad con el Excel | Diferencia 0 por cuenta | `pnpm exec tsx scripts/parity-check.ts` sale 0 |
| Latencia de captura por chat | ≤8 s entre mensaje y pregunta de confirmación | `select max(extract(epoch from (processed_at - received_at))) from inbound_messages where processed_at is not null;` |

---

## 2. Tech Stack

**Runtime track: ts-node.** Esta tabla nombra *decisiones*, no versiones; cada pin vive en §11 y en ningún otro lugar de la prosa. Los pines fueron reverificados en vivo el 2026-08-28 por `stack-researcher` (`/the-architect:architect-refresh`), que sustituye a la caché de `knowledge/runtime-tracks/ts-node.md` (verificada 2026-07-27) como fuente de autoridad; ver procedencia por paquete en §11.

| Capa | Elección | Por qué esta, frente a qué |
|---|---|---|
| Lenguaje / runtime | TypeScript sobre Node.js | Un lenguaje para servidor, UI, scripts y tests. Frente a Python: el producto es una interfaz, no un pipeline numérico |
| Framework | Next.js (App Router) | Server Components y server actions dan formularios validados en servidor sin construir una API REST para un usuario |
| Estilos | Tailwind CSS v4 (config en CSS, `@theme`) | La tabla es densa y tabular; utilidades ganan a CSS-in-JS, que además obliga a un boundary de cliente por celda |
| Componentes | shadcn/ui (CLI `shadcn`) | Copia al repo: tabla, formulario y diálogo son el 90% de esta UI y quedan editables |
| Base de datos | Postgres (Docker local, Supabase en producción) | `unique`, `check` y triggers son lo que hace de append-only una garantía y no una convención |
| ORM | Prisma | Cliente tipado y Studio, que es la administración de catálogos que decidimos no construir. Frente a Drizzle: DX vale más que control del SQL con un usuario |
| Auth | Supabase Auth (email+contraseña), sesión en cookie propia | Un solo dueño de la sesión. Frente a `better-auth`: sería la combinación prohibida "dos proveedores de identidad" |
| Trabajo en segundo plano | Ninguno: el webhook normaliza y encola en la base | Vercel es serverless; un worker en memoria se evapora. La "cola" es una fila en `inbound_messages` |
| Pagos | NOT APPLICABLE — la aplicación no cobra ni mueve dinero de terceros; solo registra el dinero propio |
| Almacenamiento | Driver conmutable: disco local en dev/tests, Supabase Storage en producción | Los tests no pueden depender de un bucket remoto y la interfaz es de dos funciones |
| Email / notificaciones | Ninguno; la única notificación es la respuesta del bot en el mismo chat | Un usuario que ya está en el chat donde escribió. Un email es una bandeja que nadie lee |
| Hosting | Vercel + GitHub | Framework y host del mismo vendor: deploy por push, preview por PR, sin configuración |
| Gestor de paquetes | pnpm | `node_modules` estricto atrapa dependencias fantasma, que es el error típico de un builder autónomo |

### Compatibility check

Verificado contra `knowledge/stack-compatibility.md`:

- Este stack **es** la fila "Internal tool" de la tabla de stacks por defecto (React full-stack · componentes copy-in · ORM completo · Postgres · Vercel).
- **Combinación conocida-mala que sí contiene:** linter que parsea CSS + motor CSS-first con at-rules (Biome 2.x + Tailwind v4). Se resuelve en §10 Bootstrap **antes del primer `lint`** con `"css": { "parser": { "tailwindDirectives": true } }` en `biome.json`. No se resuelve ignorando la hoja de estilos.
- **Evitadas a propósito:** dos proveedores de identidad (solo Supabase Auth) · proceso de larga vida en host por petición (el estado de conversación vive en la base) · dos sistemas de migración sobre una base (Prisma es el único dueño; el editor del dashboard es de solo lectura) · conexiones serverless sin pooler (`DATABASE_URL` = pooler, `DIRECT_DATABASE_URL` = directa, y las migraciones solo usan la directa).

---

## 3. Directory Structure

```
personal-finance-app/                # raíz — el bundle vive DENTRO de ella
  .claude/                           # copiado desde blueprints/personal-finance-app/workspace/
    settings.json                    # permisos de los comandos de §9 y §20.1
    rules/{database,ingest,ai,ui,testing}.md
    skills/{add-migration,add-ingest-channel}/SKILL.md
  .github/workflows/ci.yml           # el mismo gate de §20.1 — paso 14
  blueprints/personal-finance-app/   # ESTE bundle; se commitea; excluido de biome, tsc, vitest y playwright
  docker/init-test-db.sql            # crea personal_finance_test al inicializar el volumen
  prisma/
    schema.prisma                    # única fuente de verdad del esquema — paso 2
    migrations/                      # SQL generado por prisma migrate; una aplicada NUNCA se edita
    seed.ts                          # cuentas y categorías del único usuario — paso 2
  public/
  scripts/
    with-env.sh                      # carga .env y ejecuta (Prisma, tsx y Vitest no la cargan solos)
    with-test-env.sh                 # igual, apuntando DATABASE_URL a TEST_DATABASE_URL
    smoke.sh                         # arranca el build y prueba /login=200 y / -> /login
    backup.sh                        # pg_dump del volumen local a backups/ — paso 14
    restore-check.sh                 # restaura en otra base y compara conteos — paso 14
    parity-check.ts                  # compara el libro contra la hoja de Excel — paso 13
    set-telegram-webhook.ts          # registra el webhook con PRODUCTION_URL — paso 14
  src/
    proxy.ts                         # NO middleware.ts — mismo nivel que app/ bajo --src-dir — paso 1
    app/
      globals.css                    # @theme con los tokens de §7 — paso 1
      login/{page.tsx,actions.ts}    # única ruta pública — pasos 1 y 3
      (app)/
        layout.tsx                   # shell: encabezado, navegación, tema — paso 8
        page.tsx                     # "/" el libro (denso) — paso 8
        actions.ts                   # alta manual y soft-delete — paso 8
        cuentas/{page.tsx,actions.ts}     # CRUD de cuentas — paso 9
        revision/{page.tsx,actions.ts}    # pendientes por confirmar (espacioso) — paso 10
        subir/{page.tsx,actions.ts}       # subida de PDFs e imágenes — paso 11
        importar/{page.tsx,actions.ts}    # importación única del Excel — paso 13
      api/
        health/route.ts              # base alcanzable + migraciones aplicadas — paso 2
        webhooks/telegram/route.ts   # verifica cabecera secreta, normaliza y encola — paso 6
    components/
      money-cell.tsx                 # monto: tabular-nums, signo y acento no textual — paso 8
      pending-card.tsx               # tarjeta de pendiente — paso 10
      ui/                            # primitivas copiadas por el CLI de shadcn
    generated/prisma/                # cliente generado por pnpm db:generate — gitignored
    lib/
      env.ts                         # único lugar que lee process.env — paso 1
      result.ts                      # el sobre Result<T>/ErrorCode de §5, una sola vez — paso 3
      money.ts                       # único lugar que formatea o parsea dinero — paso 4
      auth/guard.ts                  # sesión y bypass e2e — paso 3
      utils.ts                       # generado por shadcn
    server/
      db/client.ts                   # único lugar que abre conexión — paso 2
      db/with-audit.ts               # envuelve toda escritura y escribe audit_log — paso 4
      ledger/commit.ts               # único escritor de transactions — paso 4
      ledger/catalog.ts              # cuentas y categorías — paso 9
      ai/gateway.ts                  # ÚNICO archivo que importa @anthropic-ai/sdk — paso 5
      ingest/channel.ts              # el puerto IngestChannel — cero referencias a Telegram — paso 6
      ingest/telegram.ts             # implementación del puerto — pasos 6 y 7
      ingest/pipeline.ts             # normalizado -> dedupe -> allowlist -> extracción — paso 7
      ingest/conversation.ts         # estado "esperando confirmación", persistido — paso 7
      ingest/pending.ts              # único escritor de pending_transactions — paso 5
      ingest/extract-free-text.ts    # extractor de texto libre — paso 5
      ingest/extract-document.ts     # extractor de imagen/PDF de un movimiento — paso 11
      ingest/extract-statement.ts    # extractor de extractos con muchos movimientos — paso 12
      ingest/statement-batch.ts      # agrupa los movimientos de un extracto — paso 12
      ingest/import-excel.ts         # importador del histórico — paso 13
      storage/index.ts               # putObject/getObject, driver local o supabase — pasos 11 y 14
      telegram/client.ts             # llamadas HTTP a la API de Telegram — paso 6
  tests/
    setup.ts                         # se niega a correr contra una base que no termine en _test
    unit/                            # lógica pura: money, env, guard, extractores con cliente falso
    integration/                     # contra Postgres real: esquema, commit, webhook, importaciones
    e2e/global-setup.ts              # migra, siembra y construye fixtures antes de la suite
    e2e/*.spec.ts                    # flujos por la interfaz — pasos 8, 9, 10, 12
    fixtures/build-fixtures.ts       # escribe los fixtures binarios (pnpm fixtures)
    fixtures/receipt-sample.png.base64
    fixtures/statement-sample.pdf    # PDF mínimo válido; el contenido no importa, la ruta sí
  .env                               # local, nunca commiteado
  .env.example                       # commiteado, con !.env.example en .gitignore
  .nvmrc                             # 24
  biome.json                         # formato, lint, parser de Tailwind, exclusión de blueprints/
  docker-compose.yml                 # Postgres local en el puerto 5433 del host
  next.config.ts · postcss.config.mjs · package.json · tsconfig.json
  playwright.config.ts               # e2e en el puerto 3101, testIgnore de blueprints/
  prisma.config.ts                   # datasource de la CLI de Prisma 7 — paso 2
  vitest.config.ts                   # unit + integration, exclude de blueprints/
  CLAUDE.md · AGENTS.md
```

**Reglas de frontera**

- Nada en `src/app/**` importa de la carpeta de otra ruta; lo compartido va a `src/lib/` o `src/server/`.
- `src/server/db/client.ts` es el único archivo que abre una conexión.
- `src/server/ledger/commit.ts` es el único escritor de `transactions`; `src/server/ingest/pending.ts` el único de `pending_transactions`.
- `src/server/ai/gateway.ts` es el único archivo que importa `@anthropic-ai/sdk`.
- `src/server/**` y `src/app/api/**` **no importan `next/*`** — usan `Request`/`Response` web. Eso es lo que permite que Vitest los cargue sin bundler. Única excepción: `proxy.ts`, que no tiene tests unitarios.
- `src/server/ingest/channel.ts` y `pipeline.ts` no contienen la palabra `telegram` en ninguna forma; el paso 6 lo verifica con un `grep` que falla si aparece.
- `tests/e2e/**` no importa nada de `src/`: verifica por la interfaz y consulta la base con `docker compose exec -T db psql`.

**Convención de resolución de módulos.** Esta sección declara una — alias `@/` solo en `src/app/**` y `src/components/**`, todo lo demás con rutas relativas sin extensión — y está conciliada contra los cinco cargadores del proyecto en la *matriz de convención de resolución* de §19.6, que es donde vive la forma resuelta y el ajuste que la hace funcionar en cada contexto. No se repite aquí.

**Todo archivo de este árbol tiene exactamente uno de dos orígenes:** lo escribe un paso de §9 (aparece por nombre en su **Do** y en el `files` de su tarea), o se emite como archivo real bajo `workspace/` (§19.6) y aterriza con la copia única que el builder ejecuta antes del paso 1. Dibujar un archivo aquí no lo crea.

---

## 4. Data Model

Ocho entidades. Todas llevan `user_id` aunque haya un solo usuario: la consulta lo recibe como argumento igual, y eso hace de "un solo usuario" una decisión de producto y no un supuesto enterrado.

### Entities

| Entidad | Qué representa · ciclo de vida | Campos no obvios |
|---|---|---|
| `accounts` | Cuenta de la que sale o entra dinero. Se siembra; se edita en el paso 9; **nunca se borra, se archiva** | `name` es literal y en minúsculas: `cuenta de ahorros` es el nombre que el bot repite al confirmar. `currency` existe para que multi-moneda sea una migración y no una reescritura; v1 solo escribe `COP` |
| `categories` | Clasificación del movimiento. Se captura en v1, no se grafica | `archived_at` en vez de borrado, para no perder la clasificación histórica |
| `transactions` | **El libro. Append-only forzado por trigger.** Solo `deleted_at`, `category_id` y `note` cambian tras la inserción; `DELETE` prohibido por la base | `amount_cents` es **siempre positivo** (`check > 0`) y `bigint`, porque un salario en centavos supera `int4`; el sentido lo da `direction`. `source_ref` es la huella idempotente del origen (id de mensaje, hash de fila del Excel, hash de línea del extracto); `null` en altas manuales y `null` no colisiona en Postgres |
| `pending_transactions` | Lo que la IA propuso y nadie confirmó. **Antesala obligatoria** de `transactions` para todo `source` ≠ `manual` | `extraction` guarda la salida cruda del gateway para poder auditar una extracción mala. `confidence` es informativo y **no habilita nada automáticamente**. `committed_transaction_id` es `unique`: un pendiente no puede generar dos transacciones |
| `documents` | Archivo subido: PDF de extracto, foto de recibo o el Excel | `sha256` es `unique` con `user_id`: subir dos veces el mismo archivo no lo procesa dos veces. `storage_key` es la llave del driver, no una ruta del sistema de archivos |
| `inbound_messages` | Todo mensaje que entra por cualquier canal, **ya normalizado**. Es el registro de idempotencia del webhook | `channel` es `text` **y no un enum, a propósito**: agregar WhatsApp no debe requerir migración. `unique (channel, provider_message_id)` es lo que impide que un reintento de Telegram duplique un gasto. `allowed=false` también se escribe: el rechazo es silencioso hacia el remitente, no hacia el registro |
| `conversation_states` | El estado "esperando confirmación" de un remitente. **Vive en la base, nunca en memoria del proceso** — Vercel es serverless | `unique (channel, sender)`: un estado vivo por remitente. `expires_at = now() + 24h`; vencido se trata como `none`. `prompt_text` guarda el mensaje enviado para poder repetirlo si la respuesta no es sí ni no |
| `audit_log` | Toda escritura al libro. **Append-only forzado por trigger**: `UPDATE` y `DELETE` lanzan excepción | Sin claves foráneas **a propósito**: sobrevive al borrado lógico de cualquier cosa y no se invalida por cascada. `action` ∈ `transaction.create`, `transaction.soft_delete`, `transaction.recategorize`, `pending.confirm`, `pending.reject`, `account.create`, `account.update`, `account.archive`, `document.upload`, `import.excel` |

### Relationships

- `accounts` —(1:N)→ `transactions` · `RESTRICT`. Una cuenta con historia no se borra; se archiva.
- `categories` —(1:N)→ `transactions` · `SET NULL`. Perder la categoría nunca puede perder el movimiento.
- `documents` —(1:N)→ `transactions` · `SET NULL` · —(1:N)→ `pending_transactions` · `CASCADE` (un pendiente sin su documento no es revisable).
- `inbound_messages` —(1:1)→ `pending_transactions` · `CASCADE`.
- `pending_transactions` —(1:1)→ `transactions` vía `committed_transaction_id` · `RESTRICT`. Como `transactions` no acepta `DELETE`, nunca se dispara: está para que la intención quede escrita en el esquema.
- `pending_transactions` —(1:1)→ `conversation_states` · `CASCADE`.
- `audit_log` no participa en ninguna relación.

### Indexes

| Tabla | Índice | Consulta que sirve |
|---|---|---|
| `transactions` | `(user_id, occurred_on desc)` | el libro, que es la pantalla principal |
| `transactions` | `(user_id, account_id, occurred_on)` | saldo por cuenta y la verificación de paridad |
| `transactions` | unique `(user_id, source, source_ref)` | idempotencia de toda importación y todo mensaje |
| `pending_transactions` | `(user_id, status, created_at)` | la pantalla de revisión, filtrada por `awaiting_review` |
| `inbound_messages` | unique `(channel, provider_message_id)` | **la idempotencia del webhook** |
| `inbound_messages` | `(channel, sender, created_at desc)` | el último mensaje de un remitente |
| `conversation_states` | unique `(channel, sender)` | un estado vivo por remitente |
| `documents` | unique `(user_id, sha256)` | subir el mismo archivo dos veces no lo reprocesa |
| `audit_log` | `(resource_type, resource_id, created_at)` | la historia de un movimiento |

### Schema

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
  output   = "../src/generated/prisma"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_DATABASE_URL")
}

enum AccountKind { savings checking cash credit_card }
enum Direction { in out }
enum Source { manual free_text telegram receipt statement excel_import }
enum PendingStatus { awaiting_review confirmed rejected }
enum DocumentKind { receipt statement spreadsheet }
enum DocumentStatus { uploaded extracted failed }

model Account {
  id         String      @id @default(uuid()) @db.Uuid
  userId     String      @map("user_id") @db.Uuid
  name       String
  kind       AccountKind
  currency   String      @default("COP")
  archivedAt DateTime?   @map("archived_at") @db.Timestamptz(3)
  createdAt  DateTime    @default(now()) @map("created_at") @db.Timestamptz(3)
  transactions Transaction[]
  pending      PendingTransaction[]
  @@unique([userId, name])
  @@map("accounts")
}

model Category {
  id         String    @id @default(uuid()) @db.Uuid
  userId     String    @map("user_id") @db.Uuid
  name       String
  archivedAt DateTime? @map("archived_at") @db.Timestamptz(3)
  createdAt  DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  transactions Transaction[]
  pending      PendingTransaction[]
  @@unique([userId, name])
  @@map("categories")
}

model Transaction {
  id          String    @id @default(uuid()) @db.Uuid
  userId      String    @map("user_id") @db.Uuid
  accountId   String    @map("account_id") @db.Uuid
  categoryId  String?   @map("category_id") @db.Uuid
  occurredOn  DateTime  @map("occurred_on") @db.Date
  description String
  amountCents BigInt    @map("amount_cents")
  direction   Direction
  source      Source
  sourceRef   String?   @map("source_ref")
  documentId  String?   @map("document_id") @db.Uuid
  note        String?
  deletedAt   DateTime? @map("deleted_at") @db.Timestamptz(3)
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  account  Account   @relation(fields: [accountId], references: [id], onDelete: Restrict)
  category Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  document Document? @relation(fields: [documentId], references: [id], onDelete: SetNull)
  pending  PendingTransaction?
  @@unique([userId, source, sourceRef])
  @@index([userId, occurredOn(sort: Desc)])
  @@index([userId, accountId, occurredOn])
  @@map("transactions")
}

model PendingTransaction {
  id                     String        @id @default(uuid()) @db.Uuid
  userId                 String        @map("user_id") @db.Uuid
  status                 PendingStatus @default(awaiting_review)
  source                 Source
  inboundMessageId       String?       @unique @map("inbound_message_id") @db.Uuid
  documentId             String?       @map("document_id") @db.Uuid
  rawInput               String        @map("raw_input")
  extraction             Json
  confidence             Float?
  occurredOn             DateTime?     @map("occurred_on") @db.Date
  description            String?
  amountCents            BigInt?       @map("amount_cents")
  direction              Direction?
  accountId              String?       @map("account_id") @db.Uuid
  categoryId             String?       @map("category_id") @db.Uuid
  committedTransactionId String?       @unique @map("committed_transaction_id") @db.Uuid
  createdAt              DateTime      @default(now()) @map("created_at") @db.Timestamptz(3)
  resolvedAt             DateTime?     @map("resolved_at") @db.Timestamptz(3)
  account   Account?           @relation(fields: [accountId], references: [id], onDelete: SetNull)
  category  Category?          @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  document  Document?          @relation(fields: [documentId], references: [id], onDelete: Cascade)
  message   InboundMessage?    @relation(fields: [inboundMessageId], references: [id], onDelete: Cascade)
  committed Transaction?       @relation(fields: [committedTransactionId], references: [id], onDelete: Restrict)
  state     ConversationState?
  @@index([userId, status, createdAt])
  @@map("pending_transactions")
}

model Document {
  id         String         @id @default(uuid()) @db.Uuid
  userId     String         @map("user_id") @db.Uuid
  kind       DocumentKind
  storageKey String         @unique @map("storage_key")
  filename   String
  mimeType   String         @map("mime_type")
  bytes      Int
  sha256     String
  status     DocumentStatus @default(uploaded)
  createdAt  DateTime       @default(now()) @map("created_at") @db.Timestamptz(3)
  transactions Transaction[]
  pending      PendingTransaction[]
  @@unique([userId, sha256])
  @@map("documents")
}

model InboundMessage {
  id                String    @id @default(uuid()) @db.Uuid
  channel           String
  providerMessageId String    @map("provider_message_id")
  sender            String
  text              String?
  attachments       Json      @default("[]")
  receivedAt        DateTime  @map("received_at") @db.Timestamptz(3)
  allowed           Boolean
  processedAt       DateTime? @map("processed_at") @db.Timestamptz(3)
  createdAt         DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  pending PendingTransaction?
  @@unique([channel, providerMessageId])
  @@index([channel, sender, createdAt(sort: Desc)])
  @@map("inbound_messages")
}

model ConversationState {
  id                   String   @id @default(uuid()) @db.Uuid
  channel              String
  sender               String
  awaiting             String
  pendingTransactionId String?  @unique @map("pending_transaction_id") @db.Uuid
  promptText           String   @map("prompt_text")
  expiresAt            DateTime @map("expires_at") @db.Timestamptz(3)
  createdAt            DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt            DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)
  pending PendingTransaction? @relation(fields: [pendingTransactionId], references: [id], onDelete: Cascade)
  @@unique([channel, sender])
  @@map("conversation_states")
}

model AuditLog {
  id           BigInt   @id @default(autoincrement())
  actorId      String   @map("actor_id")
  actorKind    String   @map("actor_kind")
  action       String
  resourceType String   @map("resource_type")
  resourceId   String   @map("resource_id")
  before       Json?
  after        Json?
  requestId    String?  @map("request_id")
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  @@index([resourceType, resourceId, createdAt])
  @@index([createdAt(sort: Desc)])
  @@map("audit_log")
}
```

**Guardas de integridad — SQL que Prisma no expresa.** Se escriben a mano dentro de la migración que el paso 2 crea con `pnpm exec prisma migrate dev --create-only --name append_only_guards`, y se aplican con `pnpm db:migrate`.

```sql
ALTER TABLE transactions ADD CONSTRAINT transactions_amount_positive CHECK (amount_cents > 0);
ALTER TABLE pending_transactions ADD CONSTRAINT pending_amount_positive CHECK (amount_cents IS NULL OR amount_cents > 0);

CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'append-only: % sobre % esta prohibido', TG_OP, TG_TABLE_NAME;
END $$;

CREATE OR REPLACE FUNCTION transactions_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id           IS DISTINCT FROM OLD.id
  OR NEW.user_id      IS DISTINCT FROM OLD.user_id
  OR NEW.account_id   IS DISTINCT FROM OLD.account_id
  OR NEW.occurred_on  IS DISTINCT FROM OLD.occurred_on
  OR NEW.description  IS DISTINCT FROM OLD.description
  OR NEW.amount_cents IS DISTINCT FROM OLD.amount_cents
  OR NEW.direction    IS DISTINCT FROM OLD.direction
  OR NEW.source       IS DISTINCT FROM OLD.source
  OR NEW.source_ref   IS DISTINCT FROM OLD.source_ref
  OR NEW.created_at   IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'transactions es append-only: solo deleted_at, category_id y note pueden cambiar';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER audit_log_immutable      BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER transactions_no_delete   BEFORE DELETE ON transactions
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER transactions_append_only BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION transactions_guard();
```

Los dos primeros disparadores son **`FOR EACH STATEMENT`** a propósito: uno `FOR EACH ROW` no se dispara cuando la sentencia no afecta ninguna fila, y entonces `delete from audit_log` sobre una tabla vacía saldría 0 y el gate del paso 2 pasaría sin probar nada.

### Migrations

Prisma Migrate es el único dueño del esquema; el editor de esquema del dashboard de Supabase es de solo lectura desde el día uno.

- **Crear:** `pnpm exec prisma migrate dev --name <nombre>`. Prisma nombra el directorio con su propio prefijo de marca de tiempo — **ese nombre no se escribe a mano en ningún archivo de este blueprint**; se le llama "el directorio de migración que `prisma migrate dev --name <nombre>` crea".
- **SQL a mano** (triggers, checks): `--create-only`, se edita el `migration.sql` emitido y se aplica con `pnpm db:migrate`.
- **Aplicar:** `pnpm db:migrate` (`prisma migrate deploy`). En producción es un paso explícito del deploy, **nunca en el arranque**: instancias concurrentes compiten.
- **Regla de producción:** expandir y luego contraer. Nunca una migración destructiva en el mismo deploy que el cambio de código. Una migración aplicada **no se edita jamás**; se crea otra.

### Seed data

`prisma/seed.ts`, ejecutado con `pnpm db:seed` o `pnpm db:seed:test`. Es **idempotente** (`upsert` por `(userId, name)`), así que `tests/e2e/global-setup.ts` puede llamarlo en cada corrida. Siembra para `APP_USER_ID`:

- Cuatro cuentas: `cuenta de ahorros` (`savings`), `cuenta corriente` (`checking`), `efectivo` (`cash`), `tarjeta de crédito` (`credit_card`).
- Ocho categorías: `mercado`, `servicios`, `transporte`, `salud`, `ocio`, `educación`, `ingresos`, `otros`.
- **Cero transacciones.** El libro arranca vacío; la historia entra por la importación del Excel (paso 13).

El literal `cuenta de ahorros` es contractual: es el nombre que el bot repite en el mensaje de confirmación que el paso 7 compara byte a byte.

---

## 5. API Design

No hay API pública. Hay **dos route handlers** y todo lo demás son **server actions**. Ambas superficies comparten un solo sobre, definido aquí para las dos.

### Conventions

- **Base path:** `/api`. Sin versión: no hay clientes externos que versionar.
- **Sobre — uno solo, sin excepciones:**
  ```ts
  type Result<T> =
    | { ok: true; data: T }
    | { ok: false; error: { code: ErrorCode; message: string } };
  ```
  Los errores nunca se lanzan a través de una frontera: se devuelven. `message` está en español y lo ve Alejandro; `code` es lo que revisa una prueba.
- **Códigos de error — el conjunto completo:**

  | `code` | HTTP | Cuándo |
  |---|---|---|
  | `unauthorized` | 401 | sin sesión, o cabecera secreta del webhook incorrecta |
  | `forbidden` | 403 | sesión válida pero `userId` ≠ `APP_USER_ID` |
  | `not_found` | 404 | el recurso no existe o es de otro `user_id` |
  | `validation_failed` | 422 | el cuerpo no pasó el esquema zod; `message` nombra el campo |
  | `conflict` | 409 | violación de unicidad — reenvío, archivo repetido, cuenta duplicada |
  | `extraction_failed` | 502 | el gateway respondió algo que no pasó el esquema, o no respondió |
  | `internal` | 500 | cualquier otra cosa; `message` genérico y el detalle al log |

- **Validación:** `zod`, junto a su consumidor, con el tipo inferido por `z.infer` — nunca declarado dos veces.
- **Paginación:** el libro pagina por cursor `(occurred_on, id)`, `?cursor=`, 50 filas por página, máximo 200. Con `LIMIT` en la base; nunca se traen todas las filas al navegador.
- **Idempotencia:** el webhook por `unique (channel, provider_message_id)`; la confirmación por `pending_transactions.committed_transaction_id` (único). Ninguna server action acepta una llave de idempotencia del cliente porque no hay clientes externos.
- **Rate limits:** ninguno a nivel de aplicación. La única superficie públicamente alcanzable es el webhook, y su control de abuso es la cabecera secreta **más** la allowlist, que rechaza antes de gastar un token de IA. Vercel aplica sus límites de plataforma.

### Routes

| Método | Ruta | Qué hace | Auth | Rate limit |
|---|---|---|---|---|
| GET | `/api/health` | Comprueba que la base responde y que no hay migraciones a medio aplicar | pública | plataforma |
| POST | `/api/webhooks/telegram` | Verifica la cabecera secreta, normaliza el update, lo inserta en `inbound_messages` y dispara el pipeline | cabecera `X-Telegram-Bot-Api-Secret-Token` | plataforma |

Todo lo demás — alta manual, soft-delete, recategorizar, CRUD de cuentas, confirmar/rechazar, subir, importar — son **server actions** en `src/app/(app)/<ruta>/actions.ts`. El navegador nunca hace `fetch` a una ruta propia.

### Critical endpoints — detalle completo

#### `POST /api/webhooks/telegram`

El único endpoint públicamente alcanzable. Un bot de Telegram tiene URL adivinable, así que su defensa es explícita y está probada. El handler **no** tipa el cuerpo contra el SDK de Telegram: lo parsea con un esquema zod mínimo que solo describe lo que este producto usa (`update_id`, y `message` con `message_id`, `date`, `chat.id`, `text?`, `photo?`, `document?`).

**Reglas de validación, en este orden exacto:**

| # | Condición | Respuesta | Escritura |
|---|---|---|---|
| 1 | `X-Telegram-Bot-Api-Secret-Token` ≠ `TELEGRAM_WEBHOOK_SECRET` | `401` `{ ok:false, error:{ code:"unauthorized" } }` | **ninguna** — no se toca la base |
| 2 | El cuerpo no pasa el esquema | `200` `{ ok:true, data:{ ignored:true } }` | ninguna |
| 3 | `update.message` ausente (edición, reacción, otro tipo) | `200` `{ ok:true, data:{ ignored:true } }` | ninguna |
| 4 | `(channel='telegram', provider_message_id)` ya existe | `200` `{ ok:true, data:{ duplicate:true } }` | **ninguna** — es el reintento de Telegram |
| 5 | `sender` ≠ `TELEGRAM_ALLOWED_CHAT_ID` | `200` `{ ok:true, data:{ ignored:true } }` y **ninguna respuesta al chat** | una fila en `inbound_messages` con `allowed=false` |
| 6 | Todo bien | `200` `{ ok:true, data:{ accepted:true } }` | `inbound_messages` con `allowed=true` más lo que produzca el pipeline |

La comparación de la cabecera usa tiempo constante (`node:crypto.timingSafeEqual` sobre buffers de igual longitud) y ocurre **antes** de tratar el cuerpo como confiable.

**Por qué el rechazo de la allowlist responde 200 y no 403:** Telegram reintenta toda respuesta no-2xx durante horas; un 403 convertiría a un curioso en una tormenta de reintentos. El rechazo es silencioso hacia el remitente y ruidoso hacia el registro.

**Efectos del camino feliz:** (1) una fila en `inbound_messages`; (2) si hay estado de conversación vivo y el texto es una respuesta de confirmación, `pending_transactions.status` pasa a `confirmed` o `rejected`, y en el primer caso `commit.ts` escribe una fila en `transactions` y una en `audit_log`; (3) si no, `extract-free-text.ts` llama al gateway, `pending.ts` escribe el pendiente, `conversation.ts` escribe el estado y el bot envía la pregunta al mismo chat. La llamada al modelo ocurre **después** del commit de `inbound_messages`, para que un reintento no reprocese.

#### `GET /api/health`

`200` → `{ ok:true, data:{ db:"reachable", migrations:"applied"|"pending" } }`. `500` → `{ ok:false, error:{ code:"internal", … } }`. `db` se prueba con `SELECT 1`; `migrations` cuenta filas de `_prisma_migrations` con `finished_at IS NULL`, y si hay alguna responde `"pending"` con `ok:true` — una migración a medias es información, no una caída. No revela versiones, tablas ni cadenas de conexión.

#### Server action: `confirmPending(pendingId): Promise<Result<{ transactionId: string }>>`

En `src/app/(app)/revision/actions.ts`, delegando a `src/server/ledger/commit.ts`.

| Condición | `code` | Efecto |
|---|---|---|
| Sin sesión | `unauthorized` | ninguno |
| No existe o es de otro `user_id` | `not_found` | ninguno |
| Ya tiene `committed_transaction_id` | `conflict` | ninguno — **confirmar dos veces no crea dos transacciones** |
| Falta `amount_cents`, `direction`, `occurred_on`, `description` o `account_id` | `validation_failed` | ninguno; la UI pide completar el campo |
| Todo bien | — | una fila en `transactions`, `status='confirmed'`, `resolved_at=now()`, `committed_transaction_id` apuntando a la nueva fila, y **una** fila en `audit_log` con `action='pending.confirm'`, todo en una sola transacción de base |

`commit.ts` es el único escritor de `transactions` y siempre escribe a través de `with-audit.ts`: no existe camino que inserte sin dejar la fila de auditoría en la misma transacción.

---

## 6. Frontend Architecture

### Routes

| Ruta | Página | Fuente de datos | Auth |
|---|---|---|---|
| `/login` | Inicio de sesión | ninguna; el formulario postea a una server action | pública |
| `/` | Libro de transacciones (denso) | consulta de servidor paginada por cursor | usuario |
| `/cuentas` | Cuentas: alta, edición, archivar | consulta de servidor | usuario |
| `/revision` | Pendientes por confirmar (espacioso) | consulta filtrada por `status='awaiting_review'` | usuario |
| `/subir` | Subir PDF de extracto o foto de recibo | server action con `FormData` | usuario |
| `/importar` | Importación única del Excel | server action con `FormData` | usuario |

### Rendering strategy

Todo es **Server Component dinámico** y eso es deliberado: cada pantalla muestra el estado del dinero, y una página cacheada con un saldo viejo es peor que una lenta. Ninguna ruta declara `"use cache"` ni exporta `revalidate`; no se activa `cacheComponents`. Las mutaciones son server actions que llaman `revalidatePath("/")` (y `"/revision"` cuando corresponde) — esa es la única interacción con la caché del framework en todo el proyecto. `/login` es Server Component con un Client Component mínimo para mostrar el error con `useActionState`.

### Component hierarchy

```
app/(app)/layout.tsx            [servidor] shell: <header> <nav> <main>
  ThemeToggle                   [cliente]  única razón: lee y escribe localStorage
  app/(app)/page.tsx            [servidor] "/" el libro
    LedgerFilters               [cliente]  filtros por cuenta y rango; escribe searchParams
    LedgerTable                 [servidor] <table> densa, fila 32px, tabular-nums
      MoneyCell                 [servidor] monto + signo + acento no textual (§7)
      SoftDeleteButton          [cliente]  confirma y llama la server action
    NewTransactionForm          [cliente]  useActionState sobre la acción de alta
    LoadMore                    [cliente]  avanza el cursor
app/(app)/revision/page.tsx     [servidor] pendientes, espaciado generoso
  PendingCard                   [servidor] una tarjeta por pendiente
    ExtractionEvidence          [servidor] raw_input y confidence, siempre visibles
    PendingForm                 [cliente]  campos editables + Confirmar / Rechazar
```

La frontera `"use client"` está siempre en la hoja: ningún layout ni página la declara. `LedgerTable` es de servidor para que 200 filas no crucen a JavaScript.

### State management

Estado de servidor: consultas de Server Component, sin librería de caché de cliente (`@tanstack/react-query` sería una segunda copia de lo que el servidor ya tiene). Estado de formulario: `useActionState` de React 19; sin `react-hook-form`, porque los formularios tienen 3–6 campos y la validación autoritativa es zod en el servidor. Estado de cliente: `useState` local; lo único global es el tema, en `localStorage`, con la clase aplicada antes de la hidratación para que no haya destello.

**Deliberadamente fuera del estado global:** la sesión (la resuelve `proxy.ts` y llega como cabecera `x-user-id`), los filtros del libro (viven en `searchParams`, así el enlace es compartible), y el estado de "esperando confirmación" del chat (vive en `conversation_states`, **nunca en memoria**).

**Ninguna fila de Prisma cruza a un Client Component.** Los Server Components mapean a un DTO donde `amountCents` es `string`: `BigInt` no es serializable a JSON y el error aparece en ejecución, no en compilación — por eso es regla del blueprint y no del compilador.

### Loading, empty, and error states

| Superficie | Cargando | Vacío | Error |
|---|---|---|---|
| `/` libro | `loading.tsx` con 8 filas esqueleto de 32px, misma altura que las reales | "Todavía no hay movimientos. Registra el primero arriba, o escríbele al bot." + enlace a `/importar` | `error.tsx` con el `message` del `Result` y botón "Reintentar" |
| `/revision` | 2 tarjetas esqueleto | "Nada por confirmar. Todo lo que llegó ya está en el libro." | mensaje + "Reintentar" |
| `/cuentas` | 4 filas esqueleto | no aplica: el seed deja 4 cuentas | mensaje + "Reintentar" |
| `/subir` | barra de progreso con el nombre del archivo | "Ningún archivo subido todavía." | el `message`, con el caso `conflict` explícito ("ese archivo ya se había subido") |
| `/importar` | "Leyendo la hoja… N filas" | "Sin importaciones previas." | fila por fila: qué línea falló y por qué |
| Confirmación por chat | el bot responde "Recibido, lo estoy leyendo…" | no aplica | "No pude leer eso. ¿Me lo escribes de otra forma?" y **no** crea pendiente |

---

## 7. Design System

Sin `ui-ux-pro-max` en esta sesión: el sistema sale de `knowledge/capabilities/styling.md` y de la tabla de tokens que ya está en `CLAUDE.md`, que es la fuente única. Esta sección añade lo que `CLAUDE.md` no llevaba: los valores de modo oscuro que faltaban y los contrastes medidos. Todos los tokens se declaran una sola vez en `@theme` dentro de `src/app/globals.css`; los componentes usan nombres de token, nunca hexadecimales.

### Colors

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--primary` | `#2563EB` | `#60A5FA` | Botones primarios, enlaces, anillo de foco |
| `--primary-fg` | `#FFFFFF` | `#09090B` | Texto sobre primary |
| `--background` | `#FFFFFF` | `#09090B` | Fondo de página |
| `--surface` | `#FAFAFA` | `#18181B` | Tarjetas, paneles, cabecera de tabla |
| `--border` | `#E4E4E7` | `#27272A` | Divisores **decorativos** únicamente |
| `--border-input` | `#71717A` | `#71717A` | Bordes de inputs y controles — el que sí necesita 3:1 |
| `--fg` | `#09090B` | `#FAFAFA` | Texto de cuerpo, **incluidos todos los montos** |
| `--fg-muted` | `#52525B` | `#A1A1AA` | Texto secundario, encabezados de columna |
| `--destructive` | `#E11D48` | `#E11D48` | Errores, borrar |
| `--success` | `#059669` | `#059669` | Confirmaciones |
| `--income` | `#059669` | `#059669` | Acento **no textual** de entrada de dinero |
| `--expense` | `#E11D48` | `#E11D48` | Acento **no textual** de salida de dinero |

**Contraste — medido con la fórmula de luminancia relativa de WCAG 2.2 sobre los hexadecimales de arriba, no estimado:**

| Par | Ratio | Requisito | Veredicto |
|---|---|---|---|
| `#09090B` sobre `#FFFFFF` | **19.90:1** | 4.5:1 | pasa |
| `#FAFAFA` sobre `#09090B` | **19.06:1** | 4.5:1 | pasa |
| `#52525B` sobre `#FFFFFF` | **7.73:1** | 4.5:1 | pasa |
| `#2563EB` sobre `#FFFFFF` | **5.15:1** | 4.5:1 | pasa |
| `#2563EB` sobre `#09090B` | **3.86:1** | 4.5:1 texto | **falla** → el modo oscuro usa `#60A5FA` |
| `#60A5FA` sobre `#09090B` | **7.83:1** | 4.5:1 | pasa |
| `#059669` sobre `#FFFFFF` | **3.77:1** | 4.5:1 texto · 3:1 no-texto | **falla como texto** → uso no textual únicamente |
| `#E11D48` sobre `#FFFFFF` | **4.70:1** | 4.5:1 | pasa como texto, **pero se usa igual que income** |
| `#71717A` sobre `#FFFFFF` | **4.83:1** | 3:1 (SC 1.4.11) | pasa |
| `#71717A` sobre `#09090B` | **4.12:1** | 3:1 | pasa |
| `#E4E4E7` sobre `#FFFFFF` | **1.27:1** | ninguno | correcto: es decorativo, y por eso existe `--border-input` |

**Los tres riesgosos y qué se decidió:**

1. **`--income` mide 3.77:1 y no llega a 4.5:1.** Por eso **ningún monto se pinta de verde o rojo**: el monto va en `--fg`, y la entrada/salida se comunica con el prefijo (`+` o `−` U+2212, regla de `CLAUDE.md`) más una barra vertical de 3px a la izquierda de la celda en `--income`/`--expense`, que es elemento no textual y solo necesita 3:1.
2. **`--expense` sí pasaría como texto (4.70:1) y se trata igual.** Dos estados del mismo eje con reglas distintas producen una interfaz donde el rojo "significa" más que el verde; la simetría vale más que el punto ganado.
3. **`--border` mide 1.27:1**, correcto para un divisor y prohibido para el borde de un input. Separarlo en dos tokens es lo que cumple SC 1.4.11 sin oscurecer toda la interfaz.

### Typography

| Rol | Familia | Tamaño / interlínea | Peso | Tracking |
|---|---|---|---|---|
| Display | stack del sistema | 32px / 1.2 | 600 | −0.02em |
| Heading | stack del sistema | 24px / 1.3 · 20px / 1.35 | 600 | −0.01em |
| Body | stack del sistema | 14px / 1.5 | 400 | 0 |
| Body denso (tabla) | stack del sistema | 13px / 1.35 | 400 | 0 |
| Etiqueta / encabezado de columna | stack del sistema | 12px / 1.4 | 500 | 0.02em |
| Montos | stack del sistema con `font-variant-numeric: tabular-nums` | igual que el contexto | 400 | 0 |

**Carga de fuentes: no hay.** El stack es `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`. Es deliberado y tiene una razón concreta además del rendimiento: `next/font` emite reglas `@font-face` de respaldo sin `font-display` y ninguna opción lo cambia, así que un criterio de aceptación sobre `font-display` sería insatisfacible. Sin webfont no hay `@font-face`, no hay destello y no hay criterio imposible. Los montos no usan familia mono: usan `tabular-nums` sobre el stack del sistema, que es lo que alinea las columnas sin cambiar de tipografía a mitad de fila.

### Spacing, radius, elevation

- **Espaciado:** base 4px — `4, 8, 12, 16, 24, 32, 48`. Sin valores arbitrarios.
- **Densidad:** la tabla de `/` usa 8px vertical y 12px horizontal, fila de 32px. `/revision`, `/cuentas`, `/subir` e `/importar` usan 24px entre campos y 32px entre bloques: ahí se decide sobre dinero y el espacio es parte de la decisión.
- **Radio:** 6px en inputs y botones, 8px en tarjetas, 0 en filas de tabla.
- **Elevación:** plana. **No hay sombras**; la separación es por borde y por fondo. Una sombra en una tabla densa es ruido.
- **Ancho máximo:** 1120px para el libro, 640px para formularios y `/revision`. **Breakpoints:** 640 / 768 / 1024px. Bajo 768px la tabla se vuelve lista de tarjetas — nunca scroll horizontal.

### Motion

| Clase | Duración | Easing |
|---|---|---|
| Hover y foco | 100ms | `ease-out` |
| Aparición de panel, diálogo o toast | 150ms | `ease-out` |
| Salida | 100ms | `ease-in` |
| Cualquier otra cosa | no existe | — |

Solo se animan `opacity` y `transform`; nunca `height`, `width` ni `color`. Todo respeta `prefers-reduced-motion: reduce`, implementado como una regla global en `globals.css` que fuerza `animation-duration: 0.01ms` y `transition-duration: 0.01ms`, no como un `if` por componente.

### Component style

Utilitario y silencioso: se parece a una hoja de cálculo bien hecha, no a un producto de consumo. Bordes en vez de sombras, un solo acento, cero gradientes, cero ilustraciones, cero animaciones de celebración. Un componente pertenece si se sigue leyendo bien en escala de grises y a 13px — si necesita color para ser comprensible, está mal construido. La única concesión a la comodidad es el espacio: donde se decide sobre dinero, generoso; donde se lee dinero, denso.

---

## 8. Authentication & Authorization

### Provider and rationale

**Supabase Auth**, email y contraseña, con la sesión en **cookies propias**, no en `localStorage`. Supabase ya es la base y el almacenamiento; añadir un segundo proveedor de identidad es la combinación conocida-mala "dos cookies de sesión y ninguna respuesta a quién manda". Se usa **solo** `@supabase/supabase-js`: la aplicación llama `auth.signInWithPassword` en el servidor, recibe el par de tokens y los escribe ella misma en dos cookies `HttpOnly`. Eso evita depender de un paquete de integración que este blueprint no pudo verificar contra el registro, y deja el manejo de sesión en un solo archivo.

**No existe registro.** No hay ruta que cree una cuenta. El único usuario se crea a mano una vez en el dashboard de Supabase y su `auth.users.id` se copia a `APP_USER_ID`.

### Flows

**Inicio de sesión:** `/login` → server action `signIn(email, password)` → `supabase.auth.signInWithPassword` → si hay `data.session`, se escriben `pfa_at` y `pfa_rt` como cookies y se redirige a `/`. Si falla, devuelve `unauthorized` con el mensaje "Correo o contraseña incorrectos." **sin decir cuál de los dos falló**.

**Resolución en cada petición:** `proxy.ts` lee `pfa_at` → `auth.getUser(token)`. Responde un usuario → escribe la cabecera `x-user-id` y continúa. Falla y hay `pfa_rt` → `auth.refreshSession`; si funciona reescribe ambas cookies, si no las borra y redirige a `/login`. Sin cookie → redirige sin llamar a Supabase.

**Cierre de sesión:** server action que borra ambas cookies y llama `auth.signOut`; si `signOut` falla, las cookies se borran igual.

**Expiración:** el refresco es transparente en `proxy.ts`; cuando el refresh token venció, la siguiente petición redirige a `/login`, sin modal y sin recuperar formularios a medio llenar, porque no hay formularios largos.

**Recuperación de contraseña y borrado de cuenta:** en el dashboard de Supabase. Un flujo de recuperación por email sería un servicio de correo entero (§2: sin email) por un caso que ocurre cada varios años.

**Rama de fallo explícita:** Supabase inalcanzable → `getUser` falla rápido (la URL local apunta a `127.0.0.1` a propósito, así que es `ECONNREFUSED` en milisegundos y no un DNS colgado) → se trata como **no autenticado** → redirección. **Nunca** se trata un error de red como sesión válida.

### Route protection

| Superficie | Regla | Dónde se aplica |
|---|---|---|
| `/login`, `/api/health` | pública | `proxy.ts` — lista de exclusión |
| `/api/webhooks/telegram` | cabecera secreta propia, no sesión | `proxy.ts` la excluye; el route handler verifica |
| `/_next/*`, `/favicon.ico`, estáticos | pública | `proxy.ts` — matcher |
| Todo lo demás | autenticado | `proxy.ts` redirige a `/login` |
| Toda server action | `requireUser()` como primera línea | `src/lib/auth/guard.ts` |

**Regla de aplicación:** la autorización se verifica en el servidor en cada petición, y `proxy.ts` no basta por sí solo — este blueprint lo dice explícitamente porque es un error específico de Next 16: **las server actions son POSTs a la ruta que las usa**, así que un matcher que excluye una ruta también salta la protección de sus acciones. Cada acción llama `requireUser()` en su primera línea y no confía en `x-user-id` sin compararla con `APP_USER_ID`. Un botón oculto no es un permiso.

### Roles and permissions

| Rol | Puede | No puede |
|---|---|---|
| Alejandro (único usuario) | Crear, confirmar, rechazar, recategorizar, archivar cuentas, importar, subir | Borrar físicamente una transacción · modificar una fila de `audit_log` · cambiar `amount_cents`, `occurred_on`, `description`, `direction`, `source` o `source_ref` de una transacción escrita — **las tres las impide un trigger de la base, no el código** |
| `channel:telegram` (el bot actuando por él) | Escribir `inbound_messages`, `pending_transactions` y `conversation_states`; confirmar cuando el remitente autorizado responde "sí" | Escribir en `transactions` sin pasar por `commit.ts` · procesar un mensaje de un remitente ≠ `TELEGRAM_ALLOWED_CHAT_ID` |

**No hay tabla de roles ni de permisos y no debe haberla.** El shape `internal-tool` las trae porque asume un equipo; aquí hay una persona. La regla equivalente — "toda mutación vuelve a comprobar en el servidor" — se cumple con `requireUser()`, el único punto de estrangulamiento.

### Sessions

Tokens: JWT de Supabase (`access_token`) y su `refresh_token`, en dos cookies `pfa_at` y `pfa_rt`. Nunca `localStorage`: un token ahí es legible por cualquier script que llegue a la página. Flags: `HttpOnly`, `SameSite=Lax`, `Path=/`, y `Secure` cuando `NODE_ENV === "production"`. `Lax` y no `Strict` porque la navegación de vuelta desde el enlace del bot debe conservar la sesión. Vida: la del token de Supabase, con refresco transparente en `proxy.ts`. CSRF: `SameSite=Lax` cubre el caso base y las server actions de Next añaden su verificación de origen; el webhook no usa cookies, así que no tiene superficie CSRF.

### Multi-tenancy / row-level isolation

No hay multi-tenencia y **no debe agregarse** (§1). El mecanismo que la sustituye no es "acordarse de filtrar": `requireUser()` devuelve el `userId` y **toda función de `src/server/**` lo recibe como primer argumento obligatorio**. No existe una función de consulta sin ese parámetro, así que omitirlo es un error de compilación. Además `requireUser()` compara el id de la sesión con `APP_USER_ID` y devuelve `forbidden` si no coinciden: aunque alguien creara un segundo usuario en Supabase, no leería ni escribiría nada.

No se usan políticas RLS: la aplicación se conecta con un rol único y de una sola identidad, y una política que siempre evalúa a verdadero da una falsa sensación de defensa. La verificación real está en la frontera de la aplicación, donde se puede probar.

---

## 9. BUILD ORDER

**Esta es la sección que el blueprint existe para producir.** Todo lo anterior es contexto; esto es el conjunto de instrucciones.

### Las reglas de un paso

1. **Un paso, una sesión.** Máximo **5 archivos autorizados** y **6 criterios de aceptación**. Un glob de migraciones generadas (`prisma/migrations/**`) no cuenta como archivo autorizado: lo nombra la herramienta, no el builder.
2. **Los cuatro campos son obligatorios:** `Do`, `Done when`, `Verify`, `Checkpoint`. El `Checkpoint` es un bloque de shell literal que commitea y etiqueta `step-NN-slug`; esa etiqueta es el objetivo de rollback del paso siguiente.
3. **Los `Done when` son observables y verificables por máquina**, en forma EARS: **WHEN** `<disparador>` **THE SYSTEM SHALL** `<respuesta observable>`.
4. **"Se ve bien" está prohibido.** También *funciona*, *está implementado*, *renderiza correctamente*, *está conectado*.
5. **`Verify` es shell literal** con el resultado esperado en un comentario, y **sale 0 cuando el paso está correcto**. Donde el resultado correcto es una salida distinta de cero, la línea la envuelve una aserción del código específico (`cmd; test $? -eq 3`), nunca un `!` pelado ni `test $? -ne 0`.
6. **Un paso no está hecho hasta que sus verify pasan** *y* los de los pasos anteriores siguen pasando.
7. **Ningún `Verify` depende de su propio `Checkpoint`.** Al ejecutarse, los archivos del paso están sin trackear y el árbol está sucio; las aserciones sobre estado commiteado van en el bloque `Checkpoint`, después del commit.
8. **Ningún paso rompe retroactivamente un gate anterior.** La validación de entorno degrada por paso: una variable es obligatoria solo desde el paso que la columna "Requerida desde el paso" de §10 nombra.
9. **Nunca se escribe el nombre inventado de un artefacto generado** (migraciones, cliente de Prisma, lockfile): se le nombra por el comando que lo produce.
10. **Nunca se afirma un número derivado que no se contó.** Donde la propiedad sirve, se afirma la propiedad: "cada tabla que §4 define existe", no "hay 8 tablas".

### One step, one unit — la regla de conteo

> **Un paso de §9 = una tarea de `tasks.json` = un bloque de tarea en un epic.**

Este build tiene **14 pasos**, por lo tanto **14 tareas** y — con el rango de 5 a 9 pasos por epic, es decir entre `ceil(14÷9)=2` y `floor(14÷5)=2` — **exactamente 2 epics** de 7 pasos cada uno.

### Step map

| # | Paso | Depende de | Toca | Gate |
|---|---|---|---|---|
| 1 | Esqueleto, entorno y `/login` servido | — | `env.ts`, `login/page.tsx`, `proxy.ts`, `globals.css`, `tests/unit/env.test.ts` | `pnpm build && pnpm smoke` |
| 2 | Esquema, migraciones, guardas y semilla | 1 | `schema.prisma`, `db/client.ts`, `seed.ts`, `api/health/route.ts`, `tests/integration/schema.test.ts` | `pnpm db:migrate:test && pnpm test tests/integration/schema.test.ts` |
| 3 | Sesión de un solo usuario | 2 | `auth/guard.ts`, `login/actions.ts`, `login/page.tsx`, `proxy.ts`, `tests/unit/guard.test.ts` | `pnpm test tests/unit/guard.test.ts` |
| 4 | Dinero, auditoría y el único escritor del libro | 2 | `money.ts`, `db/with-audit.ts`, `ledger/commit.ts`, 2 tests | `pnpm test tests/unit/money.test.ts tests/integration/commit.test.ts` |
| 5 | Gateway de IA y extractor de texto libre | 4 | `ai/gateway.ts`, `ingest/extract-free-text.ts`, `ingest/pending.ts`, 2 tests | `pnpm test tests/unit/extract-free-text.test.ts tests/integration/pending.test.ts` |
| 6 | Puerto `IngestChannel` y webhook de Telegram | 5 | `ingest/channel.ts`, `ingest/telegram.ts`, `telegram/client.ts`, `api/webhooks/telegram/route.ts`, 1 test | `pnpm test tests/integration/telegram-webhook.test.ts` |
| 7 | Confirmación por chat con estado persistido | 6 | `ingest/conversation.ts`, `ingest/pipeline.ts`, `ingest/telegram.ts`, 1 test | `pnpm test tests/integration/telegram-confirm.test.ts` |
| 8 | Shell y libro de transacciones | 4, 3 | `(app)/layout.tsx`, `(app)/page.tsx`, `(app)/actions.ts`, `money-cell.tsx`, `tests/e2e/ledger.spec.ts` | `pnpm test:e2e tests/e2e/ledger.spec.ts` |
| 9 | CRUD de cuentas | 8 | `ledger/catalog.ts`, `cuentas/page.tsx`, `cuentas/actions.ts`, 2 tests | `pnpm test:e2e tests/e2e/cuentas.spec.ts` |
| 10 | Pantalla de revisión | 8, 5 | `revision/page.tsx`, `revision/actions.ts`, `pending-card.tsx`, 2 tests | `pnpm test:e2e tests/e2e/revision.spec.ts` |
| 11 | Almacenamiento y recibos | 10 | `storage/index.ts`, `ingest/extract-document.ts`, `subir/page.tsx`, `subir/actions.ts`, 1 test | `pnpm test tests/integration/receipts.test.ts` |
| 12 | Extractos bancarios en PDF | 11 | `ingest/extract-statement.ts`, `ingest/statement-batch.ts`, 2 tests | `pnpm test tests/integration/statements.test.ts` |
| 13 | Importación del Excel histórico y paridad | 12 | `ingest/import-excel.ts`, `importar/page.tsx`, `importar/actions.ts`, `scripts/parity-check.ts`, 1 test | `pnpm exec tsx scripts/parity-check.ts` |
| 14 | Respaldo, restauración y despliegue | 13 | `scripts/backup.sh`, `scripts/restore-check.sh`, `scripts/set-telegram-webhook.ts`, `ci.yml`, `storage/index.ts` | `sh scripts/restore-check.sh` |

**Orden y por qué.** Andamio → capa de datos → sesión → la rebanada vertical más barata de validar (texto libre, que es lo que valida el gateway de IA sin gastar en OCR) → el canal de mensajería, que **reusa** ese extractor → interfaz → archivos → histórico → producción. **El paso 1 ejecuta el servidor construido**, no solo lo compila: `pnpm smoke` arranca el build y pide `/login` y `/`, así que un desacuerdo entre `package.json`, `proxy.ts` y la ruta pública se descubre en el primer gate y no en el octavo. **El paso 8 deja el producto usable sin una sola línea de IA**: alta manual, listado y borrado lógico. Los pasos 11 a 13 solo agregan canales de entrada.

---

#### Step 1 — Esqueleto, entorno y `/login` servido

**Do**
El Bootstrap de §10 ya dejó el andamio, `biome.json`, `.gitignore`, el repositorio y las dependencias. Este paso escribe el código propio mínimo que hace verde el gate:

- `src/lib/env.ts` — el **único** archivo que lee `process.env`. Esquema zod con dos niveles: el conjunto **siempre obligatorio** (`APP_USER_ID`, `DATABASE_URL`, `DIRECT_DATABASE_URL`, `TEST_DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `STORAGE_DRIVER`, `STORAGE_LOCAL_DIR`) que se valida al importar, y el resto **opcional**, expuesto por funciones `requireAnthropic()`, `requireTelegram()`, `requireSupabaseStorage()` que lanzan solo cuando se invocan. Esa degradación es lo que impide que el paso 5 rompa el gate del paso 1.
- `src/app/login/page.tsx` — Server Component con el formulario (correo, contraseña, botón). Todavía sin acción: el paso 3 la conecta. Un `<h1>`, etiquetas programáticas en ambos campos.
- `src/proxy.ts` — exporta `proxy`, no `middleware`. Vive en `src/`, al mismo nivel que `app/`: con `--src-dir` Next 16 no detecta un `proxy.ts` en la raíz del repo. Redirige a `/login` toda petición sin la cookie `pfa_at`, excepto `/login`, `/api/*`, `/_next/*` y estáticos. Todavía no valida el token: eso es el paso 3.
- `src/app/globals.css` — los tokens de §7 dentro de `@theme`, más la regla global de `prefers-reduced-motion`. **Si `shadcn init` (§10 Bootstrap) ya corrió, este archivo ya no está en blanco**: trae su propia paleta oklch (`--background`, `--primary`, `--muted`, etc., más un bloque `.dark` de toggle por clase) inyectada en un `@theme inline` y en `:root`/`.dark`. No la borres a ciegas ni la dejes conviviendo sin tocar: la primera pierde los `data-*` variants y las animaciones que los componentes copiados esperan (`shadcn/tailwind.css`); la segunda hace que la paleta de shadcn *gane* la cascada sobre la de §7, porque su bloque queda declarado después. La resolución correcta: conservás los tokens propios de §7 con sus nombres cortos (`--color-primary`, `--color-fg`, …) como única fuente, y agregás alias que apunten a esos mismos valores con los nombres que shadcn espera (`--color-foreground: var(--color-fg)`, `--color-input: var(--color-border-input)`, `--color-ring: var(--color-primary)`, etc.) — nunca redefinís el valor dos veces. Borrás el bloque `:root`/`.dark` de oklch que trajo el CLI y el `@custom-variant dark (&:is(.dark *))`: sin ese custom variant, `dark:` cae al default de Tailwind v4, que ya es `prefers-color-scheme` — exactamente lo que pide §7 sin selector de tema en la interfaz.
- `tests/unit/env.test.ts` — al menos un caso por rama: el conjunto obligatorio completo carga; falta uno y lanza nombrándolo; falta `ANTHROPIC_API_KEY` y **no** lanza.

**Done when**
- [ ] WHEN `pnpm install --frozen-lockfile` runs THE SYSTEM SHALL exit 0 without modifying `pnpm-lock.yaml`.
- [ ] WHEN `pnpm lint` runs THE SYSTEM SHALL exit 0 with zero errors and zero warnings, including on the `@theme` block of `src/app/globals.css`.
- [ ] WHEN `src/lib/env.ts` is imported with `DATABASE_URL` unset THE SYSTEM SHALL throw an error whose message contains `DATABASE_URL`.
- [ ] WHEN `src/lib/env.ts` is imported with `ANTHROPIC_API_KEY` unset THE SYSTEM SHALL NOT throw.
- [ ] WHEN `pnpm build && pnpm smoke` runs THE SYSTEM SHALL print `smoke ok: /login=200, / -> /login` and exit 0.

**Verify**
```bash
pnpm install --frozen-lockfile   # expect: exit 0
pnpm typecheck                   # expect: exit 0
pnpm lint                        # expect: exit 0, 0 errores 0 advertencias
pnpm test tests/unit/env.test.ts  # expect: exit 0, 0 failed, 0 skipped
pnpm build && pnpm smoke         # expect: exit 0 e imprime "smoke ok: /login=200, / -> /login"
```

**Checkpoint**
```bash
git add -A && git commit -m "step 1: esqueleto, entorno y /login servido"
git tag step-01-skeleton
git ls-files --error-unmatch src/lib/env.ts   # expect: exit 0 — ya commiteado arriba
```

---

#### Step 2 — Esquema, migraciones, guardas y semilla

**Do**
- `prisma.config.ts` — new, en la raíz del proyecto (no dentro de `prisma/`). **Prisma 7 ya no acepta `url`/`directUrl` dentro de `datasource` en `schema.prisma`**: la CLI (`migrate`, `generate`) toma la conexión de este archivo vía `defineConfig({ datasource: { url: env("DIRECT_DATABASE_URL") }, migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" } })`, importado de `"prisma/config"`. No carga `.env` por su cuenta — igual que Prisma mismo, depende de que el llamador ya haya pasado por `scripts/with-env.sh`.
- `prisma/schema.prisma` — el esquema completo de §4, con el bloque `datasource` reducido a `{ provider = "postgresql" }` (sin `url` ni `directUrl`, que viven en `prisma.config.ts`).
- La migración inicial: `sh scripts/with-env.sh pnpm exec prisma migrate dev --name initial_schema`. **No escribas el nombre del directorio que emite**; Prisma lo elige.
- La migración de guardas: `sh scripts/with-env.sh pnpm exec prisma migrate dev --create-only --name append_only_guards`, y dentro del `migration.sql` que ese comando emitió, el bloque SQL de §4 tal cual (checks, `forbid_mutation`, `transactions_guard`, los tres triggers).

  **Ambos van por `scripts/with-env.sh`**, como todo comando que invoque Prisma, tsx o Vitest: no cargan `.env` por su cuenta, y sin él fallan de inmediato con `Environment variable not found: DATABASE_URL`. Ver §10 y `CLAUDE.md`.
- `pnpm add @prisma/adapter-pg@7.10.0 pg @prisma/client-runtime-utils@7.10.0` más `pnpm add -D @types/pg`. El tercer paquete no es evidente: con `output` apuntando fuera de `node_modules` (`src/generated/prisma`, arriba), pnpm en modo estricto no expone ahí las dependencias transitivas del runtime de `@prisma/client` — sin este pin exacto, `pnpm build` falla con `Module not found: Can't resolve '@prisma/client-runtime-utils'` (no lo detecta `pnpm typecheck` ni ningún comando de este paso; solo un build real lo muestra).
- `src/server/db/client.ts` — el **único** archivo que abre conexión. Reexporta el `PrismaClient` generado en `src/generated/prisma`. **Prisma 7 exige un driver adapter explícito** — `new PrismaClient()` vacío no conecta — así que este archivo construye `new PrismaPg(env.DATABASE_URL)` de `@prisma/adapter-pg` y lo pasa como `new PrismaClient({ adapter })`. Es también el único archivo que nombra la ruta del cliente generado: si `prisma generate` reporta que el `provider` fijado no existe en el major instalado, cambia `provider` al que el propio CLI nombre en su error y deja el mismo `output` — la ruta es el valor que §19.6 concilia, el `provider` no.
- `prisma/seed.ts` — idempotente, con las cuatro cuentas y ocho categorías de §4, `upsert` por `(userId, name)`, leyendo `APP_USER_ID` desde `src/lib/env.ts`.
- `src/app/api/health/route.ts` — `GET`, sin `next/*`, devolviendo el sobre de §5.
- `tests/integration/schema.test.ts` — un caso por tabla de §4 (`SELECT 1 FROM <tabla> LIMIT 1` no lanza), un caso que inserta una transacción y comprueba que el `check` rechaza `amount_cents <= 0`, y un caso que comprueba que `/api/health` devuelve `ok:true`.

**Done when**
- [ ] WHEN `pnpm db:migrate:test` runs against an empty database THE SYSTEM SHALL exit 0 and create every table defined in the schema.
- [ ] WHEN `pnpm db:seed:test` runs twice in a row THE SYSTEM SHALL exit 0 both times and leave exactly 4 rows in `accounts` and 8 rows in `categories`.
- [ ] WHEN a `DELETE` is issued against `transactions` THE SYSTEM SHALL raise an exception and psql SHALL exit with code 1 under `ON_ERROR_STOP=1` and `-c`.
- [ ] WHEN an `UPDATE` is issued against `audit_log` THE SYSTEM SHALL raise an exception and psql SHALL exit with code 1 under `ON_ERROR_STOP=1` and `-c`.
- [ ] WHEN a transaction row is inserted with `amount_cents` of 0 THE SYSTEM SHALL reject it with a check-constraint violation.
- [ ] WHEN `GET /api/health` is called THE SYSTEM SHALL respond 200 with `{ ok: true }` and `data.db` equal to `reachable`.

**Verify**
```bash
docker compose up -d --wait                    # expect: exit 0, healthcheck en verde
pnpm db:generate                               # expect: exit 0
pnpm db:migrate:test                           # expect: exit 0
pnpm db:seed:test && pnpm db:seed:test         # expect: exit 0 las dos veces (idempotente)
pnpm typecheck                                 # expect: exit 0
pnpm test tests/integration/schema.test.ts     # expect: exit 0, 0 failed, 0 skipped
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d personal_finance_test \
  -c "delete from transactions"; test $? -eq 1 # expect: 1 = error SQL bajo -c -> esta linea sale 0
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d personal_finance_test \
  -c "update audit_log set action='x'"; test $? -eq 1   # expect: 1 -> esta linea sale 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 2: esquema, migraciones, guardas append-only y semilla"
git tag step-02-schema
git ls-files --error-unmatch prisma/schema.prisma   # expect: exit 0
```

---

#### Step 3 — Sesión de un solo usuario

**Do**
- `src/lib/result.ts` — new: el sobre `Result<T>`/`ErrorCode` de §5, definido una sola vez. Toda frontera lo importa de acá; ninguna lo redeclara.
- `src/lib/auth/guard.ts` — `requireUser()`, `resolveSession(accessToken)`, `refreshSession(refreshToken)`, `e2eBypassUserId()`, y las constantes `ACCESS_COOKIE`/`REFRESH_COOKIE`/`SESSION_COOKIE_OPTIONS` que `login/actions.ts` y `proxy.ts` comparten en vez de duplicar. El bypass de e2e se activa **solo si se cumplen las tres condiciones a la vez**: `E2E_USER_ID` está definida, `DATABASE_URL` termina en `_test`, y `DATABASE_URL === E2E_DATABASE_URL`. Esas dos variables las define exclusivamente `playwright.config.ts` y no aparecen en ningún `.env`, de modo que ningún archivo de entorno puede activar el bypass en producción.
- `src/app/login/actions.ts` — `signIn` con `"use server"`, validación zod, `signInWithPassword`, escritura de `pfa_at` y `pfa_rt` con los flags de §8, y `signOut`.
- `src/app/login/page.tsx` — conecta el formulario a `signIn` con `useActionState` y muestra el `message` del `Result`.
- `src/proxy.ts` — ahora valida el token con Supabase, refresca cuando puede, escribe `x-user-id`, y ante error de red trata la petición como no autenticada. **Antes de nada de eso, consulta `e2eBypassUserId()`**: si devuelve un id, lo escribe en `x-user-id` y continúa sin tocar cookies ni Supabase. Sin esta línea, `e2eBypassUserId()` existe pero nunca se ejecuta — ningún test e2e de ningún paso posterior podría autenticarse jamás, porque no hay Supabase real en este entorno. (Corrección retroactiva: la primera versión de este paso definió la función y la probó en aislamiento, pero no la conectó; el hueco solo se hizo visible al escribir el primer test e2e real, en el paso 8.)
- `tests/unit/guard.test.ts` — cuatro casos del bypass (activo; sin `E2E_USER_ID`; base que no termina en `_test`; `E2E_DATABASE_URL` distinta) y uno de `requireUser()` con un `x-user-id` distinto de `APP_USER_ID` → `forbidden`.

**Done when**
- [ ] WHEN `E2E_USER_ID` is set, `DATABASE_URL` ends with `_test` and equals `E2E_DATABASE_URL` THE SYSTEM SHALL return that user id from `e2eBypassUserId()`.
- [ ] WHEN `E2E_USER_ID` is set but `DATABASE_URL` does not end with `_test` THE SYSTEM SHALL return null from `e2eBypassUserId()`.
- [ ] WHEN `E2E_USER_ID` is set but differs from `E2E_DATABASE_URL` THE SYSTEM SHALL return null from `e2eBypassUserId()`.
- [ ] WHEN `requireUser()` receives an `x-user-id` header different from `APP_USER_ID` THE SYSTEM SHALL return an error with code `forbidden`.
- [ ] WHEN sign-in is called with wrong credentials THE SYSTEM SHALL return code `unauthorized` with the message `Correo o contraseña incorrectos.` and set no cookie.

**Verify**
```bash
pnpm typecheck                        # expect: exit 0
pnpm lint                             # expect: exit 0
pnpm test tests/unit/guard.test.ts    # expect: exit 0, 0 failed, 0 skipped
pnpm build && pnpm smoke              # expect: exit 0, el anonimo sigue yendo a /login
```

**Checkpoint**
```bash
git add -A && git commit -m "step 3: sesion de un solo usuario"
git tag step-03-auth
```

---

#### Step 4 — Dinero, auditoría y el único escritor del libro

**Do**
- `src/lib/money.ts` — el **único** archivo que formatea o parsea dinero. **No llama a `Intl.NumberFormat`**: agrupa los miles con operaciones de cadena puras, para que el resultado no dependa de los datos de locale del runtime. Exporta:
  - `formatCOP(cents: bigint): string` → `$` + parte entera agrupada con `.` cada tres dígitos, y `,` + dos dígitos solo si hay centavos. Nunca incluye signo.
  - `formatSignedCOP(cents: bigint, direction: "in" | "out"): string` → `+` o `−` (U+2212) delante de `formatCOP`.
  - `pesosToCents(digits: string): bigint` → `BigInt(digits) * 100n`; rechaza cualquier cosa que no sean dígitos. Ningún float toca dinero en ningún punto.
- `src/server/db/with-audit.ts` — `withAudit(userId, entry, fn)`: abre una transacción de Prisma, ejecuta `fn`, y en la **misma** transacción inserta la fila de `audit_log` con `before`/`after`. Si la inserción de auditoría falla, la escritura entera se revierte.
- `src/server/ledger/commit.ts` — el **único** escritor de `transactions`: `createManual(userId, input)`, `commitPending(userId, pendingId)`, `softDelete(userId, id)`, `recategorize(userId, id, categoryId)`. Todos pasan por `withAudit`.
- `tests/unit/money.test.ts` — los literales de §19.6 (`$1.234.567`, `$100.000`, `$1.234.567,89`, `+$3.200.000`, `−$450.000`) y el rechazo de `pesosToCents("1.5")`.
- `tests/integration/commit.test.ts` — una creación escribe exactamente una fila en `transactions` y una en `audit_log`; `commitPending` dos veces sobre el mismo pendiente devuelve `conflict` la segunda y deja el conteo intacto; `softDelete` deja la fila consultable con `deleted_at` no nulo.

**Done when**
- [ ] WHEN `formatCOP(123456700n)` is called THE SYSTEM SHALL return the exact string `$1.234.567`.
- [ ] WHEN `formatCOP(123456789n)` is called THE SYSTEM SHALL return the exact string `$1.234.567,89`.
- [ ] WHEN `formatSignedCOP(45000000n, "out")` is called THE SYSTEM SHALL return the exact string `−$450.000` using U+2212 as the sign.
- [ ] WHEN `createManual` inserts one transaction THE SYSTEM SHALL write exactly one `audit_log` row with `action` equal to `transaction.create` in the same database transaction.
- [ ] WHEN `commitPending` is called twice with the same pending id THE SYSTEM SHALL return code `conflict` on the second call and leave the `transactions` row count unchanged.
- [ ] WHEN `grep` searches `src` (excluyendo `src/generated/`, tipos generados por Prisma, no código de la aplicación) for a write to `transactions` outside `src/server/ledger/commit.ts` THE SYSTEM SHALL find no file.

**Verify**
```bash
pnpm typecheck                                                     # expect: exit 0
pnpm test tests/unit/money.test.ts tests/integration/commit.test.ts # expect: exit 0, 0 failed
grep -rln --include=*.ts --exclude-dir=generated -e "transaction\.create" -e "transaction\.update" -e "transaction\.updateMany" src \
  | grep -vx "src/server/ledger/commit.ts"; test $? -eq 1
# expect: 1 = ninguna linea sobrevivio al filtro -> esta linea sale 0. 2 seria error de grep y falla.
# --exclude-dir=generated es obligatorio: el .d.ts que emite `prisma generate` trae ejemplos TSDoc
# con "prisma.transaction.create(...)" literal, y sin la exclusion el gate queda rojo para siempre.
```

**Checkpoint**
```bash
git add -A && git commit -m "step 4: dinero, auditoria y el unico escritor del libro"
git tag step-04-ledger-core
```

---

#### Step 5 — Gateway de IA y extractor de texto libre

**Do**
- `pnpm add @anthropic-ai/sdk@0.122.0` — la versión de §11.
- `src/server/ai/gateway.ts` — el **único** archivo que importa el SDK, y lo hace con `await import("@anthropic-ai/sdk")` **dentro** de `defaultClient()`, de modo que un test que inyecta un cliente falso nunca carga el SDK ni necesita `ANTHROPIC_API_KEY`. Exporta `type AiClient = { complete(prompt: string, attachments?: Attachment[]): Promise<string> }`, `defaultClient()` (que llama `requireAnthropic()` de §10 y lee `ANTHROPIC_MODEL_ID`, **nunca un id de modelo escrito en el código**) y `extract(schema, input, client = defaultClient())`, que valida la respuesta con zod y devuelve `Result`.
- `src/server/ingest/extract-free-text.ts` — pide al modelo `{ description, amountPesos, direction, occurredOn, accountName, categoryName, confidence }`, donde `amountPesos` es una cadena de dígitos que `pesosToCents` convierte. Resuelve `accountName` y `categoryName` contra las filas existentes; si no encuentra la cuenta deja `account_id` en null para que la revisión lo pida. **Si el modelo no devuelve `occurredOn`, el extractor asume hoy — nunca `null`.** Un mensaje como "pagué el club de tiro" sin fecha explícita implica "ahora", y dejarlo indeterminado bloquearía la confirmación por chat del paso 7: `commitPending` (paso 4) exige `occurredOn` para confirmar, así que un pendiente sin fecha nunca podría cerrarse con un simple "sí".
- `src/server/ingest/pending.ts` — el **único** escritor de `pending_transactions`. Guarda `extraction` cruda, `raw_input` y `confidence`. **Nunca escribe en `transactions`**, con ninguna confianza.
- `tests/unit/extract-free-text.test.ts` — con un `AiClient` falso: la frase del enunciado produce `description="Club de tiro"`, `amountCents=10000000n`, `direction="out"`, `accountName="cuenta de ahorros"`; una respuesta que no pasa el esquema devuelve `extraction_failed`; una respuesta con `amountPesos` no numérico devuelve `extraction_failed`.
- `tests/integration/pending.test.ts` — una extracción escribe exactamente una fila en `pending_transactions` con `status='awaiting_review'` y cero filas en `transactions`.

**Done when**
- [ ] WHEN the free-text extractor receives `pagué el club de tiro por 100000 de mi cuenta de ahorros` with a stubbed AI client THE SYSTEM SHALL produce `amountCents` equal to `10000000` and `direction` equal to `out`.
- [ ] WHEN the AI client returns a payload that fails the schema THE SYSTEM SHALL return code `extraction_failed` and write no row.
- [ ] WHEN an extraction succeeds THE SYSTEM SHALL write exactly one `pending_transactions` row with `status` equal to `awaiting_review` and zero `transactions` rows.
- [ ] WHEN the unit test suite runs without `ANTHROPIC_API_KEY` set THE SYSTEM SHALL exit 0, because the SDK is imported lazily and the tests inject a fake client.
- [ ] WHEN `grep` searches `src` for an import of `@anthropic-ai/sdk` outside `src/server/ai/gateway.ts` THE SYSTEM SHALL find no file.

**Verify**
```bash
pnpm typecheck                                                                # expect: exit 0
pnpm test tests/unit/extract-free-text.test.ts tests/integration/pending.test.ts  # expect: exit 0, 0 failed
grep -rln --include=*.ts "@anthropic-ai/sdk" src | grep -vx "src/server/ai/gateway.ts"; test $? -eq 1
# expect: 1 = ningun otro archivo lo importa -> esta linea sale 0
grep -rn --include=*.ts -e "claude-" -e "sonnet" -e "opus" -e "haiku" src; test $? -eq 1
# expect: 1 = ningun id de modelo escrito a mano -> esta linea sale 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 5: gateway de IA y extractor de texto libre"
git tag step-05-ai-gateway
```

---

#### Step 6 — Puerto `IngestChannel` y webhook de Telegram

**Do**
- `src/server/ingest/channel.ts` — el puerto, **sin una sola referencia a Telegram**:
  ```ts
  export type Attachment = { kind: "photo" | "document"; providerFileId: string; mimeType?: string };
  export type NormalizedMessage = {
    channel: string; sender: string; text?: string;
    attachments: Attachment[]; timestamp: Date; messageId: string;
  };
  export type IngestChannel = {
    readonly name: string;
    verifyRequest(request: Request): Promise<boolean>;
    normalize(request: Request): Promise<NormalizedMessage | null>;
    isAllowedSender(sender: string): boolean;
    reply(sender: string, text: string): Promise<void>;
    fetchAttachment(a: Attachment): Promise<{ bytes: Uint8Array; mimeType: string }>;
  };
  ```
  `channel` y `sender` son cadenas a propósito: WhatsApp implementa este mismo tipo sin migración ni cambio en el núcleo.
- `src/server/telegram/client.ts` — llamadas HTTP a la API de Telegram con `fetch` (`sendMessage`, `getFile`), leyendo `TELEGRAM_BOT_TOKEN` por `requireTelegram()`.
- `src/server/ingest/telegram.ts` — la implementación del puerto: `verifyRequest` compara la cabecera con `timingSafeEqual`, `normalize` parsea el update con zod y lo mapea a `NormalizedMessage`, `isAllowedSender` compara contra `TELEGRAM_ALLOWED_CHAT_ID`.
- `src/app/api/webhooks/telegram/route.ts` — **solo normaliza y encola**: verifica, normaliza, inserta en `inbound_messages` respetando la unicidad. **`pipeline.ts` todavía no existe** (llega en el paso 7) — este paso no lo llama todavía; devuelve `accepted:true` en cuanto la fila queda escrita. Cero lógica de negocio, cero llamadas al modelo dentro del handler.
- `tests/integration/telegram-webhook.test.ts` — cabecera mala → 401 y cero filas; mismo `update_id` dos veces → 200 las dos veces y **una** fila en `inbound_messages`; remitente no autorizado → 200, `allowed=false`, cero pendientes y cero llamadas a `reply`.

**Done when**
- [ ] WHEN a POST arrives with a wrong `X-Telegram-Bot-Api-Secret-Token` header THE SYSTEM SHALL respond 401 and write zero rows to `inbound_messages`.
- [ ] WHEN the same Telegram update is delivered twice THE SYSTEM SHALL respond 200 both times and leave exactly one row in `inbound_messages`.
- [ ] WHEN a message arrives from a sender other than `TELEGRAM_ALLOWED_CHAT_ID` THE SYSTEM SHALL respond 200, store the row with `allowed` false, write zero `pending_transactions` rows and send no reply.
- [ ] WHEN an allowed message arrives THE SYSTEM SHALL store the row with `allowed` true and return `data.accepted` true.
- [ ] WHEN `grep` searches `src/server/ingest/channel.ts` for the word `telegram` in any case THE SYSTEM SHALL find no match.

**Verify**
```bash
pnpm typecheck                                            # expect: exit 0
pnpm test tests/integration/telegram-webhook.test.ts      # expect: exit 0, 0 failed, 0 skipped
grep -ri telegram src/server/ingest/channel.ts; test $? -eq 1
# expect: 1 = sin coincidencias -> esta linea sale 0. 2 seria archivo ilegible y falla.
```

**Checkpoint**
```bash
git add -A && git commit -m "step 6: puerto IngestChannel y webhook de Telegram"
git tag step-06-telegram
```

---

#### Step 7 — Confirmación por chat con estado persistido

**Do**
- `src/server/ingest/conversation.ts` — `openConfirmation(channel, sender, pendingId, promptText)`, `readState(channel, sender)` (que trata como `none` cualquier estado con `expires_at` pasado) y `closeState(channel, sender)`. Todo contra `conversation_states`. **Ninguna variable de módulo guarda estado entre invocaciones**: Vercel es serverless y una constante de módulo no sobrevive.
- `src/server/ingest/pipeline.ts` — genérico sobre `IngestChannel`, **sin referencias a Telegram**: dedupe → allowlist → ¿hay estado esperando confirmación? → si sí, interpreta la respuesta (`sí`, `si`, `s`, `yes`, `dale`, `ok` → confirmar; `no`, `n`, `nel` → rechazar; cualquier otra cosa → reenviar `prompt_text` sin cambiar el estado); si no, llama `extract-free-text.ts`, escribe el pendiente, abre el estado y responde con la pregunta.
- El texto de la pregunta se arma con esta plantilla exacta, y el paso 10 y `tests/integration/telegram-confirm.test.ts` la comparan byte a byte:
  ```
  Detecté: {description}, {formatCOP(amountCents)}, {accountName} — ¿confirmo?
  Responde Sí o No.
  ```
- `src/app/api/webhooks/telegram/route.ts` — **edit**: ahora, después de escribir `inbound_messages` con `allowed=true`, llama a `processMessage(APP_USER_ID, telegramChannel, message)`. La llamada va envuelta en `try/catch`: un fallo del pipeline (config de Anthropic ausente, red, extracción) **no debe tumbar el webhook** — el mensaje ya quedó persistido, que es lo único que le importa a Telegram, y un `500` aquí dispara reintentos infinitos. `reply` de `telegram.ts` ya quedó implementado en el paso 6; este paso no necesita tocarlo.
- `tests/integration/telegram-confirm.test.ts` — el mensaje del enunciado produce exactamente el texto `Detecté: Club de tiro, $100.000, cuenta de ahorros — ¿confirmo?\nResponde Sí o No.`; responder `sí` escribe una fila en `transactions` y cierra el estado; responder `no` deja `status='rejected'` y cero transacciones; responder `quizás` reenvía el mismo texto y deja el estado intacto. Prueba `pipeline.ts` directamente contra un `IngestChannel` falso, con `AiClient` inyectado — no contra el webhook real.

**Done when**
- [ ] WHEN an allowed free-text message is processed THE SYSTEM SHALL reply with exactly `Detecté: Club de tiro, $100.000, cuenta de ahorros — ¿confirmo?` on the first line and `Responde Sí o No.` on the second.
- [ ] WHEN the sender replies `sí` THE SYSTEM SHALL write exactly one `transactions` row, set the pending status to `confirmed` and delete the conversation state.
- [ ] WHEN the sender replies `no` THE SYSTEM SHALL set the pending status to `rejected` and write zero `transactions` rows.
- [ ] WHEN the sender replies something that is neither yes nor no THE SYSTEM SHALL resend the stored `prompt_text` unchanged and leave the conversation state in place.
- [ ] WHEN a conversation state older than its `expires_at` is read THE SYSTEM SHALL treat it as absent and start a new extraction.
- [ ] WHEN `grep` searches `src/server/ingest/pipeline.ts` for the word `telegram` in any case THE SYSTEM SHALL find no match.

**Verify**
```bash
pnpm typecheck                                          # expect: exit 0
pnpm test tests/integration/telegram-confirm.test.ts    # expect: exit 0, 0 failed, 0 skipped
grep -ri telegram src/server/ingest/pipeline.ts; test $? -eq 1   # expect: 1 -> sale 0
grep -rn "let .*State\|const .*Cache" src/server/ingest/conversation.ts; test $? -eq 1
# expect: 1 = ningun estado en memoria de modulo -> sale 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 7: confirmacion por chat con estado persistido"
git tag step-07-chat-confirm
```

---

#### Step 8 — Shell y libro de transacciones

**Do**
- `src/app/(app)/layout.tsx` — shell con `<header>`, `<nav>`, `<main>`, enlace de salto al contenido. Un solo `<h1>` por página. **El "ThemeToggle" que mencionaba una versión anterior de este paso no está especificado en ningún lado del blueprint** — §7 solo dice "light por defecto, dark disponible" (que ya cumple `prefers-color-scheme`, cableado desde el paso 1), no hay componente listado en §3, ninguna paleta de estados, ningún mecanismo de persistencia, y ningún criterio de aceptación lo exige. Construir uno sería inventar una decisión de diseño que este blueprint nunca tomó. Si Alejandro quiere un selector manual de tema, es un `/architect-refresh` o una nueva pasada de `/architect` — no una inferencia de este paso.
- `src/app/(app)/page.tsx` — el libro: tabla densa con paginación por cursor en la base (`LIMIT 50`), filtros por cuenta y rango en `searchParams`, estados de carga/vacío/error de §6.
- `src/app/(app)/actions.ts` — `createManual` con `requireUser()` en la primera línea, validación zod y `revalidatePath("/")`. **`softDelete` vive en `src/server/ledger/commit.ts`, no acá** — es el único escritor de `transactions` (regla de `database.md`), y un `UPDATE` directo desde `actions.ts` rompería esa invariante y el `grep` de "único escritor" que el paso 4 dejó viviendo para siempre en `src`. El contrato de la Epic 2 marca `commit.ts` "read-only": eso significa no reescribir `createManual`/`commitPending`, no que el archivo no pueda ganar una función nueva para una capacidad nueva.
- `src/components/money-cell.tsx` — monto en `--fg` con `tabular-nums`, prefijo `+`/`−` (U+2212) y barra de 3px en `--income`/`--expense`. **El color nunca es el único indicador.**
- `tests/e2e/ledger.spec.ts` — alta manual por la interfaz, la fila aparece con `−$100.000`, el borrado lógico la saca de la lista, la lista vacía muestra su texto, y las aserciones de accesibilidad de §15 (un `<h1>`, nombre accesible en cada control, foco visible, recorrido por teclado hasta el botón de guardar).

**Done when**
- [ ] WHEN a manual expense of 100000 pesos is submitted through the form THE SYSTEM SHALL show a row whose amount cell reads `−$100.000`.
- [ ] WHEN the ledger is empty THE SYSTEM SHALL render the text `Todavía no hay movimientos.` instead of an empty table.
- [ ] WHEN a row is soft-deleted THE SYSTEM SHALL remove it from the list and leave the database row present with a non-null `deleted_at`.
- [ ] WHEN the ledger page is requested THE SYSTEM SHALL issue a query containing `LIMIT` and return at most 50 rows.
- [ ] WHEN the page is traversed with the keyboard only THE SYSTEM SHALL reach every interactive control in visual order with a visible focus indicator.
- [ ] WHEN every amount cell is inspected THE SYSTEM SHALL show a `+` or `−` prefix, so colour is never the only indicator of direction.

**Verify**
```bash
pnpm typecheck                             # expect: exit 0
pnpm lint                                  # expect: exit 0
pnpm test:e2e tests/e2e/ledger.spec.ts     # expect: exit 0, 0 failed
```

**Checkpoint**
```bash
git add -A && git commit -m "step 8: shell y libro de transacciones"
git tag step-08-libro-ui
```

---

#### Step 9 — CRUD de cuentas

**Do**
- `src/server/ledger/catalog.ts` — `listAccounts`, `createAccount`, `renameAccount`, `archiveAccount`, y `listCategories` (solo lectura: las categorías se siembran, §1). Toda escritura pasa por `withAudit`. Recibe `userId` como primer argumento.
- `src/app/(app)/cuentas/page.tsx` — lista con nombre, tipo, estado y saldo calculado en la base.
- `src/app/(app)/cuentas/actions.ts` — las tres acciones, con `requireUser()` y `revalidatePath`.
- `tests/integration/accounts.test.ts` — crear una cuenta con nombre repetido devuelve `conflict`; archivar una cuenta con movimientos la marca `archived_at` y **no** borra sus transacciones; cada escritura deja una fila en `audit_log`.
- `tests/e2e/cuentas.spec.ts` — crear, renombrar y archivar por la interfaz; la cuenta archivada desaparece del selector del formulario de alta pero sus movimientos siguen en el libro.

**Done when**
- [ ] WHEN an account is created with a name that already exists THE SYSTEM SHALL return code `conflict` and create no row.
- [ ] WHEN an account with transactions is archived THE SYSTEM SHALL set `archived_at` and leave every one of its transactions readable.
- [ ] WHEN an account is archived THE SYSTEM SHALL stop offering it in the new-transaction account selector.
- [ ] WHEN any account is created, renamed or archived THE SYSTEM SHALL write exactly one `audit_log` row for that change.

**Verify**
```bash
pnpm typecheck                                     # expect: exit 0
pnpm test tests/integration/accounts.test.ts       # expect: exit 0, 0 failed
pnpm test:e2e tests/e2e/cuentas.spec.ts            # expect: exit 0, 0 failed
```

**Checkpoint**
```bash
git add -A && git commit -m "step 9: CRUD de cuentas"
git tag step-09-cuentas
```

---

#### Step 10 — Pantalla de revisión

**Do**
- `src/app/(app)/revision/page.tsx` — los pendientes con `status='awaiting_review'`, espaciado generoso, con la evidencia visible: `raw_input`, `confidence` y el enlace al documento cuando lo hay.
- `src/app/(app)/revision/actions.ts` — `confirmPending` y `rejectPending` con el contrato exacto de §5, delegando en `commit.ts`.
- `src/components/pending-card.tsx` — campos editables antes de confirmar (fecha, descripción, monto, dirección, cuenta, categoría).
- `tests/integration/review.test.ts` — confirmar un pendiente incompleto devuelve `validation_failed` nombrando el campo; confirmarlo dos veces devuelve `conflict` la segunda; rechazar deja `status='rejected'` y cero transacciones.
- `tests/e2e/revision.spec.ts` — el flujo completo por la interfaz, más las aserciones de accesibilidad de §15 sobre esta pantalla.

**Done when**
- [ ] WHEN a pending row without `amount_cents` is confirmed THE SYSTEM SHALL return code `validation_failed` whose message names the missing field and write no transaction.
- [ ] WHEN a pending row is confirmed twice THE SYSTEM SHALL return code `conflict` on the second call and leave the `transactions` row count unchanged.
- [ ] WHEN a pending row is confirmed THE SYSTEM SHALL write one `transactions` row, set `committed_transaction_id`, and write one `audit_log` row with action `pending.confirm`.
- [ ] WHEN a pending row is rejected THE SYSTEM SHALL set its status to `rejected` and write zero `transactions` rows.
- [ ] WHEN the review screen renders a pending row THE SYSTEM SHALL display its `raw_input` text on the page.

**Verify**
```bash
pnpm typecheck                                   # expect: exit 0
pnpm test tests/integration/review.test.ts       # expect: exit 0, 0 failed
pnpm test:e2e tests/e2e/revision.spec.ts         # expect: exit 0, 0 failed
```

**Checkpoint**
```bash
git add -A && git commit -m "step 10: pantalla de revision"
git tag step-10-revision
```

---

#### Step 11 — Almacenamiento y recibos

**Do**
- `src/server/storage/index.ts` — `putObject(key, bytes, mimeType)` y `getObject(key)`, con `STORAGE_DRIVER='local'` escribiendo bajo `STORAGE_LOCAL_DIR`. La rama `supabase` existe como stub que lanza `internal` hasta el paso 14: implementarla ahora exigiría `SUPABASE_SERVICE_ROLE_KEY`, que §10 marca como requerida desde el paso 14, y romper eso rompería los gates anteriores.
- `src/server/ingest/extract-document.ts` — sube el archivo, calcula `sha256`, escribe `documents` (con `conflict` si el hash ya existe), y manda los bytes al gateway como adjunto para obtener **un** movimiento. Escribe el pendiente con `source='receipt'`.
- `src/app/(app)/subir/page.tsx` y `actions.ts` — formulario de archivo, límite de 10 MB, tipos `image/png`, `image/jpeg`, `application/pdf`, con `requireUser()` y el mapeo de errores de §5.
- `tests/integration/receipts.test.ts` — con gateway falso y `tests/fixtures/receipt-sample.png`: subir escribe una fila en `documents` y una en `pending_transactions`; subir el mismo archivo otra vez devuelve `conflict` y no crea un segundo pendiente; un `mimeType` no permitido devuelve `validation_failed`.

**Done when**
- [ ] WHEN a PNG receipt is uploaded THE SYSTEM SHALL write one `documents` row and one `pending_transactions` row with `source` equal to `receipt`.
- [ ] WHEN the same file is uploaded a second time THE SYSTEM SHALL return code `conflict` and create no second `pending_transactions` row.
- [ ] WHEN a file with an unsupported mime type is uploaded THE SYSTEM SHALL return code `validation_failed` and store nothing.
- [ ] WHEN `STORAGE_DRIVER` is `local` THE SYSTEM SHALL write the object under `STORAGE_LOCAL_DIR` and read it back byte-identical.
- [ ] WHEN an upload succeeds THE SYSTEM SHALL write one `audit_log` row with action `document.upload`.

**Verify**
```bash
pnpm fixtures                                     # expect: exit 0, escribe receipt-sample.png
pnpm typecheck                                    # expect: exit 0
pnpm test tests/integration/receipts.test.ts      # expect: exit 0, 0 failed
```

**Checkpoint**
```bash
git add -A && git commit -m "step 11: almacenamiento y recibos"
git tag step-11-documentos
```

---

#### Step 12 — Extractos bancarios en PDF

**Do**
- `src/server/ingest/extract-statement.ts` — manda el PDF al gateway como adjunto y pide **una lista** de movimientos, no uno. No se instala ninguna librería de PDF: el gateway acepta el documento directamente, lo que evita una dependencia más que esta sesión no pudo verificar.
- `src/server/ingest/statement-batch.ts` — para cada movimiento calcula `source_ref = sha256(fecha|descripcion|monto|nombreArchivo)` y escribe un pendiente por movimiento. Reprocesar el mismo extracto no duplica: la unicidad `(user_id, source, source_ref)` de §4 lo impide al confirmar, y el batch salta los `source_ref` ya confirmados.
- **Cobertura banco por banco, incremental:** el prompt no asume un formato; cuando un banco nuevo produce filas mal leídas, se agrega un ejemplo a la lista de ejemplos del prompt y un caso al test. Nunca se escribe un parser por banco.
- `tests/integration/statements.test.ts` — con gateway falso y `tests/fixtures/statement-sample.pdf`: tres movimientos producen tres pendientes; reprocesar el mismo archivo devuelve `conflict` del documento y cero pendientes nuevos; un movimiento sin fecha se guarda con `occurred_on` nulo y `status='awaiting_review'` para que la revisión lo pida.
- `tests/e2e/subir.spec.ts` — subir el PDF por la interfaz y ver los pendientes en `/revision`.

**Done when**
- [ ] WHEN a statement PDF yielding three movements is uploaded THE SYSTEM SHALL write three `pending_transactions` rows with `source` equal to `statement`.
- [ ] WHEN the same statement file is uploaded again THE SYSTEM SHALL return code `conflict` and create zero new `pending_transactions` rows.
- [ ] WHEN a movement in the statement has no readable date THE SYSTEM SHALL store it with a null `occurred_on` and status `awaiting_review` rather than guessing one.
- [ ] WHEN two movements in one statement have identical date, description and amount THE SYSTEM SHALL keep both as separate pending rows.
- [ ] WHEN a statement is uploaded through the interface THE SYSTEM SHALL list its movements on `/revision`.

**Verify**
```bash
pnpm typecheck                                    # expect: exit 0
pnpm test tests/integration/statements.test.ts    # expect: exit 0, 0 failed
pnpm test:e2e tests/e2e/subir.spec.ts             # expect: exit 0, 0 failed
```

**Checkpoint**
```bash
git add -A && git commit -m "step 12: extractos bancarios en PDF"
git tag step-12-extractos
```

---

#### Step 13 — Importación del Excel histórico y paridad

**Do**
- `src/server/ingest/import-excel.ts` — lee el libro con `exceljs`, espera las columnas `fecha`, `descripcion`, `monto`, y para cada fila calcula `source_ref = sha256(fecha|descripcion|monto)`, `amount_cents = |monto| * 100` con aritmética entera y `direction = monto < 0 ? "out" : "in"`. **Este es el único camino que escribe en `transactions` sin pasar por la pantalla de revisión**, y lo hace igual a través de `commit.ts` y `withAudit`, con `action='import.excel'`: es una importación única de datos que Alejandro ya confirmó al escribirlos en su hoja.
- `src/app/(app)/importar/page.tsx` y `actions.ts` — sube el archivo, muestra el conteo de filas leídas, las importadas y las saltadas por duplicado, y el detalle de las que fallaron.
- `scripts/parity-check.ts` — recalcula la suma por cuenta directamente del `.xlsx` y la compara con la suma del libro; imprime la diferencia por cuenta y sale 1 si alguna es distinta de 0.
- `tests/integration/import-excel.test.ts` — con `tests/fixtures/historical-sample.xlsx`: la importación escribe tres transacciones con `−$450.000`, `+$3.200.000` y `−$100.000`; importar el mismo archivo dos veces deja tres transacciones; una fila con monto no numérico se reporta como fallida sin abortar las demás.

**Done when**
- [ ] WHEN the historical workbook is imported THE SYSTEM SHALL write three `transactions` rows with `source` equal to `excel_import`.
- [ ] WHEN the same workbook is imported a second time THE SYSTEM SHALL leave the `transactions` row count unchanged and report the skipped rows.
- [ ] WHEN a row has a non-numeric amount THE SYSTEM SHALL report that row as failed and still import the remaining rows.
- [ ] WHEN `scripts/parity-check.ts` runs after a successful import THE SYSTEM SHALL exit 0 with a per-account difference of 0.
- [ ] WHEN a row is imported THE SYSTEM SHALL write one `audit_log` row with action `import.excel`.

**Verify**
```bash
pnpm fixtures                                       # expect: exit 0, escribe historical-sample.xlsx
pnpm typecheck                                      # expect: exit 0
pnpm test tests/integration/import-excel.test.ts    # expect: exit 0, 0 failed
sh scripts/with-test-env.sh pnpm exec tsx scripts/parity-check.ts
# expect: exit 0, diferencia 0 por cuenta
```

**Checkpoint**
```bash
git add -A && git commit -m "step 13: importacion del Excel historico y paridad"
git tag step-13-excel
```

---

#### Step 14 — Respaldo, restauración y despliegue

**Do**
- `scripts/backup.sh` — `pg_dump` de la base local a `backups/`, con nombre por marca de tiempo elegido por el script. **Nunca se escribe ese nombre a mano**: `restore-check.sh` toma el archivo más reciente del directorio.
- `scripts/restore-check.sh` — **la restauración se prueba de verdad**: crea `personal_finance_restore_test`, restaura el dump más reciente en ella, compara el conteo de filas de cada tabla contra el original y sale 1 si alguno difiere. Al terminar elimina la base de prueba.
- `scripts/set-telegram-webhook.ts` — llama `setWebhook` con `PRODUCTION_URL` + `/api/webhooks/telegram` y `secret_token = TELEGRAM_WEBHOOK_SECRET`, y verifica con `getWebhookInfo` que la URL registrada es la esperada.
- `.github/workflows/ci.yml` — el gate de §20.1 completo, con un servicio Postgres, en cada push y cada PR. **Además**, un job **separado y no bloqueante** (`continue-on-error: true`) que corre `pnpm audit --prod` — es el control de auditoría de dependencias que promete §14. Va aparte a propósito: no forma parte del gate, no puede tumbar el deploy, y su salida la revisa Alejandro. Un hallazgo abre un issue, no detiene una entrega.
- `src/server/storage/index.ts` — se completa la rama `supabase` usando `SUPABASE_SERVICE_ROLE_KEY` vía `requireSupabaseStorage()`; el driver local sigue siendo el de dev y tests.

**Done when**
- [ ] WHEN `sh scripts/backup.sh` runs THE SYSTEM SHALL write one new dump file into `backups/` and exit 0.
- [ ] WHEN `sh scripts/restore-check.sh` runs THE SYSTEM SHALL restore the newest dump into a separate database, report an identical row count for every table, and exit 0.
- [ ] WHEN `STORAGE_DRIVER` is `supabase` and `SUPABASE_SERVICE_ROLE_KEY` is absent THE SYSTEM SHALL fail with a named error instead of falling back to the local driver.
- [ ] WHEN `scripts/set-telegram-webhook.ts` runs THE SYSTEM SHALL exit 0 only after `getWebhookInfo` reports the URL built from `PRODUCTION_URL`.
- [ ] WHEN the CI workflow runs THE SYSTEM SHALL execute, in order, `docker compose up -d --wait`, `pnpm install --frozen-lockfile`, `pnpm db:generate`, `pnpm db:migrate:test`, `pnpm db:seed:test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm smoke`, `pnpm fixtures`, `pnpm test`, `pnpm test:e2e`, `sh scripts/restore-check.sh`, and a check that `git tag -l 'step-*'` counts 14, and exit 0 only if every one of them exits 0.

**Verify**
```bash
pnpm typecheck                          # expect: exit 0
pnpm lint                               # expect: exit 0
sh scripts/backup.sh                    # expect: exit 0, un archivo nuevo en backups/
sh scripts/restore-check.sh             # expect: exit 0, conteos identicos
pnpm build && pnpm smoke                # expect: exit 0
pnpm test                               # expect: exit 0, 0 failed, 0 skipped
pnpm test:e2e                           # expect: exit 0, 0 failed
# Las catorce lineas siguientes hacen verificable el criterio 5: comprueban que ci.yml
# contenga literalmente cada comando del gate global de §20.1. Son grep sueltos y no un
# bucle a proposito: sin control de flujo, cada linea sale 0 por su cuenta.
grep -qF 'docker compose up -d --wait' .github/workflows/ci.yml
grep -qF 'pnpm install --frozen-lockfile' .github/workflows/ci.yml
grep -qF 'pnpm db:generate' .github/workflows/ci.yml
grep -qF 'pnpm db:migrate:test' .github/workflows/ci.yml
grep -qF 'pnpm db:seed:test' .github/workflows/ci.yml
grep -qF 'pnpm typecheck' .github/workflows/ci.yml
grep -qF 'pnpm lint' .github/workflows/ci.yml
grep -qF 'pnpm build' .github/workflows/ci.yml
grep -qF 'pnpm smoke' .github/workflows/ci.yml
grep -qF 'pnpm fixtures' .github/workflows/ci.yml
grep -qE 'pnpm test[[:space:]]*$' .github/workflows/ci.yml
grep -qF 'pnpm test:e2e' .github/workflows/ci.yml
grep -qF 'sh scripts/restore-check.sh' .github/workflows/ci.yml
grep -qF "git tag -l 'step-*'" .github/workflows/ci.yml
```

**Checkpoint**
```bash
git add -A && git commit -m "step 14: respaldo, restauracion y despliegue"
git tag step-14-deploy
git ls-files --error-unmatch .github/workflows/ci.yml   # expect: exit 0
```

---

### 9.1 Parity and cutover

El sistema que se reemplaza es la hoja de Excel de Alejandro, y sí está corriendo: es donde hoy vive la verdad de su dinero. Esta subsección dice cómo se prueba que el reemplazo no perdió nada **antes** de que la hoja deje de ser autoritativa.

#### Parity set

| # | Comportamiento que se mantiene | Cómo se prueba | Tolerancia |
|---|---|---|---|
| 1 | La suma de movimientos por cuenta del libro es igual a la de la hoja | `sh scripts/with-test-env.sh pnpm exec tsx scripts/parity-check.ts` | exacta: diferencia 0 en centavos, por cuenta |
| 2 | Cada fila de la hoja tiene exactamente una transacción en el libro | el mismo script compara el conteo de filas legibles con el conteo de `source='excel_import'` | exacta |
| 3 | Reimportar la hoja no cambia nada | correr la importación dos veces y volver a correr el script de paridad | exacta |

**Periodo de sombra:** un mes. Durante ese mes Alejandro registra en **las dos**: en la aplicación por su canal natural, y en la hoja como siempre. Al cierre, `parity-check.ts` se corre contra la hoja actualizada. La paridad es "diferencia 0 en centavos por cuenta, dos cierres de mes seguidos". Una diferencia distinta de 0 bloquea el corte y se investiga fila por fila, nunca se ajusta el libro a mano.

#### Cutover

| Fase | Qué cambia | A quién afecta | Reversible por | Verificación |
|---|---|---|---|---|
| Importación | El histórico entra al libro; la hoja sigue siendo la fuente | nadie | borrar las filas `excel_import` no es posible: se restaura desde el dump previo | `pnpm exec tsx scripts/parity-check.ts` |
| Doble registro | Ambos sistemas reciben todo | Alejandro (teclea dos veces) | dejar de usar la app | paridad al cierre del mes |
| Corte | La aplicación es la fuente de verdad; la hoja pasa a solo lectura | Alejandro | volver a escribir en la hoja, que sigue existiendo | paridad del segundo mes en 0 |
| Baja | La hoja se archiva como copia inmutable | Alejandro | restaurar el archivo desde su copia | `sh scripts/restore-check.sh` |

**Interruptor de emergencia:** la hoja de Excel nunca se borra ni se modifica durante el periodo de sombra. Volver a ella es abrir el archivo — cero minutos, cero despliegue. Ese es el motivo de que la baja sea un paso posterior al build y no un paso de §9.

#### Abort criteria

- [ ] WHEN la diferencia de paridad de cualquier cuenta es distinta de 0 al cierre de mes THE SYSTEM SHALL mantener la hoja como fuente de verdad y no cortar.
- [ ] WHEN más del 5% de los pendientes de un mes se rechazaron por extracción errónea THE SYSTEM SHALL mantener el doble registro un mes más.
- [ ] WHEN `sh scripts/restore-check.sh` falla una sola vez THE SYSTEM SHALL bloquear el corte hasta que la restauración se demuestre.

#### Data migration

Mueve datos: el histórico de la hoja. El comando es la importación del paso 13, y es **idempotente y reanudable** por construcción — `source_ref = sha256(fecha|descripcion|monto)` con unicidad `(user_id, source, source_ref)`, así que reintentar tras un fallo a mitad continúa sin duplicar. Durante el periodo de sombra no hay doble escritura automática: Alejandro escribe en ambos lados a mano, que para un usuario es más barato y más auditable que un sincronizador. La consulta de reconciliación es `scripts/parity-check.ts`. **El punto de no retorno** es el momento en que la hoja pasa a solo lectura al final de la fase de corte; desde ahí el libro es autoritativo y la hoja es evidencia histórica.

#### Decommission

La hoja se archiva, no se borra: copia inmutable en el almacenamiento, junto con el último dump de la base. Requisitos previos: dos cierres de mes con paridad 0, `restore-check.sh` en verde y un dump guardado fuera de la máquina. **La baja no es un paso de §9** — ocurre después de un periodo de asentamiento que dura más que el build, así que vive en la lista de verificación de lanzamiento de §20.1.

---

## 10. Environment Setup

### Prerequisites

| Herramienta | Versión | Comprobación |
|---|---|---|
| Node.js | 24.20.0 (LTS) | `node -v` → `v24.x` |
| pnpm | 11.24.0 vía corepack | `pnpm -v` → `11.24.0` |
| Docker con Compose v2 | cualquiera con `docker compose` | `docker compose version` |
| git | cualquiera reciente | `git --version` |
| rsync o `cp -n` | del sistema | `command -v rsync` |

`corepack enable` a secas falla con `EACCES` donde el directorio global de binarios no es escribible (Node instalado como root, casi toda imagen de CI). Usa `corepack enable --install-directory "$HOME/.local/bin"` y pon ese directorio en `PATH`.

### Accounts to create first

Créalas **antes del paso 1**, no a mitad del build:

| Servicio | URL | Primer paso que la necesita |
|---|---|---|
| Supabase (proyecto + un usuario creado a mano) | https://supabase.com/dashboard | paso 3 en producción; en local el paso 1 usa los valores locales de `.env.example` |
| Anthropic (clave de API) | https://console.anthropic.com | paso 5 |
| Telegram: bot con @BotFather, y tu chat id con @userinfobot | la app de Telegram | paso 6 |
| Vercel, conectado al repositorio de GitHub | https://vercel.com | paso 14 |

### Environment variables

| Variable | Para qué | Dónde se obtiene | Requerida desde el paso | ¿Secreta? |
|---|---|---|---|---|
| `APP_USER_ID` | El uuid del único usuario | Supabase → Authentication → Users; en local, el valor de `.env.example` | 1 | no |
| `DATABASE_URL` | Conexión de la app | `docker-compose.yml` en local (`…@127.0.0.1:5433/personal_finance`); pooler de Supabase en producción | 1 | sí |
| `DIRECT_DATABASE_URL` | Conexión de las migraciones | igual en local; conexión **directa** de Supabase en producción | 1 | sí |
| `TEST_DATABASE_URL` | Base exclusiva de los tests | `docker-compose.yml` (`…/personal_finance_test`) | 1 | sí |
| `NEXT_PUBLIC_SUPABASE_URL` | Endpoint de Supabase | Supabase → Settings → API | 1 | no |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública de Supabase | Supabase → Settings → API | 1 | no |
| `STORAGE_DRIVER` | `local` o `supabase` | decisión: `local` en dev y tests | 1 | no |
| `STORAGE_LOCAL_DIR` | Dónde escribe el driver local | `.storage` | 1 | no |
| `ANTHROPIC_API_KEY` | Llamadas al modelo | console.anthropic.com → API Keys | **5** | sí |
| `ANTHROPIC_MODEL_ID` | El id del modelo, **nunca en el código** | la skill `claude-api` (se activa sola) o docs.claude.com | **5** | no |
| `TELEGRAM_BOT_TOKEN` | Llamadas a la API de Telegram | @BotFather → `/newbot` | **6** | sí |
| `TELEGRAM_WEBHOOK_SECRET` | Se compara con `X-Telegram-Bot-Api-Secret-Token` | la eliges tú; en local ya viene un valor | **6** | sí |
| `TELEGRAM_ALLOWED_CHAT_ID` | El único remitente que se procesa | @userinfobot | **6** | no |
| `SUPABASE_SERVICE_ROLE_KEY` | Escritura en Supabase Storage | Supabase → Settings → API → service_role | **14** | sí |
| `PRODUCTION_URL` | Base del webhook, sin barra final | Vercel → Project → Domains | **14** | no |

`.env.example` está commiteado con todas las llaves y con valores locales o vacíos. `.env` y `.env.*.local` están ignorados. La app valida al arrancar **solo el conjunto marcado como requerido desde el paso 1**; el resto es opcional hasta que `requireAnthropic()`, `requireTelegram()` o `requireSupabaseStorage()` lo pidan.

**"Requerida desde el paso" es un contrato con §9, no una nota.** El validador de `src/lib/env.ts` trata una variable como obligatoria solo a partir del paso de esta columna, y esa es la razón de que el paso 5 pueda añadir `ANTHROPIC_API_KEY` sin romper el gate del paso 1.

**Dos variables que NO están aquí y no deben estarlo:** `E2E_DATABASE_URL` y `E2E_USER_ID`. Las define exclusivamente `playwright.config.ts` y no aparecen en ningún `.env` **a propósito**: Next.js solo define las variables que encuentra en un archivo `.env`, así que una variable ausente de todos ellos no puede ser sobrescrita por la carga del framework — y eso es lo que hace seguro el bypass de autenticación de e2e.

**Listar una variable aquí no la carga.** Next.js lee `.env` para la aplicación; Prisma, tsx y Vitest no. Todo comando que invoque una de esas herramientas pasa por `scripts/with-env.sh` o `scripts/with-test-env.sh`, y §19.6 lo registra.

### Files that must be committed

| Archivo | Por qué se commitea | Línea de excepción en el ignore |
|---|---|---|
| `.env.example` | Es la plantilla y la documentación viva de §10 | `!.env.example` **después** del patrón `.env*` del andamio |
| `pnpm-lock.yaml` | Es donde vive la versión resuelta de cada paquete | — no lo alcanza ningún patrón |
| `vitest.config.ts`, `playwright.config.ts`, `biome.json`, `tsconfig.json` | Sin ellos ningún `Verify` corre | — no los alcanza ningún patrón |
| `docker-compose.yml`, `docker/init-test-db.sql` | Provisionan el Postgres que los gates necesitan | — |
| `scripts/*.sh`, `scripts/*.ts` | Son los mecanismos de carga de entorno y de verificación | — |
| `tests/setup.ts`, `tests/e2e/global-setup.ts`, `tests/fixtures/*.ts`, `tests/fixtures/*.base64`, `tests/fixtures/*.pdf` | Los ejecuta la suite | — |
| `tests/fixtures/receipt-sample.png`, `tests/fixtures/historical-sample.xlsx` | **No se commitean** — `build-fixtures.ts` los regenera en cada corrida (`pnpm fixtures`, que `global-setup.ts` ya invoca antes de toda suite e2e); son bytes binarios derivados y determinísticos, no una fuente | `tests/fixtures/receipt-sample.png` · `tests/fixtures/historical-sample.xlsx` en `.gitignore` |
| `.claude/` completo | Son las reglas y permisos del agente; el andamio de Next no lo ignora, pero se declara igual | `!.claude/` por si un `.gitignore` futuro lo agrega |
| `prisma/migrations/**` | El SQL aplicado es historia, no artefacto temporal | — |
| `blueprints/` | Este bundle es la documentación de diseño del proyecto | — y por eso cada config lo excluye explícitamente |

### Bootstrap

```bash
# El orden importa y es deliberado:
#   scaffold -> workspace/ -> configs y .gitignore -> init de git -> PRIMER COMMIT
#   -> install -> pines -> navegadores -> shadcn -> formateo -> servicios
# El .gitignore y las exclusiones de biome/tsconfig van ANTES del primer commit y ANTES
# del primer `lint`, porque son archivos cuyo proposito es cambiar lo que ve un comando
# posterior. Todo este bloque es seguro de correr dos veces.

set -e
cd /Users/alejandroperez/personal-finance-app   # la raiz ya contiene blueprints/

# --- 1. Andamio -------------------------------------------------------------
# create-next-app se niega a escribir en un directorio con contenido desconocido
# (aqui hay blueprints/), asi que se anda en un subdirectorio y se sube el contenido.
# --eslint=false NO desactiva ESLint: la bandera no toma valor. --biome es la que sirve.
# Este comando ABORTA su propio install con ERR_PNPM_IGNORED_BUILDS y aun asi sale 0.
if [ ! -f package.json ]; then
  pnpm create next-app@latest tmp-scaffold --ts --app --tailwind --biome --src-dir --use-pnpm
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --ignore-existing tmp-scaffold/ ./
  else
    cp -Rn tmp-scaffold/. ./ || true   # BSD/macOS cp -n sale 1 cuando salta un archivo; saltar es lo que se quiere
  fi
  rm -rf tmp-scaffold
fi

# El demo de create-next-app mapea a "/", igual que el src/app/(app)/page.tsx que
# escribe el paso 8. Next falla el build con "two parallel pages that resolve to the
# same path", asi que el demo se borra ACA, antes del primer commit. §3 ya lo dibuja
# ausente del arbol final. rm -f es idempotente: no falla si ya no esta.
rm -f src/app/page.tsx

# --- 2. workspace/ del bundle ----------------------------------------------
# Copia NO destructiva a proposito: bootstrap es lo primero que reintenta un builder
# atascado, y una copia recursiva pelada revertiria package.json a su version sin
# dependencias. package.json y pnpm-lock.yaml nunca se sobrescriben aqui.
if command -v rsync >/dev/null 2>&1; then
  rsync -a --ignore-existing blueprints/personal-finance-app/workspace/ ./
else
  cp -Rn blueprints/personal-finance-app/workspace/. ./ || true
fi

# --- 3. Configuraciones que gobiernan comandos posteriores ------------------
# biome.json se SOBRESCRIBE aqui (no con `biome init`, que se niega a tocar uno existente).
# Sin tailwindDirectives, `biome check` muere parseando el globals.css que genero el andamio.
cat > biome.json <<'JSON'
{
  "$schema": "https://biomejs.dev/schemas/2.5.11/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": {
    "includes": [
      "**",
      "!blueprints/**",
      "!.next/**",
      "!node_modules/**",
      "!src/generated/**",
      "!.storage/**",
      "!backups/**",
      "!test-results/**",
      "!playwright-report/**"
    ]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 80
  },
  "linter": { "enabled": true, "rules": { "recommended": true } },
  "javascript": {
    "formatter": { "quoteStyle": "double", "trailingCommas": "all" }
  },
  "css": { "parser": { "tailwindDirectives": true } }
}
JSON

cat > .nvmrc <<'NVMRC'
24
NVMRC

# package.json y tsconfig.json se PARCHEAN, no se reescriben: el andamio pone campos
# que Next necesita y que este blueprint no debe adivinar.
cat > .bootstrap-patch.mjs <<'MJS'
import { readFileSync, writeFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
pkg.name = "personal-finance-app";
pkg.private = true;
pkg.packageManager = "pnpm@11.24.0";
pkg.engines = { node: ">=24.0.0" };
pkg.scripts = {
  dev: "sh scripts/with-env.sh pnpm exec next dev",
  build: "next build",
  start: "next start",
  typecheck: "tsc --noEmit",
  lint: "biome check .",
  format: "biome check --write .",
  test: "sh scripts/with-test-env.sh pnpm exec vitest run",
  "test:e2e": "sh scripts/with-env.sh pnpm exec playwright test",
  smoke: "sh scripts/smoke.sh",
  fixtures: "pnpm exec tsx tests/fixtures/build-fixtures.ts",
  "db:generate": "sh scripts/with-env.sh pnpm exec prisma generate",
  "db:migrate": "sh scripts/with-env.sh pnpm exec prisma migrate deploy",
  "db:migrate:test": "sh scripts/with-test-env.sh pnpm exec prisma migrate deploy",
  "db:seed": "sh scripts/with-env.sh pnpm exec tsx prisma/seed.ts",
  "db:seed:test": "sh scripts/with-test-env.sh pnpm exec tsx prisma/seed.ts",
  "db:studio": "sh scripts/with-env.sh pnpm exec prisma studio",
};
writeFileSync("package.json", `${JSON.stringify(pkg, null, 2)}\n`);

const ts = JSON.parse(readFileSync("tsconfig.json", "utf8"));
ts.exclude = [...new Set([...(ts.exclude ?? []), "node_modules", "blueprints", ".next"])];
// El andamio fija ES2017; amount_cents es bigint en todo el diseño y los
// literales 0n que eso implica no compilan por debajo de ES2020 (TS2737).
ts.compilerOptions.target = "ES2020";
writeFileSync("tsconfig.json", `${JSON.stringify(ts, null, 2)}\n`);
MJS
node .bootstrap-patch.mjs && rm -f .bootstrap-patch.mjs

# El .gitignore del andamio trae `.env*` sin negacion. Estas lineas van DESPUES de ese
# patron, que es lo unico que hace efectiva una excepcion.
cat >> .gitignore <<'IGNORE'

# --- personal-finance-app ---
.env
.env.local
.env.*.local
!.env.example
!.claude/
.storage/
backups/
src/generated/
test-results/
playwright-report/
# Regenerados en cada corrida por tests/fixtures/build-fixtures.ts (pnpm
# fixtures); las fuentes que sí se commitean son build-fixtures.ts,
# receipt-sample.png.base64 y statement-sample.pdf.
tests/fixtures/receipt-sample.png
tests/fixtures/historical-sample.xlsx
IGNORE

cp -n .env.example .env || true   # nunca pisa un .env con valores reales

# --- 4. Repositorio y PRIMER COMMIT ----------------------------------------
# Los checkpoints de §9 son etiquetas de git: el repositorio tiene que existir antes
# del paso 1, y este bloque es lo unico que corre antes. No se asume que el andamio
# lo haya creado: se salta esa parte cuando detecta un repositorio contenedor.
git rev-parse --git-dir >/dev/null 2>&1 || git init -b main
git add -A && git commit -m "chore: scaffold + workspace" --allow-empty

# --- 5. Dependencias --------------------------------------------------------
pnpm approve-builds --all          # en pnpm 11 la clave es allowBuilds, NO onlyBuiltDependencies
pnpm install --frozen-lockfile     # este es el gate real: solo sale 0 despues de la linea anterior

# El andamio fija biome 2.2.0 y typescript ^5: se suben a los pines de §11.
pnpm add -D typescript@~6.0.3 @biomejs/biome@2.5.11 vitest@4.1.11 @playwright/test@1.62.1 \
            prisma@7.10.0 tsx@4.23.12 @types/react@19.2.18 @types/react-dom@19.2.5
pnpm add @supabase/supabase-js@2.112.4 zod@4.4.3 @prisma/client@7.10.0 exceljs@4.4.0

pnpm exec playwright install --with-deps   # sin los binarios, toda prueba e2e falla en seco

# `shadcn init` a secas pregunta por la libreria base y bloquea una corrida desatendida.
pnpm dlx shadcn@4 init --base radix --no-monorepo

# Una sola pasada para reconciliar el formato del andamio y de los archivos copiados
# desde workspace/ con biome.json. Corre DESPUES de escribir biome.json, a proposito.
pnpm exec biome check --write .

# --- 6. Servicios locales ---------------------------------------------------
docker compose up -d --wait
# Defensivo: si el volumen pfa-pgdata ya existia, docker/init-test-db.sql no corrio.
docker compose exec -T db psql -U postgres -d personal_finance \
  -c "SELECT 1 FROM pg_database WHERE datname='personal_finance_test'" | grep -q 1 \
  || docker compose exec -T db psql -U postgres -d personal_finance \
       -c "CREATE DATABASE personal_finance_test"

# --allow-empty igual que el primer commit: en una segunda corrida del Bootstrap nada
# cambia, y `git commit` sin la bandera sale 1 y aborta el script entero bajo `set -e`.
git add -A && git commit --allow-empty -m "chore: dependencias, configuracion y servicios locales"

# NO hay `db:migrate` ni `db:seed` aqui: el esquema nace en el paso 2. El paso 2 los corre.
```

---

## 11. Dependencies

**Esta sección es la tabla de procedencia de versiones y el único lugar de la prosa donde aparece un número de versión** — con la excepción de los archivos ejecutables de §19, que llevan el valor real (la etiqueta de imagen del compose).

**Advertencia de procedencia, aplicable a toda la tabla:** refrescado el **2026-08-28** por `stack-researcher` (`/the-architect:architect-refresh`), contra registro en vivo — reemplaza a la caché `knowledge/runtime-tracks/ts-node.md` (verificada 2026-07-27) como fuente de autoridad para cada fila de abajo. Las filas marcadas `UNVERIFIED` siguen sin pin porque las resuelve el instalador (CLI de shadcn o `create-next-app`), no porque falte red: **instálalas sin versión y deja que el lockfile decida**.

### Runtime

| Paquete | Versión | Fuente | Comprobado | Instalado por | Para qué |
|---|---|---|---|---|---|
| `next` | 16.3.3 | `stack-researcher`, registro npm en vivo | 2026-08-28 | §10 Bootstrap — `pnpm create next-app` | El framework. Requiere Node ≥20.9. Peer range verificado contra React: `^18.2.0 \|\| 19.0.0-rc-de68d2f4-20241204 \|\| ^19.0.0` |
| `react` / `react-dom` | 19.2.8 | `stack-researcher`, registro npm en vivo | 2026-08-28 | §10 Bootstrap — `pnpm create next-app` | UI; `useActionState` es de React 19. Sin cambio: ya era la versión estable actual |
| `@supabase/supabase-js` | 2.112.4 | `stack-researcher`, registro npm en vivo | 2026-08-28 | §10 Bootstrap — `pnpm add` | Auth y Storage. Único cliente de identidad |
| `@prisma/client` | 7.10.0 | `stack-researcher`, registro npm en vivo (fila `prisma`) | 2026-08-28 | §10 Bootstrap — `pnpm add` | Cliente generado. Verificado de forma independiente contra la CLI: coinciden en la línea estable 7.10.0. **`prisma@latest` en npm resuelve hoy a un release candidate (8.0.0-rc.12) fuera de ese lockstep — nunca instalar sin pin exacto** |
| `@prisma/adapter-pg` | 7.10.0 | resuelto por el lockfile al ejecutar el paso 2 — **no verificado contra registro por `stack-researcher`** | 2026-08-29 | **paso 2** — `pnpm add @prisma/adapter-pg@7.10.0 pg @prisma/client-runtime-utils@7.10.0` | Driver adapter que Prisma 7 exige de forma obligatoria: `new PrismaClient()` sin adapter no conecta (§20.3) |
| `pg` | 8.23.0 | resuelto por el lockfile al ejecutar el paso 2 — **no verificado contra registro por `stack-researcher`** | 2026-08-29 | **paso 2** — junto con `@prisma/adapter-pg` | Cliente Postgres que consume el adapter. `@types/pg` va en Development |
| `@prisma/client-runtime-utils` | 7.10.0 | resuelto por el lockfile al ejecutar el paso 2 — **no verificado contra registro por `stack-researcher`** | 2026-08-29 | **paso 2** — `pnpm add @prisma/client-runtime-utils@7.10.0` (bug latente: ningún comando de §9 paso 2 lo detecta, solo un `pnpm build` real — descubierto ejecutando el paso 3) | Dependencia interna del runtime de `@prisma/client` 7.x. Con `output` apuntando fuera de `node_modules` (`src/generated/prisma`, §4), pnpm en modo estricto no la enlaza ahí a menos que sea dependencia **directa** del `package.json` raíz — sin este pin, `pnpm build` falla con `Module not found` (§20.3) |
| `zod` | 4.4.3 | `stack-researcher`, registro npm en vivo | 2026-08-28 | §10 Bootstrap — `pnpm add` | Validación en cada frontera: env, acciones, webhook, respuestas del modelo. Sin cambio |
| `@anthropic-ai/sdk` | 0.122.0 | `stack-researcher`, registro npm en vivo | 2026-08-28 | **paso 5** — `pnpm add @anthropic-ai/sdk@0.122.0` | Extracción. Importado en un solo archivo, y de forma diferida. **0.x: un salto de minor (0.115→0.122) puede romper el contrato de API igual que un major; no se revisó el changelog línea por línea, así que confirma manualmente antes de confiar en el bump** |
| `exceljs` | 4.4.0 | `stack-researcher`, registro npm en vivo | 2026-08-28 | §10 Bootstrap — `pnpm add exceljs@4.4.0` | Lee el `.xlsx` histórico (paso 13) y construye el fixture (`tests/fixtures/build-fixtures.ts`). **STALE**: sin release desde 2023-10-19 (~34 meses); aceptado deliberadamente por bajo radio de impacto (un solo consumidor, paso único de importación), no por descuido |
| `tailwindcss`, `@tailwindcss/postcss` | 4.3.3 | `stack-researcher`, registro npm en vivo | 2026-08-28 | §10 Bootstrap — `pnpm create next-app --tailwind` | Estilos. Config en CSS: si aparece un `tailwind.config.js`, es basura de v3. Sin cambio; los dos paquetes siguen coincidiendo exactamente |
| `clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react` | **UNVERIFIED — las resuelve el CLI** | el CLI de shadcn las elige | — | §10 Bootstrap — `pnpm dlx shadcn@4 init` | Utilidades de las primitivas copiadas. La versión resuelta queda en `pnpm-lock.yaml` |
| `postgres` (imagen) | `17-alpine` | `stack-researcher`, Docker Hub en vivo | 2026-08-28 | §19.6 — `docker-compose.yml` | El Postgres local que todo test de integración usa. **Hold deliberado**: `17-alpine` sigue mantenido activamente (push 2026-08-16); `18-alpine` ya existe pero no hay razón de compatibilidad para moverse |

### Development

| Paquete | Versión | Fuente | Comprobado | Instalado por | Para qué |
|---|---|---|---|---|---|
| `typescript` | ~6.0.3 | `stack-researcher`, registro npm en vivo | 2026-08-28 | §10 Bootstrap — `pnpm add -D` | **Hold en 6.x, no 7.x.** TypeScript 7.0.2 ya es la etiqueta `latest` estable (no RC), y desde Next 16.3+ el CLI-mode que TS7 requiere viene habilitado por defecto — ya no exige `experimental.useTypeScriptCli`. Pero la propia documentación de Next sigue llamándolo "experimental… no recomendado para producción", así que el track default se queda en 6.0.3 |
| `@biomejs/biome` | 2.5.11 | `stack-researcher`, registro npm en vivo | 2026-08-28 | §10 Bootstrap — `pnpm add -D` | Lint y formato. El andamio fija 2.2.0; se sube aquí. La clave `css.parser.tailwindDirectives` que resuelve el combo Biome+Tailwind v4 de §2 se verificó presente en el schema de 2.5.11 |
| `vitest` | 4.1.11 | `stack-researcher`, registro npm en vivo | 2026-08-28 | §10 Bootstrap — `pnpm add -D` | Unit e integración |
| `@playwright/test` | 1.62.1 | `stack-researcher`, registro npm en vivo | 2026-08-28 | §10 Bootstrap — `pnpm add -D` + `playwright install --with-deps` | E2E |
| `prisma` | 7.10.0 | `stack-researcher`, registro npm en vivo | 2026-08-28 | §10 Bootstrap — `pnpm add -D` | Migraciones, generación de cliente, Studio. Pin exacto — ver nota de `@prisma/client` sobre `latest` resolviendo a un RC |
| `tsx` | 4.23.12 | `stack-researcher`, registro npm en vivo | 2026-08-28 | §10 Bootstrap — `pnpm add -D` | Ejecuta todo script suelto: seed, fixtures, paridad, webhook |
| `@types/react` / `@types/react-dom` | 19.2.18 / 19.2.5 | `stack-researcher`, registro npm en vivo | 2026-08-28 | §10 Bootstrap — `pnpm add -D` | Tipos |
| `@types/node` | **UNVERIFIED — lo instala el andamio** | `create-next-app` lo elige | — | §10 Bootstrap — `pnpm create next-app` | Tipos de Node |
| `@types/pg` | 8.23.1 | resuelto por el lockfile al ejecutar el paso 2 — **no verificado contra registro por `stack-researcher`** | 2026-08-29 | **paso 2** — `pnpm add -D @types/pg` | Tipos de `pg`, que consume el driver adapter de Prisma |
| `shadcn` (CLI) | 4.19.0 | `stack-researcher`, registro npm en vivo | 2026-08-28 | §10 Bootstrap — `pnpm dlx shadcn@4` | Copia componentes. **No es una dependencia**. El comando de instalación fija solo el major (`shadcn@4`) y sigue siendo correcto |
| Node.js | 24.20.0 | `stack-researcher`, nodejs.org/dist en vivo | 2026-08-28 | el desarrollador — §10 Prerequisites | Runtime. Sigue siendo la línea LTS actual ("Krypton") |
| pnpm | 11.24.0 | `stack-researcher`, registro npm en vivo | 2026-08-28 | el desarrollador — `corepack enable --install-directory "$HOME/.local/bin"` (§10 Prerequisites); la versión la fija el campo `packageManager` de `package.json`, que corepack resuelve solo | Gestor de paquetes |

### Deliberately not used

| Rechazado | En su lugar | Por qué |
|---|---|---|
| `@supabase/ssr` | `@supabase/supabase-js` con cookies propias | Esta sesión no pudo verificar su versión, y el manejo de sesión cabe en un archivo. Añadirlo a ciegas es un pin inventado en el camino crítico |
| `better-auth`, `@clerk/nextjs` | Supabase Auth | Dos proveedores de identidad es una combinación conocida-mala |
| `drizzle-orm` | Prisma | Con un usuario y carga trivial, DX y Studio ganan a control del SQL |
| `@tanstack/react-query` | Server Components | Sería una segunda copia del estado que el servidor ya tiene |
| `react-hook-form` | `useActionState` | Formularios de 3–6 campos con validación autoritativa en zod del lado servidor |
| `pdf-parse`, `unpdf`, cualquier OCR | El gateway recibe el PDF y la imagen como adjunto | Una dependencia menos, y ninguna que esta sesión pudiera verificar |
| `ai` / `@ai-sdk/react` | `@anthropic-ai/sdk` en un solo archivo | No hay streaming en la interfaz; el SDK del vendor es la superficie mínima |
| Un parser por banco | Ejemplos incrementales en el prompt del extractor | Un parser por banco es mantenimiento perpetuo para un usuario con tres bancos |
| Políticas RLS de Postgres | `requireUser()` + `userId` obligatorio en cada función | Una política que siempre evalúa verdadero da falsa sensación de defensa |

---

## 12. Deployment Strategy

### Hosting

**Vercel**, plan Hobby, región `iad1` (la más cercana con menor latencia a Supabase por defecto; se cambia a la región del proyecto de Supabase si difiere). Comando de build `pnpm build`, directorio de salida el que Next declara (no se sobrescribe), runtime Node 24 fijado por `.nvmrc` y por `engines`. `proxy.ts` corre en el runtime de Node — es el predeterminado desde Next 16 y **no se declara `runtime` dentro del archivo de proxy, porque lanza**.

### Environments

| Entorno | Rama | URL | Base de datos | Modo de terceros |
|---|---|---|---|---|
| Local | — | `localhost:3000` | Postgres del compose, `personal_finance` | Telegram apuntando a un túnel manual; IA con clave real o cliente falso |
| Preview | cualquier PR | la que asigna Vercel | proyecto Supabase de preview | webhook de Telegram **no** registrado: un preview nunca recibe mensajes reales |
| Producción | `main` | `PRODUCTION_URL` | proyecto Supabase de producción, `DATABASE_URL` = pooler | webhook registrado con `scripts/set-telegram-webhook.ts` |

### CI/CD

`.github/workflows/ci.yml` (paso 14) corre en cada push y cada PR, con un servicio Postgres. **Corre exactamente la lista de §20.1, en ese orden — la lista no se repite aquí.** §20.1 es la única fuente: duplicarla acá garantiza que las dos copias se separen en cuanto el gate cambie, que es precisamente lo que ya había pasado con una versión anterior de este párrafo. El criterio 5 del paso 14 enumera esos comandos de forma autocontenida y catorce `grep` de su bloque `Verify` comprueban que `ci.yml` los contenga. **Todo chequeo que bloquea el deploy está en el gate, y todo el gate está en CI.** Aparte del gate, y sin poder tumbarlo, `ci.yml` corre un job no bloqueante (`continue-on-error: true`) con `pnpm audit --prod` — la auditoría de dependencias de §14, informativa: abre un issue, no detiene una entrega. Es la única cosa en el archivo que no pertenece al gate. El despliegue de Vercel se dispara por push a `main` y solo después de que CI está en verde.

### Release and rollback

Promoción: merge a `main` → build de Vercel → promoción automática. **Las migraciones son un paso explícito y previo**, corrido a mano desde la máquina de Alejandro contra `DIRECT_DATABASE_URL` (`pnpm db:migrate`), nunca en el arranque de la app y nunca por el pipeline: son pocas y el riesgo de una carrera entre instancias no vale la automatización. Regla de orden: primero la migración expansiva, después el deploy del código, y la contracción en un deploy posterior.

Reversión: "Promote to production" sobre el despliegue anterior en Vercel — segundos, sin rebuild. Como las migraciones son expansivas, el código anterior sigue funcionando contra el esquema nuevo. Si además hay que revertir datos, la vía es el dump de `scripts/backup.sh`, que `restore-check.sh` demuestra restaurable.

### Domain, DNS, TLS

Un dominio propio con un `CNAME` al destino que Vercel indique, o el subdominio `*.vercel.app` si Alejandro prefiere no comprar dominio. Certificado emitido y renovado por Vercel. Redirección de apex a `www` (o al revés) configurada en Vercel, una sola vez, para que `PRODUCTION_URL` y la URL registrada en el webhook coincidan exactamente — un webhook registrado contra el host que redirige **nunca se entrega**, porque las peticiones de webhook no siguen redirecciones.

---

## 13. Testing Strategy

| Capa | Framework | Qué cubre | Dónde | Cuándo corre |
|---|---|---|---|---|
| Unit | Vitest | Lógica pura: `money.ts`, `env.ts`, `guard.ts`, extractores con cliente de IA falso | `tests/unit/**/*.test.ts` | cada commit |
| Integration | Vitest | Contra el Postgres real: esquema y triggers, `commit.ts`, webhook, importaciones, almacenamiento | `tests/integration/**/*.test.ts` | cada commit |
| E2E | Playwright | Los flujos por la interfaz, más las aserciones de accesibilidad de §15 | `tests/e2e/*.spec.ts` | antes de cada deploy |

### Critical flows to cover E2E

1. **Alta manual y borrado lógico** (`tests/e2e/ledger.spec.ts`) — es el camino que hace útil el producto sin IA; si se rompe, no hay libro.
2. **Confirmar y rechazar un pendiente** (`tests/e2e/revision.spec.ts`) — es la regla innegociable de revisión humana; si se rompe, la fuente de verdad deja de serlo.
3. **Subir un extracto y ver sus movimientos en revisión** (`tests/e2e/subir.spec.ts`) — es el flujo mensual que reemplaza el trabajo manual más pesado.
4. **CRUD de cuentas** (`tests/e2e/cuentas.spec.ts`) — archivar mal una cuenta puede esconder movimientos.

### Test data

La base de tests es `personal_finance_test`, en el mismo contenedor que la de desarrollo pero **nunca la misma**: `docker/init-test-db.sql` la crea al inicializar el volumen y el Bootstrap la crea de forma defensiva si el volumen ya existía. `scripts/with-test-env.sh` reapunta `DATABASE_URL` y `DIRECT_DATABASE_URL` a `TEST_DATABASE_URL`, y `tests/setup.ts` **se niega a correr** si `DATABASE_URL` no termina en `_test` — los tests de integración truncan tablas, y apuntados a la base de desarrollo borrarían el libro real de Alejandro.

`vitest.config.ts` fija `fileParallelism: false` porque los archivos de integración comparten esa base y en paralelo se truncan las filas entre sí. `tests/e2e/global-setup.ts` migra, siembra y construye los fixtures binarios antes de la suite. Los fixtures binarios no viajan como binario: `receipt-sample.png.base64` es texto que `pnpm fixtures` convierte, y el `.xlsx` lo escribe `exceljs` en ese mismo comando. El servicio que todas estas capas necesitan lo provisiona `docker-compose.yml`, emitido en §19.6, y la variable que lo apunta es `TEST_DATABASE_URL`, en §10.

### What is deliberately not tested

- **Las llamadas reales al modelo.** Toda prueba inyecta un `AiClient` falso. Una prueba contra la API real sería no determinista, costaría dinero y saldría de la máquina. La calidad de la extracción se evalúa con el conjunto fijo de §17, a mano, cuando cambia el prompt.
- **La API real de Telegram.** `src/server/telegram/client.ts` se sustituye por un doble; lo que sí se prueba es todo lo que está detrás del puerto.
- **Supabase Auth contra el servicio real.** Los tests unitarios prueban `guard.ts`; los e2e usan el bypass con triple interlock del paso 3. El inicio de sesión real se comprueba una vez, a mano, en la lista de lanzamiento.
- **El render visual.** No hay pruebas de instantánea de píxeles: cambian con cada versión del navegador y no atrapan el error que importa aquí, que es un número equivocado.

---

## 14. Security & Secrets

| Preocupación | Control | Dónde se implementa |
|---|---|---|
| Almacenamiento de secretos | Variables de entorno de la plataforma (Vercel) y `.env` local ignorado. Ningún secreto en el repositorio | Vercel → Environment Variables; `.gitignore` |
| Rotación de secretos | `TELEGRAM_WEBHOOK_SECRET` se rota reejecutando `scripts/set-telegram-webhook.ts` con el valor nuevo; las claves de Supabase y Anthropic se rotan en sus consolas. Cadencia: anual, o inmediata ante sospecha | `scripts/set-telegram-webhook.ts` |
| Validación de entrada | `zod` en toda frontera: env, cada server action, el cuerpo del webhook, y **la respuesta del modelo** | `src/lib/env.ts`, `**/actions.ts`, `src/app/api/webhooks/telegram/route.ts`, `src/server/ai/gateway.ts` |
| Codificación de salida / XSS | Escapado por defecto de React. **No se usa `dangerouslySetInnerHTML` en ninguna parte**, y el texto que viene del modelo se renderiza como texto | `src/components/**` |
| Inyección SQL | Solo consultas parametrizadas de Prisma. `$queryRawUnsafe` está prohibido; `$queryRaw` con plantilla etiquetada se permite en `health` y en los tests | `src/server/db/**` |
| AuthN / AuthZ | §8 — verificación en el servidor en cada petición, `requireUser()` en la primera línea de cada acción | `src/lib/auth/guard.ts` |
| CSRF | `SameSite=Lax` en ambas cookies más la verificación de origen de las server actions de Next. El webhook no usa cookies | `src/app/login/actions.ts` |
| Límite de abuso | La superficie pública es el webhook: cabecera secreta comparada en tiempo constante **más** allowlist de remitente, que rechaza antes de gastar un token de IA. Al superar el límite, respuesta 200 silenciosa y fila con `allowed=false` | `src/server/ingest/telegram.ts` |
| Verificación de webhook | `timingSafeEqual` sobre `X-Telegram-Bot-Api-Secret-Token` antes de tratar el cuerpo como confiable, más el registro de deduplicación `unique (channel, provider_message_id)` | `src/app/api/webhooks/telegram/route.ts` |
| Auditoría de dependencias | `pnpm audit --prod` en CI; las advertencias las revisa Alejandro. Con esta superficie, un fallo de auditoría no bloquea el deploy pero sí abre un issue | `.github/workflows/ci.yml` |
| Cabeceras de seguridad | En `next.config.ts`: `Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` · `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` · `X-Content-Type-Options: nosniff` · `Referrer-Policy: strict-origin-when-cross-origin` · `X-Frame-Options: DENY` | `next.config.ts` (paso 14) |
| Datos personales | Se guardan datos financieros de una sola persona: descripciones, montos, cuentas y los archivos subidos. Retención indefinida por diseño (es un libro contable). La vía de borrado es borrar el proyecto de Supabase y el bucket; no hay borrado parcial, y eso es intencional | Supabase |
| Higiene de logs | Nunca se registra el cuerpo completo de un update de Telegram, ni un token, ni una clave. El extracto de un log lleva `provider_message_id`, `channel`, `allowed` y el `request_id` — nunca `text` | `src/app/api/webhooks/telegram/route.ts` |

**Reglas duras**

- Ningún secreto se commitea, se imprime en un log, se envía a un rastreador de errores ni se embebe en el bundle del cliente. Todo lo que llega al navegador es público: `NEXT_PUBLIC_*` son las únicas variables que pueden cruzar.
- Toda comprobación de autorización del servidor ocurre **antes** del trabajo, no después.
- El webhook se verifica por firma **antes** de que su cuerpo se trate como confiable.

**Régimen regulatorio:** ninguno aplica. Son datos financieros **propios** de una sola persona natural, sin terceros, sin transacciones de pago y sin datos de otros titulares. No hay obligaciones de PCI-DSS (no se tocan datos de tarjeta), ni de GDPR más allá de que Alejandro es el titular y el responsable a la vez. Se dice explícitamente para que nadie construya controles que aquí no aplican.

---

## 15. Accessibility

**Objetivo: WCAG 2.2 nivel AA.** Los criterios de accesibilidad viven en las listas "Done when" de §9 (pasos 8 y 10), no en un backlog.

### Baseline requirements

| Requisito | Regla en este proyecto |
|---|---|
| HTML semántico | `<header>`, `<nav>`, `<main>`; un solo `<h1>` por página; encabezados en orden; el libro es una `<table>` real con `<th scope="col">` |
| Teclado | Todo control alcanzable y operable por teclado, orden de tabulación visual, sin trampas, enlace de salto al contenido en el layout |
| Foco visible | Anillo de 2px en `--primary` con 2px de separación; mide 5.15:1 en claro y 3.86:1 en oscuro, ambos ≥3:1 |
| Contraste | Texto 4.5:1, texto grande y bordes de control 3:1 — la paleta de §7 lo cumple, y por eso los montos van en `--fg` y no en verde |
| Formularios | Todo input con `<label>` asociado; los errores son texto junto al campo, nunca solo color; se anuncian con `aria-live="polite"` |
| Imágenes | Los recibos subidos llevan `alt` con el nombre del archivo; los iconos decorativos llevan `alt=""` y `aria-hidden` |
| Movimiento | Todo respeta `prefers-reduced-motion: reduce` mediante una regla global en `globals.css` |
| Zoom y reflujo | Usable al 200% y a 320 CSS px sin scroll horizontal: bajo 768px la tabla se vuelve lista de tarjetas |
| Regiones vivas | El resultado de confirmar o rechazar un pendiente se anuncia en un `aria-live="polite"` |

### WCAG 2.2 additions

| SC | Cómo se cumple aquí |
|---|---|
| 2.4.11 Focus Not Obscured | El encabezado no es `sticky`; no hay barra de cookies ni toasts fijos que tapen el foco |
| 2.5.7 Dragging Movements | No hay ninguna interacción de arrastre en el producto. La subida de archivos ofrece siempre un `<input type="file">`, no solo una zona de soltar |
| 2.5.8 Target Size | Todo objetivo puntero mide al menos 24×24 CSS px, incluidos los botones de la tabla densa: la fila es de 32px y el botón ocupa 24px con separación |
| 3.3.7 Redundant Entry | El formulario de alta conserva cuenta y categoría entre altas consecutivas; la pantalla de revisión llega con los campos ya llenos por la extracción |
| 3.3.8 Accessible Authentication | Login con correo y contraseña, sin captcha, sin acertijos, **y sin bloquear el pegado** — los gestores de contraseñas funcionan |

### Verification

```bash
pnpm test:e2e tests/e2e/ledger.spec.ts tests/e2e/revision.spec.ts
# expect: exit 0, 0 failed — incluye: un solo <h1>, nombre accesible en cada control,
#         indicador de foco visible, recorrido completo por teclado, y prefijo +/- en
#         cada celda de monto (el color nunca es el unico indicador)
```

No se usa un ejecutor automático de reglas de accesibilidad: añadirlo exigiría una dependencia que esta sesión no pudo verificar contra el registro (§11), y las aserciones de arriba cubren los fallos concretos de esta interfaz. Los chequeos automáticos atrapan alrededor de un tercio de los problemas reales de todos modos; las tres pasadas manuales de §20.1 — teclado, lector de pantalla y zoom al 200% — son las que cubren el resto y están en la lista de lanzamiento.

---

## 16. Observability & Cost

### Instrumentation

| Señal | Herramienta | Qué captura | Quién la mira |
|---|---|---|---|
| Errores | Vercel Runtime Logs | Excepciones no capturadas, con la ruta y el `request_id`. **Sin rastreador de errores de terceros**: sería un servicio más y un contrato de datos financieros con un tercero, por un usuario | Alejandro |
| Logs | `console` estructurado en JSON, una línea por evento, con `request_id` en todas | Ruta, código de resultado, `channel`, `allowed`, duración. **Nunca el texto del mensaje ni un token** | Alejandro |
| Métricas | Consultas SQL guardadas en §1 y aquí | Las cuatro de abajo | Alejandro |
| Disponibilidad | Un chequeo externo gratuito contra `/api/health`, cada 5 minutos | Que la app responda y que la base esté alcanzable | Alejandro |
| Auditoría | La tabla `audit_log` | Toda escritura al libro, con `before`/`after` | Alejandro, con `pnpm db:studio` |

### The metrics that matter

| Métrica | Objetivo | Alertar en |
|---|---|---|
| Latencia p95 de `POST /api/webhooks/telegram` | < 8 s (incluye la llamada al modelo) | > 15 s dos veces seguidas |
| Tasa de `extraction_failed` sobre mensajes permitidos | < 10% semanal | > 25% semanal — el prompt o el modelo se degradaron |
| Pendientes con más de 7 días en `awaiting_review` | 0 | > 5 — la revisión dejó de ocurrir y el libro se está quedando atrás |
| Escrituras a `transactions` sin fila de `audit_log` correspondiente | 0, siempre | ≥ 1 — es un fallo de integridad y bloquea el deploy |

### Health check

`GET /api/health` comprueba dos cosas de verdad, no solo que el proceso responde: que la base contesta un `SELECT 1`, y que no hay filas en `_prisma_migrations` con `finished_at IS NULL`. Lo consulta el chequeo externo cada 5 minutos y el smoke test tras cada build.

### Cost model

| Servicio | Capa gratuita | Costo a escala v1 | Costo a 10× | Precipicio a vigilar |
|---|---|---|---|---|
| Vercel | Hobby | USD 0 | USD 0 | Uso comercial obliga al plan Pro; esta app es personal |
| Supabase | Free | USD 0 | USD 0 | El proyecto se **pausa** por inactividad en el plan gratuito; medio giga de base y un giga de almacenamiento |
| Anthropic | ninguna | pago por uso | pago por uso | Cada PDF de extracto es una llamada con un documento adjunto: es, con diferencia, la llamada más cara del producto |
| Postgres local | — | USD 0 | USD 0 | — |

**Costo mensual estimado al lanzar: prácticamente el consumo de Anthropic y nada más.** El único rubro con costo real es la API del modelo, y la palanca más barata para recortarlo es exactamente la que ya está en el diseño: la allowlist rechaza antes de llamar al modelo, y la deduplicación por `provider_message_id` impide que un reintento pague dos veces. **Ninguna cifra de esta tabla se verificó contra una lista de precios vigente** — esta sesión no tuvo red — así que trátala como orden de magnitud y confírmala antes de asumir un presupuesto. El riesgo que sí es concreto es la **pausa por inactividad del plan gratuito de Supabase**: está en el registro de riesgos de §20.2.

---

## 17. Model Routing

Este proyecto llama a un LLM en tiempo de ejecución, así que la sección aplica.

**Ningún id de modelo aparece en el código ni en este blueprint.** El id vive en `ANTHROPIC_MODEL_ID` y se obtiene invocando la skill `claude-api` (se activa sola, no es un comando con barra) o desde `docs.claude.com`. `.env.example` lo dice en el mismo lugar donde está la variable. El paso 5 tiene un gate que **falla** si aparece un id de modelo escrito a mano en `src/`. Esta sesión no tuvo red y no pudo consultar la skill: escribir un id de memoria sería exactamente el fallo que ese gate existe para atrapar.

### Routing table

| Tarea del producto | Nivel de modelo | Por qué ese nivel | Respaldo |
|---|---|---|---|
| Extracción de texto libre (paso 5) | El nivel de razonamiento general de la familia Claude, resuelto en `ANTHROPIC_MODEL_ID` | Entradas cortas y ambiguas en español coloquial colombiano; el error caro es leer mal un monto, no la latencia | Fallar cerrado: `extraction_failed`, ningún pendiente, y el bot pide reformular |
| Extracción de recibo o factura desde imagen (paso 11) | El mismo | Requiere visión sobre una foto de baja calidad; separar niveles duplicaría la variable de entorno y `.env.example` define una sola | El mismo |
| Extracción de extracto bancario en PDF (paso 12) | El mismo | Es la llamada más cara y la más variable entre bancos; la calidad de lectura decide si el mes se concilia | El mismo |

**Un solo modelo para las tres tareas, y es una decisión.** Enrutar por costo exigiría una segunda variable que `.env.example` no tiene, y la diferencia de gasto con este volumen es de centavos frente al riesgo de que la tarea barata lea mal un monto que entra al libro.

### Prompt and context strategy

Los prompts viven como constantes exportadas en el archivo del extractor que las usa (`extract-free-text.ts`, `extract-document.ts`, `extract-statement.ts`), no en un directorio de plantillas: son tres, y buscarlos en otro archivo cuesta más de lo que ahorra. Se versionan con el repositorio, así que `git log` sobre ese archivo es el historial de prompts.

Cada prompt tiene el mismo esqueleto: prefijo estable primero (rol, formato de salida JSON, lista de cuentas y categorías existentes, ejemplos), y variable después (el texto o el adjunto). Ese orden es lo que permite que el prefijo estable se beneficie de caché en el proveedor. El prompt **siempre** exige salida JSON con `amountPesos` como cadena de dígitos, nunca como número: un número en coma flotante en una cifra de dinero es la clase de error que este producto no puede permitirse.

### Cost controls

- **Tope por llamada:** máximo de tokens de salida acotado al tamaño de la respuesta JSON esperada; un extracto con más de 200 movimientos se rechaza con `validation_failed` en vez de intentarse.
- **Tope global:** el límite de gasto de la consola de Anthropic, configurado por Alejandro. La aplicación no lleva un contador propio: sería un sistema de medición para un usuario.
- **Al llegar al tope:** la llamada falla, el extractor devuelve `extraction_failed`, no se crea ningún pendiente y el bot responde pidiendo reformular. **Nunca se degrada a escribir en el libro sin extracción.**
- La palanca real de costo está antes del modelo, no en él: la allowlist y la deduplicación de §5 rechazan sin llamar. La métrica que lo vigila es la tasa de `extraction_failed` de §16.

### Failure handling

Tiempo de espera de 30 s por llamada. Un reintento, y solo uno, con espera de 2 s, únicamente ante error de red o `429`; nunca ante una respuesta que no pasó el esquema, porque reintentar un fallo de formato suele producir el mismo fallo y duplica el costo. El usuario ve: en el chat, "No pude leer eso. ¿Me lo escribes de otra forma?"; en la web, el `message` del `Result` junto al formulario, con el archivo ya guardado en `documents` con `status='failed'` para poder reintentar sin volver a subirlo. Una salida truncada o una negativa del modelo no pasan el esquema zod y caen en la misma rama: **el sistema falla cerrado y jamás inventa un movimiento**.

### Evaluation

Un conjunto fijo de entradas con propiedades esperadas, en `tests/unit/extract-free-text.test.ts` y en los tests de integración de los pasos 11 y 12, ejecutado con un cliente falso — eso prueba el *contrato*, no la calidad. La calidad se evalúa a mano y de forma obligatoria antes de cambiar un prompt o `ANTHROPIC_MODEL_ID`: las mismas entradas del conjunto se corren contra el modelo real y se compara campo por campo. Un cambio de prompt sin esa pasada es infalsificable y no se despliega. La lista mínima de entradas: la frase del enunciado, una con monto en formato `1.500.000`, una sin cuenta mencionada, una con fecha relativa ("ayer"), una que es un ingreso, una ambigua que debe salir con confianza baja, un recibo de servicios público, y un extracto de cada banco que Alejandro use.

---

## 18. Skills to Use During Build

Ninguna skill es obligatoria. Si una no está instalada, el builder recurre a este blueprint, lo anota en una línea y continúa. **Ninguna lleva barra inicial: las tres se activan solas y escribir `/nombre` sería un no-op silencioso.**

| Skill | Pasos de §9 | Qué aporta ahí | Instalación |
|---|---|---|---|
| `ui-ux-pro-max` | 8, 10 | Estilo de tabla densa, formularios y diálogos, y una paleta que sobrevive al modo oscuro. Los tokens ya están decididos en §7 y en `CLAUDE.md`; esta skill ayuda con la composición, no con los valores | `/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill` y luego `/plugin install ui-ux-pro-max@ui-ux-pro-max-skill` |
| `frontend-design` | 8, 9, 10, 11, 13 | Disposición del shell y de las pantallas de lista y detalle durante la construcción | `/plugin marketplace add anthropics/skills` y luego `/plugin install example-skills@anthropic-agent-skills` |
| `playwright-cli` | 8, 9, 10, 12 | Escribir y depurar los cuatro flujos e2e de §13 | `npm install -g @playwright/cli@latest` y luego `playwright-cli install --skills` |
| `pdf` | 12 | Entender qué produce un extracto bancario real antes de escribir los ejemplos del prompt | `/plugin marketplace add anthropics/skills` y luego `/plugin install document-skills@anthropic-agent-skills` |
| `claude-api` | 5, 11, 12, 17 | **La única fuente del id de modelo.** Es la que llena `ANTHROPIC_MODEL_ID`; nunca escribas un id de memoria | viene incluida con The Architect; se activa sola |

La skill `pdf` de Anthropic es propietaria y de código disponible: **úsala en su lugar, nunca copies su texto a este repositorio**.

## 19. Agent Workspace

Este bundle está en **modo bundle**: cada artefacto de esta sección es un **archivo real** bajo
`blueprints/personal-finance-app/workspace/`, no un bloque para copiar a mano. El builder copia el
contenido completo de `workspace/` a la raíz del proyecto **una sola vez, antes del paso 1**. Dibujar
un archivo en §3 no lo crea; emitirlo aquí sí.

```
workspace/
  CLAUDE.md                     # §19.1
  AGENTS.md                     # §19.2
  .env.example                  # §10 — plantilla de entorno, commiteada
  .claude/
    settings.json               # §19.3
    skills/add-migration/SKILL.md         # §19.4
    skills/add-ingest-channel/SKILL.md    # §19.4
    rules/{database,ingest,ai,ui,testing}.md   # §19.5
  docker-compose.yml            # §19.6
  docker/init-test-db.sql       # §19.6
  vitest.config.ts              # §19.6
  playwright.config.ts          # §19.6
  tests/setup.ts                # §19.6
  tests/e2e/global-setup.ts     # §19.6
  tests/fixtures/build-fixtures.ts        # §19.6
  tests/fixtures/receipt-sample.png.base64
  tests/fixtures/statement-sample.pdf
  scripts/with-env.sh           # §19.6
  scripts/with-test-env.sh      # §19.6
  scripts/smoke.sh              # §19.6
```

**`.claude/commands/` no se emite, en ningún modo.**

### 19.1 `CLAUDE.md`

Archivo real: `workspace/CLAUDE.md`. Bajo 200 líneas, comandos primero — el builder necesita saber
cómo ejecutar antes que cualquier otra cosa. Explica cómo se conectan las piezas, no solo dónde están
los archivos: los escritores únicos, el puerto `IngestChannel`, la regla de que nada llega al libro
sin confirmación humana. Toda regla suya es específica y verificable.

### 19.2 `AGENTS.md`

Archivo real: `workspace/AGENTS.md`. Puente corto para herramientas que no leen `CLAUDE.md`. No
duplica su contenido: qué es el proyecto, los comandos, las tres reglas que más importan
(append-only, escritores únicos, revisión humana obligatoria) y un puntero a `CLAUDE.md` como fuente
de verdad.

### 19.3 `.claude/settings.json`

Archivo real: `workspace/.claude/settings.json`. Pre-aprueba **todo comando que aparece en un bloque
`Verify` de §9, en `tasks.json`, en los epics y en el gate de §20.1** — sin eso el builder se detiene
en un prompt de permisos en cada gate, que es exactamente donde muere una construcción desatendida.

`allow` cubre: `pnpm` (install, typecheck, lint, build, dev, smoke, test, test:e2e, fixtures,
db:generate, db:migrate:test, db:seed:test, exec prisma/tsx/playwright), `docker compose`
(up/down/ps/logs y `exec -T db psql`), los cuatro scripts de `scripts/`, `grep`, `test`, `curl` a
localhost, y las operaciones de git que el protocolo de checkpoints necesita (`add`, `commit`, `tag`,
`ls-files`, más las de lectura).

`deny` cubre lo que nunca debe ser automático: leer `.env`, `.env.local` y `.env.production`;
`git push`, `git reset --hard`, `git clean`; `docker compose down -v`; `prisma migrate reset` y
`prisma db push`; `dropdb`; `rm -rf`; `vercel`; `supabase db reset`. Son destructivas sobre la fuente
de verdad del dinero o sobre el despliegue, y ninguna aparece en un `Verify`.

### 19.4 Project skills — `.claude/skills/<name>/SKILL.md`

Dos flujos que se repiten en este proyecto:

| Skill | Cuándo dispara | Qué garantiza |
|---|---|---|
| `add-migration` | agregar o cambiar tabla, columna, índice o constraint | El orden correcto (schema → migrate → generate → test), que las guardas append-only sigan vivas, y que una migración aplicada nunca se edite |
| `add-ingest-channel` | agregar WhatsApp, SMS, email u otro proveedor | Que se implemente el puerto existente en vez de rediseñarlo, que `channel.ts` y `pipeline.ts` no mencionen al proveedor, y que las dos garantías obligatorias (allowlist e idempotencia) no se olviden |

`add-ingest-channel` es la que convierte "WhatsApp después" de intención en procedimiento: es el
camino que §20.4 asume.

### 19.5 `.claude/rules/*.md`

Convenciones con alcance por ruta, cada una con frontmatter `paths`. El agente recibe las reglas de
la base cuando edita la capa de datos y las de interfaz cuando edita UI, en vez de un archivo gigante
donde todo compite por atención.

| Regla | `paths` | Qué cubre |
|---|---|---|
| `database.md` | `prisma/**`, `src/server/db/**`, `src/server/ledger/**` | Conexión única, escritores únicos, append-only por trigger, `amount_cents` positivo y `bigint`, migraciones inmutables |
| `ingest.md` | `src/server/ingest/**`, `src/server/telegram/**`, `src/app/api/webhooks/**` | El puerto sin mención del proveedor, webhook que solo normaliza y encola, allowlist, idempotencia, estado en base y no en memoria |
| `ai.md` | `src/server/ai/**`, `src/server/ingest/extract-*.ts` | Gateway único, import perezoso, id de modelo solo por variable de entorno, validación zod y fallo cerrado, política de reintento |
| `ui.md` | `src/app/**`, `src/components/**`, `src/lib/money.ts` | Formato es-CO con U+2212, `tabular-nums`, el color nunca como único indicador, densidad distinta entre libro y revisión |
| `testing.md` | `tests/**` | La base de test obligatoria, e2e sin importar `src/`, servidor sin `next/*`, y la prohibición de editar un `Verify` para que pase |

### 19.6 Verify-critical config and local infrastructure

Todo archivo de configuración que un `Verify` de §9 necesita **para poder correr** se emite acá como
archivo real y completo. Esta subsección es la que decide si los gates pueden ejecutarse.

| File | Path in the project | Which `Verify` commands need it | Resolution/env handling it carries | Bundle-path exclusion |
|---|---|---|---|---|
| `docker-compose.yml` | `docker-compose.yml` | pasos 2, 9, 10, 11, 12, 13, 14 | Publica Postgres en `5433:5432`; `POSTGRES_DB: personal_finance`; servicio `db`, contenedor `pfa-postgres`. No lee ningún `.env` | n/a — no recorre el árbol |
| `docker/init-test-db.sql` | `docker/init-test-db.sql` | pasos 2 en adelante | Crea `personal_finance_test` al inicializar el volumen. Sin variables | n/a — no recorre el árbol |
| `vitest.config.ts` | `vitest.config.ts` | todo `pnpm test` | Declara el alias `@/` para que Vitest resuelva lo que `tsconfig.json` declara para Next; `include` solo `tests/unit/**` y `tests/integration/**`; carga `tests/setup.ts` | `exclude: ["**/blueprints/**", …]` |
| `playwright.config.ts` | `playwright.config.ts` | todo `pnpm test:e2e` | `const PORT = 3101`, `BASE_URL = http://127.0.0.1:${PORT}`; `webServer.command` pasa por `scripts/with-test-env.sh`. **Único lugar que define `E2E_DATABASE_URL` y `E2E_USER_ID`** — por eso ningún `.env` puede pisarlas | `testIgnore: ["**/blueprints/**", "**/node_modules/**"]` |
| `tests/setup.ts` | `tests/setup.ts` | todo `pnpm test` | Se niega a correr contra una base que no termine en `_test`. Lee `TEST_DATABASE_URL` ya cargada por `with-test-env.sh` | n/a — lo carga Vitest, que ya excluye |
| `tests/e2e/global-setup.ts` | `tests/e2e/global-setup.ts` | todo `pnpm test:e2e` | Migra, siembra y construye fixtures. Consume las variables que `playwright.config.ts` inyecta | n/a — lo carga Playwright, que ya excluye |
| `tests/fixtures/build-fixtures.ts` | `tests/fixtures/build-fixtures.ts` | pasos 11 y 13 (`pnpm fixtures`) | Corre bajo `tsx` con rutas relativas, sin alias. Sin variables | n/a — invocado por ruta explícita |
| `tests/fixtures/receipt-sample.png.base64` | igual | paso 11 | Ninguna — es dato | n/a |
| `tests/fixtures/statement-sample.pdf` | igual | paso 12 | Ninguna — es dato | n/a |
| `scripts/with-env.sh` | `scripts/with-env.sh` | pasos 2 en adelante | **Es el cargador de entorno**: hace `. ./.env` y ejecuta. Prisma, tsx y Vitest no lo hacen solos | n/a |
| `scripts/with-test-env.sh` | `scripts/with-test-env.sh` | pasos 2 y 13, y `webServer` de Playwright | Igual, apuntando `DATABASE_URL` a `TEST_DATABASE_URL` | n/a |
| `scripts/smoke.sh` | `scripts/smoke.sh` | pasos 1, 3, 14 | Arranca el build y prueba `/login=200` y `/ -> /login`. **El paso 1 ejecuta el servidor construido, no solo lo compila** | n/a |
| `.env.example` | `.env.example` | ninguno directamente; es la plantilla de §10 | Plantilla commiteada, con `!.env.example` en `.gitignore`. Todos los valores entre comillas simples porque `with-env.sh` hace `. ./.env` | n/a |

#### Resolution convention matrix

**The convention, stated once:** alias `@/` **solo** en `src/app/**` y `src/components/**`; todo lo
demás importa con **rutas relativas sin extensión**.

| Context | Command that exercises it | Convention as it appears there | Config + literal setting that makes it work |
|---|---|---|---|
| Application source | `pnpm build` | `@/components/money-cell` en `src/app/**` y `src/components/**`; relativo en `src/lib/**` y `src/server/**` | `tsconfig.json` — `"paths": { "@/*": ["./src/*"] }` |
| Test files | `pnpm test` | Los tests importan `src/` con rutas relativas; los componentes que importan traen su `@/` | `vitest.config.ts` — `resolve.alias` con `"@": path.resolve(__dirname, "src")` |
| Standalone scripts | `sh scripts/with-test-env.sh pnpm exec tsx scripts/parity-check.ts` | Solo relativas sin extensión | Ningún ajuste emitido: `tsx` resuelve rutas relativas de forma nativa, sin leer `paths` de `tsconfig.json`. **Por eso la convención prohíbe `@/` fuera de `src/app/**` y `src/components/**`** — un alias acá fallaría en tiempo de ejecución aunque `tsc` lo acepte |
| Build / bundle | `pnpm build` | Igual que application source | `tsconfig.json` — mismo bloque `paths`; Next lo lee nativo |
| E2E runner | `pnpm test:e2e` | Ninguna — `tests/e2e/**` **no importa nada de `src/`** por regla de §3 | `playwright.config.ts` — no necesita alias; consulta la base con `docker compose exec -T db psql` |
| Prisma seed | `sh scripts/with-env.sh pnpm exec tsx prisma/seed.ts` | Solo relativas | igual que standalone scripts |

Un alias usado en `src/server/**` rompería `tsx` y Vitest a la vez — por eso la convención lo
restringe a las dos carpetas que solo carga Next.

#### Cross-artifact value reconciliation

Cada fila es un valor que aparece en más de un artefacto emitido. **Compared** dice `yes` solo donde
se abrió cada aparición y se compararon las cadenas carácter por carácter.

| Shared value | Single source — the file that decides it | Literal value | Every other place it appears | Compared |
|---|---|---|---|---|
| Puerto de Postgres en el host | `docker-compose.yml` — `ports` | `5433` | `.env.example` — `DATABASE_URL`, `DIRECT_DATABASE_URL`, `TEST_DATABASE_URL` (las tres URLs) · §10 | yes |
| Nombre de la base de desarrollo | `docker-compose.yml` — `POSTGRES_DB` | `personal_finance` | `.env.example` — `DATABASE_URL`, `DIRECT_DATABASE_URL` · §9 paso 2 (`psql -d personal_finance`) | yes |
| Nombre de la base de tests | `docker/init-test-db.sql` — `CREATE DATABASE` | `personal_finance_test` | `.env.example` — `TEST_DATABASE_URL` · §9 paso 2 (los dos `psql -d personal_finance_test`) · §10 Bootstrap (guarda defensiva) · `tests/setup.ts` (sufijo `_test`) | yes |
| Nombre del servicio de Docker | `docker-compose.yml` — clave del servicio | `db` | §9 paso 2 y §20.1 (`docker compose exec -T db psql`) · `.claude/settings.json` allowlist | yes |
| Puerto del servidor e2e | `playwright.config.ts` — `const PORT` | `3101` | `BASE_URL` y `webServer.command` del mismo archivo · §3 · §19.6 | yes |
| La ruta del propio bundle | §3 — el árbol | `blueprints/personal-finance-app` (patrón `blueprints/**`) | `biome.json` — `files.includes` `"!blueprints/**"` · `tsconfig.json` — `exclude` `"blueprints"` · `vitest.config.ts` — `exclude` `"**/blueprints/**"` · `playwright.config.ts` — `testIgnore` `"**/blueprints/**"` | yes |
| Versión de Biome | `biome.json` — `$schema` | `2.5.11` | §10 Bootstrap (`pnpm add -D @biomejs/biome@2.5.11`) · §11 | yes |
| Cookie de sesión | `proxy.ts` — el nombre que lee | `pfa_at` | `src/lib/auth/guard.ts` · §8 · §9 pasos 1 y 3 | yes |
| Directorio de storage local | `.env.example` — `STORAGE_LOCAL_DIR` | `.storage` | §9 paso 11 (criterio 4) · `.gitignore` · §14 | yes |
| Id del único usuario | `.env.example` — `APP_USER_ID` | `00000000-0000-0000-0000-000000000001` | `prisma/seed.ts` · `playwright.config.ts` — `E2E_USER_ID` · §8 · §10 | yes |
| Conteo de checkpoints | §9 — un tag por paso | `14` | §20.1 (`git tag -l 'step-*'` cuenta 14) · `tasks.json` (14 `checkpoint` únicos) · criterio 5 de `E2-T7` | yes |

---

## 20. Acceptance Gate, Risks & Decision Log

### 20.1 Global acceptance gate

Lo que valida el proyecto entero. Es **exactamente** la lista que corre `.github/workflows/ci.yml`
(criterio 5 de E2-T7) y toda ella está pre-aprobada en `.claude/settings.json` (§19.3):

```bash
docker compose up -d --wait
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:migrate:test
pnpm db:seed:test
pnpm typecheck
pnpm lint
pnpm build
pnpm smoke
pnpm fixtures
pnpm test
pnpm test:e2e
sh scripts/restore-check.sh
test "$(git tag -l 'step-*' | wc -l | tr -d ' ')" -eq 14
```

La última línea cuenta **un tag por paso**: 14 pasos, 14 tags. Es lo que detecta un build que avanzó
sin dejar puntos de retorno. Si falla, los objetivos de rollback ya se perdieron y no hay forma de
reconstruirlos salvo adivinando.

`sh scripts/restore-check.sh` está en el gate global **a propósito**: en una app que es la fuente de
verdad del dinero, un respaldo cuya restauración nunca se ejecutó no es un respaldo.

#### Gates manuales

Ningún comando los decide. Se ejecutan una vez, al cierre del build, antes de considerarlo terminado.

- [ ] **Tags de checkpoint.** `git tag -l 'step-*'` lista 14, uno por paso, y cada uno apunta al
      commit de su tarea. Ya lo cuenta el bloque bash, pero confirma también que **apuntan a los
      commits correctos** y no todos al mismo.
- [ ] **Archivos que deben estar commiteados.** Verificar con `git ls-files --error-unmatch`:
      `.env.example`, `pnpm-lock.yaml`, `biome.json`, `tsconfig.json`, `vitest.config.ts`,
      `playwright.config.ts`, `docker-compose.yml`, `docker/init-test-db.sql`, `prisma/schema.prisma`,
      `prisma/migrations/**`, `.claude/settings.json`, `.claude/rules/*.md`,
      `.claude/skills/*/SKILL.md`, `.github/workflows/ci.yml`, `blueprints/**`.
- [ ] **Orden del `.gitignore`.** Se escribió **antes** del primer `git add -A`, y `!.env.example`
      sobrevive a los patrones de exclusión. Si el orden se invirtió, `.env.example` no quedó
      versionado y nadie lo nota hasta el siguiente clon.
- [ ] **Re-correr el Bootstrap completo una segunda vez y verificar que sale 0.** Es la única forma
      de comprobar que el bloque es idempotente como declara. Los dos `git commit` llevan
      `--allow-empty` precisamente para esto; sin la re-corrida, esa garantía no está probada.
- [ ] **Reconciliación byte-exacta.** Cada fila de la tabla de §19.6 *Cross-artifact value
      reconciliation* revisada abriendo cada aparición — `Compared: yes` es una afirmación, no una
      intención.
- [ ] **Kill switch de §9.1 verificado.** Probar que se puede volver a la hoja de Excel como fuente
      de verdad sin perder lo ya capturado en la app.
- [ ] **Non-goals siguen sin construirse.** Nada de §20.4 se coló en v1: sin dashboards, sin reportes
      por tarjeta, sin análisis por categoría, sin multi-moneda, sin multi-usuario, sin sync bancario.
- [ ] **Variables de entorno en producción.** Las 15 de §10 presentes en Vercel, con
      `SUPABASE_SERVICE_ROLE_KEY` y `ANTHROPIC_API_KEY` fuera del repositorio y fuera del navegador.
- [ ] **Flujos e2e contra producción**, una vez, a mano: alta manual, un mensaje real por Telegram
      confirmado con `Sí`, y una subida de recibo revisada en `/revision`.
- [ ] **Las tres pasadas manuales de accesibilidad de §15** — teclado, lector de pantalla y zoom al
      200% — sobre el libro y la pantalla de revisión.
- [ ] **Rollback ejecutado una vez.** `git reset --hard` a un tag `step-*` anterior y volver, para
      comprobar que los puntos de retorno sirven de verdad.

### 20.2 Risk register

| Riesgo | Probabilidad | Impacto | Mitigación | Señal de que se materializó |
|---|---|---|---|---|
| **El parseo de PDF varía por banco** — cada banco emite un formato distinto y el extractor acierta en uno y falla en otro | Alta | Medio | Revisión humana **obligatoria** antes de escribir al libro; cobertura incremental banco por banco; un movimiento sin fecha legible se guarda con `occurred_on` nulo en vez de adivinar | Más del 5% de los pendientes de un mes rechazados por extracción errónea (§9.1 lo convierte en criterio de corte) |
| **Es la fuente de verdad del dinero** — un dato perdido o alterado no se detecta hasta que ya importa | Baja | Muy alto | Libro append-only forzado por trigger en la base, solo `deleted_at`; `audit_log` sin claves foráneas; respaldo con **restauración probada** en el gate global, no "activado" | `sh scripts/restore-check.sh` falla una sola vez — §9.1 bloquea el corte hasta demostrar la restauración |
| **El bot de Telegram es públicamente alcanzable** — cualquiera que sepa el nombre del bot puede escribirle | Media | Alto | Allowlist por `TELEGRAM_ALLOWED_CHAT_ID` con rechazo silencioso hacia el remitente y registro con `allowed=false`; verificación de `X-Telegram-Bot-Api-Secret-Token`; idempotencia por `unique (channel, provider_message_id)` | Filas en `inbound_messages` con `allowed=false` de un remitente desconocido |
| **Costo de la API de Claude por documento** — un extracto de muchas páginas cuesta más que una frase | Media | Bajo | Toda extracción pasa por un gateway único: un solo punto para medir, limitar y cambiar de modelo; un solo reintento y solo ante red o `429`; nunca reintentar un fallo de esquema | El costo mensual observado en §16 se sale de lo previsto |
| **Un reintento de webhook duplica un gasto** | Media | Alto | `unique (channel, provider_message_id)` en `inbound_messages`, verificado por el criterio 2 de E1-T6 con el mismo update entregado dos veces | Dos `transactions` con el mismo `source_ref` — imposible por el índice único, y esa es la prueba |
| **El driver de storage cae silenciosamente al local en producción** — escribiría archivos en el disco efímero de Vercel y se perderían sin ruido | Baja | Alto | El driver `supabase` **falla con un error nombrado** si falta `SUPABASE_SERVICE_ROLE_KEY`, en vez de degradar (criterio 3 de E2-T7) | Documentos subidos en producción que no se pueden releer |

### 20.3 Decision log

| Decisión | Alternativas descartadas | Por qué |
|---|---|---|
| **Telegram en v1, WhatsApp después** | WhatsApp vía Twilio; WhatsApp Cloud API directo de Meta | La WhatsApp Business API **no puede usar un número de WhatsApp personal existente**: Meta exige un número dedicado y verificación de negocio, lo que agrega días o semanas y un segundo SIM/eSIM antes de poder mandar el primer mensaje. Un bot de Telegram se configura en ~10 minutos, gratis y sin verificación. El objetivo era no bloquear el despliegue |
| **Puerto `IngestChannel` genérico desde el primer canal** | Acoplar el webhook directo a Telegram y refactorizar cuando llegue WhatsApp | El refactor "cuando llegue" nunca es barato: para entonces la lógica de negocio ya se filtró al handler. El puerto cuesta poco ahora y convierte "agregar WhatsApp" en implementar una interfaz. Dos `grep` en los gates lo hacen cumplir mecánicamente en vez de por disciplina |
| **Confirmación en el mismo chat** | Cola en la app para revisar después; confirmar solo si hay duda | Mantiene el registro en un solo paso y respeta la regla de revisión humana obligatoria. Una cola acumula pendientes que se olvidan; "solo si hay duda" rompe la garantía de que nada entra al libro sin que un humano lo vea |
| **Append-only forzado por trigger, no por convención** | Confiar en que el código solo haga soft-delete | Es la fuente de verdad del dinero. Una convención se rompe con un `prisma.transaction.delete` distraído; un trigger lanza excepción. El criterio 3 de E1-T2 lo prueba con un `DELETE` real contra la base |
| **Escritores únicos (`commit.ts`, `pending.ts`)** | Escribir desde cada acción de ruta | Centraliza la escritura de `audit_log` y la idempotencia en un lugar en vez de depender de que cada llamador se acuerde. Un `grep` en el gate de E1-T4 falla si aparece otra escritura |
| **Revisión humana obligatoria para todo `source` ≠ `manual`** | Auto-confirmar cuando la confianza del modelo sea alta | `confidence` es informativo y no habilita nada. Un modelo seguro y equivocado es el peor caso posible en un libro contable, y no hay forma de distinguirlo sin mirar |
| **Postgres local en Docker para los gates** | SQLite en tests; una base remota compartida | Los triggers append-only y los índices únicos parciales son específicos de Postgres: probarlos en SQLite probaría otra cosa. Una base remota hace que los gates dependan de la red |
| **Prisma como ORM** | SQL crudo; Drizzle | DX para un solo dev, migraciones maduras y Studio para mirar los datos a mano — que en una herramienta personal se hace seguido |
| **El id del modelo solo por variable de entorno** | Fijarlo en el código | Un id escrito a mano envejece y ata el repositorio a un modelo. El gate de E1-T5 falla si aparece `claude-`, `sonnet`, `opus` o `haiku` en `src` |
| **`channel` como `text` y no enum** | Enum de Postgres | Agregar WhatsApp no debe requerir una migración |
| **Decision: bumped `next` 16.2.12→16.3.3, `@supabase/supabase-js` 2.110.9→2.112.4, `@prisma/client`/`prisma` 7.9.1→7.10.0, `@biomejs/biome` 2.5.5→2.5.11, `vitest` 4.1.10→4.1.11, `@playwright/test` 1.62.0→1.62.1, `tsx` 4.23.1→4.23.12, `@types/react`/`@types/react-dom` 19.2.17/19.2.3→19.2.18/19.2.5, `shadcn` CLI 4.16.0→4.19.0, Node.js 24.18.0→24.20.0, pnpm 11.17.0→11.24.0** | Mantener los pines de la caché del runtime track (verificada 2026-07-27) | Why: registry drift, verificado 2026-08-28 contra registro en vivo por `stack-researcher` (`/the-architect:architect-refresh`). Ningún salto cruza un major ni rompe el peer range de `next` contra `react`. Would reverse if: algún bump rompe `pnpm install --frozen-lockfile` o cualquier `Verify` de §9 al reconstruir el lockfile |
| **Decision: bumped `@anthropic-ai/sdk` 0.115.0→0.122.0** | Mantener 0.115.0 hasta auditar el changelog a mano | Why: registry drift, verificado 2026-08-28. Es un paquete 0.x — un salto de minor puede romper el contrato de API igual que un major, y esta pasada no auditó el changelog línea por línea. Would reverse if: el extractor de texto libre (paso 5) empieza a fallar el esquema zod tras el bump — revertir a 0.115.0 y auditar el changelog antes de reintentar |
| **Decision: added `exceljs@4.4.0` como pin real** (antes `UNVERIFIED`, sin pin) | Dejarlo sin pin para que el lockfile decida; migrar a `xlsx`/`sheetjs` | Why: es la única versión estable publicada — sin release desde 2023-10-19 (~34 meses), posiblemente sin mantenimiento activo. Radio de impacto bajo: un solo consumidor (paso 13, importación única del Excel). Would reverse if: el paquete deja de instalar bajo el Node/pnpm pinned, o aparece una alternativa mantenida antes de ejecutar el paso 13 |
| **Decision: hold `typescript` en `~6.0.3`, no bump a 7.x** | Mover el track default a TypeScript 7.0.2 (ya estable, ya no exige `experimental.useTypeScriptCli` en Next 16.3+) | Why: registry drift, verificado 2026-08-28 — TS 7.0.2 es genuinamente `latest` estable, pero la propia documentación de Next lo sigue llamando "experimental… no recomendado para producción". Would reverse if: Next retira esa advertencia o el modo CLI de TS7 sale de experimental |
| **Decision: hold `postgres` (Docker) en `17-alpine`, no bump a `18-alpine`** | Mover a `18-alpine`, ya publicada y mantenida | Why: registry drift, verificado 2026-08-28 — no hay razón de compatibilidad que fuerce el salto; `17-alpine` sigue con push activo (2026-08-16). Would reverse if: `17-alpine` deja de recibir parches de seguridad, o Supabase en producción se mueve a Postgres 18 |
| **Decision: `prisma` CLI pinneado exacto en 7.10.0, nunca `@latest`** | `pnpm add -D prisma@latest` | Why: registry drift, verificado 2026-08-28 — el dist-tag `latest` de la CLI resuelve hoy a un release candidate (`8.0.0-rc.12`) fuera de lockstep con `@prisma/client` estable; instalarlo sin pin exacto rompería el cliente generado. Would reverse if: Prisma publica 8.x estable y CLI + cliente coinciden en esa línea |
| **Decision: `proxy.ts` vive en `src/proxy.ts`, no en la raíz del repo** | Dejarlo en la raíz como decía el blueprint original | Why: descubierto al ejecutar el paso 1 (build real) — con `--src-dir` (fijado en §10 Bootstrap), Next 16.3.3 solo detecta `proxy.ts` al mismo nivel que `app/`; en la raíz el build lo ignora en silencio (`ƒ Proxy (Middleware)` no aparece en `next build`, y `/` no redirige a `/login`, rompiendo el smoke test del paso 1). Corregido en §3, §9 (pasos 1 y 3), el epic 01 y `tasks.json` (E1-T1, E1-T3). Would reverse if: un scaffold futuro deja de usar `--src-dir` |
| **Decision: `prisma.config.ts` nuevo en la raíz; `schema.prisma` sin `url`/`directUrl`; `src/server/db/client.ts` usa `@prisma/adapter-pg` + `pg`** | Mantener `url`/`directUrl` inline en `datasource` como en la plantilla original de §4, y `new PrismaClient()` sin adapter | Why: descubierto al ejecutar el paso 2 (build real) — Prisma 7 (ya pinneado en §11 antes de este refresh) rechaza `url`/`directUrl` en `schema.prisma` (`P1012`) y `new PrismaClient()` vacío no conecta: exige un driver adapter explícito. No es un efecto del bump de versiones — Prisma 7.x completo tiene este requisito. Corregido en §9 paso 2, el epic 01 y `tasks.json` (E1-T2, `files` gana `prisma.config.ts`). `@prisma/adapter-pg` y `pg` van a §11 como pines nuevos, versión 7.10.0 y 8.23.0 respectivamente (resueltas por el lockfile en esta sesión, no verificadas contra registro por `stack-researcher`). Would reverse if: una versión futura de Prisma 7 vuelve a aceptar conexión inline sin adapter |
| **Decision: el guard check de §9 paso 2 espera `test $? -eq 1`, no `eq 3`, para `psql -c ... -v ON_ERROR_STOP=1`** | Dejar `eq 3` como decía el blueprint original | Why: descubierto al ejecutar el paso 2 contra Postgres 17 real — el código de salida 3 de psql ("error de script bajo `ON_ERROR_STOP`") solo aplica al modo `-f` (archivo); en modo `-c` (comando inline, el que usan estas dos líneas) un error SQL cae en el código 1 genérico. Confirmado corriendo ambas formas. Sin esta corrección el gate del paso 2 queda rojo para siempre pase lo que pase. Corregido en §9 paso 2, el epic 01 y `tasks.json` (E1-T2, acceptance + verify). Would reverse if: se cambia a `-f`/stdin en vez de `-c`, donde sí aplica el código 3 |
| **Decision: `@prisma/client-runtime-utils@7.10.0` pinneado como dependencia directa, instalado en el paso 2** | No instalarlo — dejar que quede como dependencia transitiva de `@prisma/client` | Why: descubierto al ejecutar `pnpm build` en el paso 3 (bug latente del paso 2 — ningún comando de su propio `Verify` corre `pnpm build`) — con `output` del cliente generado apuntando fuera de `node_modules` (`src/generated/prisma`), pnpm en modo estricto no le expone las dependencias transitivas del runtime de `@prisma/client`; sin este pin directo, `pnpm build` falla con `Module not found: Can't resolve '@prisma/client-runtime-utils'`. Corregido en §9 paso 2 (Do y §11) y el epic 01. Would reverse if: Prisma deja de dividir el runtime en un paquete separado, o pnpm cambia cómo resuelve `output` fuera de `node_modules` |
| **Decision: `tsconfig.json` sube `target` de `ES2017` a `ES2020`** | Dejar el `ES2017` que trae el andamio de `create-next-app` | Why: descubierto al ejecutar el paso 2 (build real) — `amount_cents` es `bigint` en todo el diseño (§4, §7) y los literales `0n` que eso implica no compilan bajo `ES2017` (`tsc` los rechaza con `TS2737`). El bump es puramente del type-checker: Next/SWC ya compilaba sintaxis moderna sin mirar este campo. Afecta a todo paso que escriba un literal `bigint`, no solo al 2. Would reverse if: el diseño deja de usar `bigint` para dinero |
| **Decision: el grep de "único escritor" del paso 4 lleva `--exclude-dir=generated`** | Dejar `grep -rln --include=*.ts -e ... src` sin excluir nada, como decía el blueprint original | Why: descubierto al ejecutar el paso 4 (build real) — el `.d.ts` que emite `prisma generate` en `src/generated/prisma/` trae ejemplos en sus comentarios TSDoc con `prisma.transaction.create(...)` literal; sin la exclusión, el grep encuentra ese archivo generado además de `commit.ts` y el gate queda rojo para siempre pase lo que pase, aunque ningún código propio viole la regla. Confirmado corriendo el comando contra el cliente generado real. Corregido en §9 paso 4, el epic 01 y `tasks.json` (E1-T4, acceptance + verify). Would reverse if: Prisma deja de incluir ejemplos de uso en los comentarios de sus tipos generados |
| **Decision: `extract-free-text.ts` asume hoy cuando el modelo no devuelve `occurredOn`, nunca `null`** | Dejar `occurredOn: null` cuando el modelo no lo determina, como sugería la lectura literal del paso 5 | Why: descubierto al ejecutar el paso 7 (build real, extremo a extremo) — un mensaje como "pagué el club de tiro" sin fecha explícita implica "ahora", no "indeterminado"; dejarlo `null` hace que `commitPending` (paso 4) rechace la confirmación con `validation_failed` en silencio, porque esa función exige `occurredOn`. El caso feliz completo (extracción → "sí" → transacción) nunca se había ejercitado hasta este paso, así que el bug estaba latente desde el paso 5. Corregido en §9 paso 5 (Do) y el epic 01. Would reverse if: el producto necesita distinguir "sin fecha" de "hoy" como estados distintos en la revisión |
| **Decision: la llamada a `processMessage` en el webhook va envuelta en `try/catch`** | Dejar que un error del pipeline (por ejemplo, `ANTHROPIC_API_KEY` ausente) se propague sin capturar, como hacía la primera versión del paso 7 | Why: descubierto al correr la suite completa después del paso 7 — con la llamada sin envolver, `tests/integration/telegram-webhook.test.ts` (paso 6) empezó a fallar con un 500 no capturado en cuanto el paso 7 conectó el pipeline, porque este entorno no tiene una clave real de Anthropic configurada. Más allá del entorno de prueba, es el comportamiento correcto en producción: `inbound_messages` ya quedó escrito, que es lo único que le importa a Telegram, y un `500` aquí dispara reintentos infinitos en vez de una respuesta limpia. Corregido en §9 paso 7 (Do) y el epic 01. Would reverse if: el webhook necesita que un fallo de pipeline sea visible como error HTTP para alguna integración futura |
| **Decision: `globals.css` mantiene los tokens de §7 como fuente única, con alias hacia los nombres de shadcn — nunca la paleta oklch por defecto del CLI** | Dejar la paleta que escribe `shadcn init` (o borrarla sin reemplazo) | Why: descubierto al ejecutar el paso 1 de la Epic 2 (build real) — `shadcn init` (§10 Bootstrap) inyecta su propio `@theme inline` con nombres estándar (`--background`, `--primary`, `--muted`, …) apuntando a un bloque `:root`/`.dark` en oklch, y ese bloque se declara *después* del `@theme` de §7 en el archivo, así que gana la cascada: el azul `#2563EB` de la marca, el fondo, el texto y el foco quedaban silenciosamente reemplazados por la escala de grises por defecto de shadcn. También reintroduce `next/font/google` (Geist) en `layout.tsx`, que §7 prohíbe explícitamente. La causa raíz es de ordenamiento: el Bootstrap corre `shadcn init` *antes* del paso 1, así que cualquier ejecución fiel de este blueprint con red disponible desde el arranque choca con esto — no es un efecto de haber diferido `shadcn init` por el bloqueo de TLS de esta sesión. Corregido en §9 paso 1 (Do), con el patrón de alias documentado ahí mismo. Would reverse if: el proyecto adopta la paleta de shadcn en vez de los tokens medidos de §7 |
| **Decision: `proxy.ts` consulta `e2eBypassUserId()` antes de mirar la cookie de sesión** | Dejar `e2eBypassUserId()` definida y probada en aislamiento pero sin llamar desde ningún lado, como quedó tras el paso 3 | Why: descubierto al escribir el primer test e2e real (paso 8) — sin esta línea, la función existe y sus 5 tests unitarios pasan, pero **nada la invoca jamás**; todo test e2e de todo epic posterior habría fallado en el redirect a `/login`, porque no hay Supabase real en este entorno. Corrección retroactiva al paso 3: el hueco no era visible hasta que un test e2e real necesitó atravesar el guard. Corregido en §9 paso 3 (Do) y el epic 01 (E1-T3). Would reverse if: los tests e2e migran a autenticarse contra un Supabase real en vez de un bypass |
| **Decision: `softDelete` vive en `src/server/ledger/commit.ts`, no en `src/app/(app)/actions.ts`** | Escribir el `UPDATE` de `deleted_at` directo desde la acción de ruta, como sugería una lectura superficial del contrato "read-only" del epic 2 | Why: descubierto al construir el paso 8 — `commit.ts` es el único escritor de `transactions` (regla de `database.md`, forzada por el `grep` que el paso 4 dejó viviendo para siempre en `src`); un `UPDATE` fuera de ese archivo la rompe. El contrato "read-only" del epic 2 sobre `commit.ts` significa no reescribir `createManual`/`commitPending`, no que el archivo esté congelado para siempre. Corregido en §9 paso 8 (Do) y el epic 02. Would reverse if: el proyecto abandona la regla de escritor único |
| **Decision: no se construye un `ThemeToggle`** | Inventar un selector de tema manual porque el paso 8 lo nombra de pasada | Why: descubierto al construir el paso 8 — el "ThemeToggle" que mencionaba el `Do` de este paso no está especificado en ningún lado: §7 solo pide `prefers-color-scheme` (ya cableado desde el paso 1), §3 no lista el componente, y ningún criterio de aceptación lo exige. Construir uno habría sido inventar paleta de estados, mecanismo de persistencia e interacción — una decisión de diseño, no una de build. Corregido en §9 paso 8 (Do) y el epic 02 (nota explícita de la omisión). Would reverse if: una pasada futura de `/architect` especifica el componente de verdad |
| **Decision: los tests e2e resetean `transactions`/`pending_transactions` con `TRUNCATE ... CASCADE`, no con `DELETE`** | Usar `DELETE FROM transactions` para limpiar estado entre tests | Why: descubierto al correr el primer test e2e — `transactions` es append-only por trigger (`DELETE` está prohibido por diseño, es la garantía central del producto), así que ni un test puede borrar filas con `DELETE`. `TRUNCATE` no dispara triggers `BEFORE DELETE` en Postgres, así que es la única forma de resetear una base de test efímera sin tocar esa garantía. Corregido en `tests/e2e/ledger.spec.ts` y documentado en el epic 02 — cualquier spec e2e futuro que necesite una base limpia debe usar el mismo patrón. Would reverse if: se agrega un `ON TRUNCATE` trigger a `transactions` para cerrar este escape (ningún plan actual lo requiere) |
| **Decision: `tests/fixtures/receipt-sample.png` y `tests/fixtures/historical-sample.xlsx` van al `.gitignore`, no se commitean** | Commitear los binarios generados, como sugería una lectura literal de "`tests/fixtures/*` ... no lo alcanza ningún patrón" en §10 | Why: descubierto al ejecutar el primer `pnpm fixtures` real (paso 8) — estos dos archivos son bytes derivados, determinísticos, que `build-fixtures.ts` regenera en cada corrida (y `global-setup.ts` ya invoca antes de toda suite e2e); commitearlos solo produce diffs binarios sin valor en cada build. Las fuentes de verdad (`build-fixtures.ts`, `receipt-sample.png.base64`, `statement-sample.pdf`) sí se commitean y no cambian. Corregido en §10 (la fila de "Files that must be committed" ahora distingue fuentes de derivados) y en el `.gitignore` que emite el Bootstrap. Would reverse if: una suite deja de regenerar los fixtures antes de correr |
| **Decision: `schema.test.ts` (paso 2) cuenta cuentas y categorías sembradas por nombre, no el total del usuario** | Dejar `prisma.account.count({ where: { userId } })` esperando exactamente 4, como se escribió originalmente | Why: descubierto al construir el paso 9 (build real) — ese conteo total solo era correcto por coincidencia mientras ningún otro código creaba cuentas; en cuanto `catalog.ts` (paso 9) le dio a la app una forma real de crear cuentas, la suite completa empezó a fallar con "expected 4, got 15" porque los tests de `accounts.test.ts` y `cuentas.spec.ts` (legítimamente) agregan filas. El criterio de aceptación original — "sembrar dos veces no duplica" — siempre fue sobre la idempotencia del seed, no sobre el total de filas del usuario; el test ahora filtra por los nombres exactos que siembra `seed.ts` (`cuenta de ahorros`, `cuenta corriente`, …), que es lo que realmente hacía falta probar. Corrección retroactiva al paso 2. Would reverse if: se decide que ningún otro código puede crear cuentas jamás (contradice el propósito del paso 9) |

### 20.4 What to build next

Los Non-Goals de §1, en el orden en que conviene atacarlos una vez que v1 lleve un mes siendo la
fuente de verdad:

1. **Resumen visual: cuánto entró vs. cuánto salió.** El más pedido y el más barato: los datos ya
   están, `direction` y `occurred_on` ya se capturan. Es una consulta agregada y una pantalla.
2. **Análisis por categoría de gasto.** `category_id` **se captura desde v1** precisamente para que
   esto no requiera recapturar el histórico. Es graficar lo que ya existe.
3. **Reportes por tarjeta de crédito.** Necesita un poco más: el concepto de corte y de ciclo de
   facturación, que hoy no está modelado.
4. **Adaptador de WhatsApp sobre el puerto `IngestChannel`.** Cuando exista el número dedicado y la
   verificación de negocio de Meta. La skill `add-ingest-channel` (§19.4) es el procedimiento; el
   core no se toca, y las dos garantías obligatorias (allowlist e idempotencia) ya están definidas.
5. **Multi-moneda.** `accounts.currency` existe desde v1 para que esto sea una migración y no una
   reescritura. v1 solo escribe `COP`.

**Fuera del alcance incluso después:** multi-usuario (cambia el modelo de auth entero y no hay
segundo usuario a la vista) y sync automático con el banco (depende de un agregador de terceros con
sus propios costos, riesgos de credenciales y cobertura irregular en Colombia).

### Post-build launch checklist

No son tareas del build: dependen de terceros y por eso no pueden ser gates de `tasks.json`.

- [ ] Crear el bot con **@BotFather** en Telegram y guardar el token en `TELEGRAM_BOT_TOKEN`.
- [ ] Obtener el chat id propio escribiéndole a **@userinfobot** y guardarlo en `TELEGRAM_ALLOWED_CHAT_ID`.
- [ ] Crear el proyecto de Supabase; copiar URL, `anon key` y `service_role` al entorno de Vercel.
- [ ] Crear el usuario único en Supabase Auth y poner su `auth.users.id` real en `APP_USER_ID`.
- [ ] Verificar cada versión marcada `UNVERIFIED` en §11 contra el registro antes de instalar
      (`/the-architect:architect-refresh` lo hace de una pasada).
- [ ] Configurar las variables de entorno en Vercel y desplegar.
- [ ] Correr `pnpm exec tsx scripts/set-telegram-webhook.ts` con `PRODUCTION_URL` ya apuntando al
      despliegue.
- [ ] Mandar un mensaje real de prueba desde Telegram y confirmarlo, extremo a extremo.
- [ ] Programar el respaldo recurrente y **ejecutar una restauración real** antes de confiarle el
      histórico.
- [ ] Mantener el doble registro (app + hoja de Excel) hasta que §9.1 dé el corte por cumplido.
