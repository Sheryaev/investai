# Invest AI Web Stand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Собрать отдельный визуальный веб-стенд обзора Invest AI со светлой и тёмной темами и интерактивной правой панелью демо-агента.

**Architecture:** Независимое React/Vite-приложение в `web-stand`, не импортирующее Electron или broker-код. Локальные типизированные демо-данные, React-состояние, ECharts и CSS design tokens; ответы агента создаются локальным сценарием.

**Tech Stack:** React 19, TypeScript 7, Vite 8, ECharts 6, Vitest, Testing Library, Playwright.

## Global Constraints

- Не изменять `src`, Electron API, брокерские контракты и текущий Windows-installer.
- Не выполнять запросы к брокеру или CLI; только демонстрационные данные.
- Основной текст не мельче 13–14 px; никаких технических пояснений в пользовательском интерфейсе.
- Отдельного пункта меню для чата нет; агент открывается справа из верхней панели.
- Светлая и тёмная темы используют одну структуру; выбранная тема сохраняется в `localStorage`.
- `npm run dev` должен принимать `--host` и `--port`; preview root — абсолютный каталог `web-stand`.
- Временный dev-server останавливается перед финальным ответом.
- Workspace не является Git-репозиторием: коммиты и Git-команды не выполняются.

---

### Task 1: Независимый scaffold и модель демо-данных

**Files:**
- Create: `web-stand/package.json`, `web-stand/tsconfig.json`, `web-stand/vite.config.ts`, `web-stand/index.html`
- Create: `web-stand/src/demo-data.ts`, `web-stand/src/demo-data.test.ts`
- Create: `web-stand/src/main.tsx`, `web-stand/src/vite-env.d.ts`

**Interfaces:**
- Produces: `Period`, `Account`, `accounts`, `historyForPeriod(points, period)`, `formatMoney(value)`.

- [ ] **Step 1: Создать конфигурацию приложения**

`web-stand/package.json`:

```json
{
  "name": "invest-ai-web-stand",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "echarts": "^6.1.0",
    "react": "^19.3.1",
    "react-dom": "^19.3.1"
  },
  "devDependencies": {
    "@playwright/test": "^1.65.1",
    "@testing-library/jest-dom": "^7.0.1",
    "@testing-library/react": "^16.3.3",
    "@testing-library/user-event": "^14.6.10",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "@vitejs/plugin-react": "^6.3.0",
    "jsdom": "^31.0.1",
    "typescript": "^7.0.2",
    "vite": "^8.3.8",
    "vitest": "^5.1.0"
  }
}
```

`web-stand/vite.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", setupFiles: "./src/test-setup.ts" },
});
```

`web-stand/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "vite.config.ts", "playwright.config.ts"]
}
```

`web-stand/index.html`:

```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#f4f5f7" />
    <title>Invest AI — визуальный стенд</title>
  </head>
  <body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>
```

`web-stand/src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { StandApp } from "./StandApp";
import "./tokens.css";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><StandApp /></React.StrictMode>,
);
```

`web-stand/src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 2: Написать failing-тесты модели**

`web-stand/src/demo-data.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { accounts, formatMoney, historyForPeriod } from "./demo-data";

 describe("demo portfolio", () => {
  it("keeps the full history for the all period", () => {
    const points = accounts[0].history;
    expect(historyForPeriod(points, "Всё")).toBe(points);
  });

  it("filters a week relative to the latest demo point", () => {
    const points = accounts[0].history;
    const result = historyForPeriod(points, "1Н");
    expect(result.length).toBe(8);
    expect(result.at(-1)).toBe(points.at(-1));
  });

  it("formats rubles without technical labels", () => {
    expect(formatMoney(1284500.5)).toMatch(/1.*284.*500/);
    expect(formatMoney(1284500.5)).toContain("₽");
  });
});
```

- [ ] **Step 3: Запустить тесты и увидеть ожидаемый FAIL**

Run: `cd web-stand && npm install && npm test`
Expected: FAIL, потому что `demo-data.ts` ещё не создан.

- [ ] **Step 4: Реализовать типы и детерминированные данные**

`web-stand/src/demo-data.ts`:

```ts
export const periods = ["1Д", "1Н", "1М", "3М", "1Г", "Всё"] as const;
export type Period = typeof periods[number];
export type AgentName = "Kimi" | "Codex" | "Claude";

