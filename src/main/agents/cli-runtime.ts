import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const agentProfile = `---
name: invest-ai-readonly
description: Анализирует только переданный снимок портфеля без локальных инструментов
tools: []
subagents: []
---

Ты — аналитик инвестиционного портфеля. Используй только данные, переданные в запросе.
Не обращайся к файлам, сети, командам, MCP, другим агентам и торговым функциям.
Указывай время снимка, отделяй факты от интерпретации, явно отмечай неполные данные.
Это аналитика, а не индивидуальная инвестиционная рекомендация.
`;

export async function ensureCliRuntime(root: string): Promise<{
  workingDirectory: string;
  agentProfilePath: string;
  emptyMcpConfigPath: string;
}> {
  const workingDirectory = join(root, "workspace");
  const agentProfilePath = join(root, "readonly-agent.md");
  const emptyMcpConfigPath = join(root, "empty-mcp.json");
  await mkdir(workingDirectory, { recursive: true });
  await writeFile(agentProfilePath, agentProfile, { encoding: "utf8", mode: 0o600 });
  await writeFile(emptyMcpConfigPath, JSON.stringify({ mcpServers: {} }), { encoding: "utf8", mode: 0o600 });
  return { workingDirectory, agentProfilePath, emptyMcpConfigPath };
}
