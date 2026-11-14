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

test("light, dark and agent states", async ({ page }) => {
  await openStand(page);
  await page.screenshot({ path: "test-results/overview-light.png", fullPage: true });

  await page.getByRole("button", { name: "Открыть агента" }).click();
  await expect(page.getByRole("complementary", { name: "ИИ-агент" })).toBeVisible();
  await page.getByRole("button", { name: "Найти риски" }).click();
  await expect(page.getByText(/концентрация в акциях/)).toBeVisible();
  await page.screenshot({ path: "test-results/agent-light.png", fullPage: true });

  await page.getByRole("button", { name: "Закрепить" }).click();
  await expect(page.getByRole("complementary", { name: "ИИ-агент" })).toHaveCSS("position", "sticky");
  await page.getByRole("button", { name: "Тёмная тема" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({ path: "test-results/agent-dark.png", fullPage: true });

  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "ИИ-агент" })).toHaveCount(0);
  await page.screenshot({ path: "test-results/overview-dark.png", fullPage: true });
  await expectNoHorizontalOverflow(page);
});

test("mobile agent opens, closes with Escape, and does not overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openStand(page);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: "test-results/mobile-overview.png", fullPage: true });

  await page.getByRole("button", { name: "Открыть агента" }).click();
  const panel = page.getByRole("complementary", { name: "ИИ-агент" });
  await expect(panel).toBeVisible();
  await page.getByRole("button", { name: "Найти риски" }).click();
  await expect(page.getByText(/концентрация в акциях/)).toBeVisible();
  await page.screenshot({ path: "test-results/mobile-agent.png", fullPage: true });

  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Открыть агента" })).toBeFocused();
  await expectNoHorizontalOverflow(page);
});

for (const width of [375, 768, 1024, 1440]) {
  test(`no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await openStand(page);
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "Открыть агента" }).click();
    await expect(page.getByRole("complementary", { name: "ИИ-агент" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}

test("pinning switches from overlay at 1279px to side-by-side at 1280px and preserves selection", async ({ page }) => {
  await page.setViewportSize({ width: 1279, height: 1000 });
  await openStand(page);
  await page.getByLabel("Счёт").selectOption("iis");
  await expect(page.getByLabel("Счёт")).toHaveValue("iis");
  await expect(page.getByText(/746.*200.*₽/)).toBeVisible();
  await page.getByRole("button", { name: "1М", exact: true }).click();
  await expect(page.getByRole("button", { name: "1М", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("img", { name: "Динамика стоимости портфеля за 1М" })).toBeVisible();

  await page.getByRole("button", { name: "Открыть агента" }).click();
  await page.getByRole("button", { name: "Закрепить" }).click();
  const overlay = page.getByRole("complementary", { name: "ИИ-агент" });
  await expect(overlay).toHaveCSS("position", "fixed");
  await expect(page.getByRole("button", { name: "Закрыть агента" })).toBeVisible();
  expect(await page.locator(".stand-shell").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length)).toBe(2);
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();

  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.getByRole("button", { name: "Открыть агента" }).click();
  await page.getByRole("button", { name: "Закрепить" }).click();
  const pinned = page.getByRole("complementary", { name: "ИИ-агент" });
  await expect(pinned).toHaveCSS("position", "sticky");
  await expect(page.getByRole("button", { name: "Закрыть агента" })).toBeHidden();
  expect(await page.locator(".stand-shell").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length)).toBe(3);
  await expect(page.getByLabel("Счёт")).toHaveValue("iis");
  await expect(page.getByRole("button", { name: "1М", exact: true })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
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
  await expect(page.getByRole("complementary", { name: "ИИ-агент" })).toHaveCount(0);
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

test("agent secondary text meets the 13px readability minimum", async ({ page }) => {
  await openStand(page);
  await page.getByRole("button", { name: "Открыть агента" }).click();
  const fontSizes: number[] = [];
  fontSizes.push(await page.getByLabel("Модель").evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)));

  await page.getByRole("button", { name: "Найти риски" }).click();
  fontSizes.push(await page.getByRole("status").evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)));
  await expect(page.getByText(/концентрация в акциях/)).toBeVisible();
  fontSizes.push(await page.locator(".message.agent small").evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)));

  expect(fontSizes.every((size) => size >= 13), `font sizes: ${fontSizes.join(", ")}`).toBe(true);
});

test("mobile account selector keeps enough width for its full label", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openStand(page);
  const selectWidth = await page.getByLabel("Счёт").evaluate((element) => element.getBoundingClientRect().width);
  expect(selectWidth).toBeGreaterThanOrEqual(170);
  await expect(page.getByRole("button", { name: "Открыть агента" })).toHaveCSS("min-width", "44px");
});
