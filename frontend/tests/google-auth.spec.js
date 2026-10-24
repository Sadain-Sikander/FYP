import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { button, stubSkills, studentToIdentity } from "./discovery-helpers";

const origin = "http://127.0.0.1:5174",
  project = "http://127.0.0.1:54321";
const id = "33333333-3333-4333-8333-333333333333";
const user = {
  id,
  aud: "authenticated",
  role: "authenticated",
  email: "taylor@example.com",
  user_metadata: { full_name: "Taylor Morgan" },
  app_metadata: { provider: "google", providers: ["google"] },
  created_at: "2026-01-01T00:00:00Z",
};
const token = [
  Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
    "base64url",
  ),
  Buffer.from(
    JSON.stringify({
      sub: id,
      exp: Math.floor(Date.now() / 1000) + 3600,
      role: "authenticated",
    }),
  ).toString("base64url"),
  "test-signature",
].join(".");

async function googleProject(page, { cancel = false, expire = false } = {}) {
  const rows = { profiles: [], saved_careers: [], saved_roadmaps: [] };
  const calls = { challenge: "", exchanges: 0, failLoad: false };
  await page.route(`${project}/**`, async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (url.pathname.endsWith("/authorize")) {
      expect(url.searchParams.get("provider")).toBe("google");
      expect(url.searchParams.get("redirect_to")).toBe(
        `${origin}/?auth_callback=1`,
      );
      expect(url.searchParams.get("code_challenge_method")).toBe("s256");
      expect(url.searchParams.get("prompt")).toBe("select_account");
      calls.challenge = url.searchParams.get("code_challenge");
      return route.fulfill({
        status: 302,
        headers: {
          location: cancel
            ? `${origin}/?auth_callback=1#error=access_denied&error_description=User+cancelled`
            : `${origin}/?auth_callback=1&code=test-google-code`,
        },
      });
    }
    if (url.pathname.endsWith("/token")) {
      expect(url.searchParams.get("grant_type")).toBe("pkce");
      const p = req.postDataJSON();
      expect(p.auth_code).toBe("test-google-code");
      expect(
        createHash("sha256").update(p.code_verifier).digest("base64url"),
      ).toBe(calls.challenge);
      calls.exchanges++;
      return route.fulfill(
        expire
          ? {
              status: 400,
              json: {
                error: "invalid_grant",
                error_description: "Code expired",
              },
            }
          : {
              json: {
                access_token: token,
                refresh_token: "test-google-refresh",
                token_type: "bearer",
                expires_in: 3600,
                user,
              },
            },
      );
    }
    if (url.pathname.endsWith("/user")) return route.fulfill({ json: user });
    if (url.pathname.endsWith("/logout")) return route.fulfill({ status: 204 });
    if (url.pathname.startsWith("/rest/v1/")) {
      const table = url.pathname.split("/").at(-1);
      expect(req.headers().authorization).toBe(`Bearer ${token}`);
      if (req.method() === "POST") {
        const row = req.postDataJSON();
        expect(row.user_id).toBe(id);
        rows[table] = [{ ...row, updated_at: "2026-10-24T10:00:00Z" }];
        return route.fulfill({ status: 201, json: [] });
      }
      expect(url.searchParams.get("user_id")).toBe(`eq.${id}`);
      if (req.method() === "DELETE") {
        rows[table] = [];
        return route.fulfill({ status: 204 });
      }
      if (calls.failLoad)
        return route.fulfill({
          status: 503,
          json: { message: "Temporary outage" },
        });
      return route.fulfill({ json: rows[table] });
    }
    throw new Error(`Unexpected request: ${url.pathname}`);
  });
  return { rows, calls };
}

