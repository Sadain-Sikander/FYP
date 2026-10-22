import { test, expect } from "@playwright/test";
import { button, stubSkills, studentToIdentity } from "./discovery-helpers";

const titles = [
  "Data Scientists",
  "Business Intelligence Analysts",
  "Data Analyst",
  "Statistical Assistants",
  "Data Warehousing Specialists",
  "Statistician",
  "Clinical Data Systems Specialist / Manager",
  "Clinical Data Managers",
  "Financial and Investment Analysts",
  "Database Administrators",
  "Sales Representatives of Services, Except Advertising, Insurance, Financial Services, and Travel",
  "Information Security Analysts",
];

test("all twelve careers fit the desktop frame without overlapping, across sizes and themes", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await stubSkills(page);
  await page.route("**/api/careers/recommend", (route) =>
    route.fulfill({
      json: {
        results: titles.map((title, i) => ({
          id: `layout-${i}`,
          title,
          source: i % 3 ? "O*NET" : "ESCO",
          description: `${title} career description.`,
        })),
      },
    }),
  );
  await page.goto("http://127.0.0.1:5173");
  await studentToIdentity(page);
  await button(page, "Explore paths").click();
  await expect(page.locator(".career-node")).toHaveCount(12);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.locator(".career-node").evaluateAll(async (nodes) => {
    await Promise.all(
      nodes.flatMap((node) => node.getAnimations().map((a) => a.finished)),
    );
  });
  for (const [width, height] of [
    [1280, 642],
    [1440, 900],
    [1024, 600],
    [768, 650],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    const geometry = await page.evaluate(() => {
      const rect = (el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      };
      return {
        pageHeight: document.documentElement.scrollHeight,
        pageWidth: document.documentElement.scrollWidth,
        bounds: [
          ...document.querySelectorAll(".career-node, .constellation-self"),
        ].map(rect),
        header: [
          ...document.querySelectorAll(
            ".paths-view .story-brand-group, .paths-view .identity-tabs, .paths-view .loom-nav-actions",
          ),
        ].map(rect),
      };
    });
    expect(
      geometry.pageHeight,
      `${width}x${height}: vertical overflow`,
    ).toBeLessThanOrEqual(height + 1);
    expect(geometry.pageWidth).toBeLessThanOrEqual(width);
    for (const group of [geometry.bounds, geometry.header]) {
      for (let i = 0; i < group.length; i++) {
        const a = group[i];
        expect(a.left).toBeGreaterThanOrEqual(0);
        expect(a.right).toBeLessThanOrEqual(width);
        expect(a.top).toBeGreaterThanOrEqual(0);
        expect(a.bottom).toBeLessThanOrEqual(height);
        for (const b of group.slice(i + 1)) {
          expect(
            a.left < b.right &&
              a.right > b.left &&
              a.top < b.bottom &&
              a.bottom > b.top,
            `${width}x${height}: overlapping items`,
          ).toBe(false);
        }
      }
    }
  }
  await page.setViewportSize({ width: 1280, height: 642 });
  const center = page.locator(".constellation-self");
  expect(await center.evaluate((el) => {
    const bounds = el.getBoundingClientRect();
    return [...el.children].every((child) => {
      const r = child.getBoundingClientRect();
      return r.top >= bounds.top && r.bottom <= bounds.bottom &&
        r.left >= bounds.left && r.right <= bounds.right;
    });
  })).toBe(true);
  await page.screenshot({ path: "test-results/career-frame-dark.png" });
  await page.getByRole("switch", { name: "Light theme" }).click();
  await expect(page.locator(".career-node").first()).toHaveCSS("color", "rgb(52, 74, 86)");
  await page.screenshot({ path: "test-results/career-frame-light.png" });
  await page.locator(".career-node").last().focus();
  await expect(page.locator(".career-node").last()).toBeInViewport({
    ratio: 1,
  });
  await expect(page.locator(".career-node").last()).toBeFocused();
  await button(page, "List").click();
  await expect(button(page, "List")).toHaveAttribute("aria-pressed", "true");
  await expect(center).toBeHidden();
  await expect(page.locator(".career-node")).toHaveCount(12);
  await page.route("**/api/skill-gap", (route) => route.fulfill({ json: {
    career: { id: "layout-0", title: titles[0], source: "ESCO" },
    matched_skills: [], skill_gaps: [], essential_skills: [],
  } }));
  await page.locator(".career-node").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: titles[0], exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".career-node").first()).toBeFocused();
  await page.screenshot({ path: "test-results/career-atlas-list.png" });
  await button(page, "Map").click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator(".career-node")).toHaveCount(12);
  await page.screenshot({ path: "test-results/career-atlas-mobile.png", fullPage: true });
  await button(page, "Back to my story").click();
  await expect(page.getByLabel("Career identity statement")).toBeVisible();
  await button(page, "Explore paths tab").click();
  await expect(page.locator(".career-node")).toHaveCount(12);
});
