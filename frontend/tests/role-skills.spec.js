import { test, expect } from "@playwright/test";
import { button } from "./discovery-helpers";

test("real occupational gaps show practical groups, source details and recognised tools", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/careers/recommend", (route) =>
    route.fulfill({
      json: {
        results: [
          {
            id: "15-2051.00",
            title: "Data Scientists",
            source: "O*NET",
            description:
              "Analyse data, build statistical models and communicate findings.",
            semantic_similarity: 0.9,
          },
        ],
      },
    }),
  );
  await page.goto("http://127.0.0.1:5173");
  await button(page, "Start my discovery").click();
  await button(page, "Use full profile editor").click();
  await page
    .getByLabel("Education & courses", { exact: true })
    .fill("Information Technology");
  await page.getByLabel("Skills", { exact: true }).fill("Python, SQL");
  await button(page, "Explore my careers").click();
  await button(page, "Explore this path").click();
  await expect(page.locator(".coverage-tag strong")).not.toHaveText("0%", {
    timeout: 120000,
  });
  const matched = page.locator(".skill-panel").first();
  await expect(matched).toContainText("Python");
  await expect(matched).toContainText("SQL");
  const gaps = page.locator(".skill-panel").nth(1);
  await expect(
    gaps.getByRole("heading", { name: "Practical skills & knowledge" }),
  ).toBeVisible();
  await expect(
    gaps.getByRole("heading", { name: "Tools used in this occupation" }),
  ).toBeVisible();
  await expect(gaps).not.toContainText("Critical Thinking");
  await gaps.locator(".role-skill-item summary").first().click();
  await expect(gaps.getByRole("link", { name: "View source" })).toHaveAttribute(
    "href",
    /data.europa.eu\/esco/,
  );
  await page
    .locator(".skill-columns")
    .screenshot({ path: "test-results/role-skills-desktop.png" });
  await page.locator(".additional-role-skills > summary").click();
  await expect(page.locator(".additional-role-skills")).toContainText(
    "Critical Thinking",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page
    .locator(".skill-columns")
    .screenshot({ path: "test-results/role-skills-mobile.png" });
});
