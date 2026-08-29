import type { Prisma, Source } from "../../generated/prisma";
import { prisma } from "../db/client";
import type { FreeTextExtraction } from "./extract-free-text";

// El unico escritor de pending_transactions. Guarda la extraccion cruda,
// raw_input y confidence. Nunca escribe en transactions, con ninguna
// confianza -- eso solo lo hace ledger/commit.ts, y solo con confirmacion
// humana explicita.

type CreatePendingInput = {
  userId: string;
  source: Source;
  rawInput: string;
  extraction: FreeTextExtraction;
  inboundMessageId?: string | null;
  documentId?: string | null;
};

export async function createPending(input: CreatePendingInput) {
  return prisma.pendingTransaction.create({
    data: {
      userId: input.userId,
      status: "awaiting_review",
      source: input.source,
      inboundMessageId: input.inboundMessageId ?? null,
      documentId: input.documentId ?? null,
      rawInput: input.rawInput,
      extraction: input.extraction.raw as Prisma.InputJsonValue,
      confidence: input.extraction.confidence,
      occurredOn: input.extraction.occurredOn,
      description: input.extraction.description,
      amountCents: input.extraction.amountCents,
      direction: input.extraction.direction,
      accountId: input.extraction.accountId,
      categoryId: input.extraction.categoryId,
    },
  });
}
