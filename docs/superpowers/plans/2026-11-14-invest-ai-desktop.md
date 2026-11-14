# Invest AI Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Собрать Windows desktop-приложение, которое по read-only T-Invest API показывает портфель и аналитику и позволяет анализировать актуальный снимок через Kimi, OpenAI/Codex или Claude без ручной передачи контекста.

**Architecture:** Electron разделяет доверенный главный процесс и React renderer. Главный процесс владеет gRPC/HTTPS-клиентами, SQLite, секретами, расчётами и read-only оркестрацией агента; renderer получает только типизированные DTO через preload IPC. Демонстрационный адаптер воспроизводит интерфейс брокера и позволяет разрабатывать и тестировать приложение без реального токена.

**Tech Stack:** Electron, React, TypeScript, Vite, Node.js, gRPC, SQLite (`better-sqlite3`), Decimal.js, Apache ECharts, Zod, Vitest, Testing Library, Playwright, Electron Builder.

## Global Constraints

- Первая версия предназначена для Windows; архитектура не должна препятствовать последующим сборкам для macOS и Linux.
- Первая версия работает только в режиме чтения; торговые методы не регистрируются и не вызываются.
- Собственный backend не создаётся.
- Renderer не получает Node integration, секреты, произвольный IPC, файловый или сетевой доступ.
- Денежная арифметика использует Decimal.js; отсутствующие значения остаются `null` и отображаются как «Н/Д».
- Токен брокера хранится только через Electron `safeStorage`, не попадает в SQLite, журналы, IPC, контекст агента и экспорт.
- ИИ подключается через установленные и авторизованные `codex`, `kimi` и `claude` CLI; API-ключи ИИ не требуются.
- Выбранный CLI автоматически получает актуальный обезличенный снимок только после действия пользователя в чате; скрытое переключение запрещено.
- CLI запускаются в пустой рабочей папке без инструментов и не получают торговых функций; автоматическое сканирование не делает платных запросов.
- Устаревшие, неполные и восстановленные данные явно маркируются.
- Все зависимости фиксируются `package-lock.json`; protobuf-контракты хранятся в `vendor/invest-contracts` с зафиксированной ревизией в `vendor/invest-contracts/REVISION`.
- Команды Git из плана являются контрольными точками, но выполняются только после отдельного разрешения пользователя; текущая папка не является Git-репозиторием.

## File Structure

```text
electron.vite.config.ts          # сборка main/preload/renderer
package.json                     # зависимости и команды
src/shared/contracts.ts          # DTO и IPC-контракты
src/shared/errors.ts             # безопасные категории ошибок
src/main/index.ts                # создание безопасного BrowserWindow
src/main/container.ts            # composition root
src/main/ipc.ts                  # единственная регистрация IPC
src/main/security/secret-store.ts
src/main/database/database.ts    # подключение и миграции
src/main/database/snapshot-repository.ts
src/main/database/chat-repository.ts
src/main/invest/gateway.ts       # интерфейс read-only брокера
src/main/invest/fixture-gateway.ts
src/main/invest/tinvest-gateway.ts
src/main/invest/mapping.ts
src/main/portfolio/money.ts
src/main/portfolio/analytics.ts
src/main/portfolio/service.ts
src/main/portfolio/context-builder.ts
src/main/agents/agent-hub.ts
src/main/agents/cli-types.ts
src/main/agents/process-runner.ts
src/main/agents/cli-detector.ts
src/main/agents/cli-commands.ts
src/main/agents/cli-parsers.ts
src/main/agents/cli-provider.ts
src/preload/index.ts             # contextBridge
src/renderer/app/App.tsx
src/renderer/pages/DashboardPage.tsx
src/renderer/pages/PortfolioPage.tsx
src/renderer/pages/AnalyticsPage.tsx
src/renderer/pages/ChatPage.tsx
src/renderer/pages/SettingsPage.tsx
src/renderer/components/Chart.tsx
src/renderer/components/MetricCard.tsx
src/renderer/components/PositionsTable.tsx
src/renderer/components/StatusBar.tsx
src/renderer/styles.css
tests/unit/*.test.ts
tests/contract/*.test.ts
tests/e2e/app.spec.ts
vendor/invest-contracts/         # только protobuf и REVISION
```

---

### Task 1: Безопасный Electron-скелет и демонстрационный запуск

**Files:**
- Create: `package.json`, `tsconfig.json`, `electron.vite.config.ts`, `src/main/index.ts`, `src/preload/index.ts`, `src/shared/contracts.ts`, `src/renderer/main.tsx`, `src/renderer/app/App.tsx`, `index.html`
- Test: `tests/unit/contracts.test.ts`

**Interfaces:**
- Produces: `AppInfo { name: "Invest AI"; version: string; mode: "demo" | "broker" }`, `window.investAi.getAppInfo(): Promise<AppInfo>`.
- Consumes: нет.

- [ ] **Step 1: Создать скелет и failing contract test**

Создать команды `dev`, `build`, `preview`, `test`, `test:unit`, `test:e2e`, `dist:win`. Команда `dev` запускает `electron-vite dev -- --host 0.0.0.0`; команда `preview` запускает `electron-vite preview -- --host 0.0.0.0`. Тест:

