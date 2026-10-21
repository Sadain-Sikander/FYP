import { test, expect } from "@playwright/test";

const id = "11111111-1111-4111-8111-111111111111";
const user = {
  id,
  aud: "authenticated",
  role: "authenticated",
  email: "sam@example.com",
  user_metadata: { display_name: "Sam" },
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
const session = {
  access_token: token,
  token_type: "bearer",
  expires_in: 3600,
  refresh_token: "test-refresh",
  user,
};

async function mockProject(page) {
  const rows = { profiles: [], saved_careers: [], saved_roadmaps: [] };
  const calls = [];
  await page.route("http://127.0.0.1:54321/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    calls.push({ path: url.pathname, method: request.method() });
    if (url.pathname.endsWith("/token")) {
      const body = request.postDataJSON();
      if (body.password === "incorrect") {
        await route.fulfill({
          status: 400,
          json: {
            error: "invalid_grant",
            error_description: "Invalid login credentials",
          },
        });
      } else await route.fulfill({ json: session });
    } else if (url.pathname.endsWith("/signup")) {
      await route.fulfill({ json: user }); // Email confirmation required; no session yet.
    } else if (url.pathname.endsWith("/recover")) {
      await route.fulfill({ json: {} });
    } else if (url.pathname.endsWith("/user")) {
      await route.fulfill({ json: user });
    } else if (url.pathname.endsWith("/logout")) {
      await route.fulfill({ status: 204 });
    } else if (url.pathname.startsWith("/rest/v1/")) {
      const table = url.pathname.split("/").at(-1);
      expect(request.headers().authorization).toBe(`Bearer ${token}`);
      if (request.method() === "POST") {
        const row = request.postDataJSON();
        expect(row.user_id).toBe(id);
        rows[table] = [{ ...row, updated_at: "2026-10-20T12:00:00Z" }];
        await route.fulfill({ status: 201, json: [] });
      } else if (request.method() === "DELETE") {
        rows[table] = [];
        await route.fulfill({ status: 204 });
      } else {
        expect(url.searchParams.get("user_id")).toBe(`eq.${id}`);
        await route.fulfill({ json: rows[table] });
      }
    } else throw new Error(`Unexpected test-project request: ${url.pathname}`);
  });
  return { rows, calls };
}

test("account UI handles errors, saves and restores profiles, signs out without leaking data", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const { rows } = await mockProject(page);
  await page.goto("http://127.0.0.1:5174/#login");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("incorrect");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Invalid login credentials",
  );
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your saved space." }),
  ).toBeVisible();
  await page
    .getByLabel("Education & courses")
    .fill("PharmD, Example University");
  await page
    .getByLabel("Skills", { exact: true })
    .fill("Research, Active Listening");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByText("Saved to your account.", { exact: true }),
  ).toBeVisible();
  expect(rows.profiles[0].data.skills).toEqual([
    "Research",
    "Active Listening",
  ]);
  await page.getByLabel("Education & courses").fill("Unsaved edit");
  await page.getByRole("button", { name: "Load saved profile" }).click();
  await expect(page.getByLabel("Education & courses")).toHaveValue(
    "PharmD, Example University",
  );
  await page
    .getByRole("button", { name: "Explore my careers", exact: true })
    .click();
  await expect(page.locator(".career-card")).toHaveCount(6, {
    timeout: 120000,
  });
  await page
    .getByRole("button", { name: "Save career", exact: true })
    .first()
    .click();
  await expect(
    page.locator("#saved .saved-grid article").nth(1).locator(".saved-item"),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Explore this path" }).first().click();
  await page.getByRole("button", { name: "Build my roadmap" }).click();
  await expect(page.locator(".milestone")).toHaveCount(4);
  await page.getByRole("button", { name: "Save roadmap", exact: true }).click();
  await expect(
    page.locator("#saved .saved-grid article").nth(2).locator(".saved-item"),
  ).toHaveCount(1);
  expect(rows.saved_careers[0].career_id).toBe(
    rows.saved_roadmaps[0].career_id,
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Load saved profile" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Load saved profile" }).click();
  await expect(page.getByLabel("Education & courses")).toHaveValue(
    "PharmD, Example University",
  );
  await page
    .locator("#saved .saved-grid article")
    .nth(2)
    .locator(".nav-text")
    .click();
  await expect(page.locator(".milestone")).toHaveCount(4);
  await page.getByRole("button", { name: /Remove saved career/ }).click();
  await expect(
    page.locator("#saved .saved-grid article").nth(1).locator(".saved-item"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByRole("button", { name: "Start my discovery" }).click();
  await expect(page.getByLabel("Education & courses")).toHaveValue("");
  await expect(
    page.getByRole("heading", { name: "Your saved space." }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("signup confirms email, reset request gives a neutral confirmation", async ({
  page,
}) => {
  const { calls } = await mockProject(page);
  await page.goto("http://127.0.0.1:5174/#signup");
  await page.getByLabel("Your name").fill("Sam");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByText("Check your email to confirm your account, then sign in."),
  ).toBeVisible();
  await page.goto("http://127.0.0.1:5174/#forgot");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(
    page.getByText(/If an account exists for this email/),
  ).toBeVisible();
  expect(calls.some((call) => call.path.endsWith("/signup"))).toBe(true);
  expect(calls.some((call) => call.path.endsWith("/recover"))).toBe(true);
});

test("recovery link opens password update instead of the ordinary workspace", async ({
  page,
}) => {
  const { calls } = await mockProject(page);
  const params = new URLSearchParams({
    access_token: token,
    refresh_token: "test-refresh",
    expires_in: "3600",
    token_type: "bearer",
    type: "recovery",
  });
  await page.goto(`http://127.0.0.1:5174/#${params}`);
  await expect(
    page.getByRole("heading", { name: "A fresh start." }),
  ).toBeVisible();
  await page
    .getByLabel("Password", { exact: true })
    .fill("new-example-password");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(
    page.getByRole("heading", { name: "Your saved space." }),
  ).toBeVisible();
  expect(
    calls.some((call) => call.path.endsWith("/user") && call.method === "PUT"),
  ).toBe(true);
});
