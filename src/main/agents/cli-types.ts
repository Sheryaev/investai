export type AgentProviderName = "codex" | "kimi" | "claude";
export type CliStatus = "not_installed" | "installed" | "ready" | "auth_required" | "error";

export interface CliAvailability {
  provider: AgentProviderName;
  status: CliStatus;
  path: string | null;
  version: string | null;
  message: string | null;
}

export interface AgentRequest {
  prompt: string;
  workingDirectory: string;
  agentProfilePath: string;
  emptyMcpConfigPath: string;
  persistSession: boolean;
  model?: string;
  sessionId?: string;
}

export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "session"; sessionId: string }
  | { type: "done" }
  | { type: "error"; category: "auth" | "provider" | "network" | "timeout" | "cancelled"; message: string };

export interface ProcessSpec {
  executable: string;
  args: string[];
  cwd: string;
  input?: string;
  timeoutMs: number;
}

export type ProcessEvent =
  | { type: "stdout" | "stderr"; text: string }
  | { type: "exit"; code: number | null };

export interface ProcessRunner {
  stream(spec: ProcessSpec, signal?: AbortSignal): AsyncIterable<ProcessEvent>;
}

export interface AgentProvider {
  readonly name: AgentProviderName;
  stream(request: AgentRequest, signal: AbortSignal): AsyncIterable<AgentEvent>;
}
