import { test, expect } from "@playwright/test";
import path from "node:path";
import { button, stubSkills, studentToIdentity } from "./discovery-helpers";

const suggestion = (kind, text = "My suggested application draft.") => ({
  kind,
  draft: text,
  evidence: [
    {
      text: "I have studied Information Technology.",
      sources: [
        {
          category: "education",
          text: "Bachelor’s degree — Information Technology",
        },
      ],
    },
  ],
  questions: ["Which project result can you verify?"],
  note: "AI-assisted draft. Check every claim.",
});

async function openLetter(page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await stubSkills(page);
  await page.goto("http://127.0.0.1:5173");
  await studentToIdentity(page);
  await button(page, "Take action tab").click();
  await page.getByRole("button", { name: /Start a cover letter/ }).click();
}

test("AI proposals preserve manual edits until accepted; letter and resume Word exports use edited text", async ({
  page,
}) => {
  const payloads = [];
  await page.route("**/api/documents/draft", (route) => {
    const body = route.request().postDataJSON();
    payloads.push(body);
    return route.fulfill({ json: suggestion(body.kind) });
  });
  await openLetter(page);
  const letter = page.getByLabel("Cover letter draft", { exact: true });
  await letter.fill("My carefully edited letter.");
  await page.getByLabel("Writing target role").fill("Junior Developer");
  await page
    .getByLabel("Organisation", { exact: true })
    .fill("Example Company");
  await page
    .getByLabel("Writing job description")
    .fill("Python and SQL development.");
  await expect(button(page, "Generate AI draft")).toBeDisabled();
  await page
    .getByRole("checkbox", {
      name: "I’ve checked these profile details for this draft.",
    })
    .check();
  await button(page, "Generate AI draft").click();
  await expect(page.getByLabel("Suggested document draft")).toHaveValue(
    "My suggested application draft.",
  );
  await expect(letter).toHaveValue("My carefully edited letter.");
  expect(payloads[0].profile.skills).toContain("Python");
  expect(payloads[0].company).toBe("Example Company");
  await page.getByText("See the source details behind the wording").click();
  await expect(page.getByRole("blockquote")).toContainText(
    "Information Technology",
  );
  await button(page, "Use this draft").click();
  await letter.fill("My final edited cover letter.");
  await page.reload();
  await expect(letter).toHaveValue("My final edited cover letter.");
  let exportRequest = page.waitForRequest("**/api/documents/export");
  let download = page.waitForEvent("download");
  await button(page, "Download Word").click();
  expect((await exportRequest).postDataJSON().text).toBe(
    "My final edited cover letter.",
  );
  expect((await download).suggestedFilename()).toBe(
    "careerbridge-cover-letter.docx",
  );
  await page.getByRole("button", { name: /Workshop your resume/ }).click();
  const builder = page.getByRole("region", {
    name: "Resume builder",
    exact: true,
  });
  await builder.getByRole("checkbox").check();
  await button(builder, "Generate AI draft").click();
  await button(builder, "Use this draft").click();
  await page
    .getByLabel("Resume draft", { exact: true })
    .fill("SUMMARY\nMy edited resume.\nSKILLS\nPython, SQL");
  await page.reload();
  await expect(page.getByLabel("Resume draft", { exact: true })).toHaveValue(
    /My edited resume/,
  );
  exportRequest = page.waitForRequest("**/api/documents/export");
  download = page.waitForEvent("download");
  await button(builder, "Download Word").click();
  expect((await exportRequest).postDataJSON().text).toContain(
    "My edited resume",
  );
  expect((await download).suggestedFilename()).toBe("careerbridge-resume.docx");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("switch", { name: "Light theme" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await builder.screenshot({ path: "test-results/resume-writing-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.getByRole("switch", { name: "Light theme" }).click();
  await builder.screenshot({ path: "test-results/resume-writing-desktop.png" });
});

test("changing a target cancels pending writing and hides stale proposals without losing edits", async ({
  page,
}) => {
  let release;
  await page.route("**/api/documents/draft", async (route) => {
    await new Promise((resolve) => {
      release = resolve;
    });
    await route
      .fulfill({ json: suggestion("cover_letter", "Old target draft") })
      .catch(() => {});
  });
  await openLetter(page);
  await page
    .getByLabel("Cover letter draft", { exact: true })
    .fill("Keep my own wording.");
  await page
    .getByRole("checkbox", {
      name: "I’ve checked these profile details for this draft.",
    })
    .check();
  const started = page.waitForRequest("**/api/documents/draft");
  await button(page, "Generate AI draft").click();
  await started;
  await page
    .getByLabel("Writing job description")
    .fill("A different target role.");
  release();
  await expect(button(page, "Generate AI draft")).toBeEnabled();
  await expect(page.getByLabel("Suggested document draft")).toHaveCount(0);
  await expect(
    page.getByLabel("Cover letter draft", { exact: true }),
  ).toHaveValue("Keep my own wording.");
  await page.route("**/api/documents/draft", (route) =>
    route.fulfill({ json: suggestion("cover_letter", "New target draft") }),
  );
  await button(page, "Generate AI draft").click();
  await expect(page.getByLabel("Suggested document draft")).toHaveValue(
    "New target draft",
  );
  await button(page, "Keep my current draft").click();
  await expect(
    page.getByLabel("Cover letter draft", { exact: true }),
  ).toHaveValue("Keep my own wording.");
});

test("writing outage keeps manual drafts and manual resume starter works without AI", async ({
  page,
}) => {
  await page.route("**/api/documents/draft", (route) =>
    route.fulfill({
      status: 503,
      json: { detail: "Writing assistance is not available yet." },
    }),
  );
  await openLetter(page);
  await page
    .getByLabel("Cover letter draft", { exact: true })
    .fill("My manual letter.");
  await page
    .getByRole("checkbox", {
      name: "I’ve checked these profile details for this draft.",
    })
    .check();
  await button(page, "Generate AI draft").click();
  await expect(page.getByRole("alert")).toContainText(
    "Writing assistance is not available",
  );
  await expect(
    page.getByLabel("Cover letter draft", { exact: true }),
  ).toHaveValue("My manual letter.");
  await page.getByRole("button", { name: /Workshop your resume/ }).click();
  await button(page, "Create a starter resume").click();
  await expect(page.getByLabel("Resume draft", { exact: true })).toHaveValue(
    /Information Technology/,
  );
});

test("uploaded profile must be reviewed before AI writing can be requested", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:5173");
  await button(page, "Start with your resume").click();
  await page
    .getByLabel("Upload your resume")
    .setInputFiles(path.resolve("tests/fixtures/resume.docx"));
  await expect(page.locator(".resume-file-strip")).toBeVisible();
  const checked = page.getByRole("checkbox", {
    name: "I’ve checked these profile details for this draft.",
  });
  await expect(checked).toBeDisabled();
  await page
    .getByRole("checkbox", {
      name: "I’ve reviewed these details. They reflect my experience.",
    })
    .check();
  await expect(checked).toBeEnabled();
  await checked.check();
  await expect(button(page, "Generate AI draft")).toBeEnabled();
  await page
    .getByLabel("Experience & projects", { exact: true })
    .fill("My corrected project description.");
  await expect(checked).not.toBeChecked();
  await expect(button(page, "Generate AI draft")).toBeDisabled();
});