```ts
import { describe, expect, it } from "vitest";
import type { AppInfo } from "../../src/shared/contracts";

describe("AppInfo", () => {
  it("describes the demo application", () => {
    const info: AppInfo = { name: "Invest AI", version: "0.1.0", mode: "demo" };
    expect(info.mode).toBe("demo");
  });
});
```

- [ ] **Step 2: Проверить падение до реализации контракта**

Run: `npm run test:unit -- tests/unit/contracts.test.ts`
Expected: FAIL, поскольку `src/shared/contracts.ts` ещё не содержит экспортируемый контракт.

- [ ] **Step 3: Реализовать контракт и безопасные процессы**

```ts
export interface AppInfo {
  name: "Invest AI";
  version: string;
  mode: "demo" | "broker";
}

export interface InvestAiApi {
  getAppInfo(): Promise<AppInfo>;
}
```

`BrowserWindow` создаётся с `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`; разрешены только локальные ресурсы приложения. Preload экспонирует:

```ts
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("investAi", {
  getAppInfo: () => ipcRenderer.invoke("app:get-info"),
});
```

В `src/main/index.ts` обработчик возвращает `AppInfo`, а новые окна и навигация на внешние URL блокируются. Внешние HTTPS-ссылки передаются `shell.openExternal` только после проверки `new URL(value).protocol === "https:"`.

- [ ] **Step 4: Запустить тест и production build**

Run: `npm run test:unit && npm run build`
Expected: unit-тест PASS; main, preload и renderer собраны без ошибок TypeScript.

- [ ] **Step 5: Проверить desktop-запуск**

Run: `npm run dev`
Expected: открывается окно Invest AI с экраном «Портфель», отсутствуют ошибки CSP и IPC. После проверки процесс останавливается; фоновый dev-server не оставляется.

- [ ] **Step 6: Контрольная точка**

При наличии отдельного разрешения на Git:

```bash
git add package.json package-lock.json electron.vite.config.ts tsconfig.json index.html src tests/unit/contracts.test.ts
git commit -m "chore: scaffold secure Electron application"
```

---

### Task 2: Доменные типы, деньги и аналитика

**Files:**
- Create: `src/main/portfolio/money.ts`, `src/main/portfolio/analytics.ts`, `src/main/portfolio/types.ts`
- Modify: `src/shared/contracts.ts`
- Test: `tests/unit/money.test.ts`, `tests/unit/analytics.test.ts`

**Interfaces:**
- Produces: `Money`, `Position`, `PortfolioSnapshot`, `calculateSnapshot(positions, cash, asOf)`, `concentration(values: Decimal[])`.
- Consumes: Task 1 для общей сборки.

- [ ] **Step 1: Написать failing tests для точности и неполных данных**

```ts
import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { money, totalValue } from "../../src/main/portfolio/money";
import { calculateSnapshot } from "../../src/main/portfolio/analytics";

it("adds decimal money without binary rounding", () => {
  expect(money("0.1", "RUB").plus(money("0.2", "RUB")).value.toString()).toBe("0.3");
});

it("does not turn missing prices into zero", () => {
  const result = calculateSnapshot([
    { instrumentId: "a", ticker: "AAA", name: "Alpha", assetType: "share", currency: "RUB", quantity: new Decimal(2), averagePrice: null, currentPrice: null, value: null, expectedYield: null }
  ], [], "2026-11-14T12:00:00.000Z");
  expect(result.totalValue).toBeNull();
  expect(result.completeness).toBe("partial");
});
```

- [ ] **Step 2: Проверить ожидаемое падение**

Run: `npm run test:unit -- tests/unit/money.test.ts tests/unit/analytics.test.ts`
Expected: FAIL из-за отсутствующих модулей `money.ts` и `analytics.ts`.

- [ ] **Step 3: Реализовать доменные DTO и Decimal-арифметику**

```ts
import Decimal from "decimal.js";

export type Currency = "RUB" | "USD" | "EUR" | "CNY";
export interface Money { value: Decimal; currency: Currency }
export const money = (value: Decimal.Value, currency: Currency): Money => ({
  value: new Decimal(value), currency,
});

export function totalValue(values: Money[], currency: Currency): Money | null {
  if (values.some((item) => item.currency !== currency)) return null;
  return values.reduce<Money | null>((sum, item) => sum
    ? { value: sum.value.plus(item.value), currency }
    : { value: item.value, currency }, null);
}
```

`Position.value`, `Position.currentPrice`, `Position.averagePrice`, `Position.expectedYield` допускают `null`. `calculateSnapshot` возвращает `completeness: "complete" | "partial"`, считает `totalValue` только при полном наборе оценённых позиций и всегда вычисляет доли только от известной суммы. Все DTO, пересекающие IPC, сериализуют Decimal как строку.

- [ ] **Step 4: Добавить концентрацию и проверить тесты**

```ts
export function concentration(values: Decimal[]): { topFivePct: Decimal | null; hhi: Decimal | null } {
  const positive = values.filter((value) => value.gt(0));
  const total = positive.reduce((sum, value) => sum.plus(value), new Decimal(0));
  if (total.isZero()) return { topFivePct: null, hhi: null };
  const weights = positive.map((value) => value.div(total)).sort((a, b) => b.cmp(a));
  return {
    topFivePct: weights.slice(0, 5).reduce((sum, value) => sum.plus(value), new Decimal(0)).mul(100),
    hhi: weights.reduce((sum, value) => sum.plus(value.pow(2)), new Decimal(0)),
  };
}
```

