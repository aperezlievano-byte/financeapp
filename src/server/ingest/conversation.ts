import { prisma } from "../db/client";

// El estado "esperando confirmacion" vive aca, en la base -- nunca en una
// variable de modulo. Vercel es serverless y no conserva memoria entre
// invocaciones; una constante de modulo funcionaria en dev y fallaria en
// produccion de forma intermitente.

const CONFIRMATION_TTL_MS = 24 * 60 * 60 * 1000;

export async function openConfirmation(
  channel: string,
  sender: string,
  pendingId: string,
  promptText: string,
): Promise<void> {
  const expiresAt = new Date(Date.now() + CONFIRMATION_TTL_MS);

  await prisma.conversationState.upsert({
    where: { channel_sender: { channel, sender } },
    update: {
      awaiting: "confirmation",
      pendingTransactionId: pendingId,
      promptText,
      expiresAt,
    },
    create: {
      channel,
      sender,
      awaiting: "confirmation",
      pendingTransactionId: pendingId,
      promptText,
      expiresAt,
    },
  });
}

export async function readState(channel: string, sender: string) {
  const state = await prisma.conversationState.findUnique({
    where: { channel_sender: { channel, sender } },
  });

  if (!state || state.expiresAt.getTime() < Date.now()) {
    return null;
  }
  return state;
}

export async function closeState(
  channel: string,
  sender: string,
): Promise<void> {
  await prisma.conversationState.deleteMany({ where: { channel, sender } });
}
