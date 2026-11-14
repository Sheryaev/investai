import type { SafeStorage } from "electron";
import type { StorageCipher } from "./secret-store";

export class ElectronStorageCipher implements StorageCipher {
  constructor(private readonly storage: SafeStorage) {}

  isAvailable(): boolean {
    return this.storage.isEncryptionAvailable();
  }

  encrypt(value: string): Buffer {
    return this.storage.encryptString(value);
  }

  decrypt(value: Buffer): string {
    return this.storage.decryptString(value);
  }
}
