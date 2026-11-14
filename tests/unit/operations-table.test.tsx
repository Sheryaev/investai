// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OperationsTable } from "../../src/renderer/components/OperationsTable";
import { serializeOperations } from "../../src/shared/market-codec";
import { money } from "../../src/main/portfolio/money";
import type { OperationsRequest } from "../../src/shared/contracts";

const accounts = [{ id: "account-1", name: "Основной" }, { id: "account-2", name: "ИИС" }];

function payload(request: OperationsRequest) {
  return serializeOperations([{
    id: `op-${request.accountId}`, accountId: request.accountId, date: "2026-11-14T09:15:00.000Z",
    type: "dividend", description: "Дивиденды Сбербанк", payment: money("1250", "RUB"),
    quantity: null, instrumentId: "sber", figi: "sber",
  }]);
}

afterEach(cleanup);

describe("OperationsTable", () => {
  it("loads selected accounts and filters operations by type", async () => {
    const getOperations = vi.fn(async (request: OperationsRequest) => payload(request));
    window.investAi = { getOperations } as never;
    render(<OperationsTable accounts={accounts} />);
    expect(await screen.findAllByText("Дивиденды Сбербанк")).toHaveLength(2);
    expect(getOperations).toHaveBeenCalledTimes(2);
    fireEvent.change(screen.getByLabelText("Тип операции"), { target: { value: "buy" } });
    expect(screen.queryByText("Дивиденды Сбербанк")).toBeNull();
    expect(screen.getByText("Операции по выбранным фильтрам не найдены.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Тип операции"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Счёт операций"), { target: { value: "account-2" } });
    await waitFor(() => expect(getOperations).toHaveBeenCalledTimes(3));
    expect(getOperations.mock.lastCall?.[0].accountId).toBe("account-2");
    expect(screen.getAllByText("Дивиденды Сбербанк")).toHaveLength(1);
  });

  it("keeps successful account data when another account fails", async () => {
    window.investAi = {
      getOperations: vi.fn(async (request: OperationsRequest) => {
        if (request.accountId === "account-2") throw new Error("offline");
        return payload(request);
      }),
    } as never;
    render(<OperationsTable accounts={accounts} />);
    expect(await screen.findByText("Дивиденды Сбербанк")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/часть операций/i);
  });
});
