export type ErrorCategory = "auth" | "permission" | "rate_limit" | "network" | "invalid_response" | "provider" | "storage";

export class AppError extends Error {
  constructor(public readonly category: ErrorCategory, message: string, public readonly retryAfterMs?: number) {
    super(message);
    this.name = "AppError";
  }
}

export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const code = typeof error === "object" && error !== null && "code" in error ? Number(error.code) : null;
  if (code === 16) return new AppError("auth", "Требуется действительный токен Т-Инвестиций.");
  if (code === 7) return new AppError("permission", "У токена недостаточно прав для чтения портфеля.");
  if (code === 8) return new AppError("rate_limit", "Брокер ограничил частоту запросов.");
  return new AppError("network", "Не удалось получить данные брокера. Проверьте соединение.");
}
