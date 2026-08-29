import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { env } from "../../src/lib/env";
import type { AiClient } from "../../src/server/ai/gateway";
import { prisma } from "../../src/server/db/client";
import type {
  IngestChannel,
  NormalizedMessage,
} from "../../src/server/ingest/channel";
import { readState } from "../../src/server/ingest/conversation";
import { processMessage } from "../../src/server/ingest/pipeline";

const CHANNEL = "fake";

function fakeClient(response: string): AiClient {
  return {
    async complete() {
      return response;
    },
  };
}

function fakeChannel(): IngestChannel & { replies: string[] } {
  const replies: string[] = [];
  return {
    name: CHANNEL,
    replies,
    async verifyRequest() {
      return true;
    },
    async normalize() {
      return null;
    },
    isAllowedSender() {
      return true;
    },
    async reply(_sender, text) {
      replies.push(text);
    },
    async fetchAttachment() {
      throw new Error("no usado en este test");
    },
  };
}

function makeMessage(sender: string, text: string): NormalizedMessage {
  return {
    channel: CHANNEL,
    sender,
    text,
    attachments: [],
    timestamp: new Date(),
    messageId: randomUUID(),
  };
}

const CLUB_DE_TIRO_RESPONSE = JSON.stringify({
  description: "Club de tiro",
  amountPesos: "100000",
  direction: "out",
  occurredOn: null,
  accountName: "cuenta de ahorros",
  categoryName: null,
  confidence: 0.9,
});

describe("processMessage", () => {
  it("replies with the exact confirmation template on a new extraction", async () => {
    const channel = fakeChannel();
    const sender = randomUUID();

    await processMessage(
      env.APP_USER_ID,
      channel,
      makeMessage(
        sender,
        "pagué el club de tiro por 100000 de mi cuenta de ahorros",
      ),
      fakeClient(CLUB_DE_TIRO_RESPONSE),
    );

    expect(channel.replies).toEqual([
      "Detecté: Club de tiro, $100.000, cuenta de ahorros — ¿confirmo?\nResponde Sí o No.",
    ]);
  });

  it("confirms with sí: writes one transaction and deletes the conversation state", async () => {
    const channel = fakeChannel();
    const sender = randomUUID();

    await processMessage(
      env.APP_USER_ID,
      channel,
      makeMessage(
        sender,
        "pagué el club de tiro por 100000 de mi cuenta de ahorros",
      ),
      fakeClient(CLUB_DE_TIRO_RESPONSE),
    );

    const countBefore = await prisma.transaction.count();
    await processMessage(env.APP_USER_ID, channel, makeMessage(sender, "sí"));
    const countAfter = await prisma.transaction.count();

    expect(countAfter).toBe(countBefore + 1);
    expect(await readState(CHANNEL, sender)).toBeNull();
  });

  it("rejects with no: sets status rejected and writes zero transactions", async () => {
    const channel = fakeChannel();
    const sender = randomUUID();

    await processMessage(
      env.APP_USER_ID,
      channel,
      makeMessage(
        sender,
        "pagué el club de tiro por 100000 de mi cuenta de ahorros",
      ),
      fakeClient(CLUB_DE_TIRO_RESPONSE),
    );

    const countBefore = await prisma.transaction.count();
    await processMessage(env.APP_USER_ID, channel, makeMessage(sender, "no"));
    const countAfter = await prisma.transaction.count();

    expect(countAfter).toBe(countBefore);
    expect(await readState(CHANNEL, sender)).toBeNull();
  });

  it("resends the stored prompt unchanged when the answer is neither yes nor no", async () => {
    const channel = fakeChannel();
    const sender = randomUUID();

    await processMessage(
      env.APP_USER_ID,
      channel,
      makeMessage(
        sender,
        "pagué el club de tiro por 100000 de mi cuenta de ahorros",
      ),
      fakeClient(CLUB_DE_TIRO_RESPONSE),
    );
    const firstPrompt = channel.replies[0];

    await processMessage(
      env.APP_USER_ID,
      channel,
      makeMessage(sender, "quizás"),
    );

    expect(channel.replies[1]).toBe(firstPrompt);
    expect(await readState(CHANNEL, sender)).not.toBeNull();
  });

  it("treats an expired conversation state as absent and starts a new extraction", async () => {
    const channel = fakeChannel();
    const sender = randomUUID();

    await processMessage(
      env.APP_USER_ID,
      channel,
      makeMessage(
        sender,
        "pagué el club de tiro por 100000 de mi cuenta de ahorros",
      ),
      fakeClient(CLUB_DE_TIRO_RESPONSE),
    );

    await prisma.conversationState.update({
      where: { channel_sender: { channel: CHANNEL, sender } },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await processMessage(
      env.APP_USER_ID,
      channel,
      makeMessage(sender, "pagué otra vez 50000 de mi cuenta de ahorros"),
      fakeClient(
        JSON.stringify({
          description: "Otra vez",
          amountPesos: "50000",
          direction: "out",
          accountName: "cuenta de ahorros",
        }),
      ),
    );

    expect(channel.replies).toHaveLength(2);
    expect(channel.replies[1]).toContain("Otra vez");
  });
});
