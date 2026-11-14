import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { Currency } from "../portfolio/types";

export interface AppPreferences {
  selectedAccountIds: string[];
  baseCurrency: Currency;
  refreshIntervalMinutes: number;
}

const defaults: AppPreferences = { selectedAccountIds: [], baseCurrency: "RUB", refreshIntervalMinutes: 5 };
const preferencesSchema = z.object({
  selectedAccountIds: z.array(z.string().min(1).max(200)).max(100),
  baseCurrency: z.enum(["RUB", "USD", "EUR", "CNY"]),
  refreshIntervalMinutes: z.number().int().min(1).max(1440),
}).strict();

export class FileSettingsStore {
  private readonly filePath: string;

  constructor(private readonly root: string) {
    this.filePath = join(root, "settings.json");
  }

  async get(): Promise<AppPreferences> {
    try {
      return preferencesSchema.parse(JSON.parse(await readFile(this.filePath, "utf8")));
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return { ...defaults };
      throw new Error("Не удалось прочитать настройки приложения.", { cause: error });
    }
  }

  async update(update: Partial<AppPreferences>): Promise<AppPreferences> {
    const value = preferencesSchema.parse({ ...await this.get(), ...update });
    await mkdir(this.root, { recursive: true });
    const temporary = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(value, null, 2), { encoding: "utf8", mode: 0o600 });
    await rename(temporary, this.filePath);
    return value;
  }
}
