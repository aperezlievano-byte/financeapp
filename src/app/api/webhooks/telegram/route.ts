import { env } from "../../../../lib/env";
import { prisma } from "../../../../server/db/client";
import { processMessage } from "../../../../server/ingest/pipeline";
import { telegramChannel } from "../../../../server/ingest/telegram";

// Verifica la cabecera secreta, normaliza el update, respeta la unicidad de
// inbound_messages y aplica la allowlist -- y solo entonces delega en el
// pipeline. Cero logica de negocio propia de Telegram en este handler; la
// llamada al modelo ocurre despues del commit de inbound_messages, para que
// un reintento no reprocese.

export async function POST(request: Request): Promise<Response> {
  const verified = await telegramChannel.verifyRequest(request);
  if (!verified) {
    return Response.json(
      {
        ok: false,
        error: { code: "unauthorized", message: "Cabecera secreta inválida." },
      },
      { status: 401 },
    );
  }

  const message = await telegramChannel.normalize(request);
  if (!message) {
    return Response.json({ ok: true, data: { ignored: true } });
  }

  const existing = await prisma.inboundMessage.findUnique({
    where: {
      channel_providerMessageId: {
        channel: message.channel,
        providerMessageId: message.messageId,
      },
    },
  });
  if (existing) {
    return Response.json({ ok: true, data: { duplicate: true } });
  }

  const allowed = telegramChannel.isAllowedSender(message.sender);

  await prisma.inboundMessage.create({
    data: {
      channel: message.channel,
      providerMessageId: message.messageId,
      sender: message.sender,
      text: message.text,
      attachments: message.attachments,
      receivedAt: message.timestamp,
      allowed,
    },
  });

  if (!allowed) {
    return Response.json({ ok: true, data: { ignored: true } });
  }

  // El mensaje ya quedo en inbound_messages -- eso es lo que importa para
  // Telegram. Un fallo del pipeline (config faltante, red, extraccion) no
  // debe tumbar el webhook: Telegram reintenta sin fin ante un no-2xx.
  try {
    await processMessage(env.APP_USER_ID, telegramChannel, message);
  } catch (error) {
    console.error("processMessage falló", error);
  }

  return Response.json({ ok: true, data: { accepted: true } });
}
