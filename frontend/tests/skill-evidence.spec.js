import { test, expect } from "@playwright/test";
import { button, stubSkills, studentToIdentity } from "./discovery-helpers";
const quote =
  "I wrote clear reports, instructions and technical documents for readers.";
const career = {
  id: "27-3042.00",
  title: "Technical Writers",
  source: "O*NET",
  semantic_similarity: 0.8,
  description: "Write technical instructions and documentation.",
};

async function start(page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await stubSkills(page);
  await page.route("**/api/careers/recommend", (route) =>
    route.fulfill({ json: { results: [career] } }),
  );
  await page.goto("http://127.0.0.1:5173");
  await studentToIdentity(page);
  await button(page, "Use full profile editor").click();
  await page.getByLabel("Experience & projects", { exact: true }).fill(quote);
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await button(page, "Start my discovery").click();
  await button(page, "Explore paths").click();
  await page.locator(".career-node").first().click();
}

test("missing skills can be selected for learning or corrected, with choices surviving refresh", async ({
  page,
}) => {
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/api/skill-gap") && r.ok(),
  );
  await start(page);
  const gap = await (await response).json();
  const name = gap.skill_gaps[0].name;
  const other = gap.skill_gaps[1].name;
  const missing = page.getByRole("region", { name: "Missing skills" });
  await expect(missing).toContainText("Not found in your profile");
  await expect(page.getByText("Connections in your story")).toHaveCount(0);
  await page
    .getByRole("checkbox", {
      name: `Include ${other} in learning plan`,
      exact: true,
    })
    .uncheck();
  await button(page, `I already have ${name}`).click();
  await expect(
    page.getByRole("dialog").locator(".career-skill-story").first(),
  ).toContainText(name);
  await expect(button(page, `I already have ${name}`)).toHaveCount(0);
  const sent = page.waitForRequest((r) => r.url().endsWith("/api/roadmap"));
  await button(page, "Build my roadmap").click();
  const payload = (await sent).postDataJSON();
  expect(payload.confirmed_skills).toContain(name);
  expect(payload.learning_skills).not.toContain(other);
  expect(payload.learning_skills).not.toContain(name);
  await expect(page.getByRole("dialog").locator(".milestone")).toHaveCount(4);
  await page.reload();
  await page.locator(".career-node").first().click();
  await expect(
    page.getByRole("checkbox", {
      name: `Include ${other} in learning plan`,
      exact: true,
    }),
  ).not.toBeChecked();
  await page.getByText(/Skills you added/).click();
  await button(page, `Move ${name} back to missing skills`).click();
  await expect(button(page, `I already have ${name}`)).toBeVisible();
  await button(page, "Close career details").click();
  await page.getByRole("switch", { name: "Light theme" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".career-node").first().click();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((d) => d.scrollWidth <= d.clientWidth + 1),
  ).toBe(true);
  await page
    .getByRole("dialog")
    .screenshot({ path: "test-results/missing-skills-mobile-light.png" });
});

test("failed skill correction preserves the missing skill for retry and profile edits clear choices", async ({
  page,
}) => {
  let fail = false;
  const payloads = [];
  await page.route("**/api/skill-gap", async (route) => {
    const p = route.request().postDataJSON();
    payloads.push(p);
    if (fail) {
      fail = false;
      return route.fulfill({
        status: 503,
        json: { detail: "Please retry this skill review." },
      });
    }
    const confirmed = p.confirmed_skills?.includes("Writing");
    const skill = {
      name: "Writing",
      status: confirmed ? "matched" : "needs_confirmation",
      method: confirmed ? "user_confirmed" : "semantic",
      evidence: { text: quote, source: "experience" },
    };
    return route.fulfill({
      json: {
        career,
        essential_skills: [skill],
        matched_skills: confirmed ? [skill] : [],
        skill_gaps: confirmed ? [] : [skill],
        suggested_matches: confirmed ? [] : [skill],
        note: "Confirm related evidence.",
        engine: "hybrid",
      },
    });
  });
  await start(page);
  fail = true;
  await button(page, "I already have Writing").click();
  await expect(page.getByRole("alert")).toContainText("Please retry");
  await expect(button(page, "I already have Writing")).toBeEnabled();
  await button(page, "I already have Writing").click();
  await expect(button(page, "I already have Writing")).toHaveCount(0);
  await button(page, "Close career details").click();
  await button(page, "Career identity tab").click();
  await button(page, "Use full profile editor").click();
  await page
    .getByLabel("Experience & projects", { exact: true })
    .fill("An entirely different experience.");
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await button(page, "Start my discovery").click();
  await button(page, "Explore paths").click();
  await page.locator(".career-node").first().click();
  await expect(button(page, "I already have Writing")).toBeVisible();
  expect(payloads.at(-1).confirmed_skills).toEqual([]);
  expect(payloads.at(-1).experience).toBe("An entirely different experience.");
});
