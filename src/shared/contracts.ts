import type { AgentEvent, AgentProviderName, CliAvailability } from "../main/agents/cli-types";
import type { AppPreferences } from "../main/settings/settings-store";

export interface AppInfo {
  name: "Invest AI";
  version: string;
  mode: "demo" | "broker";
}

export interface OperationsRequest {
  accountId: string;
  from: string;
  to: string;
}

export interface CandlesRequest extends Omit<OperationsRequest, "accountId"> {
  instrumentId: string;
  interval: "1m" | "5m" | "15m" | "1h" | "1d" | "1w" | "1M";
}

export interface SettingsSnapshot {
  mode: "demo" | "broker";
  hasToken: boolean;
  preferences: AppPreferences;
}

export interface AccountOption {
  id: string;
  name: string;
  type: string;
  status: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  provider: AgentProviderName | null;
  content: string;
  snapshotId: string;
  createdAt: string;
}

export interface ChatRequest {
  requestId: string;
  provider: AgentProviderName;
  prompt: string;
}

export interface ChatEventPayload {
  requestId: string;
  event: AgentEvent;
}

export interface InvestAiApi {
  getAppInfo(): Promise<AppInfo>;
  getLatestSnapshot(): Promise<string | null>;
  refreshPortfolio(): Promise<string>;
  getOperations(request: OperationsRequest): Promise<string>;
  getCandles(request: CandlesRequest): Promise<string>;
  getSettings(): Promise<SettingsSnapshot>;
  saveBrokerToken(token: string): Promise<SettingsSnapshot>;
  removeBrokerToken(): Promise<SettingsSnapshot>;
  updateSettings(preferences: Partial<AppPreferences>): Promise<SettingsSnapshot>;
  listAccounts(): Promise<AccountOption[]>;
  scanAgents(): Promise<CliAvailability[]>;
  listChat(): Promise<ChatMessage[]>;
  sendChat(request: ChatRequest): Promise<ChatMessage | null>;
  cancelChat(requestId: string): Promise<boolean>;
  clearChat(): Promise<void>;
  onChatEvent(callback: (payload: ChatEventPayload) => void): () => void;
  onPortfolioUpdated(callback: (payload: string) => void): () => void;
}

export const APP_INFO: AppInfo = {
  name: "Invest AI",
  version: "0.1.0",
  mode: "demo",
};
