import { expect } from "@playwright/test";
export const button = (page, name) =>
  page.getByRole("button", { name, exact: true });
export const mockSkills = [
  "Software development",
  "Database management",
  "Technical support",
  "Problem solving",
  "Communication",
  "Research",
  "Python",
  "SQL",
  "Web development",
  "Teamwork",
  "Planning",
  "Writing",
];
export async function stubSkills(page) {
  await page.route("**/api/discovery/skills", (route) =>
    route.fulfill({
      json: {
        skills: mockSkills.map((name) => ({ name, sources: ["ESCO"] })),
        next_offset: 12,
      },
    }),
  );
}
export async function studentToSkills(page) {
  await button(page, "Start my discovery").click();
  await page
    .getByLabel("Current or previous role", { exact: true })
    .fill("Student");
  await button(page, "Next").click();
  await page
    .getByLabel("Education level")
    .selectOption({ label: "Bachelor’s degree" });
  await button(page, "Next").click();
  await page.getByLabel("Subject area").fill("Information Technology");
  await button(page, "Next").click();
  await expect(
    page.getByRole("heading", {
      name: "Select at least 3 skills that apply to you.",
    }),
  ).toBeVisible();
  await expect(button(page, "Re-generate")).toBeEnabled({ timeout: 120000 });
}
export async function studentToIdentity(page) {
  await studentToSkills(page);
  await page
    .getByLabel("Add a skill", { exact: true })
    .fill("Python, SQL, JavaScript");
  await button(page, "Next").click();
  await expect(
    page.getByRole("heading", { name: "Your career identity." }),
  ).toBeVisible();
}
