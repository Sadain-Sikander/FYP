import { test, expect } from "@playwright/test";
import { button, stubSkills, studentToIdentity } from "./discovery-helpers";

const career = {
  id: "15-2051.00",
  title: "Data Scientists",
  source: "O*NET",
  description: "Analyse data and communicate findings.",
  semantic_similarity: 0.9,
};
const plan = {
  career,
  duration_weeks: 4,
  generation: "personalized",
  lesson_status: "available",
  summary: "Practise data analysis through small, testable projects.",
  priority_skill_gaps: [{ name: "Statistics" }],
  note: "AI-generated learning draft. Review the tasks and pace for your situation.",
  milestones: Array.from({ length: 4 }, (_, i) => ({
    week: i + 1,
    learning_stage: [
      "Foundations",
      "Guided practice",
      "Applied practice",
      "Independent project & review",
    ][i],
    builds_on_week: i || null,
    lesson_topic: [
      "Basic statistics concepts",
      "Worked statistics examples",
      "Data analysis exercises",
      "Statistical analysis project",
    ][i],
    title: `Build evidence, week ${i + 1}`,
    skills: ["Statistics"],
    tasks: ["Compare two datasets.", "Explain the result in plain language."],
    project: "Deliver a notebook with reproducible calculations.",
    lessons: [
      {
        id: `abc123DEF4${i + 5}`,
        title: "Statistics practice lesson",
        channel: "Example instructor",
      },
    ],
  })),
};

async function openRoadmap(page, response) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await stubSkills(page);
  await page.route("**/api/careers/recommend", (route) =>
    route.fulfill({ json: { results: [career] } }),
  );
  await page.route("**/api/roadmap", (route) =>
    route.fulfill({ json: response }),
  );
  await page.goto("http://127.0.0.1:5173");
  await studentToIdentity(page);
  await button(page, "Explore paths").click();
  await page.locator(".career-node").first().click();
  await button(page, "Build my roadmap").click();
  await expect(page.getByRole("dialog").locator(".milestone")).toHaveCount(4);
}

test("personalized lessons play on demand and survive refresh across roadmap views and themes", async ({
  page,
}) => {
  let embeds = 0;
  await page.route("https://www.youtube-nocookie.com/**", (route) => {
    embeds++;
    return route.fulfill({
      contentType: "text/html",
      body: "<p>Test video player</p>",
    });
  });
  await openRoadmap(page, plan);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Your personalized learning plan");
  await expect(dialog).toContainText("Deliver a notebook");
  await expect(
    dialog.getByRole("list", { name: "Learning progression" }).locator("li"),
  ).toHaveText([
    "1Foundations",
    "2Guided practice",
    "3Applied practice",
    "4Independent project & review",
  ]);
  await expect(dialog).toContainText("Continue from week 03");
  expect(embeds).toBe(0);
  await button(dialog, "Watch lesson").first().click();
  await expect(dialog.locator("iframe")).toHaveAttribute(
    "src",
    "https://www.youtube-nocookie.com/embed/abc123DEF45",
  );
  await expect.poll(() => embeds).toBe(1);
  await button(dialog, "Close video").click();
  await expect(dialog.locator("iframe")).toHaveCount(0);
  await button(dialog, "Watch lesson").nth(1).click();
  await expect(dialog.locator("iframe")).toHaveAttribute(
    "src",
    "https://www.youtube-nocookie.com/embed/abc123DEF46",
  );
  await button(dialog, "Close video").click();
  await button(page, "Take the next step").click();
  await page.getByRole("button", { name: /Build your next steps/ }).click();
  await page.reload();
  const workbench = page.getByRole("region", { name: "Learning roadmap" });
  await expect(workbench).toContainText("Your personalized learning plan");
  await expect(
    workbench.getByRole("link", { name: "Open on YouTube" }).first(),
  ).toHaveAttribute("href", "https://www.youtube.com/watch?v=abc123DEF45");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("switch", { name: "Light theme" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await workbench.screenshot({ path: "test-results/learning-plan-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.getByRole("switch", { name: "Light theme" }).click();
  await workbench.screenshot({
    path: "test-results/learning-plan-desktop.png",
  });
  await button(page, "Use full profile editor").click();
  await expect(page.locator("#roadmap")).toContainText(
    "Statistics practice lesson",
  );
});

test("unavailable personalization shows starter notice, search links and a working retry", async ({
  page,
}) => {
  const fallback = {
    ...plan,
    generation: "starter",
    summary: undefined,
    lesson_status: "search_only",
    notice:
      "Personalization is unavailable right now. Here is a starter plan; you can try again.",
    milestones: plan.milestones.map((week, i) => ({
      ...week,
      lessons: [],
      lesson_status: [
        "provider_unavailable",
        "no_results",
        "no_distinct_result",
        "not_configured",
      ][i],
      lesson_search_url:
        "https://www.youtube.com/results?search_query=statistics",
    })),
  };
  await openRoadmap(page, fallback);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Your starter learning plan");
  await expect(dialog).toContainText("Personalization is unavailable");
  await expect(dialog).toContainText(
    "Video lessons could not be retrieved right now",
  );
  await expect(dialog).toContainText(
    "No playable lesson was found for this topic",
  );
  await expect(dialog).toContainText("Earlier videos are not repeated here");
  await expect(dialog).toContainText("Video lessons are not connected yet");
  await expect(
    dialog.getByRole("link", { name: "Search YouTube" }),
  ).toHaveCount(4);
  await expect(
    dialog.getByRole("button", { name: "Watch lesson" }),
  ).toHaveCount(0);
  await page.route("**/api/roadmap", (route) => route.fulfill({ json: plan }));
  await button(dialog, "Rebuild plan").click();
  await expect(dialog).toContainText("Your personalized learning plan");
});
