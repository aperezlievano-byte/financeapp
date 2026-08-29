import { requireUser } from "../../../lib/auth/guard";
import { uploadReceiptAction } from "./actions";

async function handleUpload(formData: FormData): Promise<void> {
  "use server";
  await uploadReceiptAction(formData);
}

const FOCUS_RING =
  "rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export default async function SubirPage() {
  const user = await requireUser();
  if (!user.ok) {
    return null;
  }

  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-8 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold text-fg">Subir recibo</h1>
      <form action={handleUpload} className="flex flex-col gap-4">
        <label htmlFor="file" className="text-sm font-medium text-fg-muted">
          Archivo (PNG, JPEG o PDF, máx. 10 MB)
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept="image/png,image/jpeg,application/pdf"
          required
          className={`rounded-md border border-border-input bg-background px-3 py-2 text-fg ${FOCUS_RING}`}
        />
        <button
          type="submit"
          className={`w-fit rounded-md bg-primary px-4 py-2 font-medium text-primary-fg ${FOCUS_RING}`}
        >
          Subir
        </button>
      </form>
    </div>
  );
}
