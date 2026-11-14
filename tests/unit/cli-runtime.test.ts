import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureCliRuntime } from "../../src/main/agents/cli-runtime";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("CLI runtime files", () => {
  it("creates an empty workspace and a Kimi profile with no tools", async () => {
    const root = await mkdtemp(join(process.cwd(), "tests", ".cli-runtime-"));
    temporaryDirectories.push(root);
    const runtime = await ensureCliRuntime(root);
    const profile = await readFile(runtime.agentProfilePath, "utf8");
    const mcp = JSON.parse(await readFile(runtime.emptyMcpConfigPath, "utf8"));
    expect(profile).toContain("tools: []");
    expect(profile).toContain("subagents: []");
    expect(mcp).toEqual({ mcpServers: {} });
    expect(runtime.workingDirectory).not.toBe(process.cwd());
  });
});
