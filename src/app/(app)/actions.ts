"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "../../lib/auth/guard";
import { pesosToCents } from "../../lib/money";
import type { Result } from "../../lib/result";
import { createManual, softDelete } from "../../server/ledger/commit";

const createSchema = z.object({
  description: z.string().min(1),
  amountPesos: z.string().min(1),
  direction: z.enum(["in", "out"]),
  accountId: z.string().min(1),
  categoryId: z.string().min(1).optional(),
  occurredOn: z.string().min(1),
});

export async function createTransaction(
  formData: FormData,
): Promise<Result<null>> {
  const user = await requireUser();
  if (!user.ok) return user;

  const parsed = createSchema.safeParse({
    description: formData.get("description"),
    amountPesos: formData.get("amountPesos"),
    direction: formData.get("direction"),
    accountId: formData.get("accountId"),
    categoryId: formData.get("categoryId") || undefined,
    occurredOn: formData.get("occurredOn"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "validation_failed",
        message: "Revisa los campos del formulario.",
      },
    };
  }

  let amountCents: bigint;
  try {
    amountCents = pesosToCents(parsed.data.amountPesos);
  } catch {
    return {
      ok: false,
      error: { code: "validation_failed", message: "El monto no es válido." },
    };
  }

  const result = await createManual({
    userId: user.data,
    accountId: parsed.data.accountId,
    categoryId: parsed.data.categoryId ?? null,
    occurredOn: new Date(parsed.data.occurredOn),
    description: parsed.data.description,
    amountCents,
    direction: parsed.data.direction,
  });

  if (!result.ok) return result;

  revalidatePath("/");
  return { ok: true, data: null };
}

export async function deleteTransaction(
  transactionId: string,
): Promise<Result<null>> {
  const user = await requireUser();
  if (!user.ok) return user;

  const result = await softDelete(transactionId, user.data);
  if (!result.ok) return result;

  revalidatePath("/");
  return result;
}