export interface HistoryPoint { date: string; value: number }
export interface Position {
  ticker: string;
  name: string;
  value: number;
  weight: number;
  yieldPct: number;
  color: string;
}
export interface AllocationItem { label: string; value: number; color: string }
export interface Operation { title: string; detail: string; amount: number }
export interface Account {
  id: string;
  name: string;
  total: number;
  dayChange: number;
  dayChangePct: number;
  totalYieldPct: number;
  history: HistoryPoint[];
  positions: Position[];
  allocation: AllocationItem[];
  operations: Operation[];
}

function makeHistory(total: number, offset: number): HistoryPoint[] {
  const end = new Date("2026-11-14T12:00:00Z").getTime();
  return Array.from({ length: 181 }, (_, index) => {
    const progress = index / 180;
    const wave = Math.sin(index / 8 + offset) * 0.018 + Math.cos(index / 17) * 0.011;
    return {
      date: new Date(end - (180 - index) * 86_400_000).toISOString(),
      value: Math.round(total * (0.79 + progress * 0.21 + wave)),
    };
  });
}

const positions: Position[] = [
  { ticker: "SBER", name: "Сбербанк", value: 348200, weight: 27.1, yieldPct: 18.4, color: "#35b986" },
  { ticker: "YNDX", name: "Яндекс", value: 246900, weight: 19.2, yieldPct: 12.7, color: "#6c63ff" },
  { ticker: "LKOH", name: "Лукойл", value: 198400, weight: 15.4, yieldPct: -2.8, color: "#f0aa55" },
  { ticker: "T", name: "Т-Технологии", value: 162700, weight: 12.7, yieldPct: 22.1, color: "#e4ce45" },
  { ticker: "GAZP", name: "Газпром", value: 119300, weight: 9.3, yieldPct: 4.6, color: "#58a6de" },
];

export const accounts: Account[] = [
  {
    id: "main", name: "Основной счёт", total: 1284500,
    dayChange: 4380, dayChangePct: 0.34, totalYieldPct: 18.24,
    history: makeHistory(1284500, 0), positions,
    allocation: [
      { label: "Акции", value: 76.4, color: "#6c63ff" },
      { label: "Облигации", value: 14.8, color: "#35b986" },
      { label: "Валюта", value: 5.6, color: "#58a6de" },
      { label: "Деньги", value: 3.2, color: "#d6d9e0" },
    ],
    operations: [
      { title: "Дивиденды Сбербанк", detail: "Сегодня, 10:24", amount: 12400 },
      { title: "Покупка YNDX", detail: "12 ноября, 16:40", amount: -48200 },
      { title: "Пополнение", detail: "10 ноября, 09:15", amount: 100000 },
    ],
  },
  {
    id: "iis", name: "ИИС", total: 746200,
    dayChange: -1240, dayChangePct: -0.17, totalYieldPct: 11.8,
    history: makeHistory(746200, 1.4),
    positions: positions.map((position) => ({ ...position, value: Math.round(position.value * 0.58) })),
    allocation: [
      { label: "Акции", value: 68.2, color: "#6c63ff" },
      { label: "Облигации", value: 21.4, color: "#35b986" },
      { label: "Валюта", value: 4.1, color: "#58a6de" },
      { label: "Деньги", value: 6.3, color: "#d6d9e0" },
    ],
    operations: [
      { title: "Покупка SBER", detail: "Сегодня, 11:10", amount: -32100 },
      { title: "Купон ОФЗ", detail: "13 ноября, 12:00", amount: 6840 },
      { title: "Пополнение", detail: "8 ноября, 09:30", amount: 50000 },
    ],
  },
];

export function historyForPeriod(points: HistoryPoint[], period: Period): HistoryPoint[] {
  if (period === "Всё") return points;
  const days = { "1Д": 1, "1Н": 7, "1М": 30, "3М": 90, "1Г": 365 }[period];
  const end = new Date(points.at(-1)?.date ?? 0).getTime();
  return points.filter((point) => new Date(point.date).getTime() >= end - days * 86_400_000);
}

