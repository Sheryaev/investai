import BetterSqlite3 from "better-sqlite3";
import { migrate } from "./migrations";

export class Database {
  private readonly connection: BetterSqlite3.Database;

  constructor(location: string) {
    this.connection = new BetterSqlite3(location);
    if (location !== ":memory:") this.connection.pragma("journal_mode = WAL");
    this.connection.pragma("foreign_keys = ON");
    migrate(this.connection);
  }

  execute(sql: string, ...parameters: unknown[]): BetterSqlite3.RunResult {
    return this.connection.prepare(sql).run(...parameters);
  }

  get<T>(sql: string, ...parameters: unknown[]): T | undefined {
    return this.connection.prepare(sql).get(...parameters) as T | undefined;
  }

  all<T>(sql: string, ...parameters: unknown[]): T[] {
    return this.connection.prepare(sql).all(...parameters) as T[];
  }

  transaction<T>(work: () => T): T {
    return this.connection.transaction(work)();
  }

  close(): void {
    this.connection.close();
  }
}
