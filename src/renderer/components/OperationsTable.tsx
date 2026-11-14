import { useEffect, useMemo, useRef, useState } from "react";
import type { BrokerOperation, OperationType } from "../../main/invest/gateway";
import { deserializeOperations } from "../../shared/market-codec";
import { formatMoney } from "../pages/DashboardPage";

interface OperationsTableProps {
  accounts: Array<{ id: string; name: string }>;
}

const periods = { "1Н": 7, "1М": 30, "3М": 90, "1Г": 365 } as const;
type Period = keyof typeof periods;
const operationTypes: Record<OperationType, string> = {
  deposit: "Пополнение", withdrawal: "Вывод", buy: "Покупка", sell: "Продажа",
  dividend: "Дивиденды", coupon: "Купон", fee: "Комиссия", tax: "Налог", other: "Другое",
};
const dateFormatter = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function OperationsTable({ accounts }: OperationsTableProps) {
  const [period, setPeriod] = useState<Period>("1М");
  const [account, setAccount] = useState("");
  const [type, setType] = useState("");
  const [operations, setOperations] = useState<BrokerOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const accountKey = accounts.map((item) => `${item.id}:${item.name}`).join("|");
  const accountNames = useMemo(() => new Map(accounts.map((item) => [item.id, item.name])), [accounts]);

  useEffect(() => {
    const id = ++requestId.current;
    const selectedAccounts = accounts.filter((item) => !account || item.id === account);
    const to = new Date();
    const from = new Date(to.getTime() - periods[period] * 86_400_000);
    setLoading(true);
    setError(null);
    setOperations([]);
    void Promise.allSettled(selectedAccounts.map(async (item) => {
      const payload = await window.investAi.getOperations({ accountId: item.id, from: from.toISOString(), to: to.toISOString() });
      return deserializeOperations(payload);
    })).then((results) => {
      if (requestId.current !== id) return;
      const loaded = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
      loaded.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
      setOperations(loaded);
      if (results.some((result) => result.status === "rejected")) {
        setError(loaded.length > 0 ? "Не удалось загрузить часть операций. Показаны доступные данные." : "Не удалось загрузить операции. Попробуйте другой период.");
      }
      setLoading(false);
    });
    return () => { requestId.current += 1; };
    // accountKey represents the stable account list used by this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountKey, account, period]);

  const filtered = operations.filter((operation) => !type || operation.type === type);

  return (
    <section className="panel table-panel operations-panel">
      <div className="operations-heading">
        <div><h2>Операции</h2><p className="muted">Пополнения, сделки, выплаты и комиссии</p></div>
        <div className="period-tabs" aria-label="Период операций">
          {(Object.keys(periods) as Period[]).map((item) => <button key={item} type="button" className={period === item ? "active" : ""} onClick={() => setPeriod(item)}>{item}</button>)}
        </div>
      </div>
      <div className="table-filters">
        <select className="field" aria-label="Счёт операций" value={account} onChange={(event) => setAccount(event.target.value)}>
          <option value="">Все счета</option>
          {accounts.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
        </select>
        <select className="field" aria-label="Тип операции" value={type} onChange={(event) => setType(event.target.value)}>
          <option value="">Все операции</option>
          {Object.entries(operationTypes).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>
      </div>
      {error && <div className="inline-alert" role="alert">{error}</div>}
      <div className="table-scroll">
        <table className="data-table operations-table">
          <thead><tr><th>Дата</th><th>Операция</th><th>Тип</th><th>Счёт</th><th>Количество</th><th>Сумма</th></tr></thead>
          <tbody>
            {filtered.map((operation) => <tr key={`${operation.accountId}:${operation.id}`}>
              <td>{dateFormatter.format(new Date(operation.date))}</td>
              <td>{operation.description}</td>
              <td>{operationTypes[operation.type]}</td>
              <td>{accountNames.get(operation.accountId) ?? "Счёт"}</td>
              <td>{operation.quantity?.toString() ?? "Н/Д"}</td>
              <td className={operation.payment?.value.gte(0) ? "positive" : "negative"}>{formatMoney(operation.payment)}</td>
            </tr>)}
          </tbody>
        </table>
        {loading && <p className="table-empty">Загружаем операции…</p>}
        {!loading && filtered.length === 0 && <p className="table-empty">Операции по выбранным фильтрам не найдены.</p>}
      </div>
    </section>
  );
}
