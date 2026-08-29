"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "../../../lib/auth/guard";
import type { Result } from "../../../lib/result";
import { extractReceipt } from "../../../server/ingest/extract-document";

export async function uploadReceiptAction(
  formData: FormData,
): Promise<Result<{ documentId: string; pendingId: string }>> {
  const user = await requireUser();
  if (!user.ok) return user;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return {
      ok: false,
      error: { code: "validation_failed", message: "Selecciona un archivo." },
    };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const result = await extractReceipt({
    userId: user.data,
    filename: file.name,
    mimeType: file.type,
    bytes,
  });
  if (!result.ok) return result;

  revalidatePath("/revision");
  return result;
}