export function formatMoney(value: number): string {
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value)} ₽`;
}

export function demoAnswer(agent: AgentName, question: string): string {
  if (question.includes("риск")) return "Главный риск — концентрация в акциях и пяти крупнейших позициях. Сбербанк и Яндекс составляют 46,3% портфеля.";
  if (question.includes("измен")) return "За сегодня портфель вырос на 4 380 ₽. Основной вклад внесли Сбербанк и Т-Технологии.";
  return `${agent}: портфель выглядит умеренно сконцентрированным. Доходность с начала периода 18,24%, доля акций 76,4%.`;
}
```

- [ ] **Step 5: Прогнать тесты модели**

Run: `cd web-stand && npm test`
Expected: 3 passed.

---

### Task 2: Design tokens, каркас и переключение темы

**Files:**
- Create: `web-stand/src/tokens.css`, `web-stand/src/styles.css`
- Create: `web-stand/src/StandApp.tsx`, `web-stand/src/StandApp.test.tsx`, `web-stand/src/test-setup.ts`
- Create: `web-stand/src/components/Sidebar.tsx`, `web-stand/src/components/Topbar.tsx`

**Interfaces:**
- Produces: `StandApp`, `Sidebar`, `Topbar`; состояние `theme: "light" | "dark"`, `agentOpen: boolean`, `agentPinned: boolean`.

- [ ] **Step 1: Написать failing-тест темы и открытия агента**

`web-stand/src/test-setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

vi.stubGlobal("ResizeObserver", class {
  observe() {}
  unobserve() {}
  disconnect() {}
});
```

`web-stand/src/StandApp.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { StandApp } from "./StandApp";

 describe("StandApp", () => {
  it("switches theme and opens the agent without navigation", async () => {
    const user = userEvent.setup();
    render(<StandApp />);
    await user.click(screen.getByRole("button", { name: "Тёмная тема" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    await user.click(screen.getByRole("button", { name: "Открыть агента" }));
    expect(screen.getByRole("complementary", { name: "ИИ-агент" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Обзор" })).toBeVisible();
  });
});
```

Run: `cd web-stand && npm test -- StandApp`
Expected: FAIL, потому что `StandApp.tsx` отсутствует.

- [ ] **Step 2: Реализовать каркас и состояние**

`web-stand/src/components/Sidebar.tsx`:

```tsx
const items = ["Обзор", "Портфель", "Аналитика", "Операции", "Настройки"];
export function Sidebar() {
  return <aside className="sidebar">
    <div className="brand"><span className="brand-mark">IA</span><span>Invest AI</span></div>
    <nav aria-label="Разделы">{items.map((item) => item === "Обзор"
      ? <button className="nav-item active" key={item}>{item}</button>
      : <span className="nav-item nav-placeholder" key={item}>{item}</span>)}</nav>
    <div className="sidebar-foot"><span className="live-dot" />Демо-портфель</div>
  </aside>;
}
```

`web-stand/src/components/Topbar.tsx`:

```tsx
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
  return <header className="topbar">
    <div><h1>Обзор</h1><span className="updated">Сегодня, 14:32</span></div>
    <div className="top-actions">
      <select aria-label="Счёт" value={props.accountId} onChange={(event) => props.onAccount(event.target.value)}>
        {props.accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}
      </select>
      <button className="icon-button" aria-label={props.theme === "light" ? "Тёмная тема" : "Светлая тема"} onClick={props.onTheme}>{props.theme === "light" ? "◐" : "☀"}</button>
      <button className="agent-button" aria-label="Открыть агента" onClick={props.onAgent}>✦ Агент</button>
    </div>
  </header>;
}
```

`web-stand/src/StandApp.tsx`:

