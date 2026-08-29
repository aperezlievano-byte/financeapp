import { describe, expect, it } from "vitest";
import { POST } from "../../src/app/api/webhooks/telegram/route";
import { prisma } from "../../src/server/db/client";

const WEBHOOK_URL = "http://127.0.0.1/api/webhooks/telegram";
const WEBHOOK_SECRET = "local-dev-secret";
const ALLOWED_CHAT_ID = "123456789";

function makeRequest(body: unknown, secret: string): Request {
  return new Request(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Telegram-Bot-Api-Secret-Token": secret,
    },
    body: JSON.stringify(body),
  });
}

function makeUpdate(updateId: number, chatId: string, text = "hola") {
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: Math.floor(Date.now() / 1000),
      chat: { id: Number(chatId) },
      text,
    },
  };
}

// Cada corrida necesita update_id nuevos: esta base de test no se resetea
// entre invocaciones de `pnpm test`, y provider_message_id es unique.
let nextUpdateId = Date.now();
function freshUpdateId(): number {
  nextUpdateId += 1;
  return nextUpdateId;
}

describe("POST /api/webhooks/telegram", () => {
  it("responds 401 and writes zero rows when the secret header is wrong", async () => {
    const updateId = freshUpdateId();
    const countBefore = await prisma.inboundMessage.count();

    const response = await POST(
      makeRequest(makeUpdate(updateId, ALLOWED_CHAT_ID), "wrong-secret"),
    );

    expect(response.status).toBe(401);

    const countAfter = await prisma.inboundMessage.count();
    expect(countAfter).toBe(countBefore);
  });

  it("responds 200 both times and leaves exactly one row for a repeated update", async () => {
    const updateId = freshUpdateId();
    const update = makeUpdate(updateId, ALLOWED_CHAT_ID);

    const first = await POST(makeRequest(update, WEBHOOK_SECRET));
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.data.accepted).toBe(true);

    const second = await POST(makeRequest(update, WEBHOOK_SECRET));
    expect(second.status).toBe(200);
    const secondBody = await second.json();
    expect(secondBody.data.duplicate).toBe(true);

    const rows = await prisma.inboundMessage.findMany({
      where: { channel: "telegram", providerMessageId: String(updateId) },
    });
    expect(rows).toHaveLength(1);
  });

  it("stores allowed=false and sends no reply for a sender outside the allowlist", async () => {
    const updateId = freshUpdateId();
    const disallowedChatId = "999999999";

    const response = await POST(
      makeRequest(makeUpdate(updateId, disallowedChatId), WEBHOOK_SECRET),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.ignored).toBe(true);

    const row = await prisma.inboundMessage.findUniqueOrThrow({
      where: {
        channel_providerMessageId: {
          channel: "telegram",
          providerMessageId: String(updateId),
        },
      },
    });
    expect(row.allowed).toBe(false);

    const pendingCount = await prisma.pendingTransaction.count({
      where: { inboundMessageId: row.id },
    });
    expect(pendingCount).toBe(0);
  });

  it("stores allowed=true and returns accepted for an allowed sender", async () => {
    const updateId = freshUpdateId();

    const response = await POST(
      makeRequest(makeUpdate(updateId, ALLOWED_CHAT_ID), WEBHOOK_SECRET),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.accepted).toBe(true);

    const row = await prisma.inboundMessage.findUniqueOrThrow({
      where: {
        channel_providerMessageId: {
          channel: "telegram",
          providerMessageId: String(updateId),
        },
      },
    });
    expect(row.allowed).toBe(true);
  });
});
