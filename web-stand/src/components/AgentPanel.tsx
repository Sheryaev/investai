interface AgentPanelProps {
  pinned: boolean;
  onPin: () => void;
  onClose: () => void;
}

export function AgentPanel(_props: AgentPanelProps) {
  return <aside className="agent-panel" aria-label="ИИ-агент" role="complementary" />;
}
