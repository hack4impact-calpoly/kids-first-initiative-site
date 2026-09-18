import { expect, test } from "@playwright/test";

// The test server bypasses Clerk for other pages, but documentation must still require real auth.
test("documentation links and direct file URLs do not disclose content to anonymous visitors", async ({ request }) => {
  for (const path of [
    "/adminDashboard/docs",
    "/adminDashboard/docs/index.html",
    "/adminDashboard/docs/handoff.md",
    "/adminDashboard/docs/operations.md",
    "/adminDashboard/docs/styles.css",
    "/adminDashboard/docs/bundle.js",
  ]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(401);
    expect(response.headers()["cache-control"], path).toContain("no-store");
    expect(await response.text(), path).not.toContain("Verified baseline");
    const head = await request.head(path);
    expect(head.status(), path).toBe(401);
    expect(await head.body(), path).toHaveLength(0);
  }
});

test("documentation is not exposed as public files", async ({ request }) => {
  for (const path of ["/docs/index.html", "/docs/handoff.md", "/handoff.md", "/docs/operations.md"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
    expect(await response.text(), path).not.toContain("Verified baseline");
  }
});

test("the dashboard documentation link works independently of statistics and is not in public navigation", async ({
  page,
}) => {
  // The dashboard uses the existing development-only test bypass, not an actual admin session.
  await page.route(/\/api\/(users|quiz|gameData|admin\/analytics)(\?|$)/, (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"Test outage"}' }),
  );
  await page.goto("/adminDashboard");
  const link = page.getByRole("link", { name: "Documentation & handoff" });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "/adminDashboard/docs");
  const [navigation] = await Promise.all([
    page.waitForRequest((request) => new URL(request.url()).pathname === "/adminDashboard/docs"),
    link.click(),
  ]);
  expect(navigation.isNavigationRequest()).toBe(true);
  expect(navigation.method()).toBe("GET");
  // Direct authorization is tested above. A browser can first receive Clerk's handshake redirect
  // with these synthetic keys; that external auth service is intentionally not part of UI tests.
  await page.goto("/home");
  await expect(page.getByRole("link", { name: "Documentation & handoff" })).toHaveCount(0);
});
