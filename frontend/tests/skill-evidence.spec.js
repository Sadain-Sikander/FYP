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

test("real semantic evidence can be confirmed, persisted, reconsidered and sent to the roadmap", async ({
  page,
}) => {
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/api/skill-gap") && r.ok(),
  );
  await start(page);
  const gap = await (await response).json();
  expect(gap.engine).toBe("hybrid");
  const candidate = gap.suggested_matches.find(
    (s) => s.method === "semantic" && s.evidence.source === "experience",
  );
  expect(candidate).toBeTruthy();
  const name = candidate.name;
  const evidence = page.getByRole("article", {
    name: `Evidence for ${name}`,
    exact: true,
  });
  await expect(evidence).toContainText(quote);
  await expect(
    page.getByRole("dialog").locator(".opportunities"),
  ).toContainText(name);
  await page.screenshot({
    path: "test-results/skill-evidence-dark.png",
    fullPage: true,
  });
  await button(page, `Confirm ${name}`).click();
  await expect(evidence).toHaveCount(0);
  await expect(
    page.getByRole("dialog").locator(".career-skill-story").first(),
  ).toContainText(name);
  const roadmapRequest = page.waitForRequest((r) =>
    r.url().endsWith("/api/roadmap"),
  );
  await button(page, "Build my roadmap").click();
  expect((await roadmapRequest).postDataJSON().confirmed_skills).toContain(
    name,
  );
  await expect(page.getByRole("dialog").locator(".milestone")).toHaveCount(4);
  await page.reload();
  await page.locator(".career-node").first().click();
  await page.getByText(/Review your answers/).click();
  await button(page, `Reconsider ${name}`).click();
  await expect(evidence).toBeVisible();
  await button(page, `Not yet: ${name}`).click();
  await expect(evidence).toHaveCount(0);
  await expect(
    page.getByRole("dialog").locator(".opportunities"),
  ).toContainText(name);
  await button(page, "Close career details").click();
  await page.getByRole("switch", { name: "Light theme" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".career-node").first().click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("heading", { name: "Connections in your story" }),
  ).toBeVisible();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((d) => d.scrollWidth <= d.clientWidth + 1),
  ).toBe(true);
  await page
    .getByRole("dialog")
    .screenshot({ path: "test-results/skill-evidence-mobile-light.png" });
});

test("failed confirmation preserves the suggestion for retry and profile edits clear reviews", async ({
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
  await button(page, "Confirm Writing").click();
  await expect(page.getByRole("alert")).toContainText("Please retry");
  await expect(button(page, "Confirm Writing")).toBeEnabled();
  await button(page, "Confirm Writing").click();
  await expect(button(page, "Confirm Writing")).toHaveCount(0);
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
  await expect(button(page, "Confirm Writing")).toBeVisible();
  expect(payloads.at(-1).confirmed_skills).toEqual([]);
  expect(payloads.at(-1).experience).toBe("An entirely different experience.");
});