Run: `npm run test:unit -- tests/unit/money.test.ts tests/unit/analytics.test.ts`
Expected: PASS, включая пустой портфель, `null` и сумму долей 100% в пределах заданного округления.

- [ ] **Step 5: Контрольная точка**

```bash
git add src/main/portfolio src/shared/contracts.ts tests/unit/money.test.ts tests/unit/analytics.test.ts
git commit -m "feat: add precise portfolio analytics"
```

---

### Task 3: SQLite, миграции и снимки

**Files:**
- Create: `src/main/database/database.ts`, `src/main/database/migrations.ts`, `src/main/database/snapshot-repository.ts`
- Test: `tests/unit/snapshot-repository.test.ts`

**Interfaces:**
- Produces: `SnapshotRepository.save(snapshot): void`, `.latest(): PortfolioSnapshot | null`, `.get(id): PortfolioSnapshot | null`, `.list(limit): SnapshotMeta[]`, `.close(): void`.
- Consumes: `PortfolioSnapshot` из Task 2.

- [ ] **Step 1: Написать failing round-trip test**

```ts
import { describe, expect, it } from "vitest";
import { Database } from "../../src/main/database/database";
import { SnapshotRepository } from "../../src/main/database/snapshot-repository";
import { fixtureSnapshot } from "./fixtures";

it("persists and restores a snapshot without Decimal instances", () => {
  const db = new Database(":memory:");
  const repository = new SnapshotRepository(db);
  repository.save(fixtureSnapshot);
  expect(repository.get(fixtureSnapshot.id)).toEqual(fixtureSnapshot);
  expect(repository.latest()?.id).toBe(fixtureSnapshot.id);
  repository.close();
});
```

- [ ] **Step 2: Проверить падение**

Run: `npm run test:unit -- tests/unit/snapshot-repository.test.ts`
Expected: FAIL из-за отсутствующих `Database` и `SnapshotRepository`.

- [ ] **Step 3: Реализовать миграцию и транзакционное сохранение**

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  as_of TEXT NOT NULL,
  completeness TEXT NOT NULL CHECK (completeness IN ('complete', 'partial')),
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS snapshots_as_of_idx ON snapshots(as_of DESC);
```

`save` выполняет `INSERT INTO snapshots ... ON CONFLICT(id) DO UPDATE` внутри `better-sqlite3` transaction. Перед записью Zod проверяет сериализованный `PortfolioSnapshot`; при чтении повторная проверка отклоняет повреждённый payload. Секретных колонок в схеме нет.

- [ ] **Step 4: Проверить миграцию, повторное сохранение и повреждённые данные**

Run: `npm run test:unit -- tests/unit/snapshot-repository.test.ts`
Expected: PASS для round-trip, идемпотентного `save`, сортировки `latest` и контролируемой ошибки повреждённого JSON.

- [ ] **Step 5: Контрольная точка**

```bash
git add src/main/database tests/unit/snapshot-repository.test.ts tests/unit/fixtures.ts
git commit -m "feat: persist portfolio snapshots locally"
```

---

### Task 4: Read-only T-Invest Gateway

**Files:**
- Create: `src/main/invest/gateway.ts`, `src/main/invest/fixture-gateway.ts`, `src/main/invest/tinvest-gateway.ts`, `src/main/invest/mapping.ts`, `vendor/invest-contracts/REVISION`
- Test: `tests/contract/tinvest-mapping.test.ts`, `tests/contract/gateway.test.ts`

**Interfaces:**
- Produces: `InvestGateway.listAccounts()`, `.getPortfolio(accountId)`, `.getPositions(accountId)`, `.getOperations(accountId, from, to)`, `.getCandles(instrumentId, from, to, interval)`.
- Consumes: доменные типы Task 2.

- [ ] **Step 1: Зафиксировать интерфейс и failing mapping tests**

```ts
export interface InvestGateway {
  listAccounts(): Promise<BrokerAccount[]>;
  getPortfolio(accountId: string): Promise<BrokerPortfolio>;
  getPositions(accountId: string): Promise<BrokerPosition[]>;
  getOperations(accountId: string, from: string, to: string): Promise<BrokerOperation[]>;
  getCandles(instrumentId: string, from: string, to: string, interval: CandleInterval): Promise<Candle[]>;
}
```

Тесты используют записанные синтетические ответы protobuf с `units` и `nano`; проверяют преобразование в Decimal, `null` для отсутствующей цены, маскирование `accountId` в DTO для агента и отсутствие методов `postOrder`, `cancelOrder` в `InvestGateway`.

- [ ] **Step 2: Проверить падение**

Run: `npm run test:unit -- tests/contract/tinvest-mapping.test.ts tests/contract/gateway.test.ts`
Expected: FAIL из-за отсутствующих gateway и mapping.

- [ ] **Step 3: Реализовать демонстрационный и gRPC-адаптеры**

`FixtureGateway` возвращает детерминированный мультивалютный портфель, операции и свечи. `TInvestGateway` использует `@grpc/grpc-js`, `@grpc/proto-loader` и TLS на `invest-public-api.tinkoff.ru:443`; токен передаётся только в metadata `authorization: Bearer <token>` внутри главного процесса.

Преобразование котировки:

```ts
import Decimal from "decimal.js";

