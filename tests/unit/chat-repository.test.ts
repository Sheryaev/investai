import { describe, expect, it, vi } from "vitest";
import { Database } from "../../src/main/database/database";
import { ChatRepository } from "../../src/main/database/chat-repository";

 describe("ChatRepository", () => {
  it("stores local history with provider and snapshot metadata", () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-11-14T18:00:00.000Z");
    const database = new Database(":memory:");
    const repository = new ChatRepository(database);
    repository.add({ role: "user", provider: null, content: "Найди риски", snapshotId: "snapshot:1" });
    repository.add({ role: "assistant", provider: "kimi", content: "Риск концентрации", snapshotId: "snapshot:1" });
    vi.useRealTimers();
    const messages = repository.list();
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ role: "user", provider: null, content: "Найди риски", snapshotId: "snapshot:1" });
    expect(messages[1]).toMatchObject({ role: "assistant", provider: "kimi" });
    expect(messages.every((message) => message.id && message.createdAt)).toBe(true);
    repository.clear();
    expect(repository.list()).toEqual([]);
    database.close();
  });
});
