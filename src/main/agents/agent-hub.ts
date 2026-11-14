import type { AgentEvent, AgentProvider, AgentProviderName, AgentRequest } from "./cli-types";

export class AgentHub {
  constructor(private readonly providers: Record<AgentProviderName, AgentProvider>) {}

  stream(provider: AgentProviderName, request: AgentRequest, signal: AbortSignal): AsyncIterable<AgentEvent> {
    return this.providers[provider].stream(request, signal);
  }
}
