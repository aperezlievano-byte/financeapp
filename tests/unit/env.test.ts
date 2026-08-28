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
  STORAGE_DRIVER: "local",
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

describe("src/lib/env.ts", () => {
  it("loads without throwing when every required variable is present", async () => {
    setEnv({});
    await expect(import("../../src/lib/env")).resolves.toBeDefined();
  });

  it("throws naming the missing variable when DATABASE_URL is unset", async () => {
    setEnv({ DATABASE_URL: undefined });
    await expect(import("../../src/lib/env")).rejects.toThrow(/DATABASE_URL/);
  });

  it("does not throw when ANTHROPIC_API_KEY is unset", async () => {
    setEnv({ ANTHROPIC_API_KEY: undefined });
    await expect(import("../../src/lib/env")).resolves.toBeDefined();
  });
});
