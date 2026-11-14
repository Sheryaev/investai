import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileSettingsStore } from "../../src/main/settings/settings-store";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("FileSettingsStore", () => {
  it("persists validated non-secret preferences and keeps defaults", async () => {
    const root = await mkdtemp(join(process.cwd(), "tests", ".settings-store-"));
    directories.push(root);
    const store = new FileSettingsStore(root);
    expect(await store.get()).toEqual({ selectedAccountIds: [], baseCurrency: "RUB", refreshIntervalMinutes: 5 });
    await store.update({ selectedAccountIds: ["account-2", "account-1"], baseCurrency: "USD", refreshIntervalMinutes: 15 });
    expect(await new FileSettingsStore(root).get()).toEqual({ selectedAccountIds: ["account-2", "account-1"], baseCurrency: "USD", refreshIntervalMinutes: 15 });
    expect(await readFile(join(root, "settings.json"), "utf8")).not.toContain("token");
  });

  it("rejects invalid values instead of weakening settings", async () => {
    const root = await mkdtemp(join(process.cwd(), "tests", ".settings-store-"));
    directories.push(root);
    const store = new FileSettingsStore(root);
    await expect(store.update({ refreshIntervalMinutes: 0 })).rejects.toThrow();
    await expect(store.update({ baseCurrency: "BTC" as never })).rejects.toThrow();
  });
});
