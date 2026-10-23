import { test, expect } from "@playwright/test";
import path from "node:path";
import { button, stubSkills, studentToIdentity } from "./discovery-helpers";

const home = "http://127.0.0.1:5173";
test("refresh keeps the unfinished prompt and never defaults to the legacy editor", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${home}/#explore`);
  await expect(page.getByLabel("Current or previous role")).toBeVisible();
  await page.getByLabel("Current or previous role").fill("Student");
  await button(page, "Next").click();
  await page
    .getByLabel("Education level")
    .selectOption({ label: "Bachelor’s degree" });
  await button(page, "Next").click();
  await page.getByLabel("Subject area").fill("Computer Science");
  await page.reload();
  await expect(page.getByLabel("Subject area")).toHaveValue("Computer Science");
  await expect(page.locator(".app-shell")).toHaveCount(0);
  await button(page, "Back").click();
  await expect(page.getByLabel("Education level")).toHaveValue(
    "Bachelor’s degree",
  );
});

test("refresh restores career results, action drafts and the identity tab without redirecting", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await stubSkills(page);
  await page.goto(home);
  await studentToIdentity(page);
  const identity = "I build reliable reporting tools using Python and SQL.";
  await page.getByLabel("Career identity statement").fill(identity);
  await button(page, "Explore paths").click();
  await expect(page.locator(".career-node")).toHaveCount(6, {
    timeout: 120000,
  });
  const titles = await page.locator(".career-node strong").allTextContents();
  await page.reload();
  await expect(page.locator(".career-node strong")).toHaveText(titles);
  await button(page, "Take action tab").click();
  await page.getByRole("button", { name: /Start a cover letter/ }).click();
  await page
    .getByLabel("Cover letter draft")
    .fill("My personally edited letter.");
  await page.reload();
  await expect(page.getByLabel("Cover letter draft")).toHaveValue(
    "My personally edited letter.",
  );
  await expect(button(page, "Take action tab")).toHaveAttribute(
    "aria-current",
    "page",
  );
  await button(page, "Career identity tab").click();
  await page.reload();
  await expect(page.getByLabel("Career identity statement")).toHaveValue(
    identity,
  );
  await expect(button(page, "Career identity tab")).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.locator(".app-shell")).toHaveCount(0);
});

test("refresh preserves resume studio edits and review confirmation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(home);
  await button(page, "Start with your resume").click();
  await page.reload();
  await expect(button(page, "Choose your resume")).toBeVisible();
  await page
    .getByLabel("Upload your resume")
    .setInputFiles(path.resolve("tests/fixtures/resume.docx"));
  await expect(page.locator(".score-ring")).toBeVisible();
  await page
    .getByLabel("Experience & projects", { exact: true })
    .fill("My corrected project experience.");
  await page.getByRole("checkbox", { name: /I’ve reviewed/ }).check();
  await page.reload();
  await expect(page.locator(".resume-studio")).toBeVisible();
  await expect(
    page.getByLabel("Experience & projects", { exact: true }),
  ).toHaveValue("My corrected project experience.");
  await expect(
    page.getByRole("checkbox", { name: /I’ve reviewed/ }),
  ).toBeChecked();
  await button(page, "Continue to my identity").click();
  await expect(page.getByLabel("Career identity statement")).toHaveValue(
    /corrected project/,
  );
});

test("unavailable, malformed and another account's session data fall back to the new flow", async ({
  page,
}) => {
  await page.goto(home);
  await page.evaluate(() =>
    sessionStorage.setItem("careerbridge-workspace-v1", "{bad json"),
  );
  await page.goto(`${home}/#explore`);
  await page.reload();
  await expect(page.getByLabel("Current or previous role")).toBeVisible();
  await page.getByLabel("Current or previous role").fill("Private role");
  await page.evaluate(() => {
    const stored = JSON.parse(
      sessionStorage.getItem("careerbridge-workspace-v1"),
    );
    stored.owner = "another-account";
    sessionStorage.setItem("careerbridge-workspace-v1", JSON.stringify(stored));
  });
  await page.reload();
  await expect(page.getByLabel("Current or previous role")).toHaveValue("");
  await page.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", {
      get() {
        throw new Error("Storage blocked");
      },
    });
  });
  await page.reload();
  await expect(page.getByLabel("Current or previous role")).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveCount(0);
});
