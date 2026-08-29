import { describe, expect, it } from "vitest";
import { env } from "../../src/lib/env";
import type { AiClient } from "../../src/server/ai/gateway";
import { extractFreeText } from "../../src/server/ingest/extract-free-text";

function fakeClient(response: string): AiClient {
  return {
    async complete() {
      return response;
    },
  };
}

describe("extractFreeText", () => {
  it("extracts amount and direction from the example sentence", async () => {
    const client = fakeClient(
      JSON.stringify({
        description: "Club de tiro",
        amountPesos: "100000",
        direction: "out",
        occurredOn: null,
        accountName: "cuenta de ahorros",
        categoryName: null,
        confidence: 0.9,
      }),
    );

    const result = await extractFreeText(
      env.APP_USER_ID,
      "pagué el club de tiro por 100000 de mi cuenta de ahorros",
      client,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.amountCents).toBe(10000000n);
    expect(result.data.direction).toBe("out");
    expect(result.data.description).toBe("Club de tiro");
    expect(result.data.accountId).not.toBeNull();
  });

  it("returns extraction_failed when the payload fails the schema", async () => {
    const client = fakeClient(JSON.stringify({ nope: true }));

    const result = await extractFreeText(env.APP_USER_ID, "algo raro", client);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("extraction_failed");
    }
  });

  it("returns extraction_failed when amountPesos is not numeric", async () => {
    const client = fakeClient(
      JSON.stringify({
        description: "Club de tiro",
        amountPesos: "1.5",
        direction: "out",
      }),
    );

    const result = await extractFreeText(
      env.APP_USER_ID,
      "algo con decimales",
      client,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("extraction_failed");
    }
  });
});
