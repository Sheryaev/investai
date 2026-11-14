import { contextBridge, ipcRenderer } from "electron";
import type { AppInfo, CandlesRequest, ChatEventPayload, InvestAiApi, OperationsRequest } from "../shared/contracts";

const api: InvestAiApi = {
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke("app:get-info"),
  getLatestSnapshot: (): Promise<string | null> => ipcRenderer.invoke("portfolio:get-latest"),
  refreshPortfolio: (): Promise<string> => ipcRenderer.invoke("portfolio:refresh"),
  getOperations: (request: OperationsRequest): Promise<string> => ipcRenderer.invoke("portfolio:operations", request),
  getCandles: (request: CandlesRequest): Promise<string> => ipcRenderer.invoke("portfolio:candles", request),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveBrokerToken: (token: string) => ipcRenderer.invoke("settings:save-token", token),
  removeBrokerToken: () => ipcRenderer.invoke("settings:remove-token"),
  updateSettings: (preferences) => ipcRenderer.invoke("settings:update", preferences),
  listAccounts: () => ipcRenderer.invoke("settings:list-accounts"),
  scanAgents: () => ipcRenderer.invoke("agents:scan"),
  listChat: () => ipcRenderer.invoke("chat:list"),
  sendChat: (request) => ipcRenderer.invoke("chat:send", request),
  cancelChat: (requestId) => ipcRenderer.invoke("chat:cancel", requestId),
  clearChat: () => ipcRenderer.invoke("chat:clear"),
  onChatEvent: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: ChatEventPayload) => {
      if (typeof payload?.requestId === "string" && payload.event) callback(payload);
    };
    ipcRenderer.on("chat:event", listener);
    return () => ipcRenderer.removeListener("chat:event", listener);
  },
  onPortfolioUpdated: (callback: (payload: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: string) => {
      if (typeof payload === "string") callback(payload);
    };
    ipcRenderer.on("portfolio:updated", listener);
    return () => ipcRenderer.removeListener("portfolio:updated", listener);
  },
};

contextBridge.exposeInMainWorld("investAi", api);
