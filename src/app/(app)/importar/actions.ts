"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "../../../lib/auth/guard";
import type { Result } from "../../../lib/result";
import type { ImportReport } from "../../../server/ingest/import-excel";
import { importExcel } from "../../../server/ingest/import-excel";

export async function importExcelAction(
  formData: FormData,
): Promise<Result<ImportReport>> {
  const user = await requireUser();
  if (!user.ok) return user;

  const accountId = formData.get("accountId");
  if (typeof accountId !== "string" || accountId.length === 0) {
    return {
      ok: false,
      error: { code: "validation_failed", message: "Selecciona una cuenta." },
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return {
      ok: false,
      error: { code: "validation_failed", message: "Selecciona un archivo." },
    };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const report = await importExcel(user.data, accountId, bytes);

  revalidatePath("/");
  return { ok: true, data: report };
}