```tsx
import { useEffect, useState } from "react";
import { accounts } from "./demo-data";
import type { Period } from "./demo-data";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { PortfolioOverview } from "./components/PortfolioOverview";
import { AgentPanel } from "./components/AgentPanel";

export function StandApp() {
  const [theme, setTheme] = useState<"light" | "dark">(() => localStorage.getItem("invest-theme") === "dark" ? "dark" : "light");
  const [accountId, setAccountId] = useState(accounts[0].id);
  const [period, setPeriod] = useState<Period>("3М");
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentPinned, setAgentPinned] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("invest-theme", theme);
  }, [theme]);
  const account = accounts.find((item) => item.id === accountId) ?? accounts[0];
  return <div className={`stand-shell ${agentOpen && agentPinned ? "agent-is-pinned" : ""}`}>
    <Sidebar />
    <main className="workspace">
      <Topbar accounts={accounts} accountId={accountId} onAccount={setAccountId} theme={theme}
        onTheme={() => setTheme((value) => value === "light" ? "dark" : "light")} onAgent={() => setAgentOpen(true)} />
      <PortfolioOverview account={account} period={period} onPeriod={setPeriod} />
    </main>
    {agentOpen && <AgentPanel pinned={agentPinned} onPin={() => setAgentPinned((value) => !value)} onClose={() => { setAgentOpen(false); setAgentPinned(false); }} />}
  </div>;
}
```

- [ ] **Step 3: Добавить полный набор визуальных tokens и базовые стили**

`web-stand/src/tokens.css`:

```css
:root {
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color-scheme: light;
  --bg: #f3f4f6;
  --surface: #ffffff;
  --surface-soft: #f8f8fa;
  --text: #202127;
  --muted: #777b88;
  --line: #e8e9ee;
  --accent: #6860ed;
  --accent-soft: #eeecff;
  --positive: #17966f;
  --negative: #d45967;
  --shadow: 0 10px 34px rgba(30, 34, 48, .055);
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #111214;
  --surface: #1a1b1f;
  --surface-soft: #202125;
  --text: #f0f0f2;
  --muted: #9698a2;
  --line: #2c2d33;
  --accent: #928aff;
  --accent-soft: #292641;
  --positive: #4bc69c;
  --negative: #ef8390;
  --shadow: 0 12px 36px rgba(0, 0, 0, .18);
}
* { box-sizing: border-box; }
body { margin: 0; min-width: 360px; background: var(--bg); color: var(--text); }
button, select, textarea { font: inherit; }
button { cursor: pointer; }
button:focus-visible, select:focus-visible, textarea:focus-visible { outline: 3px solid color-mix(in srgb, var(--accent) 30%, transparent); outline-offset: 2px; }
```

`web-stand/src/styles.css` задаёт каркас: sidebar 220 px, рабочая область `minmax(0, 1fr)`, закреплённый агент 380 px, карточки `border: 1px solid var(--line); border-radius: 20px; background: var(--surface); box-shadow: var(--shadow)`, текст 14 px, ключевое значение `clamp(32px, 4vw, 48px)`. При ширине менее 1280 px панель агента всегда `position: fixed; right: 16px; top: 16px; bottom: 16px; z-index: 20`; при ширине менее 760 px sidebar 72 px, подписи скрываются, обзор одноколоночный.

- [ ] **Step 4: Запустить тест после подключения минимальных заглушек**

До следующих задач `PortfolioOverview` и `AgentPanel` экспортируют минимальные компоненты:

```tsx
export function PortfolioOverview() { return <section aria-label="Портфель" />; }
```

```tsx
export function AgentPanel() { return <aside aria-label="ИИ-агент" role="complementary" />; }
```

Run: `cd web-stand && npm test -- StandApp`
Expected: 1 passed. Заглушки полностью заменяются в Tasks 3–4.

---

### Task 3: Продуктовый обзор и рабочие графики

**Files:**
- Create: `web-stand/src/components/PortfolioOverview.tsx`
- Create: `web-stand/src/components/PortfolioChart.tsx`, `web-stand/src/components/AllocationChart.tsx`
- Create: `web-stand/src/components/ChartFrame.tsx`
- Test: `web-stand/src/PortfolioOverview.test.tsx`

**Interfaces:**
- Consumes: `Account`, `Period`, `historyForPeriod`, `formatMoney` из Task 1.
- Produces: `PortfolioOverview({ account, period, onPeriod })`.

- [ ] **Step 1: Написать failing-тест содержимого и периодов**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { accounts } from "./demo-data";
import { PortfolioOverview } from "./components/PortfolioOverview";

vi.mock("echarts", () => ({
  init: () => ({ setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() }),
}));

