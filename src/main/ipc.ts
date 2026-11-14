import type { IpcMain } from "electron";
import { z } from "zod";
import { APP_INFO } from "../shared/contracts";
import type { InvestContainer } from "./container";
import type { SettingsService } from "./settings/settings-service";
import type { CliDetector } from "./agents/cli-detector";
import type { ChatService } from "./agents/chat-service";
import type { AppLogger } from "./logging/logger";

const range = { from: z.string().datetime(), to: z.string().datetime() };
const operationsRequest = z.object({ accountId: z.string().min(1).max(200), ...range }).strict();
const candlesRequest = z.object({
  instrumentId: z.string().min(1).max(200), ...range,
  interval: z.enum(["1m", "5m", "15m", "1h", "1d", "1w", "1M"]),
}).strict();
const preferencesRequest = z.object({
  selectedAccountIds: z.array(z.string().min(1).max(200)).max(100).optional(),
  baseCurrency: z.enum(["RUB", "USD", "EUR", "CNY"]).optional(),
  refreshIntervalMinutes: z.number().int().min(1).max(1440).optional(),
}).strict();

const chatRequest = z.object({
  requestId: z.string().min(8).max(100), provider: z.enum(["codex", "kimi", "claude"]),
  prompt: z.string().trim().min(1).max(8000),
}).strict();

export interface IpcServices {
  settings: SettingsService;
  agents: CliDetector;
  chat: ChatService;
  logger: AppLogger;
}

export function registerIpc(ipcMain: IpcMain, container: InvestContainer, services: IpcServices): void {
  const activeChats = new Map<string, AbortController>();
  ipcMain.handle("app:get-info", async () => ({ ...APP_INFO, mode: (await services.settings.getState()).mode }));
  ipcMain.handle("portfolio:get-latest", () => container.latestSnapshot());
  ipcMain.handle("portfolio:refresh", async (event) => {
    const { preferences } = await services.settings.getState();
    const payload = await container.refreshSnapshot(preferences.selectedAccountIds, preferences.baseCurrency);
    event.sender.send("portfolio:updated", payload);
    return payload;
  });
  ipcMain.handle("portfolio:operations", async (_event, request: unknown) => {
    const input = operationsRequest.parse(request);
    return container.operations(input.accountId, input.from, input.to);
  });
  ipcMain.handle("portfolio:candles", async (_event, request: unknown) => {
    const input = candlesRequest.parse(request);
    return container.candles(input.instrumentId, input.from, input.to, input.interval);
  });
  ipcMain.handle("settings:get", () => services.settings.getState());
  ipcMain.handle("settings:save-token", async (_event, request: unknown) => {
    const token = z.string().trim().min(1).max(4096).parse(request);
    services.logger.registerSecret(token);
    const state = await services.settings.saveToken(token);
    container.useGateway(await services.settings.createGateway());
    services.logger.info("broker.token.saved", { mode: state.mode });
    return state;
  });
  ipcMain.handle("settings:remove-token", async () => {
    const state = await services.settings.removeToken();
    container.useGateway(await services.settings.createGateway());
    return state;
  });
  ipcMain.handle("settings:update", async (_event, request: unknown) => services.settings.update(preferencesRequest.parse(request)));
  ipcMain.handle("settings:list-accounts", async () => {
    const accounts = await container.listAccounts();
    return accounts.map(({ id, name, type, status }) => ({ id, name, type, status }));
  });
  ipcMain.handle("agents:scan", () => services.agents.detectAll());
  ipcMain.handle("chat:list", () => services.chat.list());
  ipcMain.handle("chat:clear", () => services.chat.clear());
  ipcMain.handle("chat:send", async (event, request: unknown) => {
    const input = chatRequest.parse(request);
    if (activeChats.has(input.requestId)) throw new Error("Этот запрос уже выполняется.");
    const controller = new AbortController();
    activeChats.set(input.requestId, controller);
    services.logger.info("chat.started", { provider: input.provider, requestId: input.requestId });
    try {
      const result = await services.chat.send(input.provider, input.prompt, (agentEvent) => {
        event.sender.send("chat:event", { requestId: input.requestId, event: agentEvent });
      }, controller.signal);
      services.logger.info("chat.finished", { provider: input.provider, requestId: input.requestId, saved: result !== null });
      return result;
    } catch (error) {
      services.logger.error("chat.failed", { provider: input.provider, requestId: input.requestId, message: error instanceof Error ? error.message : "unknown" });
      throw error;
    } finally {
      activeChats.delete(input.requestId);
    }
  });
  ipcMain.handle("chat:cancel", (_event, request: unknown) => {
    const requestId = z.string().min(8).max(100).parse(request);
    const controller = activeChats.get(requestId);
    controller?.abort();
    return controller !== undefined;
  });
}
