"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "../../../lib/auth/guard";
import type { Result } from "../../../lib/result";
import {
  archiveAccount,
  createAccount,
  renameAccount,
} from "../../../server/ledger/catalog";

const KIND_VALUES = ["savings", "checking", "cash", "credit_card"] as const;

const createSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(KIND_VALUES),
});

export async function createAccountAction(
  formData: FormData,
): Promise<Result<null>> {
  const user = await requireUser();
  if (!user.ok) return user;

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "validation_failed", message: "Revisa los campos." },
    };
  }

  const result = await createAccount(
    user.data,
    parsed.data.name,
    parsed.data.kind,
  );
  if (!result.ok) return result;

  revalidatePath("/cuentas");
  return { ok: true, data: null };
}

const renameSchema = z.object({
  accountId: z.string().min(1),
  name: z.string().min(1),
});

export async function renameAccountAction(
  formData: FormData,
): Promise<Result<null>> {
  const user = await requireUser();
  if (!user.ok) return user;

  const parsed = renameSchema.safeParse({
    accountId: formData.get("accountId"),
    name: formData.get("name"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "validation_failed", message: "Revisa los campos." },
    };
  }

  const result = await renameAccount(
    user.data,
    parsed.data.accountId,
    parsed.data.name,
  );
  if (!result.ok) return result;

  revalidatePath("/cuentas");
  return { ok: true, data: null };
}

export async function archiveAccountAction(
  accountId: string,
): Promise<Result<null>> {
  const user = await requireUser();
  if (!user.ok) return user;

  const result = await archiveAccount(user.data, accountId);
  if (!result.ok) return result;

  revalidatePath("/cuentas");
  return { ok: true, data: null };
}
