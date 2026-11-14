import {
  ArrowLeftRight,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  LayoutDashboard,
  Settings,
  type LucideIcon,
} from "lucide-react";

interface NavigationItem {
  label: string;
  icon: LucideIcon;
}

const items: NavigationItem[] = [
  { label: "Обзор", icon: LayoutDashboard },
  { label: "Портфель", icon: BriefcaseBusiness },
  { label: "Аналитика", icon: ChartNoAxesCombined },
  { label: "Операции", icon: ArrowLeftRight },
  { label: "Настройки", icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">IA</span>
        <span className="brand-name">Invest AI</span>
      </div>
      <nav className="navigation" aria-label="Разделы">
        {items.map(({ label, icon: Icon }) => {
          const content = (
            <>
              <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
              <span className="nav-label">{label}</span>
            </>
          );

          return label === "Обзор" ? (
            <button
              className="nav-item active"
              type="button"
              aria-label={label}
              aria-current="page"
              key={label}
            >
              {content}
            </button>
          ) : (
            <span className="nav-item nav-placeholder" key={label}>
              {content}
            </span>
          );
        })}
      </nav>
      <div className="sidebar-foot">
        <span className="live-dot" aria-hidden="true" />
        <span className="sidebar-foot-label">Демо-портфель</span>
      </div>
    </aside>
  );
}
