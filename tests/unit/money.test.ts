import { describe, expect, it } from "vitest";
import { formatCOP, formatSignedCOP, pesosToCents } from "../../src/lib/money";

describe("formatCOP", () => {
  it("formats whole pesos without decimals", () => {
    expect(formatCOP(123456700n)).toBe("$1.234.567");
  });

  it("formats a round number under a million", () => {
    expect(formatCOP(10000000n)).toBe("$100.000");
  });

  it("formats cents as a comma decimal", () => {
    expect(formatCOP(123456789n)).toBe("$1.234.567,89");
  });
});

describe("formatSignedCOP", () => {
  it("prefixes income with +", () => {
    expect(formatSignedCOP(320000000n, "in")).toBe("+$3.200.000");
  });

  it("prefixes expense with U+2212, not the ASCII hyphen", () => {
    expect(formatSignedCOP(45000000n, "out")).toBe("−$450.000");
  });
});

describe("pesosToCents", () => {
  it("converts a whole-peso digit string to cents", () => {
    expect(pesosToCents("100000")).toBe(10000000n);
  });

  it("rejects a non-integer string", () => {
    expect(() => pesosToCents("1.5")).toThrow();
  });
});