export function quotationToDecimal(value?: { units?: string | number; nano?: number } | null): Decimal | null {
  if (!value || value.units === undefined) return null;
  return new Decimal(value.units).plus(new Decimal(value.nano ?? 0).div(1_000_000_000));
}
```

Protobuf-ревизия записывается полным commit hash или immutable tag в `vendor/invest-contracts/REVISION`. Загружаются только users, operations, instruments и market data contracts.

- [ ] **Step 4: Проверить контракты без реального токена**

Run: `npm run test:unit -- tests/contract/tinvest-mapping.test.ts tests/contract/gateway.test.ts`
Expected: PASS; сетевые вызовы не выполняются, интерфейс не экспортирует торговых операций.

- [ ] **Step 5: Ручная проверка с read-only токеном**

В настройках ввести собственный read-only токен, выбрать счета и сравнить сумму с официальным приложением брокера.
Expected: счета и портфель читаются; попытка торговли отсутствует в коде и интерфейсе. Токен в тестовые fixtures не копируется.

- [ ] **Step 6: Контрольная точка**

```bash
git add src/main/invest tests/contract vendor/invest-contracts package.json package-lock.json
git commit -m "feat: integrate read-only T-Invest gateway"
```

---

### Task 5: PortfolioService, кэш и обновление котировок

**Files:**
- Create: `src/main/portfolio/service.ts`, `src/main/portfolio/market-data-service.ts`, `src/shared/errors.ts`
- Test: `tests/unit/portfolio-service.test.ts`

**Interfaces:**
- Produces: `PortfolioService.refresh(): Promise<PortfolioSnapshot>`, `.cached(): PortfolioSnapshot | null`, `.operations(filter): Promise<BrokerOperation[]>`, `.candles(request): Promise<Candle[]>`.
- Consumes: Tasks 2–4.

- [ ] **Step 1: Написать failing tests для offline и partial refresh**

```ts
it("keeps the last good snapshot when refresh fails", async () => {
  const repository = new SnapshotRepository(new Database(":memory:"));
  repository.save(fixtureSnapshot);
  const gateway = { getPortfolio: async () => { throw new Error("offline"); } };
  const service = new PortfolioService(gateway as never, repository);
  await expect(service.refresh()).rejects.toMatchObject({ category: "network" });
  expect(service.cached()).toEqual(fixtureSnapshot);
});
```

Второй тест объединяет два счёта, сохраняет `partial`, если один счёт недоступен, и не складывает RUB с USD без курса и времени курса.

- [ ] **Step 2: Проверить падение**

Run: `npm run test:unit -- tests/unit/portfolio-service.test.ts`
Expected: FAIL из-за отсутствующего `PortfolioService`.

- [ ] **Step 3: Реализовать refresh и безопасные ошибки**

```ts
export type ErrorCategory = "auth" | "permission" | "rate_limit" | "network" | "invalid_response" | "provider" | "storage";
export class AppError extends Error {
  constructor(public category: ErrorCategory, message: string, public retryAfterMs?: number) {
    super(message);
  }
}
```

`refresh` сохраняет снимок только после успешной валидации. Независимые счета запрашиваются через ограниченную очередь с concurrency 3. Ошибки одного счёта образуют partial snapshot; ошибка всего обновления не затирает кэш. Повтор rate limit выполняется не более двух раз с учётом `retryAfterMs`, сетевых ошибок — с экспоненциальной задержкой 500 и 1500 мс.

- [ ] **Step 4: Реализовать MarketDataService**

`MarketDataService` подписывается на котировки только открытых позиций, переподключается с задержками 1, 2, 4, 8, максимум 30 секунд и при недоступном stream выполняет polling каждые 30 секунд. Каждая цена несёт `asOf`; события не вызывают React напрямую, а проходят через типизированное IPC-событие `portfolio:updated`.

- [ ] **Step 5: Проверить тесты и утечки подписок**

Run: `npm run test:unit -- tests/unit/portfolio-service.test.ts && npm run build`
Expected: PASS; `close()` отменяет таймеры, AbortController и stream; повторный refresh не создаёт вторую активную подписку.

- [ ] **Step 6: Контрольная точка**

```bash
git add src/main/portfolio src/shared/errors.ts tests/unit/portfolio-service.test.ts
git commit -m "feat: add resilient portfolio refresh and market data"
```

---

### Task 6: Обзор, навигация и графики

**Files:**
- Create: `src/renderer/app/App.tsx`, `src/renderer/pages/DashboardPage.tsx`, `src/renderer/components/Chart.tsx`, `src/renderer/components/MetricCard.tsx`, `src/renderer/components/StatusBar.tsx`, `src/renderer/styles.css`
- Modify: `src/main/ipc.ts`, `src/preload/index.ts`
- Test: `tests/unit/dashboard.test.tsx`

**Interfaces:**
- Produces: экраны `overview`, `portfolio`, `analytics`, `chat`, `settings`; `portfolio:get-latest`, `portfolio:refresh`, `portfolio:updated`.
- Consumes: DTO Tasks 2–5.

- [ ] **Step 1: Написать failing UI test**

```tsx
import { render, screen } from "@testing-library/react";
import { DashboardPage } from "../../src/renderer/pages/DashboardPage";
import { fixtureSnapshot } from "./fixtures";

