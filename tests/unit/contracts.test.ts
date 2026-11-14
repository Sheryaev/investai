import { describe, expect, it } from "vitest";
import { APP_INFO } from "../../src/shared/contracts";

describe("APP_INFO", () => {
  it("describes the demo application at runtime", () => {
    expect(APP_INFO).toEqual({ name: "Invest AI", version: "0.1.0", mode: "demo" });
  });
});
