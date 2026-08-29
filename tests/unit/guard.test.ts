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
  vi.doUnmock("next/headers");
  vi.restoreAllMocks();
});

describe("e2eBypassUserId", () => {
  it("returns the e2e user id when the three conditions hold at once", async () => {
    setEnv({
      E2E_USER_ID: "e2e-user",
      E2E_DATABASE_URL:
        "postgresql://postgres:postgres@127.0.0.1:5433/personal_finance_test",
    });
    const { e2eBypassUserId } = await import("../../src/lib/auth/guard");
    expect(e2eBypassUserId()).toBe("e2e-user");
  });

  it("returns null when E2E_USER_ID is absent", async () => {
    setEnv({ E2E_USER_ID: undefined });
    const { e2eBypassUserId } = await import("../../src/lib/auth/guard");
    expect(e2eBypassUserId()).toBeNull();
  });

  it("returns null when DATABASE_URL does not end with _test", async () => {
    setEnv({
      DATABASE_URL:
        "postgresql://postgres:postgres@127.0.0.1:5433/personal_finance",
      E2E_USER_ID: "e2e-user",
      E2E_DATABASE_URL:
        "postgresql://postgres:postgres@127.0.0.1:5433/personal_finance",
    });
    const { e2eBypassUserId } = await import("../../src/lib/auth/guard");
    expect(e2eBypassUserId()).toBeNull();
  });

  it("returns null when E2E_DATABASE_URL differs from DATABASE_URL", async () => {
    setEnv({
      E2E_USER_ID: "e2e-user",
      E2E_DATABASE_URL:
        "postgresql://postgres:postgres@127.0.0.1:5433/otra_test",
    });
    const { e2eBypassUserId } = await import("../../src/lib/auth/guard");
    expect(e2eBypassUserId()).toBeNull();
  });
});

describe("requireUser", () => {
  it("returns forbidden when x-user-id differs from APP_USER_ID", async () => {
    setEnv({});
    vi.doMock("next/headers", () => ({
      headers: async () => new Map([["x-user-id", "someone-else"]]),
    }));

    const { requireUser } = await import("../../src/lib/auth/guard");
    const result = await requireUser();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("forbidden");
    }
  });
});
