"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "../../../lib/auth/guard";
import type { Result } from "../../../lib/result";
import { commitPending, rejectPending } from "../../../server/ledger/commit";

export async function confirmPendingAction(
  pendingId: string,
): Promise<Result<{ transactionId: string }>> {
  const user = await requireUser();
  if (!user.ok) return user;

  const result = await commitPending(pendingId, user.data);
  if (!result.ok) return result;

  revalidatePath("/revision");
  return result;
}

export async function rejectPendingAction(
  pendingId: string,
): Promise<Result<null>> {
  const user = await requireUser();
  if (!user.ok) return user;

  const result = await rejectPending(pendingId, user.data);
  if (!result.ok) return result;

  revalidatePath("/revision");
  return result;
}
