import { useEffect, useState } from "react";
import { accounts } from "./demo-data";
import type { Period } from "./demo-data";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { PortfolioOverview } from "./components/PortfolioOverview";
import { AgentPanel } from "./components/AgentPanel";

type Theme = "light" | "dark";

export function StandApp() {
  const [theme, setTheme] = useState<Theme>(() => (
    localStorage.getItem("invest-theme") === "dark" ? "dark" : "light"
  ));
  const [accountId, setAccountId] = useState(accounts[0].id);
  const [period, setPeriod] = useState<Period>("3М");
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentPinned, setAgentPinned] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("invest-theme", theme);
  }, [theme]);

  const account = accounts.find((item) => item.id === accountId) ?? accounts[0];

  return (
    <div className={`stand-shell ${agentOpen && agentPinned ? "agent-is-pinned" : ""}`}>
      <Sidebar />
      <main className="workspace">
        <Topbar
          accounts={accounts}
          accountId={accountId}
          onAccount={setAccountId}
          theme={theme}
          onTheme={() => setTheme((value) => value === "light" ? "dark" : "light")}
          onAgent={() => setAgentOpen(true)}
        />
        <PortfolioOverview account={account} period={period} onPeriod={setPeriod} />
      </main>
      {agentOpen && (
        <AgentPanel
          account={account}
          pinned={agentPinned}
          onPin={() => setAgentPinned((value) => !value)}
          onClose={() => {
            setAgentOpen(false);
            setAgentPinned(false);
          }}
        />
      )}
    </div>
  );
}
