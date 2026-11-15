import { test, expect } from "@playwright/test";

async function account(page, { google = false, failUpdate = false } = {}) {
  let user = {
    id: "44444444-4444-4444-8444-444444444444",
    aud: "authenticated",
    email: "test@example.com",
    app_metadata: { provider: google ? "google" : "email" },
    user_metadata: google
      ? {
          full_name: "Alex Taylor",
          avatar_url: "https://lh3.googleusercontent.com/test-avatar",
        }
      : {},
  };
  const token = [
    Buffer.from('{"alg":"HS256"}').toString("base64url"),
    Buffer.from(
      JSON.stringify({
        sub: user.id,
        exp: Math.floor(Date.now() / 1000) + 3600,
        role: "authenticated",
      }),
    ).toString("base64url"),
    "test-signature",
  ].join(".");
  const changes = [];
  await page.route("https://lh3.googleusercontent.com/test-avatar", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="green"/></svg>',
    }),
  );
  await page.route("http://127.0.0.1:54321/**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname;
    if (path.endsWith("/token"))
      return route.fulfill({
        json: {
          access_token: token,
          refresh_token: "test-refresh",
          token_type: "bearer",
          expires_in: 3600,
          user,
        },
      });
    if (path.endsWith("/user")) {
      if (req.method() === "PUT") {
        changes.push(req.postDataJSON());
        if (failUpdate) {
          failUpdate = false;
          return route.fulfill({
            status: 503,
            json: { message: "Unavailable" },
          });
        }
        user = {
          ...user,
          user_metadata: { ...user.user_metadata, ...req.postDataJSON().data },
        };
      }
      return route.fulfill({ json: user });
    }
    if (path.startsWith("/rest/v1/")) return route.fulfill({ json: [] });
    if (path.endsWith("/logout")) return route.fulfill({ status: 204 });
    throw new Error(`Unexpected route ${path}`);
  });
  await page.goto("http://127.0.0.1:5174/#login");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  return changes;
}

test("an account without a name completes setup once, preserves errors and shows its name after refresh", async ({
  page,
}) => {
  const changes = await account(page, { failUpdate: true });
  await expect(
    page.getByRole("heading", { name: "What should we call you?" }),
  ).toBeVisible();
  await page.getByLabel("Your name").fill("Alex Taylor");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "name could not be saved",
  );
  await expect(page.getByLabel("Your name")).toHaveValue("Alex Taylor");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByLabel("Current or previous role")).toBeVisible();
  expect(changes.at(-1)).toMatchObject({
    data: { display_name: "Alex Taylor" },
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "What should we call you?" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Saved space", exact: true }).click();
  await expect(
    page.getByRole("dialog").locator(".account-identity"),
  ).toContainText("Alex Taylor");
  await expect(page.getByRole("dialog").locator(".account-avatar")).toHaveText(
    "AT",
  );
});

test("Google metadata supplies the name and photo without a setup prompt, with initials if the image fails", async ({
  page,
}) => {
  const changes = await account(page, { google: true });
  await expect(page.getByLabel("Current or previous role")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "What should we call you?" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Saved space", exact: true }).click();
  const identity = page.getByRole("dialog").locator(".account-identity");
  await expect(identity).toContainText("Alex Taylor");
  await expect(identity.locator("img")).toHaveAttribute(
    "src",
    "https://lh3.googleusercontent.com/test-avatar",
  );
  await identity
    .locator("img")
    .evaluate((img) =>
      img.dispatchEvent(new Event("error", { bubbles: false })),
    );
  await expect(identity.locator(".account-avatar")).toHaveText("AT");
  expect(changes).toEqual([]);
  await page.getByRole("button", { name: "Back to discovery" }).click();
  await page.getByRole("button", { name: "Cancel discovery" }).click();
  await expect(page.locator(".loom-home")).not.toContainText(
    /EXPERIMENT|O\*NET|ESCO/,
  );
  await expect(
    page.getByRole("link", { name: "The experience", exact: true }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
