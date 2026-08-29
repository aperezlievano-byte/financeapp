import { requireProductionUrl, requireTelegram } from "../src/lib/env";
import { getWebhookInfo, setWebhook } from "../src/server/telegram/client";

// Registra el webhook de Telegram contra PRODUCTION_URL y no sale 0 hasta
// que getWebhookInfo confirme que la URL registrada es exactamente la
// esperada -- registrar no es lo mismo que Telegram haber aceptado.

async function main(): Promise<void> {
  const { PRODUCTION_URL } = requireProductionUrl();
  const { TELEGRAM_WEBHOOK_SECRET } = requireTelegram();
  const expectedUrl = `${PRODUCTION_URL}/api/webhooks/telegram`;

  await setWebhook(expectedUrl, TELEGRAM_WEBHOOK_SECRET);

  const info = await getWebhookInfo();
  if (info.url !== expectedUrl) {
    console.error(
      `Webhook registrado como "${info.url}", se esperaba "${expectedUrl}".`,
    );
    process.exit(1);
  }

  console.log(`Webhook confirmado: ${info.url}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
