import { randomUUID } from "node:crypto";
import type { ChatMessage } from "../../shared/contracts";
import type { Database } from "./database";

export class ChatRepository {
  constructor(private readonly database: Database) {}

  add(input: Pick<ChatMessage, "role" | "provider" | "content" | "snapshotId">): ChatMessage {
    const message: ChatMessage = { id: randomUUID(), createdAt: new Date().toISOString(), ...input };
    this.database.execute(
      "INSERT INTO chat_messages (id, role, provider, content, snapshot_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      message.id, message.role, message.provider, message.content, message.snapshotId, message.createdAt,
    );
    return message;
  }

  list(limit = 200): ChatMessage[] {
    const safeLimit = Math.max(1, Math.min(1000, Math.trunc(limit)));
    return this.database.all<ChatMessage>(
      `SELECT id, role, provider, content, snapshot_id AS snapshotId, created_at AS createdAt
       FROM (
         SELECT rowid AS sequence, * FROM chat_messages
         ORDER BY created_at DESC, sequence DESC LIMIT ?
       ) ORDER BY created_at, sequence`,
      safeLimit,
    );
  }

  clear(): void {
    this.database.execute("DELETE FROM chat_messages");
  }
}
