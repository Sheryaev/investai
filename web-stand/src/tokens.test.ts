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

const css = readFileSync("src/tokens.css", "utf8");

function themeTokens(selector: ":root" | ":root[data-theme=\"dark\"]") {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
  return (name: string) => block.match(new RegExp(`--${name}:\\s*(#[a-f\\d]{6})`, "i"))?.[1] ?? "";
}

it("keeps light-theme muted text at WCAG AA contrast on both surfaces", () => {
  const token = themeTokens(":root");

  expect(contrast(token("muted"), token("bg"))).toBeGreaterThanOrEqual(4.5);
  expect(contrast(token("muted"), token("surface"))).toBeGreaterThanOrEqual(4.5);
});

it.each([
  { theme: "light", selector: ":root" as const },
  { theme: "dark", selector: ":root[data-theme=\"dark\"]" as const },
])("keeps $theme-theme financial signs at WCAG AA contrast on every surface", ({ selector }) => {
  const token = themeTokens(selector);

  for (const sign of ["positive", "negative"]) {
    for (const surface of ["bg", "surface", "surface-soft"]) {
      expect(
        contrast(token(sign), token(surface)),
        `${sign} on ${surface}: ${token(sign)} / ${token(surface)}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  }
});
