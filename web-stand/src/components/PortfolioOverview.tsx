import type { Account, Period } from "../demo-data";

interface PortfolioOverviewProps {
  account: Account;
  period: Period;
  onPeriod: (period: Period) => void;
}

export function PortfolioOverview(_props: PortfolioOverviewProps) {
  return <section className="portfolio-overview" aria-label="Портфель" />;
}
