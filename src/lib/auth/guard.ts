import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { env, readE2E } from "../env";
import type { Result } from "../result";

export const ACCESS_COOKIE = "pfa_at";
export const REFRESH_COOKIE = "pfa_rt";

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
};

function supabaseClient() {
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

// Nunca trata un error de red (Supabase inalcanzable) como sesion valida:
// ambos casos -- token invalido y falla de red -- devuelven null por igual.
export async function resolveSession(
  accessToken: string,
): Promise<{ userId: string } | null> {
  try {
    const { data, error } = await supabaseClient().auth.getUser(accessToken);
    if (error || !data.user) {
      return null;
    }
    return { userId: data.user.id };
  } catch {
    return null;
  }
}

export async function refreshSession(refreshToken: string): Promise<{
  userId: string;
  accessToken: string;
  refreshToken: string;
} | null> {
  try {
    const { data, error } = await supabaseClient().auth.refreshSession({
      refresh_token: refreshToken,
    });
    if (error || !data.session || !data.user) {
      return null;
    }
    return {
      userId: data.user.id,
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    };
  } catch {
    return null;
  }
}

// Se activa solo si las tres condiciones se cumplen a la vez. E2E_USER_ID y
// E2E_DATABASE_URL no pueden llegar por ningun .env (§10), asi que la unica
// forma de que esto sea verdad es que playwright.config.ts las haya puesto.
export function e2eBypassUserId(): string | null {
  const { E2E_USER_ID, E2E_DATABASE_URL } = readE2E();

  if (!E2E_USER_ID) return null;
  if (!env.DATABASE_URL.endsWith("_test")) return null;
  if (env.DATABASE_URL !== E2E_DATABASE_URL) return null;

  return E2E_USER_ID;
}

// No confia en x-user-id sin compararla con APP_USER_ID: proxy.ts la escribe,
// pero cada server action vuelve a verificarla (las server actions son POSTs
// a su propia ruta, y un matcher que excluye una ruta salta su proteccion).
export async function requireUser(): Promise<Result<string>> {
  const headerList = await headers();
  const userId = headerList.get("x-user-id");

  if (!userId) {
    return {
      ok: false,
      error: { code: "unauthorized", message: "No hay sesión activa." },
    };
  }

  if (userId !== env.APP_USER_ID) {
    return {
      ok: false,
      error: { code: "forbidden", message: "No autorizado." },
    };
  }

  return { ok: true, data: userId };
}
