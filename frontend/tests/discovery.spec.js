import { test, expect } from "@playwright/test";

const home = "http://127.0.0.1:5173";

test("guided story preserves edits, toggles suggestions, and submits the reviewed profile", async ({
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
  await page.getByRole("button", { name: "Start my discovery" }).click();
  await page
    .getByLabel("Experience & projects", { exact: true })
    .fill("Built a community garden with volunteers.");
  await page.getByText("Add a little more context", { exact: false }).click();
  await page
    .getByLabel("Education & courses", { exact: true })
    .fill("Environmental science");
  await page.screenshot({
    path: "test-results/discovery-story-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /What are you/ }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Research", exact: true }).click();
  await page.getByRole("button", { name: "Teamwork", exact: true }).click();
  await page.getByRole("button", { name: "Research", exact: true }).click();
  await expect(page.getByLabel("Skills", { exact: true })).toHaveValue(
    "Teamwork",
  );
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByLabel("Experience & projects", { exact: true }),
  ).toHaveValue("Built a community garden with volunteers.");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Helping people", exact: true })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByLabel("Career goals", { exact: true })
    .fill("Work on sustainable communities");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.locator(".discovery-review")).toContainText(
    "Environmental science",
  );
  await page
    .getByRole("button", { name: "Edit your strengths", exact: true })
    .click();
  await page.getByText("Add a little more context", { exact: false }).click();
  await page
    .getByLabel("Your strengths", { exact: true })
    .fill("Explaining practical ideas");
  await page.getByRole("button", { name: "05 Discover" }).click();
  let payload;
  await page.route("**/api/careers/recommend", async (route) => {
    payload = route.request().postDataJSON();
    await route.fulfill({
      status: 503,
      json: { detail: "Career service temporarily unavailable. Please retry." },
    });
  });
  await page
    .getByRole("button", { name: "Explore my careers", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  expect(payload.skills).toEqual(["Teamwork"]);
  expect(payload.strengths).toBe("Explaining practical ideas");
  expect(payload.interests).toBe("Helping people");
  await page.unroute("**/api/careers/recommend");
  // Simulated response checks UI handoff; real model validation is a separate smoke test.
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
  await page
    .getByRole("button", { name: "Explore my careers", exact: true })
    .click();
  await expect(page.locator(".career-card")).toHaveCount(1);
  await expect(page.locator(".discovery-shell")).toHaveCount(0);
  await expect(page.getByLabel("Skills", { exact: true })).toHaveValue(
    "Teamwork",
  );
  expect(errors).toEqual([]);
});

test("empty profile cannot submit and answers survive switching to the full editor", async ({
  page,
}) => {
  await page.goto(home);
  await page.getByRole("button", { name: "Start my discovery" }).click();
  await page.getByRole("button", { name: "05 Discover" }).click();
  await expect(
    page.getByRole("button", { name: "Explore my careers", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Edit your story", exact: true })
    .click();
  await page.getByText("Add a little more context", { exact: false }).click();
  await page
    .getByLabel("Education & courses", { exact: true })
    .fill("Self-taught web development");
  await page.getByRole("button", { name: "Use full profile editor" }).click();
  await expect(
    page.getByLabel("Education & courses", { exact: true }),
  ).toHaveValue("Self-taught web development");
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page.getByRole("button", { name: "Start my discovery" }).click();
  await expect(
    page.getByRole("heading", { name: /What have you/ }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Education & courses", { exact: true }),
  ).toHaveValue("Self-taught web development");
});

test("mobile chapters fit the screen and respect reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(home);
  await expect(page.locator(".neural-core > svg").first()).toHaveCSS(
    "animation-name",
    "none",
  );
  await page.screenshot({
    path: "test-results/discovery-home-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  const canvasIsStill = await page
    .locator(".neural-canvas")
    .evaluate(async (canvas) => {
      const before = canvas.toDataURL();
      for (let i = 0; i < 6; i++) await new Promise(requestAnimationFrame);
      return before === canvas.toDataURL();
    });
  expect(canvasIsStill).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Start my discovery" }).click();
  for (let i = 0; i < 5; i++) {
    await expect(page.locator(".discovery-chapter")).toHaveCSS(
      "animation-name",
      "none",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (i === 1) {
      await page
        .getByRole("button", { name: "Communication", exact: true })
        .click();
      await page.screenshot({
        path: "test-results/discovery-strengths-mobile.png",
        fullPage: true,
      });
    }
    if (i < 4)
      await page.getByRole("button", { name: "Continue", exact: true }).click();
  }
  await expect(
    page.getByRole("button", { name: "Explore my careers", exact: true }),
  ).toBeEnabled();
});

test("hero preview changes directions and guided discovery returns real careers", async ({
  page,
}) => {
  await page.goto(home);
  await page.getByRole("button", { name: "Design", exact: true }).click();
  await expect(page.locator(".preview-results")).toContainText("UX designer");
  await expect(page.locator(".preview-results")).not.toContainText(
    "Software developer",
  );
  await page.getByRole("button", { name: "People", exact: true }).click();
  await expect(page.locator(".preview-results")).toContainText(
    "Community manager",
  );
  await page.getByRole("button", { name: "Start my discovery" }).click();
  await page
    .getByLabel("Experience & projects", { exact: true })
    .fill("Built web applications with Python and JavaScript");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByLabel("Skills", { exact: true })
    .fill("Python, SQL, JavaScript");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Building technology", exact: true })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Find my first role", exact: true })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Explore my careers", exact: true })
    .click();
  await expect(page.locator(".career-card")).toHaveCount(6, {
    timeout: 120000,
  });
  await page.getByRole("button", { name: "Explore this path" }).first().click();
  await page.getByRole("button", { name: "Build my roadmap" }).click();
  await expect(page.locator(".milestone")).toHaveCount(4);
});
