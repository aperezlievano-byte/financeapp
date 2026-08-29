import { z } from "zod";

// El unico archivo que lee process.env (regla de CLAUDE.md). El conjunto
// obligatorio se valida al importar; el resto queda detras de funciones que
// lanzan solo cuando el llamador realmente los necesita, para que un paso
// posterior (Anthropic, Telegram, Supabase Storage) no rompa este gate.

const requiredEnvSchema = z.object({
  APP_USER_ID: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  DIRECT_DATABASE_URL: z.string().min(1),
  TEST_DATABASE_URL: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  STORAGE_DRIVER: z.enum(["local", "supabase"]),
  STORAGE_LOCAL_DIR: z.string().min(1),
});

function parse<T>(schema: z.ZodType<T>, label: string): T {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues
      .map((issue) => String(issue.path[0]))
      .join(", ");
    throw new Error(
      `${label}: variables de entorno invalidas o ausentes: ${missing}`,
    );
  }
  return result.data;
}

export const env = parse(requiredEnvSchema, "env");

const anthropicSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL_ID: z.string().min(1),
});

export function requireAnthropic() {
  return parse(anthropicSchema, "requireAnthropic");
}

const telegramSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1),
  TELEGRAM_ALLOWED_CHAT_ID: z.string().min(1),
});

export function requireTelegram() {
  return parse(telegramSchema, "requireTelegram");
}

const supabaseStorageSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export function requireSupabaseStorage() {
  return parse(supabaseStorageSchema, "requireSupabaseStorage");
}

// E2E_USER_ID y E2E_DATABASE_URL nunca estan en .env.example ni en .env a
// proposito (§10): las define solo playwright.config.ts, para que el bypass
// de autenticacion de e2e no pueda activarse contra la base real. Por eso son
// opcionales y su ausencia no es un error -- a diferencia de las funciones
// require*() de arriba.
const e2eSchema = z.object({
  E2E_USER_ID: z.string().optional(),
  E2E_DATABASE_URL: z.string().optional(),
});

export function readE2E() {
  return parse(e2eSchema, "readE2E");
}
