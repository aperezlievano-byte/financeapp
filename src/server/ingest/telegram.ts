import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { requireTelegram } from "../../lib/env";
import * as telegramClient from "../telegram/client";
import type { Attachment, IngestChannel, NormalizedMessage } from "./channel";

const updateSchema = z.object({
  update_id: z.number(),
  message: z
    .object({
      message_id: z.number(),
      date: z.number(),
      chat: z.object({ id: z.number() }),
      text: z.string().optional(),
      photo: z.array(z.object({ file_id: z.string() })).optional(),
      document: z
        .object({ file_id: z.string(), mime_type: z.string().optional() })
        .optional(),
    })
    .optional(),
});

export const telegramChannel: IngestChannel = {
  name: "telegram",

  async verifyRequest(request) {
    const { TELEGRAM_WEBHOOK_SECRET } = requireTelegram();
    const received =
      request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";

    const receivedBuf = Buffer.from(received);
    const expectedBuf = Buffer.from(TELEGRAM_WEBHOOK_SECRET);

    if (receivedBuf.length !== expectedBuf.length) {
      return false;
    }
    return timingSafeEqual(receivedBuf, expectedBuf);
  },

  async normalize(request): Promise<NormalizedMessage | null> {
    const body = await request.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success || !parsed.data.message) {
      return null;
    }

    const { message, update_id } = parsed.data;

    const attachments: Attachment[] = [];
    const largestPhoto = message.photo?.at(-1);
    if (largestPhoto) {
      attachments.push({ kind: "photo", providerFileId: largestPhoto.file_id });
    }
    if (message.document) {
      attachments.push({
        kind: "document",
        providerFileId: message.document.file_id,
        mimeType: message.document.mime_type,
      });
    }

    return {
      channel: "telegram",
      sender: String(message.chat.id),
      text: message.text,
      attachments,
      timestamp: new Date(message.date * 1000),
      messageId: String(update_id),
    };
  },

  isAllowedSender(sender) {
    const { TELEGRAM_ALLOWED_CHAT_ID } = requireTelegram();
    return sender === TELEGRAM_ALLOWED_CHAT_ID;
  },

  async reply(sender, text) {
    await telegramClient.sendMessage(sender, text);
  },

  async fetchAttachment(attachment) {
    const { filePath } = await telegramClient.getFile(
      attachment.providerFileId,
    );
    return telegramClient.downloadFile(filePath);
  },
};
