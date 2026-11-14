import { useEffect, useState } from "react";
import type { CliAvailability, CliStatus } from "../../main/agents/cli-types";
import type { Currency } from "../../main/portfolio/types";
import type { AccountOption, SettingsSnapshot } from "../../shared/contracts";

const providerNames = { codex: "Codex", kimi: "Kimi", claude: "Claude" } as const;
const statusNames: Record<CliStatus, string> = {
  not_installed: "Не установлен", installed: "Установлен", ready: "Готов",
  auth_required: "Требуется вход", error: "Ошибка запуска",
};
const loginInstructions = {
  codex: "codex login", kimi: "kimi login", claude: "Запустите claude в терминале и выполните вход",
};

interface SettingsPageProps {
  onChanged?: (state: SettingsSnapshot) => void;
}

export function SettingsPage({ onChanged }: SettingsPageProps) {
  const [state, setState] = useState<SettingsSnapshot | null>(null);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [agents, setAgents] = useState<CliAvailability[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [currency, setCurrency] = useState<Currency>("RUB");
  const [interval, setInterval] = useState(5);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void window.investAi.getSettings().then((value) => {
      if (!active) return;
      setState(value);
      setSelected(value.preferences.selectedAccountIds);
      setCurrency(value.preferences.baseCurrency);
      setInterval(value.preferences.refreshIntervalMinutes);
    }).catch(() => { if (active) setError("Не удалось загрузить настройки."); });
    void window.investAi.listAccounts().then((value) => { if (active) setAccounts(value); })
      .catch(() => { if (active) setError("Не удалось получить список счетов. Проверьте токен и соединение."); });
    void window.investAi.scanAgents().then((value) => { if (active) setAgents(value); })
      .catch(() => { if (active) setError("Не удалось проверить локальные CLI."); })
      .finally(() => { if (active) setScanning(false); });
    return () => { active = false; };
  }, []);

  function applyState(value: SettingsSnapshot, success: string) {
    setState(value);
    setSelected(value.preferences.selectedAccountIds);
    setCurrency(value.preferences.baseCurrency);
    setInterval(value.preferences.refreshIntervalMinutes);
    setMessage(success);
    setError(null);
    onChanged?.(value);
  }

  async function saveToken() {
    setBusy(true);
    setMessage(null);
    try {
      const value = await window.investAi.saveBrokerToken(token);
      setToken("");
      applyState(value, "Токен зашифрован и сохранён. Режим Т-Инвестиций включён.");
    } catch {
      setError("Не удалось сохранить токен. Проверьте значение и доступность системного шифрования.");
    } finally { setBusy(false); }
  }

  async function removeToken() {
    if (!window.confirm("Удалить сохранённый токен и перейти в демо-режим?")) return;
    setBusy(true);
    try {
      applyState(await window.investAi.removeBrokerToken(), "Токен удалён. Включён демо-режим.");
    } catch { setError("Не удалось удалить токен."); }
    finally { setBusy(false); }
  }

  async function savePreferences() {
    setBusy(true);
    try {
      applyState(await window.investAi.updateSettings({
        selectedAccountIds: selected, baseCurrency: currency, refreshIntervalMinutes: interval,
      }), "Настройки портфеля сохранены.");
    } catch { setError("Не удалось сохранить настройки портфеля."); }
    finally { setBusy(false); }
  }

  async function rescan() {
    setScanning(true);
    try { setAgents(await window.investAi.scanAgents()); }
    catch { setError("Не удалось повторно проверить CLI."); }
    finally { setScanning(false); }
  }

  return (
    <div className="page-stack settings-page">
      <header className="page-header"><div><span className="eyebrow">ПОДКЛЮЧЕНИЯ И ПРИВАТНОСТЬ</span><h1>Настройки</h1><p className="muted">Брокер, счета и локальные ИИ-агенты</p></div><span className={`mode-badge ${state?.mode === "broker" ? "broker" : ""}`}>{state?.mode === "broker" ? "Т-Инвестиции" : "Демо-режим"}</span></header>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {message && <div className="success-banner" role="status">{message}</div>}
      <section className="panel settings-section">
        <div className="settings-section-heading"><div><h2>Т-Инвестиции</h2><p>Только read-only токен. Приложение не создаёт и не отменяет заявки.</p></div><span className="privacy-badge">safeStorage</span></div>
        <div className="settings-form-row">
          <label className="settings-field"><span>Read-only токен</span><input className="field" type="password" aria-label="Read-only токен" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} placeholder={state?.hasToken ? "Токен сохранён · введите новый для замены" : "Вставьте токен Т-Инвестиций"} /></label>
          <button className="button primary" type="button" disabled={busy || !token.trim()} onClick={() => void saveToken()}>Сохранить токен</button>
          {state?.hasToken && <button className="button secondary" type="button" disabled={busy} onClick={() => void removeToken()}>Удалить</button>}
        </div>
        <p className="settings-hint">Токен шифруется средствами Windows и не попадает в графики, чат, журналы или экспорт.</p>
      </section>
      <section className="panel settings-section">
        <div className="settings-section-heading"><div><h2>Портфель</h2><p>Если ни один счёт не выбран, используются все доступные счета.</p></div></div>
        <div className="account-options">
          {accounts.map((account) => <label className="account-option" key={account.id}><input type="checkbox" aria-label={account.name} checked={selected.includes(account.id)} onChange={() => setSelected((current) => current.includes(account.id) ? current.filter((id) => id !== account.id) : [...current, account.id])} /><span><strong>{account.name}</strong><small>{account.type} · {account.status}</small></span></label>)}
          {accounts.length === 0 && <p className="muted">Список счетов пока недоступен.</p>}
        </div>
        <div className="preferences-row">
          <label className="settings-field"><span>Базовая валюта</span><select className="field" aria-label="Базовая валюта" value={currency} onChange={(event) => setCurrency(event.target.value as Currency)}><option>RUB</option><option>USD</option><option>EUR</option><option>CNY</option></select></label>
          <label className="settings-field"><span>Интервал обновления, мин</span><input className="field" aria-label="Интервал обновления" type="number" min={1} max={1440} value={interval} onChange={(event) => setInterval(Number(event.target.value))} /></label>
          <button className="button secondary" type="button" disabled={busy} onClick={() => void savePreferences()}>Сохранить настройки</button>
        </div>
        <p className="settings-hint">Разные валюты не складываются без курса: в таком случае итог будет отмечен как неполный.</p>
      </section>
      <section className="panel settings-section">
        <div className="settings-section-heading"><div><h2>Локальные ИИ-агенты</h2><p>Используется вход, уже выполненный в CLI. API-ключи не нужны.</p></div><button className="button secondary compact" type="button" disabled={scanning} onClick={() => void rescan()}>{scanning ? "Проверяем…" : "Проверить снова"}</button></div>
        <div className="agent-settings-grid">
          {agents.map((agent) => <article className="agent-settings-card" key={agent.provider}>
            <div className="agent-card-heading"><strong>{providerNames[agent.provider]}</strong><span className={`agent-status ${agent.status}`}>{statusNames[agent.status]}</span></div>
            <p>{agent.version ? `Версия ${agent.version}` : "CLI не найден в PATH"}</p>
            <code>{loginInstructions[agent.provider]}</code>
            {agent.message && <small>{agent.message}</small>}
          </article>)}
          {agents.length === 0 && <p className="muted">Проверяем codex, kimi и claude в PATH…</p>}
        </div>
      </section>
    </div>
  );
}
