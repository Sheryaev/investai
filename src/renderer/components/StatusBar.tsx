interface StatusBarProps {
  asOf: string;
  stale: boolean;
  partial: boolean;
  refreshing: boolean;
  onRefresh?: () => void;
}

export function StatusBar({ asOf, stale, partial, refreshing, onRefresh }: StatusBarProps) {
  return (
    <div className="status-bar">
      <span>Данные на {new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(asOf))}</span>
      {stale && <span className="status-warning">Данные устарели</span>}
      {partial && <span className="status-warning">Неполные данные</span>}
      {onRefresh && (
        <button className="button secondary compact" type="button" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? "Обновляем…" : "Обновить"}
        </button>
      )}
    </div>
  );
}