test("Google PKCE preserves a guest story and saved work opens in the current interface", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const { rows, calls } = await googleProject(page);
  await stubSkills(page);
  await page.goto(origin);
  await studentToIdentity(page);
  const identity = await page
    .getByLabel("Career identity statement", { exact: true })
    .inputValue();
  await button(page, "Sign in to save").click();
  await button(page, "Continue with Google").click();
  await expect(page).toHaveURL(`${origin}/#explore`);
  await expect(
    page.getByLabel("Career identity statement", { exact: true }),
  ).toHaveValue(identity);
  expect(calls.exchanges).toBe(1);
  await button(page, "Save profile").click();
  await expect.poll(() => rows.profiles.length).toBe(1);
  await button(page, "Explore paths").click();
  await page.locator(".career-node").first().click();
  await button(page, "Save career").click();
  await expect.poll(() => rows.saved_careers.length).toBe(1);
  await button(page, "Build my roadmap").click();
  await expect(page.locator(".milestone")).toHaveCount(4);
  await button(page, "Save roadmap").click();
  await expect.poll(() => rows.saved_roadmaps.length).toBe(1);
  await button(page, "Close career details").click();
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await button(page, "Saved space").click();
  const saved = page.getByRole("dialog", {
    name: "Your saved space",
    exact: true,
  });
  await expect(saved).toContainText("Taylor Morgan");
  await saved.getByRole("button", { name: "Load saved profile" }).click();
  await expect(
    page.getByLabel("Career identity statement", { exact: true }),
  ).toHaveValue(identity);
  await button(page, "Saved space").click();
  await saved
    .locator(".saved-grid article")
    .nth(1)
    .locator(".nav-text")
    .click();
  await expect(
    page.getByRole("dialog").getByRole("heading", {
      name: rows.saved_careers[0].data.title,
      exact: true,
    }),
  ).toBeVisible();
  await button(page, "Close career details").click();
  await button(page, "Saved space").click();
  await saved
    .locator(".saved-grid article")
    .nth(2)
    .locator(".nav-text")
    .click();
  await expect(
    page
      .getByRole("region", { name: "Learning roadmap" })
      .locator(".milestone"),
  ).toHaveCount(4);
  await expect(page.locator(".app-shell")).toHaveCount(0);
  await page.locator(".loom-brand").click();
  await page
    .locator(".loom-home")
    .getByRole("button", { name: "Saved space", exact: true })
    .click();
  await expect(saved).toBeVisible();
  await button(page, "Back to discovery").click();
  await button(page, "Saved space").click();
  calls.failLoad = true;
  await saved.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(saved.getByRole("alert")).toContainText("could not be loaded", {
    timeout: 20000,
  });
  calls.failLoad = false;
  await saved.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(
    saved.getByRole("button", { name: "Load saved profile" }),
  ).toBeVisible();
  await saved.screenshot({ path: "test-results/saved-space-dark.png" });
  await button(page, "Back to discovery").click();
  await page.getByRole("switch", { name: "Light theme" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await button(page, "Saved space").click();
  await expect(
    saved.getByRole("button", { name: "Load saved profile" }),
  ).toBeVisible();
  expect(
    await saved.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  await saved.screenshot({ path: "test-results/saved-space-mobile.png" });
  await saved.getByRole("button", { name: "Delete saved profile" }).click();
  await expect.poll(() => rows.profiles.length).toBe(0);
  await saved.getByRole("button", { name: "Sign out", exact: true }).click();
  await button(page, "Start my discovery").click();
  await expect(
    page.getByLabel("Current or previous role", { exact: true }),
  ).toHaveValue("");
  await expect(button(page, "Saved space")).toHaveCount(0);
  expect(errors).toEqual([]);
});

for (const reason of ["cancel", "expire"]) {
  test(`Google ${reason} returns a clean retry screen and retains the guest draft`, async ({
    page,
  }) => {
    await googleProject(page, { [reason]: true });
    await page.goto(origin);
    await button(page, "Start my discovery").click();
    await page
      .getByLabel("Current or previous role", { exact: true })
      .fill("Teacher");
    await page
      .locator(".loom-nav-actions")
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await button(page, "Continue with Google").click();
    await expect(page).toHaveURL(`${origin}/#login`);
    await expect(page.getByRole("alert")).toContainText(
      "could not be completed",
    );
    await expect(button(page, "Continue with Google")).toBeEnabled();
    await page
      .getByRole("link", { name: "Continue exploring as a guest" })
      .click();
    await expect(
      page.getByLabel("Current or previous role", { exact: true }),
    ).toHaveValue("Teacher");
  });
}

test("Google requires configuration and cannot import another account's draft", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:5173/#login");
  await expect(button(page, "Continue with Google")).toBeDisabled();
  await expect(page.getByRole("status")).toContainText(
    "Accounts are not connected",
  );
  await googleProject(page);
  await page.goto(origin);
  await button(page, "Start my discovery").click();
  await page
    .getByLabel("Current or previous role", { exact: true })
    .fill("Private role");
  await page
    .locator(".loom-nav-actions")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await page.evaluate(() => {
    const draft = JSON.parse(
      sessionStorage.getItem("careerbridge-workspace-v1"),
    );
    draft.owner = "another-user-id";
    sessionStorage.setItem("careerbridge-workspace-v1", JSON.stringify(draft));
  });
  await button(page, "Continue with Google").click();
  await expect(
    page.getByLabel("Current or previous role", { exact: true }),
  ).toHaveValue("");
});
