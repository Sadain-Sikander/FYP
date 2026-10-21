import { test, expect } from "@playwright/test";
import path from "node:path";
const fixture = (file) => path.resolve("tests/fixtures", file);
const button = (page, name) => page.getByRole("button", { name, exact: true });

test("resume entry stays in discovery through upload, editing, review and identity in both themes", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("http://127.0.0.1:5173");
  await button(page, "Start with your resume").click();
  await expect(page.locator(".resume-studio")).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveCount(0);
  await page.screenshot({
    path: "test-results/resume-studio-dark.png",
    fullPage: true,
  });
  await page.getByRole("switch", { name: "Light theme" }).click();
  await page.screenshot({
    path: "test-results/resume-studio-light.png",
    fullPage: true,
  });
  const file = page.getByLabel("Upload your resume");
  await file.setInputFiles({
    name: "invalid.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a resume"),
  });
  await expect(page.getByRole("alert")).toContainText("Choose a PDF or DOCX");
  await file.setInputFiles(fixture("resume.docx"));
  await expect(page.locator(".score-ring")).toBeVisible();
  await expect(page.getByLabel("Skills", { exact: true })).toHaveValue(
    /JavaScript/,
  );
  const proceed = button(page, "Continue to my identity");
  const reviewed = page.getByRole("checkbox", { name: /I’ve reviewed/ });
  await expect(proceed).toBeDisabled();
  await reviewed.check();
  await page
    .getByLabel("Experience & projects", { exact: true })
    .fill("My own reporting application and volunteer work.");
  await expect(reviewed).not.toBeChecked();
  await expect(proceed).toBeDisabled();
  await page
    .getByLabel("Target job description", { exact: false })
    .fill("We need Python, SQL, Docker and Java for our engineering team.");
  await button(page, "Compare with this job").click();
  await expect(page.locator(".keyword-review")).toContainText("Docker");
  await page.screenshot({
    path: "test-results/resume-studio-review-light.png",
    fullPage: true,
  });
  await page.getByRole("switch", { name: "Light theme" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/resume-studio-review-mobile.png",
    fullPage: true,
  });
  await reviewed.check();
  await proceed.click();
  await expect(page.getByLabel("Career identity statement")).toHaveValue(
    /volunteer work/,
  );
  await expect(button(page, "Explore paths")).toBeEnabled();
  await page.getByRole("button", { name: "Take action tab" }).click();
  await page.getByRole("button", { name: /Workshop your resume/ }).click();
  await expect(
    page.getByLabel("Experience & projects", { exact: true }),
  ).toHaveValue(/volunteer work/);
  await file.setInputFiles(fixture("blank.pdf"));
  await expect(page.getByRole("alert")).toContainText("No usable resume text");
  await file.setInputFiles(fixture("resume.pdf"));
  await expect(page.locator(".score-ring")).toBeVisible();
  await expect(
    page.getByLabel("Experience & projects", { exact: true }),
  ).toHaveValue(/volunteer work/);
  await expect(reviewed).not.toBeChecked();
  await button(page, "Clear uploaded resume").click();
  await expect(button(page, "Choose your resume")).toBeVisible();
  await button(page, "Back to take action").click();
  await page.getByRole("button", { name: "Career identity tab" }).click();
  await expect(page.getByLabel("Career identity statement")).toHaveValue(
    /volunteer work/,
  );
  await page.getByRole("button", { name: "Take action tab" }).click();
  await page.getByRole("button", { name: /Workshop your resume/ }).click();
  await button(page, "Cancel discovery").click();
  await button(page, "Start my discovery").click();
  await expect(page.getByLabel("Career identity statement")).toHaveValue(
    /volunteer work/,
  );
  await expect(page.locator(".resume-studio")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("cancelled resume upload cannot overwrite the story when it finishes", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  let release, arrived;
  const hold = new Promise((resolve) => {
    release = resolve;
  });
  const started = new Promise((resolve) => {
    arrived = resolve;
  });
  await page.route("**/api/resume/extract", async (route) => {
    const response = await route.fetch();
    arrived();
    await hold;
    await route.fulfill({ response }).catch(() => {});
  });
  await page.goto("http://127.0.0.1:5173");
  await button(page, "Start with your resume").click();
  await page
    .getByLabel("Upload your resume")
    .setInputFiles(fixture("resume.pdf"));
  await started;
  await button(page, "Cancel upload").click();
  release();
  await button(page, "I’ll tell my story instead").click();
  await expect(page.getByLabel("Current or previous role")).toHaveValue("");
  await expect(page.locator(".app-shell")).toHaveCount(0);
});
