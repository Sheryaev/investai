import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:7100",
    viewport: { width: 1440, height: 1000 },
    channel: "msedge",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run build && npm run preview -- --host 127.0.0.1 --port 7100 --strictPort",
    url: "http://127.0.0.1:7100",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
