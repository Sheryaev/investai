import type { AgentProviderName, CliAvailability, ProcessRunner } from "./cli-types";

export class CliDetector {
  constructor(private readonly runner: ProcessRunner, private readonly workingDirectory: string) {}

  async detectOne(provider: AgentProviderName): Promise<CliAvailability> {
    const base = { provider, path: null, version: null, message: null };
    const location = await this.capture("where.exe", [provider]);
    if (location.code !== 0 || !location.stdout.trim()) return { ...base, status: "not_installed" };
    const path = location.stdout.split(/\r?\n/).find((line) => line.trim())?.trim() ?? null;
    const versionResult = await this.capture(provider, ["--version"]);
    if (versionResult.code !== 0) {
      return { ...base, path, status: "error", message: "CLI найден, но не запускается. Проверьте установку." };
    }
    const version = versionResult.stdout.match(/\d+\.\d+\.\d+(?:[-\w.]*)/)?.[0] ?? versionResult.stdout.trim() ?? null;
    if (provider === "codex") {
      const login = await this.capture(provider, ["login", "status"]);
      if (login.code !== 0) {
        return { ...base, path, version, status: "auth_required", message: "Выполните в терминале: codex login" };
      }
      return { ...base, path, version, status: "ready" };
    }
    return { ...base, path, version, status: "installed" };
  }

  async detectAll(): Promise<CliAvailability[]> {
    return Promise.all((["codex", "kimi", "claude"] as const).map((provider) => this.detectOne(provider)));
  }

  private async capture(executable: string, args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
    let stdout = "";
    let stderr = "";
    let code: number | null = 1;
    try {
      for await (const event of this.runner.stream({ executable, args, cwd: this.workingDirectory, timeoutMs: 10_000 })) {
        if (event.type === "stdout") stdout += event.text;
        if (event.type === "stderr") stderr += event.text;
        if (event.type === "exit") code = event.code;
      }
    } catch {
      return { code: 1, stdout, stderr };
    }
    return { code, stdout, stderr };
  }
}
