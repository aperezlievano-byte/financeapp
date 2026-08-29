import { requireTelegram } from "../../lib/env";

// Llamadas HTTP a la API de Telegram con fetch nativo. Nunca importado fuera
// de src/server/telegram/** y src/server/ingest/telegram.ts.

const TELEGRAM_API_BASE = "https://api.telegram.org";

export async function sendMessage(chatId: string, text: string): Promise<void> {
  const { TELEGRAM_BOT_TOKEN } = requireTelegram();

  const response = await fetch(
    `${TELEGRAM_API_BASE}/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    },
  );

  if (!response.ok) {
    throw new Error(`Telegram sendMessage falló: ${response.status}`);
  }
}

export async function getFile(fileId: string): Promise<{ filePath: string }> {
  const { TELEGRAM_BOT_TOKEN } = requireTelegram();

  const response = await fetch(
    `${TELEGRAM_API_BASE}/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`,
  );

  if (!response.ok) {
    throw new Error(`Telegram getFile falló: ${response.status}`);
  }

  const body = (await response.json()) as { result: { file_path: string } };
  return { filePath: body.result.file_path };
}

export async function downloadFile(
  filePath: string,
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const { TELEGRAM_BOT_TOKEN } = requireTelegram();

  const response = await fetch(
    `${TELEGRAM_API_BASE}/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`,
  );

  if (!response.ok) {
    throw new Error(`Telegram downloadFile falló: ${response.status}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const mimeType =
    response.headers.get("content-type") ?? "application/octet-stream";
  return { bytes, mimeType };
}
