import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type { ProcessEvent, ProcessRunner, ProcessSpec } from "./cli-types";

export type ProcessErrorCategory = "timeout" | "cancelled" | "provider";

export class ProcessRunError extends Error {
  constructor(public readonly category: ProcessErrorCategory, message: string) {
    super(message);
    this.name = "ProcessRunError";
  }
}

function terminateTree(child: ChildProcessWithoutNullStreams): void {
  if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32") {
    const killer = spawn("taskkill.exe", ["/pid", String(child.pid), "/T", "/F"], {
      shell: false,
      windowsHide: true,
      stdio: "ignore",
    });
    killer.on("error", () => child.kill());
    return;
  }
  child.kill("SIGTERM");
}

export class NodeProcessRunner implements ProcessRunner {
  async *stream(spec: ProcessSpec, signal?: AbortSignal): AsyncIterable<ProcessEvent> {
    const queue: ProcessEvent[] = [];
    let closed = false;
    let failure: ProcessRunError | null = null;
    let waiting: (() => void) | null = null;
    const wake = () => {
      waiting?.();
      waiting = null;
    };
    const push = (event: ProcessEvent) => {
      queue.push(event);
      wake();
    };
    const wait = () => new Promise<void>((resolve) => { waiting = resolve; });

    const child = spawn(spec.executable, spec.args, {
      cwd: spec.cwd,
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (text: string) => push({ type: "stdout", text }));
    child.stderr.on("data", (text: string) => push({ type: "stderr", text }));
    child.stdin.on("error", () => undefined);

    const stop = (category: ProcessErrorCategory, message: string) => {
      if (closed || failure) return;
      failure = new ProcessRunError(category, message);
      terminateTree(child);
    };
    const onAbort = () => stop("cancelled", "Процесс остановлен пользователем.");
    if (signal?.aborted) onAbort();
    else signal?.addEventListener("abort", onAbort, { once: true });

    const timeout = setTimeout(() => stop("timeout", "Превышено время ожидания CLI."), spec.timeoutMs);
    child.on("error", () => {
      if (!failure) failure = new ProcessRunError("provider", "Не удалось запустить CLI.");
      closed = true;
      wake();
    });
    child.on("close", (code) => {
      push({ type: "exit", code });
      closed = true;
      wake();
    });

    if (!closed && !failure) {
      if (spec.input !== undefined) child.stdin.end(spec.input, "utf8");
      else child.stdin.end();
    } else {
      child.stdin.destroy();
      terminateTree(child);
    }

    try {
      while (!closed || queue.length > 0) {
        if (queue.length === 0) await wait();
        while (queue.length > 0) yield queue.shift()!;
      }
      if (failure) throw failure;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      if (!closed) {
        terminateTree(child);
        child.stdout.destroy();
        child.stderr.destroy();
        child.stdin.destroy();
      }
    }
  }
}
