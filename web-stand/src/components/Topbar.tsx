import { Moon, Sparkles, Sun } from "lucide-react";
import type { Account } from "../demo-data";

interface TopbarProps {
  accounts: Account[];
  accountId: string;
  onAccount: (id: string) => void;
  theme: "light" | "dark";
  onTheme: () => void;
  onAgent: () => void;
}

export function Topbar(props: TopbarProps) {
  const dark = props.theme === "dark";

  return (
    <header className="topbar">
      <div className="topbar-heading">
        <h1>Обзор</h1>
        <span className="updated">Сегодня, 14:32</span>
      </div>
      <div className="top-actions">
        <select
          aria-label="Счёт"
          value={props.accountId}
          onChange={(event) => props.onAccount(event.target.value)}
        >
          {props.accounts.map((account) => (
            <option value={account.id} key={account.id}>{account.name}</option>
          ))}
        </select>
        <button
          className="icon-button"
          type="button"
          aria-label={dark ? "Светлая тема" : "Тёмная тема"}
          title={dark ? "Светлая тема" : "Тёмная тема"}
          onClick={props.onTheme}
        >
          {dark ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
        </button>
        <button className="agent-button" type="button" aria-label="Открыть агента" onClick={props.onAgent}>
          <Sparkles size={19} aria-hidden="true" />
          <span>Агент</span>
        </button>
      </div>
    </header>
  );
}
