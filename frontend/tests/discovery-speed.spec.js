import { test, expect } from "@playwright/test";
import { button } from "./discovery-helpers";

test("users can continue with their own skills while suggestions are pending", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  let release;
  await page.route("**/api/discovery/skills", async (route) => {
    await new Promise((resolve) => {
      release = resolve;
    });
    await route
      .fulfill({
        json: {
          skills: [{ name: "Late suggestion", sources: ["ESCO"] }],
          next_offset: 1,
        },
      })
      .catch(() => {});
  });
  await page.goto("http://127.0.0.1:5173");
  await button(page, "Start my discovery").click();
  await page
    .getByLabel("Current or previous role", { exact: true })
    .fill("Student");
  await button(page, "Next").click();
  await page
    .getByLabel("Education level")
    .selectOption({ label: "Bachelor’s degree" });
  await button(page, "Next").click();
  await page.getByLabel("Subject area").fill("Information Technology");
  await button(page, "Next").click();
  await expect(
    page.getByText("Finding skills that connect to your story…"),
  ).toBeVisible();
  await page
    .getByLabel("Add a skill", { exact: true })
    .fill("Python, SQL, JavaScript");
  await button(page, "Add your skill").click();
  await expect(
    page.getByRole("group", { name: "Suggested skills" }),
  ).toContainText("Python");
  await expect(button(page, "Next")).toBeEnabled();
  await button(page, "Next").click();
  await expect(
    page.getByRole("heading", { name: "Your career identity." }),
  ).toBeVisible();
  release();
  await expect(
    page.getByLabel("Career identity statement", { exact: true }),
  ).toContainText(/Python/);
  await expect(
    page.getByRole("button", { name: "Late suggestion", exact: true }),
  ).toHaveCount(0);
});
