import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StandApp } from "./StandApp";

vi.mock("echarts", () => ({
  init: () => ({ setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() }),
}));

describe("StandApp", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it("switches and persists the theme", async () => {
    const user = userEvent.setup();
    render(<StandApp />);

    await user.click(screen.getByRole("button", { name: "Тёмная тема" }));

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem("invest-theme")).toBe("dark");
    expect(screen.getByRole("button", { name: "Светлая тема" })).toBeVisible();
  });

  it("restores the persisted theme", () => {
    localStorage.setItem("invest-theme", "dark");

    render(<StandApp />);

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(screen.getByRole("button", { name: "Светлая тема" })).toBeVisible();
  });

  it("opens the agent without navigation", async () => {
    const user = userEvent.setup();
    render(<StandApp />);

    await user.click(screen.getByRole("button", { name: "Открыть агента" }));

    expect(screen.getByRole("complementary", { name: "ИИ-агент" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Обзор" })).toBeVisible();
  });

  it("keeps the current section named and placeholders non-interactive", () => {
    render(<StandApp />);

    expect(screen.getByRole("button", { name: "Обзор" })).toHaveAttribute("aria-label", "Обзор");
    expect(screen.queryByRole("button", { name: "Портфель" })).not.toBeInTheDocument();
    expect(screen.getByText("Портфель").tagName).toBe("SPAN");
  });
});