it("marks stale and partial portfolio data", () => {
  render(<DashboardPage snapshot={fixtureSnapshot} stale />);
  expect(screen.getByText(/Данные на/i)).toBeTruthy();
  expect(screen.getByText(/устарели/i)).toBeTruthy();
  expect(screen.getAllByText("Н/Д").length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Проверить падение**

Run: `npm run test:unit -- tests/unit/dashboard.test.tsx`
Expected: FAIL из-за отсутствующего `DashboardPage`.

- [ ] **Step 3: Реализовать dashboard и typed IPC**

Preload предоставляет `getLatestSnapshot`, `refreshPortfolio`, `onPortfolioUpdated`; последняя функция возвращает unsubscribe и копирует только валидированный DTO. Dashboard получает данные через `useEffect`, сначала показывает кэш, затем запускает refresh и не блокирует навигацию.

`Chart` инициализирует ECharts один раз, применяет `setOption`, вызывает `resize` через `ResizeObserver` и `dispose` при unmount. Линейный график принимает только ISO time и строковые Decimal-значения; периоды `1Д / 1Н / 1М / 3М / 1Г / Всё` фильтруют ряд по `asOf`.

- [ ] **Step 4: Реализовать карточки и структуру**

Метрики: общая стоимость, свободные средства, прибыль за день, прибыль за весь доступный период. Круговые диаграммы: типы активов, валюты, счета. Списки: крупнейшие позиции и вклад в изменение. Любое отсутствующее значение выводится как `Н/Д`; оценочная история получает подпись «Расчётная оценка».

- [ ] **Step 5: Проверить UI и production build**

Run: `npm run test:unit -- tests/unit/dashboard.test.tsx && npm run build`
Expected: PASS; отсутствуют предупреждения о незакрытых ECharts instances и подписках.

- [ ] **Step 6: Контрольная точка**

```bash
git add src/main/ipc.ts src/preload src/renderer tests/unit/dashboard.test.tsx
git commit -m "feat: add portfolio overview and interactive charts"
```

---

### Task 7: Позиции, инструмент, операции и аналитика

**Files:**
- Create: `src/renderer/pages/PortfolioPage.tsx`, `src/renderer/pages/AnalyticsPage.tsx`, `src/renderer/components/PositionsTable.tsx`, `src/renderer/components/InstrumentDrawer.tsx`, `src/renderer/components/OperationsTable.tsx`
- Test: `tests/unit/portfolio-page.test.tsx`, `tests/unit/analytics-page.test.tsx`

**Interfaces:**
- Produces: фильтры позиций/операций, выбранный `instrumentId`, `portfolio:get-candles`, `portfolio:get-operations`.
- Consumes: Tasks 4–6.

- [ ] **Step 1: Написать failing tests для фильтров**

```tsx
it("filters positions by ticker and account without hiding missing values", async () => {
  render(<PortfolioPage snapshot={fixtureSnapshot} />);
  await userEvent.type(screen.getByPlaceholderText("Тикер или название"), "SBER");
  expect(screen.getByText("SBER")).toBeTruthy();
  expect(screen.queryByText("YNDX")).toBeNull();
});
```

Дополнительные assertions: сортировка по стоимости использует Decimal, фильтр операций по периоду включает границы ISO, отрасль `null` объединяется в «Не указано».

- [ ] **Step 2: Проверить падение**

Run: `npm run test:unit -- tests/unit/portfolio-page.test.tsx tests/unit/analytics-page.test.tsx`
Expected: FAIL из-за отсутствующих страниц.

- [ ] **Step 3: Реализовать таблицу и карточку инструмента**

`PositionsTable` поддерживает поиск, сортировку, счёт и тип актива; значения Decimal сортируются через `new Decimal(a).comparedTo(new Decimal(b))`. `InstrumentDrawer` загружает свечи только при открытии, отменяет предыдущий запрос через AbortSignal и показывает candlestick + volume, текущую позицию и операции.

- [ ] **Step 4: Реализовать аналитику и операции**

`AnalyticsPage` выводит стоимость, доходность, top-five concentration, HHI, валютную и отраслевую структуру. `OperationsTable` фильтрует пополнения, выводы, сделки, дивиденды и купоны по счёту и периоду; длинные списки используют пагинацию по 100 строк.

- [ ] **Step 5: Проверить тесты**

Run: `npm run test:unit -- tests/unit/portfolio-page.test.tsx tests/unit/analytics-page.test.tsx && npm run build`
Expected: PASS; при `null` отображается «Н/Д», при неполной истории — предупреждение.

- [ ] **Step 6: Контрольная точка**

```bash
git add src/renderer tests/unit/portfolio-page.test.tsx tests/unit/analytics-page.test.tsx
git commit -m "feat: add positions instruments and operations analytics"
```

---

### Task 8: Секреты и настройки

**Files:**
- Create: `src/main/security/secret-store.ts`, `src/renderer/pages/SettingsPage.tsx`, `src/main/settings/settings-store.ts`
- Modify: `src/main/ipc.ts`, `src/preload/index.ts`
- Test: `tests/unit/secret-store.test.ts`, `tests/unit/settings-page.test.tsx`

**Interfaces:**
- Produces: `SecretStore.set(name, value)`, `.get(name): Promise<string | null>`, `.delete(name)`, `.has(name): Promise<boolean>`; настройки без секретов.
- Consumes: Tasks 1, 4, 5.

- [ ] **Step 1: Написать failing tests**

```ts
it("stores only encrypted payloads and never returns values through settings DTO", async () => {
  const encryption = new FakeEncryption();
  const store = new SecretStore(new MemorySecretFile(), encryption);
  await store.set("tinkoff", "t.secret");
  expect(await store.has("tinkoff")).toBe(true);
  expect(MemorySecretFile.raw).not.toContain("t.secret");
  expect(store.publicSettings()).toEqual({ tinkoffConfigured: true });
});
```

Дополнительно проверить отказ при `safeStorage.isEncryptionAvailable() === false`, удаление ключа и redaction строк `t.*`, `sk-*` в журнале.

- [ ] **Step 2: Проверить падение**

Run: `npm run test:unit -- tests/unit/secret-store.test.ts tests/unit/settings-page.test.tsx`
Expected: FAIL из-за отсутствующих `SecretStore` и `SettingsPage`.

- [ ] **Step 3: Реализовать SecretStore**

```ts
export type SecretName = "tinkoff";

export interface Encryption {
  isAvailable(): boolean;
  encrypt(value: string): Buffer;
  decrypt(value: Buffer): string;
}

export class SecretStore {
  constructor(private file: SecretFile, private encryption: Encryption) {}
  async set(name: SecretName, value: string): Promise<void> {
    if (!this.encryption.isAvailable()) throw new AppError("storage", "Шифрование недоступно в ОС");
    if (!value.trim()) throw new AppError("invalid_response", "Ключ не может быть пустым");
    await this.file.write(name, this.encryption.encrypt(value).toString("base64"));
  }
}
```

Реализация Electron использует `safeStorage`; encrypted payload хранится отдельно от SQLite в `userData/secrets.json` с правами текущего пользователя. IPC имеет `settings:save-secret`, но не имеет `settings:get-secret`.

- [ ] **Step 4: Реализовать настройки**

`SettingsPage` сохраняет только токен брокера через masked input, показывает `configured: boolean`, выбирает счета, базовую валюту и частоту обновления. Для ИИ отображаются найденные CLI, версия, состояние входа, команды установки/входа, необязательная модель и настройка истории сессий. API-ключи ИИ не запрашиваются. Очистка кэша, чатов и всех данных требует отдельного модального подтверждения.

- [ ] **Step 5: Проверить тесты и отсутствие секретов в build artifacts**

Run: `npm run test:unit -- tests/unit/secret-store.test.ts tests/unit/settings-page.test.tsx && npm run build`
Expected: PASS; renderer bundle не содержит импортов Electron `safeStorage` и значений тестовых секретов.

- [ ] **Step 6: Контрольная точка**

```bash
git add src/main/security src/main/settings src/main/ipc.ts src/preload src/renderer/pages/SettingsPage.tsx tests/unit/secret-store.test.ts tests/unit/settings-page.test.tsx
git commit -m "feat: secure broker and AI credentials"
```

---

### Task 9: Локальные Codex, Kimi и Claude CLI

**Files:**
- Create: `src/main/agents/cli-types.ts`, `src/main/agents/process-runner.ts`, `src/main/agents/cli-detector.ts`, `src/main/agents/cli-commands.ts`, `src/main/agents/cli-parsers.ts`, `src/main/agents/cli-provider.ts`, `src/main/agents/agent-hub.ts`
- Test: `tests/contract/cli-providers.test.ts`, `tests/unit/process-runner.test.ts`

**Interfaces:**
- Produces: `AgentProviderName = "codex" | "kimi" | "claude"`, `CliStatus`, `AgentProvider.stream(request, signal)`, `AgentHub.stream(provider, request, signal)` и `agents:detect`.
- Consumes: только установленные и авторизованные пользователем CLI; `SecretStore` для ИИ не нужен.

- [ ] **Step 1: Написать failing JSONL contract tests**

Проверить fixtures Codex (`thread.started`, `agent_message`/completed item), Kimi (Assistant message) и Claude (`system`, `assistant`, `result`) на разорванных chunks. Отдельные тесты: `where.exe`/`--version`, отсутствие CLI, ошибка входа, отмена, timeout, потоковый текст и запрет скрытого fallback.

- [ ] **Step 2: Проверить падение**

Run: `npm run test:unit -- tests/contract/cli-providers.test.ts tests/unit/process-runner.test.ts`
Expected: FAIL из-за отсутствующих CLI modules.

- [ ] **Step 3: Реализовать безопасный process runner**

Использовать `spawn(executable, args, { shell: false, windowsHide: true })`; не принимать командную строку от renderer. Prompt передавать через stdin там, где CLI поддерживает `-`, чтобы не раскрывать финансовый контекст в списке аргументов Windows и не упираться в лимит длины argv. Реализовать JSONL parsing, timeout, AbortSignal и завершение дерева процесса Windows без оставшихся дочерних процессов.

- [ ] **Step 4: Реализовать detector и фиксированные команды**

Detector возвращает `not_installed | installed | ready | auth_required | error`; `--version` означает только `installed`, а `ready` появляется после `codex login status` либо успешного запроса. Не запускать платные запросы при автоматическом сканировании.

- Codex: `codex exec - --json --sandbox read-only --skip-git-repo-check --ephemeral`; resume только при включённой локальной истории CLI.
- Kimi: `kimi -p <prompt> --output-format stream-json --agent-file <generated-readonly-agent.md>`; agent file содержит `tools: []`.
- Claude: `claude -p <prompt> --output-format stream-json --verbose --include-partial-messages --tools "" --disallowedTools "mcp__*" --permission-prompts none --no-session-persistence`.

Все процессы запускаются в отдельной пустой рабочей папке приложения. Codex и Claude получают prompt через stdin; если Kimi stdin в установленной версии не поддерживается, использовать компактный prompt аргументом и явно задокументировать ограничение. Пользовательские hooks, MCP и tools не должны получать финансовый контекст; для Claude дополнительно использовать `--strict-mcp-config` с пустой конфигурацией и `--setting-sources ""` при поддержке установленной версии.

- [ ] **Step 5: Проверить контрактные тесты без реальных запросов**

Run: `npm run test:unit -- tests/contract/cli-providers.test.ts tests/unit/process-runner.test.ts && npm run build`
Expected: PASS для детекции, трёх JSONL parsers, auth errors, timeout, abort, redaction и ровно одного вызванного provider. Реальные CLI не вызываются тестами.

---

### Task 10: Автоматический контекст и чат без API-ключей

**Files:**
- Create: `src/main/portfolio/context-builder.ts`, `src/main/agents/orchestrator.ts`, `src/main/database/chat-repository.ts`, `src/renderer/pages/ChatPage.tsx`
- Modify: `src/main/ipc.ts`, `src/preload/index.ts`
- Test: `tests/unit/context-builder.test.ts`, `tests/unit/chat-page.test.tsx`

**Interfaces:**
- Produces: `buildPortfolioContext(snapshot, selection)`, `chat:send`, `chat:cancel`, `chat:event`, `agents:detect`, локальные диалоги.
- Consumes: Tasks 2–9.

- [ ] **Step 1: Написать failing privacy test**

Контекст содержит позиции и полноту данных, но не raw account IDs, токены или `sk-*`. Account IDs заменяются устойчивыми метками `Счёт 1`, `Счёт 2`.

- [ ] **Step 2: Реализовать версионированный контекст**

`PortfolioContext` содержит `schemaVersion`, время, базовую валюту, totals, positions, allocations, recentOperations, changes и selection. Системный prompt требует отвечать по снимку, указывать его время, отделять факт от интерпретации и формулировать ограничения без обязательных уточняющих вопросов. Полный снимок передаётся заранее, поэтому внешнему CLI не нужны собственные tools приложения.

- [ ] **Step 3: Реализовать чат и локальную историю**

`ChatPage` показывает карточки `Codex / Kimi / Claude` с состояниями «Не установлен», «Установлен», «Требуется вход», «Готов». Для неустановленного CLI показывается официальная команда установки; для авторизации — `codex login`, `kimi login` либо запуск `claude` с интерактивным входом. Пользователь выбирает ровно одного агента и отправляет запрос; скрытого fallback нет. Ответ стримится, поддерживает cancel/retry и локальную историю. Настройки раскрывают, что включённые сессии CLI могут хранить историю отдельно от Invest AI.

- [ ] **Step 4: Проверить чат**

Run: `npm run test:unit -- tests/unit/context-builder.test.ts tests/unit/chat-page.test.tsx tests/contract/cli-providers.test.ts && npm run build`
Expected: PASS для selector, потока, отмены, повтора, истории и отсутствия API-ключей в DTO. Реальные платные запросы не выполняются.

---

### Task 11: Журналы, экспорт и end-to-end сценарии

**Files:**
- Create: `src/main/logging/logger.ts`, `src/main/chat/export-chat.ts`, `tests/e2e/app.spec.ts`, `playwright.config.ts`
- Modify: `src/main/container.ts`, `src/main/index.ts`
- Test: `tests/unit/logger.test.ts`

**Interfaces:**
- Produces: redacted rotating logs, Markdown export, повторяемые Electron E2E.
- Consumes: все предыдущие задачи.

- [ ] **Step 1: Написать failing redaction test**

```ts
import { redact } from "../../src/main/logging/logger";

it("redacts broker and provider credentials", () => {
  expect(redact("token=t.secret key=sk-live-value"))
    .toBe("token=[redacted] key=[redacted]");
});
```

- [ ] **Step 2: Проверить падение и реализовать logger**

Run: `npm run test:unit -- tests/unit/logger.test.ts`
Expected: FAIL до создания logger.

Реализация заменяет Authorization metadata, Bearer tokens, `t.*`, `sk-*`, значения полей `apiKey`, `token`, `authorization`; файлы журнала ограничены 5 МБ и тремя ротациями. Финансовый snapshot и prompt в обычный журнал не пишутся.

Run: `npm run test:unit -- tests/unit/logger.test.ts`
Expected: PASS.

- [ ] **Step 3: Реализовать Markdown export**

Экспорт содержит название диалога, provider/model, время snapshot и сообщения. Секреты не сериализуются. Путь выбирается через системный `dialog.showSaveDialog`; renderer передаёт только `chatId`, но не произвольный путь.

- [ ] **Step 4: Написать Playwright E2E**

```ts
import { test, expect, _electron as electron } from "@playwright/test";

test("demo portfolio and automatic agent context survive navigation", async () => {
  const app = await electron.launch({ args: ["."], env: { ...process.env, INVEST_AI_MODE: "demo" } });
  const page = await app.firstWindow();
  await expect(page.getByText("Общая стоимость")).toBeVisible();
  await page.getByRole("button", { name: "ИИ-чат" }).click();
  await page.getByRole("button", { name: "Проанализируй портфель" }).click();
  await expect(page.getByText(/снимок портфеля/i)).toBeVisible();
  await app.close();
});
```

Дополнительные E2E: offline cache, неверный токен, пустой портфель, мультивалютный partial snapshot, периоды/фильтры, instrument drawer, три provider mock, cancel/retry, restart history и закрытие во время refresh.

- [ ] **Step 5: Запустить полный набор**

Run: `npm run test:unit && npm run test:e2e && npm run build`
Expected: все тесты PASS; после тестов Electron и dev-server завершены.

- [ ] **Step 6: Контрольная точка**

```bash
git add src/main/logging src/main/chat src/main/container.ts src/main/index.ts tests playwright.config.ts
git commit -m "test: cover desktop workflows and diagnostics"
```

---

### Task 12: Windows-инсталлятор и финальная приёмка

**Files:**
- Create: `electron-builder.yml`, `README.md`, `build/icon.ico`
- Modify: `package.json`
- Test: автоматическая сборка и ручной checklist.

**Interfaces:**
- Produces: Windows NSIS installer в `release/`, документированные команды.
- Consumes: всё приложение.

- [ ] **Step 1: Настроить Electron Builder**

```yaml
appId: ai.invest.desktop
productName: Invest AI
files:
  - out/**
  - package.json
asar: true
win:
  target:
    - nsis
  artifactName: Invest-AI-Setup-${version}.${ext}
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
```

`better-sqlite3` и gRPC native dependencies собираются для версии Electron через `@electron/rebuild`; unpacked native files перечисляются в `asarUnpack`. Подпись добавляется только при наличии сертификата, его отсутствие явно записывается в результат сборки.

- [ ] **Step 2: Собрать инсталлятор**

Run: `npm run dist:win`
Expected: `release/Invest-AI-Setup-0.1.0.exe` создан; native modules загружаются из packaged app, ошибок `NODE_MODULE_VERSION` нет.

- [ ] **Step 3: Документировать запуск и приватность**

`README.md` содержит точные команды:

```bash
npm ci
npm run dev
npm run test:unit
npm run test:e2e
npm run build
npm run dist:win
```

Отдельно описаны read-only token, установка и вход `codex`/`kimi`/`claude`, отсутствие API-ключей ИИ, возможная плата по условиям аккаунта CLI, автоматическая отправка обезличенного снимка выбранному ИИ, отключение tools и истории CLI, демонстрационный режим, расположение локальных данных и отсутствие торговли.

- [ ] **Step 4: Выполнить чистую проверку**

Скопировать проект без `node_modules`, `out`, `release` и локальных секретов в отдельную временную папку внутри workspace.
Run: `npm ci && npm run test:unit && npm run test:e2e && npm run dist:win`
Expected: команды завершаются успешно без глобальных зависимостей.

- [ ] **Step 5: Ручная приёмка Windows**

Установить приложение, запустить без Node.js в PATH, проверить demo и реальный read-only портфель, каждого настроенного ИИ-провайдера, offline cache, удаление секретов и закрытие без оставшихся процессов. Сверить основные суммы с официальным приложением брокера; расхождения по времени котировок и оценочной истории должны быть подписаны.

- [ ] **Step 6: Контрольная точка**

```bash
git add electron-builder.yml package.json package-lock.json README.md build/icon.ico
git commit -m "build: deliver Windows installer"
```

## Spec Coverage Map

- Разделы 1–3 спецификации: Tasks 1–5, 8.
- Экраны раздела 4: Tasks 6–10.
- Данные, точность, обновление и история раздела 5: Tasks 2–5, 11.
- Автоматический контекст и read-only tools раздела 6: Task 10.
- Безопасность раздела 7: Tasks 1, 4, 8–11.
- Ошибки и производительность разделов 8–9: Tasks 5, 9–11.
- Тестирование раздела 10: модульные и контрактные циклы Tasks 1–11, E2E Task 11, ручная приёмка Task 12.
- Windows-поставка и критерии готовности разделов 11–12: Task 12.
- Функции раздела 13 не реализуются.
