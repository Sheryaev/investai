import type { AgentProviderName, AgentRequest } from "./cli-types";

export interface CliCommand {
  executable: string;
  args: string[];
  cwd: string;
  input?: string;
}

export function buildCliCommand(provider: AgentProviderName, request: AgentRequest): CliCommand {
  if (provider === "codex") {
    return {
      executable: "codex",
      args: [
        "exec", "--json", "--sandbox", "read-only", "--skip-git-repo-check", "--ephemeral",
        "--ignore-rules", "--ignore-user-config", "-",
      ],
      cwd: request.workingDirectory,
      input: request.prompt,
    };
  }
  if (provider === "kimi") {
    return {
      executable: "kimi",
      args: ["-p", request.prompt, "--output-format", "stream-json", "--agent-file", request.agentProfilePath],
      cwd: request.workingDirectory,
    };
  }
  return {
    executable: "claude",
    args: [
      "-p", "--output-format", "stream-json", "--verbose", "--include-partial-messages",
      "--tools", "", "--disallowedTools", "mcp__*", "--permission-prompts", "none",
      "--no-session-persistence", "--strict-mcp-config", "--mcp-config", request.emptyMcpConfigPath,
      "--setting-sources", "",
    ],
    cwd: request.workingDirectory,
    input: request.prompt,
  };
}
