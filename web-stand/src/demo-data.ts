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
      value: index === 180 ? total : Math.round(total * (0.79 + progress * 0.21 + wave)),
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
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.trunc(value))} ₽`;
}

const percentValue = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

export function demoAnswer(agent: AgentName, question: string, account: Account): string {
  const stocks = account.allocation.find((item) => item.label === "Акции")?.value ?? 0;
  const leaders = [...account.positions].sort((a, b) => b.weight - a.weight).slice(0, 2);
  const leaderNames = leaders.map((position) => position.name).join(" и ");
  const leaderWeight = leaders.reduce((sum, position) => sum + position.weight, 0);

  if (question.includes("риск")) {
    return `Главный риск — концентрация в акциях: их доля ${percentValue.format(stocks)}%. ${leaderNames} составляют ${percentValue.format(leaderWeight)}% портфеля.`;
  }
  if (question.includes("измен")) {
    if (account.dayChange === 0) return "За сегодня стоимость портфеля не изменилась.";
    const direction = account.dayChange > 0 ? "вырос" : "снизился";
    return `За сегодня портфель ${direction} на ${formatMoney(Math.abs(account.dayChange))}. Основной вклад внесли ${leaderNames}.`;
  }
  return `${agent}: портфель выглядит умеренно сконцентрированным. Доходность с начала периода ${percentValue.format(account.totalYieldPct)}%, доля акций ${percentValue.format(stocks)}%.`;
}
