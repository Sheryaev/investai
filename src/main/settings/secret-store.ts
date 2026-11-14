import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface StorageCipher {
  isAvailable(): boolean;
  encrypt(value: string): Buffer;
  decrypt(value: Buffer): string;
}

export class FileSecretStore {
  private readonly filePath: string;

  constructor(private readonly root: string, private readonly cipher: StorageCipher) {
    this.filePath = join(root, "broker-token.bin");
  }

  async hasToken(): Promise<boolean> {
    try {
      await readFile(this.filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getToken(): Promise<string | null> {
    try {
      return this.cipher.decrypt(await readFile(this.filePath));
    } catch (error) {
      if (this.isMissing(error)) return null;
      throw new Error("Не удалось расшифровать токен брокера. Сохраните его повторно.", { cause: error });
    }
  }

  async setToken(token: string): Promise<void> {
    const value = token.trim();
    if (!value) throw new Error("Токен брокера не может быть пустым.");
    if (!this.cipher.isAvailable()) throw new Error("Системное шифрование недоступно. Токен не сохранён.");
    await mkdir(this.root, { recursive: true });
    const encrypted = this.cipher.encrypt(value);
    const temporary = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temporary, encrypted, { mode: 0o600 });
    await rename(temporary, this.filePath);
  }

  async deleteToken(): Promise<void> {
    await unlink(this.filePath).catch((error: unknown) => {
      if (!this.isMissing(error)) throw error;
    });
  }

  private isMissing(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
  }
}
