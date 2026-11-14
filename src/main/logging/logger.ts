import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const sensitiveKey = /^(token|access[_-]?token|api[_-]?key|authorization|password|secret)$/i;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function redactSecrets<T>(input: T, secrets: string[] = []): T {
  if (typeof input === "string") {
    let result: string = input;
    for (const secret of secrets.filter(Boolean)) result = result.replace(new RegExp(escapeRegExp(secret), "g"), "[скрыто]");
    return result
      .replace(/Bearer\s+[^\s,;]+/gi, "Bearer [скрыто]")
      .replace(/\b(token|api[_-]?key|authorization)(\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, "$1$2[скрыто]") as T;
  }
  if (Array.isArray(input)) return input.map((item) => redactSecrets(item, secrets)) as T;
  if (input && typeof input === "object") {
    return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, sensitiveKey.test(key) ? "[скрыто]" : redactSecrets(value, secrets)])) as T;
  }
  return input;
}

export class AppLogger {
  private readonly filePath: string;
  private readonly secrets: string[] = [];

  constructor(root: string, private readonly now: () => Date = () => new Date()) {
    mkdirSync(root, { recursive: true });
    this.filePath = join(root, "invest-ai.log");
  }

  registerSecret(secret: string): void {
    if (secret && !this.secrets.includes(secret)) this.secrets.push(secret);
  }

  info(event: string, data: Record<string, unknown> = {}): void { this.write("info", event, data); }
  warn(event: string, data: Record<string, unknown> = {}): void { this.write("warn", event, data); }
  error(event: string, data: Record<string, unknown> = {}): void { this.write("error", event, data); }

  private write(level: string, event: string, data: Record<string, unknown>): void {
    const entry = redactSecrets({ time: this.now().toISOString(), level, event, ...data }, this.secrets);
    try { appendFileSync(this.filePath, `${JSON.stringify(entry)}\n`, { encoding: "utf8", mode: 0o600 }); } catch { /* Logging must not stop the application. */ }
  }
}
