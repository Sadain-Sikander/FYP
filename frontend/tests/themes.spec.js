import { test, expect } from "@playwright/test";
import { studentToIdentity } from "./discovery-helpers";

const home = "http://127.0.0.1:5173";
const toggle = (page) => page.getByRole("switch", { name: "Light theme" });
const button = (page, name) => page.getByRole("button", { name, exact: true });

test("theme switch supports keyboard use, preserves answers, and persists across pages and reloads", async ({
  page,
}) => {
  await page.goto(home);
  await expect(toggle(page)).not.toBeChecked();
  await toggle(page).focus();
  await page.keyboard.press("Space");
  await expect(toggle(page)).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator(".loom-home")).toHaveCSS(
    "background-color",
    "rgb(245, 246, 238)",
  );
  await page.screenshot({
    path: "test-results/theme-light-home.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.reload();
  await expect(toggle(page)).toBeChecked();
  await button(page, "Start my discovery").click();
  const story = page.getByLabel("Current or previous role", { exact: true });
  await story.fill("Web developer");
  await toggle(page).click();
  await expect(story).toHaveValue("Web developer");
  await expect(story).toHaveCSS("border-top-width", "0px");
  await button(page, "Use full profile editor").click();
  await expect(toggle(page)).not.toBeChecked();
  await toggle(page).click();
  await expect(page.locator(".app-shell")).toHaveCSS(
    "background-color",
    "rgb(245, 246, 238)",
  );
  await page
    .getByRole("link", { name: /Sign in to save your progress/ })
    .click();
  await expect(toggle(page)).toBeChecked();
  await expect(page.locator(".auth-page")).toHaveCSS(
    "background-color",
    "rgb(245, 246, 238)",
  );
  await toggle(page).click();
  await expect(page.locator(".auth-page")).toHaveCSS(
    "background-color",
    "rgb(22, 24, 19)",
  );
  await page.reload();
  await expect(toggle(page)).not.toBeChecked();
});

test("light theme covers mobile choices, real results, and the roadmap dialog", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(home);
  await toggle(page).click();
  await studentToIdentity(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/theme-light-mobile.png",
    fullPage: true,
  });
  await button(page, "Explore paths").click();
  await expect(page.locator(".career-node")).toHaveCount(12, {
    timeout: 120000,
  });
  await page.locator(".career-node").first().click();
  await expect(page.getByRole("dialog")).toHaveCSS(
    "background-color",
    "rgb(254, 255, 249)",
  );
  await button(page, "Build my roadmap").click();
  await expect(page.getByRole("dialog").locator(".milestone")).toHaveCount(4);
  await expect(button(page, "Close career details")).toBeInViewport();
  await page.screenshot({ path: "test-results/theme-light-roadmap.png" });
  await page.keyboard.press("Escape");
  await toggle(page).click();
  await expect(page.locator(".career-node")).toHaveCount(12);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("theme switching still works without storage and repaints a paused background", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException("Storage blocked", "SecurityError");
    };
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage blocked", "SecurityError");
    };
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(home);
  await button(page, "Pause background motion").click();
  const canvas = page.locator(".loom-home .ambient-canvas");
  const dark = await canvas.evaluate((el) => el.toDataURL());
  await toggle(page).click();
  await expect(toggle(page)).toBeChecked();
  expect(await canvas.evaluate((el) => el.toDataURL())).not.toBe(dark);
  expect(
    await canvas.evaluate(async (el) => {
      const frame = el.toDataURL();
      for (let i = 0; i < 6; i++) await new Promise(requestAnimationFrame);
      return frame === el.toDataURL();
    }),
  ).toBe(true);
  expect(errors).toEqual([]);
});
