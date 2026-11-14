import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AppLogger, redactSecrets } from "../../src/main/logging/logger";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("redaction and local logs", () => {
  it("redacts bearer tokens, token fields and explicitly registered secrets", () => {
    const input = "Bearer t.secret token=t.secret authorization=abc123";
    const output = redactSecrets(input, ["t.secret", "abc123"]);
    expect(output).not.toContain("t.secret");
    expect(output).not.toContain("abc123");
    expect(redactSecrets({ token: "t.secret", nested: { authorization: "Bearer abc" } })).toEqual({ token: "[скрыто]", nested: { authorization: "[скрыто]" } });
  });

  it("writes structured events without secrets or chat content", async () => {
    const root = await mkdtemp(join(process.cwd(), "tests", ".logs-"));
    directories.push(root);
    const logger = new AppLogger(root, () => new Date("2026-11-14T18:00:00.000Z"));
    logger.registerSecret("t.secret");
    logger.info("chat.started", { provider: "kimi", prompt: "Bearer t.secret" });
    logger.error("broker.failed", { message: "token=t.secret", stack: "secret t.secret" });
    const content = await readFile(join(root, "invest-ai.log"), "utf8");
    const lines = content.trim().split("\n").map((line) => JSON.parse(line));
    expect(lines[0]).toMatchObject({ level: "info", event: "chat.started", provider: "kimi" });
    expect(content).not.toContain("t.secret");
    expect(content).toContain("[скрыто]");
  });
});
