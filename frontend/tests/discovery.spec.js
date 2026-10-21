import { test, expect } from "@playwright/test";
import {
  button,
  stubSkills,
  studentToSkills,
  studentToIdentity,
} from "./discovery-helpers";
const home = "http://127.0.0.1:5173";

test("student prompts stack, validate, preserve back navigation, and submit the edited identity", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await stubSkills(page);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(home);
  await button(page, "Start my discovery").click();
  await expect(button(page, "Next")).toBeDisabled();
  const role = page.getByLabel("Current or previous role", { exact: true });
  await role.fill("one two three four five six");
  await expect(button(page, "Next")).toBeDisabled();
  await role.fill("Student");
  await expect(role).toHaveCSS("border-top-width", "0px");
  await expect(role).toHaveCSS("outline-style", "none");
  await page.screenshot({
    path: "test-results/story-role.png",
    animations: "disabled",
  });
  await button(page, "Next").click();
  await expect(button(page, "Next")).toBeDisabled();
  await expect(page.locator(".answer-stack")).toContainText("Student");
  await page
    .getByLabel("Education level")
    .selectOption({ label: "Bachelor’s degree" });
  await button(page, "Next").click();
  await expect(button(page, "Next")).toBeDisabled();
  await page.getByLabel("Subject area").fill("Information Technology");
  await button(page, "Back").click();
  await expect(page.getByLabel("Education level")).toHaveValue(
    "Bachelor’s degree",
  );
  await button(page, "Next").click();
  await expect(page.getByLabel("Subject area")).toHaveValue(
    "Information Technology",
  );
  await page.screenshot({
    path: "test-results/story-subject.png",
    animations: "disabled",
  });
  await button(page, "Next").click();
  await button(page, "Software development").click();
  await button(page, "Database management").click();
  await expect(button(page, "Next")).toBeDisabled();
  await button(page, "Technical support").click();
  await page.screenshot({
    path: "test-results/story-skills.png",
    animations: "disabled",
  });
  await button(page, "Next").click();
  const statement = page.getByLabel("Career identity statement", {
    exact: true,
  });
  await expect(statement).toHaveValue(/Information Technology/);
  await statement.fill(
    "I study Information Technology and want to build accessible software using my database and support skills.",
  );
  let payload;
  await page.route("**/api/careers/recommend", (route) => {
    payload = route.request().postDataJSON();
    return route.fulfill({
      status: 503,
      json: { detail: "Please retry the career service." },
    });
  });
  await button(page, "Explore paths").click();
  await expect(page.getByRole("alert")).toContainText("Please retry");
  expect(payload.skills).toEqual([
    "Software development",
    "Database management",
    "Technical support",
  ]);
  expect(payload.education).toBe("Bachelor’s degree · Information Technology");
  expect(payload.experience).toBe("");
  expect(payload.identity_statement).toContain("accessible software");
  await page.unroute("**/api/careers/recommend");
  await page.route("**/api/careers/recommend", (route) =>
    route.fulfill({
      json: {
        results: [
          {
            id: "test",
            title: "Software developer",
            source: "ESCO",
            description: "Build software.",
          },
        ],
      },
    }),
  );
  await button(page, "Explore paths").click();
  await expect(page.locator(".career-node")).toHaveCount(1);
  await button(page, "Career identity tab").click();
  await expect(statement).toHaveValue(/accessible software/);
  await button(page, "Remove skill Technical support").click();
  await expect(button(page, "Explore paths")).toBeDisabled();
  await expect(button(page, "Explore paths").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("additional education and experience, skill regeneration, and full editor preserve all entries", async ({
  page,
}) => {
  await stubSkills(page);
  await page.goto(home);
  await studentToIdentity(page);
  await button(page, "Add education").click();
  await page
    .getByLabel("Education level")
    .selectOption({ label: "Professional certificate" });
  await button(page, "Next").click();
  await page.getByLabel("Subject area").fill("User experience design");
  await button(page, "Next").click();
  await expect(button(page, "Python")).toHaveAttribute("aria-pressed", "true");
  await expect(button(page, "Re-generate")).toBeEnabled();
  await button(page, "Re-generate").click();
  await expect(button(page, "Python")).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Add a skill", { exact: true }).fill("python, Design");
  await page.getByLabel("Add a skill", { exact: true }).press("Enter");
  await button(page, "Next").click();
  await expect(page.locator(".identity-ingredients")).toContainText(
    "User experience design",
  );
  await button(page, "Add experience").click();
  await page
    .getByLabel("Current or previous role", { exact: true })
    .fill("Volunteer");
  await button(page, "Next").click();
  await page
    .getByLabel("Role details")
    .fill("Helped neighbours learn digital skills");
  await button(page, "Next").click();
  await expect(button(page, "Re-generate")).toBeEnabled();
  await button(page, "Next").click();
  await expect(
    page.getByRole("heading", { name: "Your career identity." }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/story-identity.png",
    fullPage: true,
    animations: "disabled",
  });
  await expect(page.locator(".identity-ingredients")).toContainText(
    "Volunteer — Helped neighbours learn digital skills",
  );
  await button(page, "Use full profile editor").click();
  await expect(
    page.getByLabel("Education & courses", { exact: true }),
  ).toHaveValue(
    "Bachelor’s degree · Information Technology\nProfessional certificate · User experience design",
  );
  await expect(
    page.getByLabel("Experience & projects", { exact: true }),
  ).toHaveValue("Volunteer — Helped neighbours learn digital skills");
  await expect(page.getByLabel("Skills", { exact: true })).toHaveValue(
    "Python, SQL, JavaScript, Design",
  );
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await button(page, "Start my discovery").click();
  await expect(
    page.getByRole("heading", { name: "Your career identity." }),
  ).toBeVisible();
});

test("real mobile journey reaches careers, roadmap, cover letter download, and resume review", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(home);
  await page.getByRole("switch", { name: "Light theme" }).click();
  await studentToIdentity(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await button(page, "Explore paths").click();
  await expect(page.locator(".career-node")).toHaveCount(12, {
    timeout: 120000,
  });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.locator(".career-node").evaluateAll(async (nodes) => {
    await Promise.all(
      nodes.flatMap((node) =>
        node.getAnimations().map((animation) => animation.finished),
      ),
    );
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const bounds = await page.locator(".career-node").evaluateAll((nodes) =>
    nodes.map((node) => {
      const r = node.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    }),
  );
  for (let i = 0; i < bounds.length; i++) {
    expect(bounds[i].left).toBeGreaterThanOrEqual(0);
    expect(bounds[i].right).toBeLessThanOrEqual(1440);
    for (let j = i + 1; j < bounds.length; j++) {
      const a = bounds[i],
        b = bounds[j];
      expect(
        a.left < b.right &&
          a.right > b.left &&
          a.top < b.bottom &&
          a.bottom > b.top,
      ).toBe(false);
    }
  }
  await page.screenshot({
    path: "test-results/story-paths-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator(".career-node").first().click();
  await button(page, "Build my roadmap").click();
  await expect(page.getByRole("dialog").locator(".milestone")).toHaveCount(4);
  await expect(button(page, "Close career details")).toBeInViewport();
  await button(page, "Take the next step").click();
  await expect(
    page.getByRole("heading", { name: "Make your next move." }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Start a cover letter/ }).click();
  const letter = page.getByLabel("Cover letter draft", { exact: true });
  await expect(letter).toHaveValue(/Information Technology/);
  await letter.fill("My own edited cover letter.");
  await button(page, "Explore paths tab").click();
  await button(page, "Take action tab").click();
  await expect(letter).toHaveValue("My own edited cover letter.");
  const download = page.waitForEvent("download");
  await button(page, "Download text").click();
  expect((await download).suggestedFilename()).toBe(
    "careerbridge-cover-letter.txt",
  );
  await page.getByRole("button", { name: /Build your next steps/ }).click();
  await expect(
    page
      .getByRole("region", { name: "Learning roadmap" })
      .locator(".milestone"),
  ).toHaveCount(4);
  await page.screenshot({
    path: "test-results/story-actions-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: /Workshop your resume/ }).click();
  await expect(page.getByLabel("Upload your resume")).toBeAttached();
  await expect(
    page.getByRole("button", { name: /Upload a resume/ }),
  ).toHaveClass(/active/);
});

test("stale suggestions cannot replace skills after going back and changing subject", async ({
  page,
}) => {
  let first;
  const requests = [];
  await page.route("**/api/discovery/skills", (route) => {
    requests.push(route.request().postDataJSON());
    if (requests.length === 1) {
      first = route;
      return;
    }
    return route.fulfill({
      json: {
        skills: [{ name: "New subject skill", sources: ["ESCO"] }],
        next_offset: 0,
      },
    });
  });
  await page.goto(home);
  await button(page, "Start my discovery").click();
  await button(page, "Student").click();
  await button(page, "Next").click();
  await page
    .getByLabel("Education level")
    .selectOption({ label: "Bachelor’s degree" });
  await button(page, "Next").click();
  await page.getByLabel("Subject area").fill("Old subject");
  await button(page, "Next").click();
  await expect(
    page.getByRole("status").filter({ hasText: "Finding skills" }),
  ).toBeVisible();
  await button(page, "Back").click();
  await page.getByLabel("Subject area").fill("New subject");
  await button(page, "Next").click();
  await expect(button(page, "New subject skill")).toBeVisible();
  await first
    .fulfill({ json: { skills: [{ name: "Stale skill", sources: ["ESCO"] }] } })
    .catch(() => {});
  await expect(button(page, "Stale skill")).toHaveCount(0);
  expect(requests[1].education).toBe("Bachelor’s degree · New subject");
});

test("suggestion errors allow retry or manual skills, and unfinished input survives leaving the flow", async ({
  page,
}) => {
  await page.route("**/api/discovery/skills", (route) =>
    route.fulfill({ status: 503, json: { detail: "Unavailable" } }),
  );
  await page.goto(home);
  await button(page, "Start my discovery").click();
  await page
    .getByLabel("Current or previous role", { exact: true })
    .fill("Volunteer");
  await button(page, "Next").click();
  await page.getByLabel("Role details").fill("Teaching gardening to children");
  await button(page, "Use full profile editor").click();
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await button(page, "Start my discovery").click();
  await expect(page.getByLabel("Role details")).toHaveValue(
    "Teaching gardening to children",
  );
  await button(page, "Next").click();
  await expect(page.getByRole("alert")).toContainText(
    "couldn’t load suggestions",
  );
  await expect(button(page, "Retry suggestions")).toBeEnabled();
  await page
    .getByLabel("Add a skill", { exact: true })
    .fill("Teaching, Gardening, Communication");
  await button(page, "Next").click();
  await expect(
    page.getByLabel("Career identity statement", { exact: true }),
  ).toHaveValue(/Teaching, Gardening, Communication/);
  await expect(button(page, "Explore paths")).toBeEnabled();
});
