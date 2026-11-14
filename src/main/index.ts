import electron from "electron";
import type { BrowserWindow as BrowserWindowType } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createWindowOptions, isSafeExternalUrl } from "./window-security";
import { InvestContainer } from "./container";
import { registerIpc } from "./ipc";
import { SettingsService } from "./settings/settings-service";
import { ElectronStorageCipher } from "./settings/electron-cipher";
import { CliDetector } from "./agents/cli-detector";
import { NodeProcessRunner } from "./agents/process-runner";
import { ensureCliRuntime } from "./agents/cli-runtime";
import { AgentHub } from "./agents/agent-hub";
import { CliProvider } from "./agents/cli-provider";
import { ChatService } from "./agents/chat-service";
import { AppLogger } from "./logging/logger";

const { app, BrowserWindow, ipcMain, shell, safeStorage } = electron;
if (process.env.INVEST_AI_USER_DATA) app.setPath("userData", process.env.INVEST_AI_USER_DATA);
const currentDirectory = dirname(fileURLToPath(import.meta.url));
let container: InvestContainer | null = null;

function createWindow(): BrowserWindowType {
  const window = new BrowserWindow(
    createWindowOptions(join(currentDirectory, "../preload/index.cjs")),
  );

  window.once("ready-to-show", () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (url === window.webContents.getURL()) return;
    event.preventDefault();
    if (isSafeExternalUrl(url)) void shell.openExternal(url);
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(currentDirectory, "../renderer/index.html"));
  }
  return window;
}

app.whenReady().then(async () => {
  const userData = app.getPath("userData");
  const logger = new AppLogger(join(userData, "logs"));
  const settings = new SettingsService(join(userData, "settings"), new ElectronStorageCipher(safeStorage));
  logger.info("app.started", { version: app.getVersion(), mode: (await settings.getState()).mode });
  const runtime = await ensureCliRuntime(join(userData, "agent-runtime"));
  const runner = new NodeProcessRunner();
  const agents = new CliDetector(runner, runtime.workingDirectory);
  const hub = new AgentHub({ codex: new CliProvider("codex", runner), kimi: new CliProvider("kimi", runner), claude: new CliProvider("claude", runner) });
  container = new InvestContainer(join(userData, "invest-ai.db"), await settings.createGateway());
  const chat = new ChatService(hub, container.chat, runtime, () => container?.portfolio.cached() ?? null);
  registerIpc(ipcMain, container, { settings, agents, chat, logger });
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  container?.close();
  container = null;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
