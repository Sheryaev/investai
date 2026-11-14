import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SettingsService } from "../../src/main/settings/settings-service";
import type { StorageCipher } from "../../src/main/settings/secret-store";
import { FixtureGateway } from "../../src/main/invest/fixture-gateway";

const cipher: StorageCipher = {
  isAvailable: () => true,
  encrypt: (value) => Buffer.from(Buffer.from(value).toString("base64")),
  decrypt: (value) => Buffer.from(value.toString(), "base64").toString(),
};
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("SettingsService", () => {
  it("derives broker mode from the encrypted token without exposing it", async () => {
    const root = await mkdtemp(join(process.cwd(), "tests", ".settings-service-"));
    directories.push(root);
    const service = new SettingsService(root, cipher);
    expect(await service.getState()).toMatchObject({ mode: "demo", hasToken: false });
    expect(await service.createGateway()).toBeInstanceOf(FixtureGateway);
    await service.saveToken("t.readonly");
    const state = await service.getState();
    expect(state).toMatchObject({ mode: "broker", hasToken: true });
    expect(JSON.stringify(state)).not.toContain("t.readonly");
    await service.removeToken();
    expect(await service.getState()).toMatchObject({ mode: "demo", hasToken: false });
  });
});
