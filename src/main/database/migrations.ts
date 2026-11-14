import type BetterSqlite3 from "better-sqlite3";

const migrations = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS snapshots (
        id TEXT PRIMARY KEY,
        as_of TEXT NOT NULL,
        completeness TEXT NOT NULL CHECK (completeness IN ('complete', 'partial')),
        payload TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS snapshots_as_of_idx ON snapshots(as_of DESC);
    `,
  },
  {
    version: 2,
    sql: `
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        provider TEXT NULL CHECK (provider IN ('codex', 'kimi', 'claude') OR provider IS NULL),
        content TEXT NOT NULL,
        snapshot_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx ON chat_messages(created_at);
    `,
  },
];

export function migrate(connection: BetterSqlite3.Database): void {
  connection.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
  const applied = connection.prepare("SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations").get() as { version: number };
  for (const migration of migrations.filter((item) => item.version > applied.version)) {
    connection.transaction(() => {
      connection.exec(migration.sql);
      connection.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)")
        .run(migration.version, new Date().toISOString());
    })();
  }
}
