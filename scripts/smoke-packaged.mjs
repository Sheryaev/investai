import { mkdtemp, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { _electron as electron } from "@playwright/test";

const profile = await mkdtemp(join(process.cwd(), "tests", ".packaged-profile-"));
const env = Object.fromEntries(
  Object.entries({ ...process.env, INVEST_AI_USER_DATA: profile })
    .filter((entry) => entry[0] !== "ELECTRON_RUN_AS_NODE" && typeof entry[1] === "string"),
);

let electronApp;
try {
  electronApp = await electron.launch({
    executablePath: process.env.INVEST_AI_PACKAGED_EXE ?? resolve("release/win-unpacked/Invest AI.exe"),
    cwd: process.cwd(),
    env,
  });
  const window = await electronApp.firstWindow();
  await window.getByRole("heading", { name: "Обзор" }).waitFor({ state: "visible", timeout: 20_000 });
  await window.getByText(/65.*939/).first().waitFor({ state: "visible", timeout: 10_000 });
  await window.getByRole("button", { name: /Настройки/ }).click();
  await window.getByText("Демо-режим").first().waitFor({ state: "visible", timeout: 10_000 });
  console.log("Packaged smoke passed: dashboard, demo portfolio and settings are visible.");
} finally {
  await electronApp?.close();
  await rm(profile, { recursive: true, force: true });
}
