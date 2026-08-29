import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const REQUIRED_ENV: Record<string, string> = {
  APP_USER_ID: "00000000-0000-0000-0000-000000000001",
  DATABASE_URL:
    "postgresql://postgres:postgres@127.0.0.1:5433/personal_finance_test",
  DIRECT_DATABASE_URL:
    "postgresql://postgres:postgres@127.0.0.1:5433/personal_finance_test",
  TEST_DATABASE_URL:
    "postgresql://postgres:postgres@127.0.0.1:5433/personal_finance_test",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-placeholder-anon-key",
  STORAGE_DRIVER: "supabase",
  STORAGE_LOCAL_DIR: ".storage",
};

const ORIGINAL_ENV = { ...process.env };

function setEnv(overrides: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(REQUIRED_ENV)) {
    process.env[key] = value;
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("storage/index.ts with STORAGE_DRIVER=supabase", () => {
  it("putObject fails with a named error when SUPABASE_SERVICE_ROLE_KEY is absent, never falling back to the local driver", async () => {
    setEnv({ SUPABASE_SERVICE_ROLE_KEY: undefined });
    const { putObject } = await import("../../src/server/storage");

    await expect(
      putObject("some/key", Buffer.from("x"), "text/plain"),
    ).rejects.toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("getObject fails with a named error when SUPABASE_SERVICE_ROLE_KEY is absent, never falling back to the local driver", async () => {
    setEnv({ SUPABASE_SERVICE_ROLE_KEY: undefined });
    const { getObject } = await import("../../src/server/storage");

    await expect(getObject("some/key")).rejects.toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/,
    );
  });
});
