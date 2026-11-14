import type { SettingsSnapshot } from "../../shared/contracts";
import { FixtureGateway } from "../invest/fixture-gateway";
import type { InvestGateway } from "../invest/gateway";
import { TInvestGateway } from "../invest/tinvest-gateway";
import { FileSecretStore, type StorageCipher } from "./secret-store";
import { FileSettingsStore, type AppPreferences } from "./settings-store";

export class SettingsService {
  private readonly secrets: FileSecretStore;
  private readonly settings: FileSettingsStore;

  constructor(root: string, cipher: StorageCipher) {
    this.secrets = new FileSecretStore(root, cipher);
    this.settings = new FileSettingsStore(root);
  }

  async getState(): Promise<SettingsSnapshot> {
    const hasToken = await this.secrets.hasToken();
    return { mode: hasToken ? "broker" : "demo", hasToken, preferences: await this.settings.get() };
  }

  async createGateway(): Promise<InvestGateway> {
    const token = await this.secrets.getToken();
    return token ? new TInvestGateway(token) : new FixtureGateway();
  }

  async saveToken(token: string): Promise<SettingsSnapshot> {
    await this.secrets.setToken(token);
    return this.getState();
  }

  async removeToken(): Promise<SettingsSnapshot> {
    await this.secrets.deleteToken();
    return this.getState();
  }

  async update(preferences: Partial<AppPreferences>): Promise<SettingsSnapshot> {
    await this.settings.update(preferences);
    return this.getState();
  }
}
