import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { button, stubSkills, studentToIdentity } from "./discovery-helpers";

const categories = [
  "Introduction",
  "Experience",
  "Role knowledge",
  "Problem solving",
  "Reflection",
];
const questions = categories.map((category, i) => ({
  id: `q${i + 1}`,
  category,
  question: `Tell me about ${category.toLowerCase()}.`,
  hint: "Use a real example from your experience.",
}));
const answer =
  "I built a Python reporting tool for a university project and checked its output against sample data.";
const feedback = {
  summary: "You give a concrete example. Explain the result next.",
  strengths: [
    {
      quote: "checked its output against sample data",
      comment: "You explain how you checked quality.",
    },
  ],
  improvements: ["Describe what you learned from the comparison."],
  outline: [
    "Briefly explain the project's purpose.",
    "Describe your action and the result you observed.",
  ],
  follow_up: "What would you improve if you repeated the project?",
  note: "AI coaching, not a hiring assessment.",
};

async function openPractice(page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await stubSkills(page);
  await page.goto("http://127.0.0.1:5173");
  await studentToIdentity(page);
  await button(page, "Take action tab").click();
  await page.getByRole("button", { name: /Practise your interview/ }).click();
  await page.getByLabel("Interview target role").fill("Junior Developer");
  await expect(button(page, "Start practice")).toBeDisabled();
  await page
    .getByRole("checkbox", {
      name: "I’ve reviewed my profile for interview practice.",
    })
    .check();
}