it("shows portfolio values and changes the chart period", async () => {
  const user = userEvent.setup();
  const onPeriod = vi.fn();
  render(<PortfolioOverview account={accounts[0]} period="3М" onPeriod={onPeriod} />);
  expect(screen.getByText(/1.*284.*500.*₽/)).toBeInTheDocument();
  expect(screen.getByText("SBER")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "1М" }));
  expect(onPeriod).toHaveBeenCalledWith("1М");
});
```

Run: `cd web-stand && npm test -- PortfolioOverview`
Expected: FAIL, потому что рабочий компонент ещё не реализован.

- [ ] **Step 2: Реализовать переиспользуемый ChartFrame**

```tsx
import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";

export function ChartFrame({ option, label, className = "" }: { option: EChartsOption; label: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    chart.setOption(option);
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(ref.current);
    return () => { observer.disconnect(); chart.dispose(); };
  }, [option]);
  return <div ref={ref} className={`chart ${className}`} role="img" aria-label={label} />;
}
```

- [ ] **Step 3: Реализовать графики**

`PortfolioChart` использует `historyForPeriod(account.history, period)`, линию `type: "line"`, `smooth: 0.35`, `showSymbol: false`, акцентный `lineStyle.width: 3`, полупрозрачную заливку и tooltip `trigger: "axis"`. Оси используют `axisLabel.color: "#888b95"`, `splitLine.lineStyle.color: "#e8e9ee"`; цвета темы приходят через `getComputedStyle(document.documentElement).getPropertyValue(...)`. Компонент принимает `{ account, period }` и мемоизирует option через `useMemo`.

`AllocationChart` принимает `{ items: AllocationItem[] }`, создаёт `series: [{ type: "pie", radius: ["66%", "86%"], center: ["50%", "50%"], label: { show: false }, data: items.map(({ label, value, color }) => ({ name: label, value, itemStyle: { color } })) }]`. Рядом в `PortfolioOverview` выводится HTML-легенда с числами, поэтому смысл не зависит от canvas.

- [ ] **Step 4: Реализовать обзор без лишнего текста**

```tsx
import type { Account, Period } from "../demo-data";
import { formatMoney, periods } from "../demo-data";
import { PortfolioChart } from "./PortfolioChart";
import { AllocationChart } from "./AllocationChart";

export function PortfolioOverview({ account, period, onPeriod }: { account: Account; period: Period; onPeriod: (period: Period) => void }) {
  return <div className="overview-grid">
    <section className="card hero-card">
      <div><span className="label">Стоимость портфеля</span><strong className="portfolio-value">{formatMoney(account.total)}</strong></div>
      <div className="hero-changes"><span className="positive">+{formatMoney(account.dayChange)} сегодня</span><span>+{account.totalYieldPct}% за всё время</span></div>
    </section>
    <section className="card dynamics-card">
      <div className="card-head"><h2>Динамика</h2><div className="periods">{periods.map((item) => <button className={item === period ? "active" : ""} key={item} onClick={() => onPeriod(item)}>{item}</button>)}</div></div>
      <PortfolioChart account={account} period={period} />
    </section>
    <section className="card allocation-card"><h2>Активы</h2><AllocationChart items={account.allocation} /><div className="allocation-legend">{account.allocation.map((item) => <div key={item.label}><span style={{ background: item.color }} />{item.label}<strong>{item.value}%</strong></div>)}</div></section>
    <section className="card positions-card"><div className="card-head"><h2>Позиции</h2><span className="label">Топ 5</span></div>{account.positions.map((position) => <div className="position" key={position.ticker}><span className="ticker" style={{ background: position.color }}>{position.ticker.slice(0, 1)}</span><div><strong>{position.ticker}</strong><small>{position.name}</small></div><span>{formatMoney(position.value)}<small>{position.weight}%</small></span><strong className={position.yieldPct >= 0 ? "positive" : "negative"}>{position.yieldPct > 0 ? "+" : ""}{position.yieldPct}%</strong></div>)}</section>
    <section className="card operations-card"><h2>Операции</h2>{account.operations.map((operation) => <div className="operation" key={operation.title}><div><strong>{operation.title}</strong><small>{operation.detail}</small></div><span className={operation.amount >= 0 ? "positive" : ""}>{operation.amount > 0 ? "+" : ""}{formatMoney(operation.amount)}</span></div>)}</section>
  </div>;
}
```

Для отрицательного дневного изменения `hero-changes` использует класс `negative` и не добавляет `+`; это обязательный небольшой условный рендер вместо безусловного примера выше.

- [ ] **Step 5: Завершить CSS сетки и прогнать тесты**

Обзор: `grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 18px`; hero 12 колонок, dynamics 8, allocation 4, positions 7, operations 5. Высота основного графика 320 px. Позиции и операции имеют строки не ниже 64 px, вторичный текст 13 px. Ниже 1100 px dynamics и allocation занимают по 12 и 12 колонок соответственно, positions и operations — по 12.

Run: `cd web-stand && npm test`
Expected: все unit-тесты passed.

---

### Task 4: Интерактивная правая панель агента

**Files:**
- Create: `web-stand/src/components/AgentPanel.tsx`
- Test: `web-stand/src/AgentPanel.test.tsx`
- Modify: `web-stand/src/styles.css`

**Interfaces:**
- Consumes: `AgentName`, `demoAnswer` из Task 1.
- Produces: `AgentPanel({ pinned, onPin, onClose })`.

- [ ] **Step 1: Написать failing-тест диалога**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { AgentPanel } from "./components/AgentPanel";

it("answers a quick question with the selected demo agent", async () => {
  vi.useFakeTimers();
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<AgentPanel pinned={false} onPin={vi.fn()} onClose={vi.fn()} />);
  await user.selectOptions(screen.getByLabelText("Модель"), "Kimi");
  await user.click(screen.getByRole("button", { name: "Найти риски" }));
  expect(screen.getByText("Найди риски портфеля")).toBeInTheDocument();
  await vi.advanceTimersByTimeAsync(450);
  expect(screen.getByText(/концентрация в акциях/)).toBeInTheDocument();
  vi.useRealTimers();
});
```

