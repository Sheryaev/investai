import type { PortfolioSnapshot } from "../portfolio/types";
import type { Database } from "./database";
import { deserializeSnapshot, serializeSnapshot } from "./snapshot-codec";

export interface SnapshotMeta {
  id: string;
  asOf: string;
  completeness: "complete" | "partial";
}

interface SnapshotRow extends SnapshotMeta {
  payload: string;
}

export class SnapshotRepository {
  constructor(private readonly database: Database) {}

  save(snapshot: PortfolioSnapshot): void {
    const payload = serializeSnapshot(snapshot);
    this.database.transaction(() => {
      this.database.execute(
        `INSERT INTO snapshots (id, as_of, completeness, payload) VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET as_of = excluded.as_of, completeness = excluded.completeness, payload = excluded.payload`,
        snapshot.id,
        snapshot.asOf,
        snapshot.completeness,
        payload,
      );
    });
  }

  get(id: string): PortfolioSnapshot | null {
    const row = this.database.get<SnapshotRow>("SELECT id, as_of AS asOf, completeness, payload FROM snapshots WHERE id = ?", id);
    return row ? deserializeSnapshot(row.payload) : null;
  }

  latest(): PortfolioSnapshot | null {
    const row = this.database.get<{ id: string }>("SELECT id FROM snapshots ORDER BY as_of DESC, id DESC LIMIT 1");
    return row ? this.get(row.id) : null;
  }

  list(limit: number): SnapshotMeta[] {
    const safeLimit = Math.max(1, Math.min(1000, Math.trunc(limit)));
    return this.database.all<SnapshotMeta>(
      "SELECT id, as_of AS asOf, completeness FROM snapshots ORDER BY as_of DESC, id DESC LIMIT ?",
      safeLimit,
    );
  }

  close(): void {
    this.database.close();
  }
}
