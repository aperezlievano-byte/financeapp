import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { env, requireSupabaseStorage } from "../../lib/env";

// Abstrae el driver de almacenamiento detras de putObject/getObject.
// 'local' escribe bajo STORAGE_LOCAL_DIR (dev y tests). 'supabase' (paso 14)
// escribe en Supabase Storage -- requireSupabaseStorage() se llama SIEMPRE
// primero y ANTES de tocar la red, para que un SUPABASE_SERVICE_ROLE_KEY
// ausente falle con un error nombrado en vez de cualquier otra cosa (nunca
// cae de vuelta al driver local: no hay ninguna rama que lo permita).

const SUPABASE_STORAGE_BUCKET = "documents";

function supabaseStorageClient() {
  const { SUPABASE_SERVICE_ROLE_KEY } = requireSupabaseStorage();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

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

  const client = supabaseStorageClient();
  const { error } = await client.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .upload(key, bytes, { contentType: mimeType, upsert: false });
  if (error) {
    throw new Error(
      `internal: Supabase Storage upload falló: ${error.message}`,
    );
  }
}

export async function getObject(key: string): Promise<Buffer> {
  if (env.STORAGE_DRIVER === "local") {
    const filePath = path.join(env.STORAGE_LOCAL_DIR, key);
    return fs.readFile(filePath);
  }

  const client = supabaseStorageClient();
  const { data, error } = await client.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .download(key);
  if (error || !data) {
    throw new Error(
      `internal: Supabase Storage download falló: ${error?.message ?? "sin datos"}`,
    );
  }
  return Buffer.from(await data.arrayBuffer());
}
