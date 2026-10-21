import { test, expect } from "@playwright/test";
const home = "http://127.0.0.1:5173";
const button = (page, name) => page.getByRole("button", { name, exact: true });
async function next(page) {
  await button(page, "Continue").click();
}

test("borderless story, word selection, editing, and error recovery preserve the reviewed profile", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(home);
  await page.screenshot({
    path: "test-results/discovery-home-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await button(page, "Start my discovery").click();
  const story = page.getByLabel("Experience & projects", { exact: true });
  await story.fill("Built a community garden with volunteers.");
  await expect(story).toHaveCSS("border-top-width", "0px");
  await expect(story).toHaveCSS("outline-style", "none");
  await expect(story).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await page.screenshot({
    path: "test-results/discovery-story-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await button(page, "Add education & courses").click();
  await page
    .getByLabel("Education & courses", { exact: true })
    .fill("Environmental science");
  await button(page, "Save this thought").click();
  await next(page);
  await expect(
    page.getByRole("heading", { name: "You have a way with…" }),
  ).toBeFocused();
  await button(page, "Research").click();
  await button(page, "Teamwork").click();
  await button(page, "Research").click();
  await expect(button(page, "Research")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(button(page, "Teamwork")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await button(page, "Add your own").click();
  await page
    .getByLabel("Add a skill", { exact: true })
    .fill("Gardening, teamwork");
  await page.getByLabel("Add a skill", { exact: true }).press("Enter");
  await expect(button(page, "Gardening")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await button(page, "Back").click();
  await expect(story).toHaveValue("Built a community garden with volunteers.");
  await next(page);
  await next(page);
  await button(page, "Helping people").click();
  await next(page);
  await button(page, "Work on meaningful projects").click();
  await next(page);
  await expect(page.locator(".narrative-review")).toContainText(
    "Environmental science",
  );
  await button(page, "Edit your strengths").click();
  await button(page, "Add your strengths").click();
  await page
    .getByLabel("Your strengths", { exact: true })
    .fill("Explaining practical ideas");
  await button(page, "Save this thought").click();
  await button(page, "05 Your possibilities").click();
  let payload;
  await page.route("**/api/careers/recommend", async (route) => {
    payload = route.request().postDataJSON();
    await route.fulfill({
      status: 503,
      json: { detail: "Career service temporarily unavailable. Please retry." },
    });
  });
  await button(page, "Explore my careers").click();
  await expect(page.getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  expect(payload.skills).toEqual(["Teamwork", "Gardening"]);
  expect(payload.strengths).toBe("Explaining practical ideas");
  expect(payload.interests).toBe("Helping people");
  await page.unroute("**/api/careers/recommend");
  await page.route("**/api/careers/recommend", (route) =>
    route.fulfill({
      json: {
        results: [
          {
            id: "test-planner",
            title: "Community Planner",
            source: "TEST",
            description: "Plan community projects.",
            semantic_similarity: 0.6,
          },
        ],
      },
    }),
  );
  await button(page, "Explore my careers").click();
  await expect(page.locator(".career-node")).toHaveCount(1);
  await button(page, "Back to my story").click();
  await expect(page.locator(".narrative-review")).toContainText("Gardening");
  await button(page, "Use full profile editor").click();
  await expect(page.getByLabel("Skills", { exact: true })).toHaveValue(
    "Teamwork, Gardening",
  );
  expect(errors).toEqual([]);
});

test("empty profiles cannot submit and optional context survives editor changes", async ({
  page,
}) => {
  await page.goto(home);
  await button(page, "Start my discovery").click();
  await button(page, "05 Your possibilities").click();
  await expect(button(page, "Explore my careers")).toBeDisabled();
  await button(page, "Edit your story").click();
  await button(page, "Add education & courses").click();
  await page
    .getByLabel("Education & courses", { exact: true })
    .fill("Self-taught web development");
  await button(page, "Save this thought").click();
  await button(page, "Use full profile editor").click();
  await expect(
    page.getByLabel("Education & courses", { exact: true }),
  ).toHaveValue("Self-taught web development");
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await button(page, "Start my discovery").click();
  await button(page, "Add education & courses").click();
  await expect(
    page.getByLabel("Education & courses", { exact: true }),
  ).toHaveValue("Self-taught web development");
});

test("mobile scenes fit the screen and reduced motion freezes the background", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(home);
  await page.screenshot({
    path: "test-results/discovery-home-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  const still = await page
    .locator(".loom-home .ambient-canvas")
    .evaluate(async (canvas) => {
      const before = canvas.toDataURL();
      for (let i = 0; i < 6; i++) await new Promise(requestAnimationFrame);
      return before === canvas.toDataURL();
    });
  expect(still).toBe(true);
  await button(page, "Start my discovery").click();
  for (let i = 0; i < 5; i++) {
    await expect(page.locator(".conversation-scene")).toHaveCSS(
      "animation-name",
      "none",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (i === 1) {
      await button(page, "Communication").click();
      await page.screenshot({
        path: "test-results/discovery-strengths-mobile.png",
        fullPage: true,
      });
    }
    if (i < 4) await next(page);
  }
  await expect(button(page, "Explore my careers")).toBeEnabled();
});

test("custom words commit on continue and the constellation opens a real roadmap", async ({
  page,
}) => {
  await page.goto(home);
  await button(page, "Start my discovery").click();
  await page
    .getByLabel("Experience & projects", { exact: true })
    .fill("Built web applications with Python and JavaScript");
  await next(page);
  await button(page, "Python").click();
  await button(page, "Add your own").click();
  await page.getByLabel("Add a skill", { exact: true }).fill("SQL, JavaScript");
  await next(page);
  await button(page, "Building technology").click();
  await next(page);
  await button(page, "Find my first role").click();
  await next(page);
  await expect(page.locator(".narrative-review")).toContainText(
    "Python, SQL, JavaScript",
  );
  await button(page, "Explore my careers").click();
  await expect(page.locator(".career-node")).toHaveCount(6, {
    timeout: 120000,
  });
  await page.screenshot({
    path: "test-results/career-constellation.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/discovery-results-mobile.png",
    fullPage: true,
  });
  await page.locator(".career-node").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await button(page, "Build my roadmap").click();
  await expect(page.getByRole("dialog").locator(".milestone")).toHaveCount(4);
  await expect(
    page.getByRole("dialog").locator(".milestone h3").first(),
  ).not.toBeEmpty();
  await expect(
    page.getByRole("dialog").getByRole("heading", { level: 2 }),
  ).toBeFocused();
  await expect(button(page, "Close career details")).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.locator(".career-node").nth(1).click();
  await expect(button(page, "Build my roadmap")).toBeVisible();
  await button(page, "Close career details").click();
  await button(page, "Back to my story").click();
  await expect(page.locator(".narrative-review")).toContainText(
    "Python, SQL, JavaScript",
  );
  await button(page, "Explore my careers").click();
  await page.locator(".career-node").first().click();
  await button(page, "Sign in to save").click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
});

test("background animation can be paused without changing the flow", async ({
  page,
}) => {
  await page.goto(home);
  await button(page, "Pause background motion").click();
  await expect(button(page, "Resume background motion")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(
    await page
      .locator(".loom-home .ambient-canvas")
      .evaluate(async (canvas) => {
        const before = canvas.toDataURL();
        for (let i = 0; i < 6; i++) await new Promise(requestAnimationFrame);
        return before === canvas.toDataURL();
      }),
  ).toBe(true);
  await button(page, "Resume background motion").click();
  expect(
    await page
      .locator(".loom-home .ambient-canvas")
      .evaluate(async (canvas) => {
        const before = canvas.toDataURL();
        for (let i = 0; i < 8; i++) await new Promise(requestAnimationFrame);
        return before !== canvas.toDataURL();
      }),
  ).toBe(true);
});