test("practice keeps answers and feedback across navigation and refresh, exports notes, and supports both themes", async ({
  page,
}) => {
  const calls = [];
  await page.route("**/api/interview/questions", (route) => {
    calls.push(route.request().postDataJSON());
    return route.fulfill({ json: { generation: "personalized", questions } });
  });
  await page.route("**/api/interview/feedback", (route) => {
    calls.push(route.request().postDataJSON());
    return route.fulfill({ json: feedback });
  });
  await openPractice(page);
  await button(page, "Start practice").click();
  await expect(
    page.getByRole("heading", { name: questions[0].question }),
  ).toBeVisible();
  expect(calls[0].job_title).toBe("Junior Developer");
  expect(calls[0].profile.skills).toContain("Python");
  const input = page.getByLabel("Your interview answer", { exact: true });
  await expect(button(page, "Get answer feedback")).toBeDisabled();
  await input.fill(answer);
  await button(page, "Get answer feedback").click();
  const panel = page.getByRole("region", { name: "Answer feedback" });
  await expect(panel).toContainText(feedback.summary);
  expect(calls[1].answer).toBe(answer);
  expect(calls[1].question.question).toBe(questions[0].question);
  await expect(input).toHaveValue(answer);
  await button(page, "Next question").click();
  await input.fill("Another genuine example from my university project.");
  await page.reload();
  await expect(input).toHaveValue(
    "Another genuine example from my university project.",
  );
  await button(page, "Previous question").click();
  await expect(input).toHaveValue(answer);
  await expect(panel).toContainText(feedback.summary);
  const downloadPromise = page.waitForEvent("download");
  await button(page, "Download practice notes").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    "careerbridge-interview-practice.txt",
  );
  const notes = await readFile(await download.path(), "utf8");
  expect(notes).toContain(answer);
  expect(notes).toContain(feedback.follow_up);
  await input.fill(answer + " I also documented my approach.");
  await expect(panel).toHaveCount(0);
  await expect(
    page.getByText(
      "You edited this answer. Request feedback again for this version.",
    ),
  ).toBeVisible();
  await button(page, "Get answer feedback").click();
  await expect(panel).toBeVisible();
  const workspace = page.getByRole("region", {
    name: "Interview practice",
    exact: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("switch", { name: "Light theme" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await workspace.screenshot({ path: "test-results/interview-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.getByRole("switch", { name: "Light theme" }).click();
  await workspace.screenshot({ path: "test-results/interview-desktop.png" });
  await button(page, "Start new practice").click();
  await button(page, "Keep this practice").click();
  await expect(input).toHaveValue(/documented/);
  await button(page, "Start new practice").click();
  await button(page, "Replace and start").click();
  await expect(input).toHaveValue("");
  await expect(page.getByText("0 of 5 answers written")).toBeVisible();
});

test("starter practice and feedback errors preserve answers and allow retries", async ({
  page,
}) => {
  await page.route("**/api/interview/questions", (route) =>
    route.fulfill({
      json: {
        generation: "starter",
        questions,
        notice: "Personalized questions are unavailable right now.",
      },
    }),
  );
  await page.route("**/api/interview/feedback", (route) =>
    route.fulfill({
      status: 503,
      json: {
        detail:
          "Feedback is unavailable right now. Your answer is kept; use the self-review prompts or retry.",
      },
    }),
  );
  await openPractice(page);
  await button(page, "Start practice").click();
  await expect(
    page.getByText("Starter practice · Junior Developer"),
  ).toBeVisible();
  await page.getByLabel("Your interview answer").fill(answer);
  await button(page, "Get answer feedback").click();
  await expect(page.getByRole("alert")).toContainText(
    "Feedback is unavailable",
  );
  await expect(page.getByLabel("Your interview answer")).toHaveValue(answer);
  await page.getByText("Self-review prompts", { exact: true }).click();
  await expect(
    page.getByText("Did I answer the question directly?"),
  ).toBeVisible();
  await page.route("**/api/interview/feedback", (route) =>
    route.fulfill({ json: feedback }),
  );
  await button(page, "Get answer feedback").click();
  await expect(
    page.getByRole("region", { name: "Answer feedback" }),
  ).toBeVisible();
  for (let i = 1; i < 5; i++) {
    await button(page, "Next question").click();
    await page
      .getByLabel("Your interview answer")
      .fill(`My example for question ${i + 1} uses real experience.`);
  }
  await expect(page.getByText("5 of 5 answers written")).toBeVisible();
  await expect(page.getByText(/You’ve written all five answers/)).toBeVisible();
  await expect(button(page, "Next question")).toHaveCount(0);
});

test("editing an answer cancels pending feedback; changing roles keeps notes but prevents stale reviews", async ({
  page,
}) => {
  let release;
  await page.route("**/api/interview/questions", (route) =>
    route.fulfill({ json: { generation: "personalized", questions } }),
  );
  await page.route("**/api/interview/feedback", async (route) => {
    await new Promise((resolve) => {
      release = resolve;
    });
    await route.fulfill({ json: feedback }).catch(() => {});
  });
  await openPractice(page);
  await button(page, "Start practice").click();
  await page.getByLabel("Your interview answer").fill(answer);
  await button(page, "Get answer feedback").click();
  await expect.poll(() => !!release).toBe(true);
  await page
    .getByLabel("Your interview answer")
    .fill("My updated answer describes a different project and its outcome.");
  release();
  await expect(button(page, "Get answer feedback")).toBeEnabled();
  await expect(
    page.getByRole("region", { name: "Answer feedback" }),
  ).toHaveCount(0);
  await page.getByLabel("Interview target role").fill("Teacher");
  await expect(button(page, "Get answer feedback")).toBeDisabled();
  await expect(page.getByText(/Your role or profile changed/)).toBeVisible();
  await expect(page.getByLabel("Your interview answer")).toHaveValue(
    /updated answer/,
  );
  await page.reload();
  await expect(page.getByLabel("Your interview answer")).toHaveValue(
    /updated answer/,
  );
  await expect(button(page, "Get answer feedback")).toBeDisabled();
});

test("cancelling questions discards late results and malformed responses are recoverable", async ({
  page,
}) => {
  let release;
  await page.route("**/api/interview/questions", async (route) => {
    await new Promise((resolve) => {
      release = resolve;
    });
    await route
      .fulfill({ json: { generation: "personalized", questions } })
      .catch(() => {});
  });
  await openPractice(page);
  await button(page, "Start practice").click();
  await expect.poll(() => !!release).toBe(true);
  await button(page, "Cancel request").click();
  release();
  await expect(page.getByLabel("Your interview answer")).toHaveCount(0);
  await page.route("**/api/interview/questions", (route) =>
    route.fulfill({ json: { generation: "personalized", questions: [] } }),
  );
  await button(page, "Start practice").click();
  await expect(page.getByRole("alert")).toContainText("couldn’t read");
  await page.route("**/api/interview/questions", (route) =>
    route.fulfill({ json: { generation: "personalized", questions } }),
  );
  await button(page, "Start practice").click();
  await expect(page.getByLabel("Your interview answer")).toBeVisible();
});
