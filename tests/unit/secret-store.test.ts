import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileSecretStore, type StorageCipher } from "../../src/main/settings/secret-store";

const cipher: StorageCipher = {
  isAvailable: () => true,
  encrypt: (value) => Buffer.from(Buffer.from(value, "utf8").toString("base64"), "utf8"),
  decrypt: (value) => Buffer.from(value.toString("utf8"), "base64").toString("utf8"),
};
const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, recursiveOptions(directory))));
});
function recursiveOptions(directory: string) { return { recursive: true as const, force: true }; }

describe("FileSecretStore", () => {
  it("encrypts, replaces and deletes the broker token without storing plaintext", async () => {
    const root = await mkdtemp(join(process.cwd(), "tests", ".secret-store-"));
    directories.push(root);
    const store = new FileSecretStore(root, cipher);
    expect(await store.hasToken()).toBe(false);
    await store.setToken("t.secret-readonly");
    expect(await store.getToken()).toBe("t.secret-readonly");
    expect(await readFile(join(root, "broker-token.bin"), "utf8")).not.toContain("t.secret-readonly");
    await store.setToken("t.replacement");
    expect(await store.getToken()).toBe("t.replacement");
    await store.deleteToken();
    expect(await store.hasToken()).toBe(false);
    expect(await store.getToken()).toBeNull();
  });

  it("refuses plaintext persistence when OS encryption is unavailable", async () => {
    const root = await mkdtemp(join(process.cwd(), "tests", ".secret-store-"));
    directories.push(root);
    const store = new FileSecretStore(root, { ...cipher, isAvailable: () => false });
    await expect(store.setToken("plain-text")).rejects.toThrow(/шифрование/i);
    await expect(readFile(join(root, "broker-token.bin"), "utf8")).rejects.toThrow();
  });
});
