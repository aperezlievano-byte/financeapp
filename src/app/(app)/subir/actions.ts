"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "../../../lib/auth/guard";
import type { Result } from "../../../lib/result";
import { extractReceipt } from "../../../server/ingest/extract-document";
import { processStatement } from "../../../server/ingest/statement-batch";

// El formulario es uno solo: la interfaz no le pide al usuario que declare
// si sube un recibo o un extracto, así que el mimeType decide. Un PDF es
// siempre un extracto bancario (statement-batch.ts, muchos movimientos); una
// imagen es siempre un recibo (extract-document.ts, uno solo). extractReceipt
// sigue aceptando application/pdf como entrada válida para quien la llame
// directo (no hay ningún acceptance de ningún paso que pida lo contrario),
// pero ese camino no es alcanzable desde este formulario.
export async function uploadReceiptAction(
  formData: FormData,
): Promise<
  Result<
    | { documentId: string; pendingId: string }
    | { documentId: string; pendingIds: string[] }
  >
> {
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

  const result =
    file.type === "application/pdf"
      ? await processStatement({
          userId: user.data,
          filename: file.name,
          bytes,
        })
      : await extractReceipt({
          userId: user.data,
          filename: file.name,
          mimeType: file.type,
          bytes,
        });
  if (!result.ok) return result;

  revalidatePath("/revision");
  return result;
}
