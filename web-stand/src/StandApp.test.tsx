import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StandApp } from "./StandApp";

vi.mock("echarts/core", () => ({
  init: () => ({ setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() }),
  use: vi.fn(),
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

    expect(screen.getByRole("dialog", { name: "ИИ-агент" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Обзор" })).toBeVisible();
  });

  it("returns focus to the topbar opener after Escape and after reopening", async () => {
    const user = userEvent.setup();
    render(<StandApp />);
    const opener = screen.getByRole("button", { name: "Открыть агента" });

    await user.click(opener);
    expect(screen.getByRole("dialog", { name: "ИИ-агент" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "ИИ-агент" })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();

    await user.click(opener);
    await user.click(screen.getByRole("button", { name: "Закрыть" }));
    expect(opener).toHaveFocus();
  });

  it("makes the overlay modal, removes background inert on close, and restores focus", async () => {
    const user = userEvent.setup();
    render(<StandApp />);
    const opener = screen.getByRole("button", { name: "Открыть агента" });

    await user.click(opener);

    expect(screen.getByRole("dialog", { name: "ИИ-агент" })).toHaveAttribute("aria-modal", "true");
    expect(document.querySelector(".sidebar")).toHaveAttribute("inert");
    expect(document.querySelector(".workspace")).toHaveAttribute("inert");

    await user.keyboard("{Escape}");

    expect(document.querySelector(".sidebar")).not.toHaveAttribute("inert");
    expect(document.querySelector(".workspace")).not.toHaveAttribute("inert");
    expect(opener).toHaveFocus();
  });

  it("keeps the current section named and exposes no dead Overview button or link", () => {
    render(<StandApp />);

    const current = screen.getByLabelText("Обзор");
    expect(current.tagName).toBe("SPAN");
    expect(current).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("button", { name: "Обзор" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Обзор" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Портфель" })).not.toBeInTheDocument();
    expect(screen.getByText("Портфель").tagName).toBe("SPAN");
  });
});
