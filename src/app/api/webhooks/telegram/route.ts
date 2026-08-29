import { prisma } from "../../../../server/db/client";
import { telegramChannel } from "../../../../server/ingest/telegram";

// Solo normaliza y encola: verifica la cabecera secreta, normaliza el update,
// respeta la unicidad de inbound_messages y aplica la allowlist. Cero
// extraccion, cero llamadas al modelo dentro de este handler.

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

  return Response.json({ ok: true, data: { accepted: true } });
}
