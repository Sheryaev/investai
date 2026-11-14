import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

function luminance(hex: string): number {
  const channels = hex.match(/[a-f\d]{2}/gi)?.map((channel) => parseInt(channel, 16) / 255) ?? [];
  const [red, green, blue] = channels.map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: string, second: string): number {
  const light = Math.max(luminance(first), luminance(second));
  const dark = Math.min(luminance(first), luminance(second));
  return (light + 0.05) / (dark + 0.05);
}

it("keeps light-theme muted text at WCAG AA contrast on both surfaces", () => {
  const css = readFileSync("src/tokens.css", "utf8");
  const root = css.match(/:root\s*\{([^}]*)\}/)?.[1] ?? "";
  const token = (name: string) => root.match(new RegExp(`--${name}:\\s*(#[a-f\\d]{6})`, "i"))?.[1] ?? "";

  expect(contrast(token("muted"), token("bg"))).toBeGreaterThanOrEqual(4.5);
  expect(contrast(token("muted"), token("surface"))).toBeGreaterThanOrEqual(4.5);
});
