import { describe, expect, it } from "vitest";
import { money, totalValue } from "../../src/main/portfolio/money";

describe("money", () => {
  it("adds decimal values without binary rounding", () => {
    const result = totalValue([money("0.1", "RUB"), money("0.2", "RUB")], "RUB");
    expect(result?.value.toString()).toBe("0.3");
  });

  it("does not mix currencies without an explicit conversion", () => {
    expect(totalValue([money("10", "RUB"), money("1", "USD")], "RUB")).toBeNull();
  });

  it("represents an empty set in one currency as zero", () => {
    expect(totalValue([], "RUB")?.value.toString()).toBe("0");
  });
});
