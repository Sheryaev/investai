import { describe, expect, it } from "vitest";
import { NodeProcessRunner } from "../../src/main/agents/process-runner";
import type { ProcessEvent } from "../../src/main/agents/cli-types";

async function collect(events: AsyncIterable<ProcessEvent>): Promise<ProcessEvent[]> {
  const result: ProcessEvent[] = [];
  for await (const event of events) result.push(event);
  return result;
}

describe("NodeProcessRunner", () => {
  it("passes input through stdin and streams stdout", async () => {
    const runner = new NodeProcessRunner();
    const events = await collect(runner.stream({
      executable: process.execPath,
      args: ["-e", "let value='';process.stdin.on('data',c=>value+=c);process.stdin.on('end',()=>process.stdout.write(value.toUpperCase()))"],
      cwd: process.cwd(),
      input: "private portfolio",
      timeoutMs: 5_000,
    }));
    expect(events).toContainEqual({ type: "stdout", text: "PRIVATE PORTFOLIO" });
    expect(events.at(-1)).toEqual({ type: "exit", code: 0 });
  });

  it("stops a hung process at the timeout", async () => {
    const runner = new NodeProcessRunner();
    await expect(collect(runner.stream({
      executable: process.execPath,
      args: ["-e", "setTimeout(()=>{},10000)"],
      cwd: process.cwd(),
      timeoutMs: 30,
    }))).rejects.toMatchObject({ category: "timeout" });
  });

  it("cancels a running process through AbortSignal", async () => {
    const runner = new NodeProcessRunner();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30);
    try {
      await expect(collect(runner.stream({
        executable: process.execPath,
        args: ["-e", "setTimeout(()=>{},10000)"],
        cwd: process.cwd(),
        timeoutMs: 5_000,
      }, controller.signal))).rejects.toMatchObject({ category: "cancelled" });
    } finally {
      clearTimeout(timer);
    }
  });

  it("does not retry or fall back when the executable is missing", async () => {
    const runner = new NodeProcessRunner();
    await expect(collect(runner.stream({
      executable: "definitely-missing-invest-ai-cli",
      args: [],
      cwd: process.cwd(),
      timeoutMs: 100,
    }))).rejects.toMatchObject({ category: "provider" });
  });
});
