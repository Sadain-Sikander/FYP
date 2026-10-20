import { test, expect } from "@playwright/test";
import path from "node:path";

const fixtures = path.resolve("tests/fixtures");

test("home, manual recommendations, roadmap, automatic resume fill and ATS review", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("http://127.0.0.1:5173");
  await expect(
    page.getByRole("heading", { name: /You’re more than/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Tell your story" }).click();
  await page.getByRole("button", { name: "Use full profile editor" }).click();
  const skills = page.getByLabel("Skills", { exact: true });
  const experience = page.getByLabel("Experience & projects", { exact: true });
  const recommend = page.getByRole("button", {
    name: "Explore my careers",
    exact: true,
  });
  await page.getByLabel("Education & courses").fill("BS Computer Science");
  await experience.fill("My original web project.");
  await skills.fill("Python, SQL, Figma");
  await recommend.click();
  await expect(page.locator(".career-card")).toHaveCount(6, {
    timeout: 120000,
  });
  await page.getByRole("button", { name: "Explore this path" }).first().click();
  await page.getByRole("button", { name: "Build my roadmap" }).click();
  await expect(page.locator(".milestone")).toHaveCount(4);
  await page.getByRole("button", { name: /Upload a resume/ }).click();
  await page
    .getByLabel("Upload your resume")
    .setInputFiles(path.join(fixtures, "resume.docx"));
  await expect(page.getByText("Profile filled", { exact: true })).toBeVisible();
  await expect(experience).toHaveValue(/My original web project/);
  await expect(experience).toHaveValue(/reporting application/);
  await expect(skills).toHaveValue(/Figma/);
  await expect(skills).toHaveValue(/JavaScript/);
  await expect(page.locator("#matches")).toHaveCount(0);
  await expect(recommend).toBeDisabled();
  await expect(page.locator(".score-ring")).toBeVisible();
  await expect(
    page.getByText("ATS readiness estimate", { exact: true }),
  ).toBeVisible();
  const job = page.getByLabel("Target job description", { exact: false });
  await job.fill(
    "We need Python, SQL, Docker and Java for our engineering team.",
  );
  await expect(page.locator(".score-ring")).toHaveCount(0); // Never show stale job scores.
  await page.getByRole("button", { name: "Compare with this job" }).click();
  await expect(
    page.getByText("ATS estimate · job tailored", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".keyword-review")).toContainText("Docker");
  await page
    .locator("#resume-review")
    .screenshot({ path: "test-results/resume-review.png" });
  const reviewed = page.getByRole("checkbox", { name: /I've reviewed/ });
  await reviewed.check();
  await recommend.click();
  await expect(page.locator(".career-card")).toHaveCount(6, {
    timeout: 120000,
  });
  await skills.fill("Python, SQL, Docker");
  await expect(reviewed).not.toBeChecked();
  await expect(page.locator(".career-card")).toHaveCount(0);
  await page
    .getByLabel("Upload your resume")
    .setInputFiles(path.join(fixtures, "blank.pdf"));
  await expect(
    page.getByRole("alert").filter({ hasText: "No usable resume text" }),
  ).toBeVisible();
  await expect(skills).toHaveValue("Python, SQL, Docker");
  await page
    .getByLabel("Upload your resume")
    .setInputFiles(path.join(fixtures, "resume.pdf"));
  await expect(page.getByText("Profile filled", { exact: true })).toBeVisible();
  await expect(page.locator(".score-ring")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/workspace-mobile.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Home", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/home-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  // No credentials: truthful setup state; guest exploration remains available.
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeDisabled();
  await page.screenshot({
    path: "test-results/login-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "test-results/login-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("changing the job description cancels a pending review", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:5173");
  await page.getByRole("button", { name: "Start with your resume" }).click();
  await page
    .getByLabel("Upload your resume")
    .setInputFiles(path.join(fixtures, "resume.docx"));
  await expect(page.locator(".score-ring")).toBeVisible();
  let release;
  const hold = new Promise((resolve) => {
    release = resolve;
  });
  let arrived;
  const started = new Promise((resolve) => {
    arrived = resolve;
  });
  await page.route("**/api/resume/review", async (route) => {
    const response = await route.fetch();
    arrived();
    await hold;
    await route.fulfill({ response }).catch(() => {});
  });
  await page
    .getByLabel("Target job description", { exact: false })
    .fill("We need Python and SQL for a reporting role.");
  await page.getByRole("button", { name: "Compare with this job" }).click();
  await started;
  await page
    .getByLabel("Target job description", { exact: false })
    .fill("We need Java and Docker for a platform role.");
  release();
  await expect(page.locator(".score-ring")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Compare with this job" }),
  ).toBeEnabled();
});

test("reduced motion disables decorative animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("http://127.0.0.1:5173");
  await expect(page.locator(".flower-petals").first()).toHaveCSS(
    "animation-name",
    "none",
  );
});
