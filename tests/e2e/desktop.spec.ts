import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { test, expect, _electron as electron } from "@playwright/test";

test("desktop demo workflow stays local and covers portfolio, analytics, chat and settings", async () => {
  const profile = await mkdtemp(join(process.cwd(), "tests", ".e2e-profile-"));
  const env = Object.fromEntries(Object.entries({ ...process.env, INVEST_AI_USER_DATA: profile })
    .filter((entry): entry is [string, string] => entry[0] !== "ELECTRON_RUN_AS_NODE" && typeof entry[1] === "string"));
  const electronApp = await electron.launch({
    args: ["."],
    cwd: process.cwd(),
    env,
  });
  try {
    const window = await electronApp.firstWindow();
    await expect(window.getByRole("heading", { name: "Обзор" })).toBeVisible();
    await expect(window.getByText(/65.*939/).first()).toBeVisible();

    await window.getByRole("button", { name: /Портфель/ }).click();
    await expect(window.getByRole("heading", { name: "Портфель" })).toBeVisible();
    await window.getByRole("button", { name: "Открыть SBER" }).click();
    await expect(window.getByRole("dialog", { name: "SBER" })).toBeVisible();
    await expect(window.getByRole("img", { name: "Свечной график SBER" })).toBeVisible();
    await expect(window.getByText("Дивиденды Сбербанк")).toBeVisible();
    await window.getByRole("button", { name: "Закрыть" }).click();

    await window.getByRole("button", { name: /Аналитика/ }).click();
    await expect(window.getByRole("heading", { name: "Аналитика" })).toBeVisible();
    await expect(window.getByText("Концентрация топ-5")).toBeVisible();
    await expect(window.getByText("Покупка YNDX")).toBeVisible();

    await window.getByRole("button", { name: /ИИ-чат/ }).click();
    await expect(window.getByRole("heading", { name: "ИИ-чат" })).toBeVisible();
    await expect(window.getByRole("button", { name: "Найди риски" })).toBeVisible();
    await expect(window.getByLabel("CLI-агент")).toBeVisible();

    await window.getByRole("button", { name: /Настройки/ }).click();
    await expect(window.getByRole("heading", { name: "Настройки" })).toBeVisible();
    await expect(window.getByLabel("Read-only токен")).toHaveAttribute("type", "password");
    await expect(window.getByRole("heading", { name: "Локальные ИИ-агенты" })).toBeVisible();
    await expect(window.getByText("Демо-режим").first()).toBeVisible();
  } finally {
    await electronApp.close();
    await rm(profile, { recursive: true, force: true });
  }
});
