import { promises as fs } from "node:fs";
import path from "node:path";
import { env, requireSupabaseStorage } from "../../lib/env";

// Abstrae el driver de almacenamiento detras de putObject/getObject.
// 'supabase' es un stub hasta el paso 14: implementarlo ahora exigiria
// SUPABASE_SERVICE_ROLE_KEY, que §10 marca como requerida recien desde ese
// paso, y romper eso rompería los gates anteriores.

export async function putObject(
  key: string,
  bytes: Buffer,
  mimeType: string,
): Promise<void> {
  if (env.STORAGE_DRIVER === "local") {
    const filePath = path.join(env.STORAGE_LOCAL_DIR, key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, bytes);
    return;
  }
  requireSupabaseStorage();
  throw new Error(
    `internal: driver de almacenamiento 'supabase' no implementado hasta el paso 14 (mimeType=${mimeType})`,
  );
}

export async function getObject(key: string): Promise<Buffer> {
  if (env.STORAGE_DRIVER === "local") {
    const filePath = path.join(env.STORAGE_LOCAL_DIR, key);
    return fs.readFile(filePath);
  }
  requireSupabaseStorage();
  throw new Error(
    "internal: driver de almacenamiento 'supabase' no implementado hasta el paso 14",
  );
}