Run: `cd web-stand && npm test -- AgentPanel`
Expected: FAIL, потому что рабочая панель ещё не реализована.

- [ ] **Step 2: Реализовать панель и локальный демо-ответ**

```tsx
import { useEffect, useRef, useState } from "react";
import type { AgentName } from "../demo-data";
import { demoAnswer } from "../demo-data";

interface Message { id: number; role: "user" | "agent"; text: string; agent?: AgentName }

export function AgentPanel({ pinned, onPin, onClose }: { pinned: boolean; onPin: () => void; onClose: () => void }) {
  const [agent, setAgent] = useState<AgentName>("Kimi");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [thinking, setThinking] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const send = (question: string) => {
    const text = question.trim();
    if (!text || thinking) return;
    setMessages((items) => [...items, { id: Date.now(), role: "user", text }]);
    setInput(""); setThinking(true);
    window.setTimeout(() => {
      setMessages((items) => [...items, { id: Date.now() + 1, role: "agent", agent, text: demoAnswer(agent, text) }]);
      setThinking(false);
    }, 400);
  };
  useEffect(() => {
    panelRef.current?.focus();
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onClose]);
  return <><button className="agent-backdrop" aria-label="Закрыть агента" onClick={onClose} /><aside className="agent-panel" role="complementary" aria-label="ИИ-агент" tabIndex={-1} ref={panelRef}>
    <header className="agent-head"><strong>✦ Агент</strong><div><select aria-label="Модель" value={agent} onChange={(event) => setAgent(event.target.value as AgentName)}><option>Kimi</option><option>Codex</option><option>Claude</option></select><button aria-label={pinned ? "Открепить" : "Закрепить"} onClick={onPin}>{pinned ? "▣" : "□"}</button><button aria-label="Закрыть" onClick={onClose}>×</button></div></header>
    <div className="agent-body">{messages.length === 0 && <div className="agent-welcome"><span>✦</span><h2>Что разберём?</h2><div className="quick-questions"><button onClick={() => send("Найди риски портфеля")}>Найти риски</button><button onClick={() => send("Что изменилось?")}>Что изменилось?</button><button onClick={() => send("Проанализируй портфель")}>Обзор портфеля</button></div></div>}{messages.map((message) => <div className={`message ${message.role}`} key={message.id}>{message.agent && <small>{message.agent}</small>}<p>{message.text}</p></div>)}{thinking && <span className="thinking">Анализирую…</span>}</div>
    <form className="composer" onSubmit={(event) => { event.preventDefault(); send(input); }}><textarea aria-label="Сообщение агенту" placeholder="Спросить о портфеле…" value={input} onChange={(event) => setInput(event.target.value)} rows={2} /><button type="submit" aria-label="Отправить" disabled={!input.trim() || thinking}>↑</button></form>
  </aside></>;
}
```

