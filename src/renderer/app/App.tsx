import { useCallback, useEffect, useState } from "react";
import type { AppInfo } from "../../shared/contracts";
import { deserializeSnapshot } from "../../main/database/snapshot-codec";
import type { PortfolioSnapshot } from "../../main/portfolio/types";
import { DashboardPage } from "../pages/DashboardPage";
import { PortfolioPage } from "../pages/PortfolioPage";
import { AnalyticsPage } from "../pages/AnalyticsPage";
import { SettingsPage } from "../pages/SettingsPage";
import { ChatPage } from "../pages/ChatPage";

type Page = "overview" | "portfolio" | "analytics" | "chat" | "settings";

const navigation: Array<{ id: Page; label: string; icon: string }> = [
  { id: "overview", label: "Обзор", icon: "◫" },
  { id: "portfolio", label: "Портфель", icon: "▤" },
  { id: "analytics", label: "Аналитика", icon: "↗" },
  { id: "chat", label: "ИИ-чат", icon: "✦" },
  { id: "settings", label: "Настройки", icon: "⚙" },
];

export function App() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [page, setPage] = useState<Page>("overview");
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const payload = await window.investAi.refreshPortfolio();
      setSnapshot(deserializeSnapshot(payload));
    } catch {
      setError("Не удалось обновить данные. Показан последний сохранённый снимок.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void window.investAi.getAppInfo().then((value) => { if (active) setInfo(value); });
    const unsubscribe = window.investAi.onPortfolioUpdated((payload) => {
      if (active) setSnapshot(deserializeSnapshot(payload));
    });
    void (async () => {
      try {
        const cached = await window.investAi.getLatestSnapshot();
        if (cached && active) setSnapshot(deserializeSnapshot(cached));
      } catch {
        if (active) setError("Локальный снимок повреждён. Попробуйте обновить данные.");
      }
      if (active) await refresh();
    })();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [refresh]);

  const stale = snapshot ? Date.now() - new Date(snapshot.asOf).getTime() > 15 * 60 * 1000 : false;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">IA</span><div>Invest <span>AI</span><small>PORTFOLIO INTELLIGENCE</small></div></div>
        <nav className="navigation" aria-label="Основная навигация">
          <span className="nav-caption">РАБОЧЕЕ ПРОСТРАНСТВО</span>
          {navigation.slice(0, 4).map((item) => (
            <button key={item.id} type="button" className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => setPage(item.id)}>
              <span className="nav-icon">{item.icon}</span>{item.label}
              {item.id === "chat" && <span className="nav-new">AI</span>}
            </button>
          ))}
          <span className="nav-caption second">СИСТЕМА</span>
          {navigation.slice(4).map((item) => (
            <button key={item.id} type="button" className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => setPage(item.id)}>
              <span className="nav-icon">{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className={`connection-dot ${info?.mode === "demo" ? "demo" : ""}`} />
          <div><strong>{info?.mode === "broker" ? "Т-Инвестиции" : "Демо-режим"}</strong><span>{info ? `Invest AI v${info.version}` : "Запуск…"}</span></div>
        </div>
      </aside>
      <section className="content">
        {error && <div className="error-banner" role="alert">{error}</div>}
        {page === "overview" && <DashboardPage snapshot={snapshot} stale={stale} refreshing={refreshing} onRefresh={() => void refresh()} />}
        {page === "portfolio" && <PortfolioPage snapshot={snapshot} />}
        {page === "analytics" && <AnalyticsPage snapshot={snapshot} />}
        {page === "settings" && <SettingsPage onChanged={(state) => {
          setInfo((current) => current ? { ...current, mode: state.mode } : current);
          void refresh();
        }} />}
        {page === "chat" && <ChatPage snapshot={snapshot} />}
      </section>
    </main>
  );
}
