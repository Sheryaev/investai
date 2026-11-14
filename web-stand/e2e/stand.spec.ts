import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

interface PageDiagnostics {
  consoleErrors: string[];
  failedRequests: string[];
  notFoundResponses: string[];
}

const diagnostics = new WeakMap<Page, PageDiagnostics>();

test.beforeEach(({ page }) => {
  const record: PageDiagnostics = { consoleErrors: [], failedRequests: [], notFoundResponses: [] };
  diagnostics.set(page, record);
  page.on("console", (message) => {
    if (message.type() === "error") {
      const location = message.location();
      record.consoleErrors.push(`${message.text()} (${location.url || "unknown location"})`);
    }
  });
  page.on("requestfailed", (request) => {
    record.failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? "failed"}`);
  });
  page.on("response", (response) => {
    if (response.status() === 404) record.notFoundResponses.push(`${response.request().method()} ${response.url()}`);
  });
});

test.afterEach(({ page }) => {
  const record = diagnostics.get(page);
  expect(record, "diagnostics were registered").toBeDefined();
  expect(record?.notFoundResponses ?? [], "zero 404 responses").toEqual([]);
  expect(record?.consoleErrors ?? [], "zero browser console errors").toEqual([]);
  expect(record?.failedRequests ?? [], "zero failed requests").toEqual([]);
});

async function openStand(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Обзор" })).toBeVisible();
  await expect(page.getByText(/1.*284.*500.*₽/)).toBeVisible();
  await expect(page.locator(".portfolio-chart canvas")).toBeVisible();
  await expect(page.locator(".allocation-chart canvas")).toBeVisible();
  await page.evaluate(async () => { await document.fonts.ready; });
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.document, `document overflow: ${JSON.stringify(dimensions)}`).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.body, `body overflow: ${JSON.stringify(dimensions)}`).toBeLessThanOrEqual(dimensions.viewport);
}

test("light, dark and agent states expose correct overlay and pinned semantics", async ({ page }) => {
  await openStand(page);
  await page.screenshot({ path: "test-results/overview-light.png", fullPage: true });

  const opener = page.getByRole("button", { name: "Открыть агента" });
  await opener.click();
  const overlay = page.getByRole("dialog", { name: "ИИ-агент" });
  await expect(overlay).toBeVisible();
  await expect(overlay).toHaveAttribute("aria-modal", "true");
  await expect(page.locator(".sidebar")).toHaveAttribute("inert", "");
  await expect(page.locator(".workspace")).toHaveAttribute("inert", "");
  await expect(page.getByRole("button", { name: "Закрыть агента" })).toHaveAttribute("tabindex", "-1");
  await page.getByRole("button", { name: "Найти риски" }).click();
  await expect(page.getByText(/концентрация в акциях/)).toBeVisible();
  await page.screenshot({ path: "test-results/agent-light.png", fullPage: true });

  await page.getByRole("button", { name: "Закрепить" }).click();
  const pinned = page.getByRole("complementary", { name: "ИИ-агент" });
  await expect(pinned).toHaveCSS("position", "sticky");
  await expect(pinned).not.toHaveAttribute("aria-modal", "true");
  await expect(page.locator(".sidebar")).not.toHaveAttribute("inert");
  await expect(page.locator(".workspace")).not.toHaveAttribute("inert");
  await expect(page.getByRole("button", { name: "Закрыть агента" })).toHaveCount(0);
  await page.getByRole("button", { name: "Тёмная тема" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({ path: "test-results/agent-dark.png", fullPage: true });

  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(pinned).toHaveCount(0);
  await expect(opener).toBeFocused();
  await page.screenshot({ path: "test-results/overview-dark.png", fullPage: true });
  await expectNoHorizontalOverflow(page);
});

test("mobile agent hides pin, traps focus as a dialog, and cleans up inert on Escape", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openStand(page);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: "test-results/mobile-overview.png", fullPage: true });

  const opener = page.getByRole("button", { name: "Открыть агента" });
  await opener.click();
  const panel = page.getByRole("dialog", { name: "ИИ-агент" });
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute("aria-modal", "true");
  await expect(panel).toBeFocused();
  await expect(page.locator(".agent-pin-button")).toBeHidden();
  await expect(page.locator(".sidebar")).toHaveAttribute("inert", "");
  await expect(page.locator(".workspace")).toHaveAttribute("inert", "");
  await page.getByRole("button", { name: "Найти риски" }).click();
  await expect(page.getByText(/концентрация в акциях/)).toBeVisible();
  await page.screenshot({ path: "test-results/mobile-agent.png", fullPage: true });

  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(page.locator(".sidebar")).not.toHaveAttribute("inert");
  await expect(page.locator(".workspace")).not.toHaveAttribute("inert");
  await expect(opener).toBeFocused();
  await expectNoHorizontalOverflow(page);
});

for (const width of [375, 768, 1024, 1440]) {
  test(`no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await openStand(page);
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "Открыть агента" }).click();
    await expect(page.getByRole("dialog", { name: "ИИ-агент" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}

test("desktop pinning survives resize to a 1279px modal overlay without a pin control", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await openStand(page);
  await page.getByLabel("Счёт").selectOption("iis");
  await expect(page.getByLabel("Счёт")).toHaveValue("iis");
  await expect(page.getByText(/746.*200.*₽/)).toBeVisible();
  await page.getByRole("button", { name: "1М", exact: true }).click();
  await expect(page.getByRole("button", { name: "1М", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("img", { name: "Динамика стоимости портфеля за 1М" })).toBeVisible();

  const opener = page.getByRole("button", { name: "Открыть агента" });
  await opener.click();
  await expect(page.locator(".agent-pin-button")).toBeVisible();
  await page.getByRole("button", { name: "Закрепить" }).click();
  const pinned = page.getByRole("complementary", { name: "ИИ-агент" });
  await expect(pinned).toHaveCSS("position", "sticky");
  expect(await page.locator(".stand-shell").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length)).toBe(3);
  await expect(page.locator(".workspace")).not.toHaveAttribute("inert");

  await page.setViewportSize({ width: 1279, height: 1000 });
  const overlay = page.getByRole("dialog", { name: "ИИ-агент" });
  await expect(overlay).toHaveCSS("position", "fixed");
  await expect(overlay).toHaveAttribute("aria-modal", "true");
  await expect(page.locator(".agent-pin-button")).toBeHidden();
  await expect(page.getByRole("button", { name: "Закрыть агента" })).toBeVisible();
  await expect(page.locator(".workspace")).toHaveAttribute("inert", "");
  expect(await page.locator(".stand-shell").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length)).toBe(2);

  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(overlay).toHaveCount(0);
  await expect(page.locator(".workspace")).not.toHaveAttribute("inert");
  await expect(opener).toBeFocused();
  await expect(page.getByLabel("Счёт")).toHaveValue("iis");
  await expect(page.getByRole("button", { name: "1М", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/746.*200.*₽/)).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("theme persists after reload", async ({ page }) => {
  await openStand(page);
  await page.getByRole("button", { name: "Тёмная тема" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.reload();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Светлая тема" })).toBeVisible();
  await expect(page.locator(".portfolio-chart canvas")).toBeVisible();
});

test("quick and custom questions answer observably and Escape closes", async ({ page }) => {
  await openStand(page);
  const opener = page.getByRole("button", { name: "Открыть агента" });
  await opener.click();

  await page.getByRole("button", { name: "Что изменилось?" }).click();
  await expect(page.getByText(/За сегодня портфель вырос на/)).toBeVisible();

  await page.getByLabel("Модель").selectOption("Codex");
  const composer = page.getByLabel("Сообщение агенту");
  await composer.fill("Дай персональный разбор");
  await composer.press("Enter");
  await expect(page.locator(".message.user").last()).toHaveText("Дай персональный разбор");
  await expect(page.locator(".message.agent").last()).toContainText("Codex: портфель выглядит");
  await expect(page.locator(".message.agent").last().locator("small")).toHaveText("Codex");
  await expect(composer).toHaveValue("");

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "ИИ-агент" })).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("production document has a mobile viewport and no dead placeholder links", async ({ page, request }) => {
  const response = await request.get("/");
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toMatch(/<meta\s+name="viewport"\s+content="width=device-width,\s*initial-scale=1\.0"\s*\/?>/);

  await openStand(page);
  const deadLinks = await page.locator("a[href]").evaluateAll((links) => links
    .map((link) => link.getAttribute("href") ?? "")
    .filter((href) => href === "" || href === "#" || href.toLowerCase().startsWith("javascript:")));
  expect(deadLinks).toEqual([]);
  await expect(page.getByRole("button", { name: "Обзор", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Обзор", exact: true })).toHaveCount(0);
  const currentSection = page.locator(".nav-item.active");
  await expect(currentSection).toHaveAttribute("aria-label", "Обзор");
  await expect(currentSection).toHaveAttribute("aria-current", "page");
  expect(await currentSection.evaluate((element) => element.tagName)).toBe("SPAN");
});

test.describe("message log auto-scroll", () => {
  test.use({ reducedMotion: "reduce" });

  test("keeps the latest answer visible with reduced motion", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 500 });
    await openStand(page);
    await page.getByRole("button", { name: "Открыть агента" }).click();
    const log = page.getByRole("log");
    const composer = page.getByLabel("Сообщение агенту");

    for (let index = 1; index <= 4; index += 1) {
      await composer.fill(`Проверка прокрутки ${index}`);
      await composer.press("Enter");
      await expect(page.locator(".message.agent")).toHaveCount(index);
      const metrics = await log.evaluate((element) => ({
        bottom: element.scrollHeight - element.clientHeight,
        position: element.scrollTop,
      }));
      expect(Math.abs(metrics.bottom - metrics.position), `latest answer ${index} is visible`).toBeLessThanOrEqual(2);
    }
  });
});


test("portfolio weights stay on their own line", async ({ page }) => {
  await openStand(page);
  await expect(page.locator(".position-value small").first()).toHaveCSS("display", "block");
});

test("agent primary text is 16px and compact controls remain readable", async ({ page }) => {
  await openStand(page);
  await page.getByRole("button", { name: "Открыть агента" }).click();
  const composer = page.getByLabel("Сообщение агенту");
  await expect(composer).toHaveCSS("font-size", "16px");

  await page.getByRole("button", { name: "Найти риски" }).click();
  await expect(page.locator(".message.user p")).toHaveCSS("font-size", "16px");
  await expect(page.locator(".message.agent p")).toHaveCSS("font-size", "16px");

  const compactSizes: number[] = [];
  compactSizes.push(await page.getByLabel("Модель").evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)));
  compactSizes.push(await page.locator(".message.agent small").evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)));
  expect(compactSizes.every((size) => size >= 13 && size <= 14), `compact font sizes: ${compactSizes.join(", ")}`).toBe(true);
});

test("IIS agent answers use only the selected account figures", async ({ page }) => {
  await openStand(page);
  await page.getByLabel("Счёт").selectOption("iis");
  await page.getByRole("button", { name: "Открыть агента" }).click();

  await page.getByRole("button", { name: "Что изменилось?" }).click();
  const change = page.locator(".message.agent").last();
  await expect(change).toContainText("снизился на 1 240 ₽");
  await expect(change).not.toContainText("4 380");
  await expect(change).not.toContainText("вырос");

  const composer = page.getByLabel("Сообщение агенту");
  await composer.fill("Дай обзор");
  await composer.press("Enter");
  const overview = page.locator(".message.agent").last();
  await expect(overview).toContainText("11,8%");
  await expect(overview).toContainText("68,2%");
  await expect(overview).not.toContainText("18,24%");
  await expect(overview).not.toContainText("76,4%");

  await composer.fill("Найди риски портфеля");
  await composer.press("Enter");
  const risks = page.locator(".message.agent").last();
  await expect(risks).toContainText("68,2%");
  await expect(risks).not.toContainText("76,4%");
});

test("mobile account selector keeps enough width for its full label", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openStand(page);
  const selectWidth = await page.getByLabel("Счёт").evaluate((element) => element.getBoundingClientRect().width);
  expect(selectWidth).toBeGreaterThanOrEqual(170);
  await expect(page.getByRole("button", { name: "Открыть агента" })).toHaveCSS("min-width", "44px");
});


async function expectChartContained(page: Page) {
  const geometry = await page.locator(".dynamics-card").evaluate((card) => {
    const chart = card.querySelector(".portfolio-chart");
    const canvas = chart?.querySelector("canvas");
    if (!chart || !canvas) throw new Error("Rendered chart canvas not found");
    const cardBox = card.getBoundingClientRect();
    const chartBox = chart.getBoundingClientRect();
    const canvasBox = canvas.getBoundingClientRect();
    return {
      cardLeft: cardBox.left,
      cardRight: cardBox.right,
      chartLeft: chartBox.left,
      chartRight: chartBox.right,
      chartWidth: chartBox.width,
      canvasLeft: canvasBox.left,
      canvasRight: canvasBox.right,
      canvasWidth: canvasBox.width,
    };
  });

  expect(geometry.chartWidth).toBeGreaterThan(0);
  expect(geometry.canvasWidth).toBeGreaterThan(0);
  expect(geometry.chartLeft).toBeGreaterThanOrEqual(geometry.cardLeft);
  expect(geometry.chartRight).toBeLessThanOrEqual(geometry.cardRight + 1);
  expect(geometry.canvasLeft).toBeGreaterThanOrEqual(geometry.chartLeft);
  expect(geometry.canvasRight).toBeLessThanOrEqual(geometry.chartRight + 1);
}

for (const [period, slug] of [["1Д", "1d"], ["1Н", "1n"]] as const) {
  test(`period ${period} chart geometry and desktop/mobile screenshots`, async ({ page }) => {
    await openStand(page);
    await page.getByRole("button", { name: period, exact: true }).click();
    await expect(page.getByRole("img", { name: `Динамика стоимости портфеля за ${period}` })).toBeVisible();
    await page.waitForTimeout(350);
    await expectChartContained(page);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `test-results/overview-${slug}.png`, fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(150);
    await expectChartContained(page);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `test-results/mobile-${slug}.png`, fullPage: true });
  });
}
