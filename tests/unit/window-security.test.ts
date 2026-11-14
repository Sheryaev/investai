import { describe, expect, it } from "vitest";
import { createWindowOptions, isSafeExternalUrl } from "../../src/main/window-security";

describe("Electron window security", () => {
  it("isolates the renderer from Node.js", () => {
    const options = createWindowOptions("out/preload/index.js");
    expect(options.webPreferences).toMatchObject({
      preload: "out/preload/index.js",
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    });
  });

  it("allows only HTTPS for external links", () => {
    expect(isSafeExternalUrl("https://tinkoff.github.io/investAPI/")).toBe(true);
    expect(isSafeExternalUrl("http://example.com")).toBe(false);
    expect(isSafeExternalUrl("javascript:alert(1)")).toBe(false);
  });
});