В `StandApp` overlay-backdrop отображается только при `agentOpen`; на широком закреплённом экране CSS скрывает backdrop, а `StandApp` сохраняет состояние периода и счёта.

- [ ] **Step 3: Добавить стили панели и focus behavior**

Панель: ширина `min(380px, calc(100vw - 24px))`, белая/графитовая поверхность, `border-radius: 22px`, фиксированный composer. Backdrop не должен быть виден при `.agent-is-pinned` на ширине от 1280 px. Для overlay используется `role="complementary"`, начальный фокус и Escape; фокус-ловушка ограничивает Tab внутри панели на ширине менее 1280 px и возвращает фокус кнопке «Открыть агента» после закрытия.

Run: `cd web-stand && npm test`
Expected: все unit-тесты passed.

---

### Task 5: E2E, визуальная приёмка и preview

**Files:**
- Create: `web-stand/playwright.config.ts`, `web-stand/e2e/stand.spec.ts`
- Modify только при обнаружении дефектов: `web-stand/src/**/*.tsx`, `web-stand/src/*.css`

**Interfaces:**
- Consumes: рабочий стенд Tasks 1–4.
- Produces: проверенный production build и скриншоты четырёх ключевых состояний.

- [ ] **Step 1: Настроить E2E**

`web-stand/playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:7100", viewport: { width: 1440, height: 1000 }, trace: "retain-on-failure" },
  webServer: { command: "npm run dev -- --host 127.0.0.1 --port 7100", url: "http://127.0.0.1:7100", reuseExistingServer: false },
});
```

`web-stand/e2e/stand.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("light, dark and agent states", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Обзор" })).toBeVisible();
  await expect(page.getByText(/1.*284.*500.*₽/)).toBeVisible();
  await page.screenshot({ path: "test-results/overview-light.png", fullPage: true });
  await page.getByRole("button", { name: "Открыть агента" }).click();
  await page.getByRole("button", { name: "Найти риски" }).click();
  await expect(page.getByText(/концентрация в акциях/)).toBeVisible();
  await page.screenshot({ path: "test-results/agent-light.png", fullPage: true });
  await page.getByRole("button", { name: "Тёмная тема" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({ path: "test-results/agent-dark.png", fullPage: true });
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await page.screenshot({ path: "test-results/overview-dark.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
```

- [ ] **Step 2: Прогнать сборку и E2E**

Run: `cd web-stand && npm run build && npm run test:e2e`
Expected: TypeScript/Vite build exit 0; 1 Playwright test passed; четыре PNG созданы.

- [ ] **Step 3: Проверить скриншоты визуально**

Открыть четыре PNG через media reader и проверить: читаемые числа, отсутствие текста мельче 13 px, нет обрезанных карточек, обе темы контрастны, график не перекрыт, агент не меняет маршрут и не создаёт горизонтальный scroll. Исправить только наблюдаемые дефекты и повторить Step 2.

- [ ] **Step 4: Проверить узкое окно**

Добавить в E2E второй test с `page.setViewportSize({ width: 390, height: 844 })`: открыть обзор, открыть агента, проверить `getByRole("complementary")`, закрыть Escape и проверить отсутствие переполнения. Сохранить `test-results/mobile-agent.png`, визуально проверить и повторить полный прогон.

- [ ] **Step 5: Финальная проверка и остановка сервера**

Run: `cd web-stand && npm test && npm run build && npm run test:e2e`
Expected: все unit и два E2E passed. Убедиться через список процессов, что Vite/Node из `web-stand` не остался запущен. Финальный preview: корень `C:\Users\User\Documents\Kimi\Workspaces\invest-ai\web-stand` и ссылка `http://localhost:7100/`.
