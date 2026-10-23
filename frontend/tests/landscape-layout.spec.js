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
async function settle(page) {
  await page.locator(".career-node").evaluateAll(async (nodes) => {
    await Promise.all(
      nodes.flatMap((node) => node.getAnimations().map((a) => a.finished)),
    );
  });
}
async function checkFrame(page, width, height) {
  await settle(page);
  const geometry = await page.evaluate(() => {
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    };
    return {
      height: document.documentElement.scrollHeight,
      width: document.documentElement.scrollWidth,
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
    geometry.height,
    `${width}x${height}: vertical overflow`,
  ).toBeLessThanOrEqual(height + 1);
  expect(geometry.width).toBeLessThanOrEqual(width);
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
          `${width}x${height}: overlapping items ${JSON.stringify(a)} and ${JSON.stringify(b)}`,
        ).toBe(false);
      }
    }
  }
  expect(
    await page
      .locator(".career-node strong")
      .evaluateAll((nodes) =>
        nodes.every((node) => node.scrollHeight <= node.clientHeight + 1),
      ),
  ).toBe(true);
  for (const selector of [".career-node-type", ".career-node-link"]) {
    await expect(page.locator(selector).first()).toBeVisible();
  }
}

test("spacious career pages fit the frame and keep every result accessible across sizes and themes", async ({
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
          source: "O*NET",
          description: `${title} career description.`,
        })),
      },
    }),
  );
  await page.route("**/api/skill-gap", (route) =>
    route.fulfill({ json: { matched_skills: [], skill_gaps: [] } }),
  );
  await page.goto("http://127.0.0.1:5173");
  await studentToIdentity(page);
  await button(page, "Explore paths").click();
  await expect(page.locator(".career-node")).toHaveCount(6);
  await expect(
    page.getByRole("heading", { name: "Look where your story could go." }),
  ).toBeVisible();
  await expect(page.locator(".constellation-self")).toContainText(
    "Your identity",
  );
  await expect(page.locator(".paths-view")).toHaveCSS(
    "background-color",
    "rgb(22, 24, 19)",
  );
  await expect(page.locator(".career-node-dot").first()).toHaveCSS(
    "background-color",
    "rgb(212, 245, 164)",
  );
  await expect(button(page, "Pause background motion")).toBeVisible();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const previous = button(page, "Previous career possibilities");
  const next = button(page, "Next career possibilities");
  for (const [width, height] of [
    [1280, 642],
    [1440, 900],
    [1024, 600],
    [768, 650],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(previous).toBeDisabled();
    await expect(page.locator(".career-node strong")).toHaveText(
      titles.slice(0, 6),
    );
    await checkFrame(page, width, height);
    await next.click();
    await expect(page.locator(".landscape-pagination")).toContainText("7–12");
    await expect(page.locator(".career-node strong")).toHaveText(
      titles.slice(6),
    );
    await expect(next).toBeDisabled();
    await checkFrame(page, width, height);
    await previous.click();
  }
  await page.setViewportSize({ width: 1280, height: 642 });
  await settle(page);
  await page.screenshot({ path: "test-results/career-frame-dark.png" });
  await page.getByRole("switch", { name: "Light theme" }).click();
  await expect(page.locator(".paths-view")).toHaveCSS(
    "background-color",
    "rgb(245, 246, 238)",
  );
  await expect(page.locator(".career-node-dot").first()).toHaveCSS(
    "background-color",
    "rgb(72, 104, 41)",
  );
  await expect(page.locator(".career-node").first()).toHaveCSS(
    "color",
    "rgb(38, 50, 31)",
  );
  await page.screenshot({ path: "test-results/career-frame-light.png" });
  await next.focus();
  await page.keyboard.press("Enter");
  await settle(page);
  await page.locator(".career-node").last().click();
  await expect(page.getByRole("dialog")).toContainText(titles[11]);
  await button(page, "Close career details").click();
  await expect(page.locator(".career-node").last()).toBeFocused();
  await expect(page.locator(".career-node").last()).toBeInViewport({
    ratio: 1,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".career-node")).toHaveCount(12);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator(".landscape-pagination")).toHaveCount(0);
  await button(page, "Back to my story").click();
  await expect(page.getByLabel("Career identity statement")).toBeVisible();
  await button(page, "Explore paths tab").click();
  await expect(page.locator(".career-node")).toHaveCount(12);
});
