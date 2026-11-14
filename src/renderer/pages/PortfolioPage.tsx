import { useState } from "react";
import type { PortfolioSnapshot, Position } from "../../main/portfolio/types";
import { PositionsTable } from "../components/PositionsTable";
import { InstrumentDrawer } from "../components/InstrumentDrawer";
import { StatusBar } from "../components/StatusBar";

export function PortfolioPage({ snapshot }: { snapshot: PortfolioSnapshot | null }) {
  const [selected, setSelected] = useState<Position | null>(null);
  if (!snapshot) return <section className="empty-state"><h1>Нет позиций</h1><p>Обновите портфель на странице обзора.</p></section>;
  return (
    <div className="page-stack">
      <header className="page-header">
        <div><span className="eyebrow">АКТИВЫ</span><h1>Портфель</h1><p className="muted">{snapshot.positions.length} позиций · поиск, фильтры и сортировка</p></div>
        <StatusBar asOf={snapshot.asOf} stale={false} partial={snapshot.completeness === "partial"} refreshing={false} />
      </header>
      <section className="panel table-panel">
        <PositionsTable positions={snapshot.positions} accounts={snapshot.allocations.accounts} onSelect={setSelected} />
      </section>
      {selected && <InstrumentDrawer position={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
