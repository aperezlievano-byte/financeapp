"use server";

import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  SESSION_COOKIE_OPTIONS,
} from "../../lib/auth/guard";
import { env } from "../../lib/env";
import type { Result } from "../../lib/result";

const signInSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

export type SignInState = Result<null> | null;

export async function signIn(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "validation_failed",
        message: "Correo o contraseña incorrectos.",
      },
    };
  }

  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.session) {
    return {
      ok: false,
      error: {
        code: "unauthorized",
        message: "Correo o contraseña incorrectos.",
      },
    };
  }

  const cookieStore = await cookies();
  cookieStore.set(
    ACCESS_COOKIE,
    data.session.access_token,
    SESSION_COOKIE_OPTIONS,
  );
  cookieStore.set(
    REFRESH_COOKIE,
    data.session.refresh_token,
    SESSION_COOKIE_OPTIONS,
  );

  redirect("/");
}

export async function signOut(): Promise<void> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;

  if (accessToken) {
    const supabase = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
    try {
      await supabase.auth.signOut();
    } catch {
      // las cookies se borran igual aunque signOut falle
    }
  }

  cookieStore.delete(ACCESS_COOKIE);
  cookieStore.delete(REFRESH_COOKIE);
  redirect("/login");
}
