import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/contract/**/*.test.ts"],
    environment: "node",
    clearMocks: true,
  },
});
