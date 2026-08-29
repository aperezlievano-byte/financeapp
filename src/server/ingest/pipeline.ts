import { formatCOP } from "../../lib/money";
import type { AiClient } from "../ai/gateway";
import { prisma } from "../db/client";
import { commitPending } from "../ledger/commit";
import type { IngestChannel, NormalizedMessage } from "./channel";
import { closeState, openConfirmation, readState } from "./conversation";
import { extractFreeText } from "./extract-free-text";
import { createPending } from "./pending";

// Generico sobre IngestChannel -- cero referencias a un proveedor especifico.
// Orquesta: allowlist -> ¿hay confirmacion pendiente? -> interpretar sí/no,
// o si no hay estado, extraer y abrir una confirmacion nueva.

const CONFIRM_WORDS = new Set(["si", "sí", "s", "yes", "dale", "ok"]);
const REJECT_WORDS = new Set(["no", "n", "nel"]);

function buildPromptText(
  description: string,
  amountCents: bigint,
  accountName: string,
): string {
  return `Detecté: ${description}, ${formatCOP(amountCents)}, ${accountName} — ¿confirmo?\nResponde Sí o No.`;
}

export async function processMessage(
  userId: string,
  channelImpl: IngestChannel,
  message: NormalizedMessage,
  aiClient?: AiClient,
): Promise<void> {
  if (!channelImpl.isAllowedSender(message.sender)) {
    return;
  }

  const state = await readState(message.channel, message.sender);

  if (state) {
    const answer = (message.text ?? "").trim().toLowerCase();

    if (CONFIRM_WORDS.has(answer)) {
      if (state.pendingTransactionId) {
        await commitPending(state.pendingTransactionId, userId);
      }
      await closeState(message.channel, message.sender);
      return;
    }

    if (REJECT_WORDS.has(answer)) {
      if (state.pendingTransactionId) {
        await prisma.pendingTransaction.update({
          where: { id: state.pendingTransactionId },
          data: { status: "rejected", resolvedAt: new Date() },
        });
      }
      await closeState(message.channel, message.sender);
      return;
    }

    await channelImpl.reply(message.sender, state.promptText);
    return;
  }

  if (!message.text) {
    return;
  }

  const extraction = await extractFreeText(userId, message.text, aiClient);
  if (!extraction.ok) {
    await channelImpl.reply(
      message.sender,
      "No pude leer eso. ¿Me lo escribes de otra forma?",
    );
    return;
  }

  const pending = await createPending({
    userId,
    source: "free_text",
    rawInput: message.text,
    extraction: extraction.data,
  });

  const account = extraction.data.accountId
    ? await prisma.account.findUnique({
        where: { id: extraction.data.accountId },
      })
    : null;

  const promptText = buildPromptText(
    extraction.data.description,
    extraction.data.amountCents,
    account?.name ?? "sin cuenta",
  );

  await openConfirmation(
    message.channel,
    message.sender,
    pending.id,
    promptText,
  );
  await channelImpl.reply(message.sender, promptText);
}
