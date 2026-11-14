import { describe, expect, it } from "vitest";
import { Database } from "../../src/main/database/database";
import { SnapshotRepository } from "../../src/main/database/snapshot-repository";
import { fixtureSnapshot } from "./fixtures";

function createRepository() {
  const database = new Database(":memory:");
  return { database, repository: new SnapshotRepository(database) };
}

describe("SnapshotRepository", () => {
  it("round-trips Decimal values and restores the latest snapshot", () => {
    const { database, repository } = createRepository();
    repository.save(fixtureSnapshot);
    expect(repository.get(fixtureSnapshot.id)).toEqual(fixtureSnapshot);
    expect(repository.latest()).toEqual(fixtureSnapshot);
    expect(repository.list(1)).toEqual([{ id: fixtureSnapshot.id, asOf: fixtureSnapshot.asOf, completeness: "complete" }]);
    database.close();
  });

  it("upserts the same snapshot without duplicates", () => {
    const { database, repository } = createRepository();
    repository.save(fixtureSnapshot);
    repository.save(fixtureSnapshot);
    expect(repository.list(10)).toHaveLength(1);
    database.close();
  });

  it("rejects a corrupted stored payload", () => {
    const { database, repository } = createRepository();
    database.execute(
      "INSERT INTO snapshots (id, as_of, completeness, payload) VALUES (?, ?, ?, ?)",
      "broken",
      "2026-11-14T13:00:00.000Z",
      "partial",
      "{broken",
    );
    expect(() => repository.get("broken")).toThrow(/снимка|поврежд/i);
    database.close();
  });
});
