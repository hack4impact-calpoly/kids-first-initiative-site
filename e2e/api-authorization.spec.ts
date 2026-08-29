import { expect, test } from "@playwright/test";

/**
 * API-level negative coverage.
 *
 * The e2e server runs with KFI_E2E_BYPASS_CLERK, which keeps Clerk middleware running but enforces
 * nothing, so every request here arrives as a resolvable anonymous caller — the same shape a signed
 * out visitor has in production. That makes this suite the anonymous half of the authorization
 * contract: routes that must refuse a caller with no credentials, and routes that must reject
 * malformed input before touching data.
 *
 * A refusal must be a deliberate 401/403/404, never a 500. A crash is not a refusal: it means the
 * route failed before deciding, which is how an authorization gap hides.
 *
 * Positive role coverage (admin, educator, owner) lives in the unit suites, which can supply a
 * session; asserting it here would only test the bypass.
 */

const ADMIN_ONLY_READS = [
  "/api/users",
  "/api/quiz",
  "/api/gameData",
  "/api/events",
  "/api/sessions",
  "/api/example",
  "/api/admin/analytics",
];

const EDUCATOR_ONLY = ["/api/classroom-sessions", "/api/classroom-sessions/history"];

test.describe("anonymous callers", () => {
  for (const path of ADMIN_ONLY_READS) {
    test(`refuses an unauthenticated read of ${path}`, async ({ request }) => {
      const response = await request.get(path);

      // 401 or 403 are both acceptable; what matters is that this is a decision, not a crash.
      expect([401, 403]).toContain(response.status());
    });
  }

  for (const path of EDUCATOR_ONLY) {
    test(`refuses an unauthenticated read of ${path}`, async ({ request }) => {
      const response = await request.get(path);

      expect([401, 403]).toContain(response.status());
    });
  }

  test("refuses to create a classroom session", async ({ request }) => {
    const response = await request.post("/api/classroom-sessions", { data: { title: "Forged class" } });

    expect([401, 403]).toContain(response.status());
  });

  test("refuses to reopen a class", async ({ request }) => {
    const response = await request.post("/api/classroom-sessions/history/000000000000000000000000/reopen");

    expect([401, 403, 404]).toContain(response.status());
  });

  test("does not confirm whether another educator's class exists", async ({ request }) => {
    const response = await request.get("/api/classroom-sessions/history/000000000000000000000000");

    // 404 rather than 403, so a caller cannot probe for classes by id.
    expect([401, 404]).toContain(response.status());
  });

  test("refuses to save game data without a resolvable owner", async ({ request }) => {
    const response = await request.post("/api/gameData", {
      data: {
        saveId: "forged-save",
        saveVersion: 1,
        gameVersion: "1.0.0",
        gameId: "PenguinRun",
        completedLevels: [1],
        userId: "someone-else",
        classroomSessionId: "forged-session",
      },
    });

    expect([401, 403]).toContain(response.status());
  });

  test("refuses to list saves without a resolvable owner", async ({ request }) => {
    const response = await request.get("/api/gameData/mine");

    expect([401, 403]).toContain(response.status());
  });
});

test.describe("input validation", () => {
  test("rejects a classroom join with no access code", async ({ request }) => {
    const response = await request.post("/api/classroom-sessions/join", { data: {} });

    expect(response.status()).toBe(400);
  });

  test("rejects a classroom join with an inactive access code", async ({ request }) => {
    const response = await request.post("/api/classroom-sessions/join", {
      data: { code: "ZZZZZZ-000", displayName: "Student" },
    });

    // Not found rather than a generic failure, and never a session.
    expect([404, 410]).toContain(response.status());
    await expect(response.json()).resolves.not.toHaveProperty("sessionId");
  });

  test("rejects a malformed game data body", async ({ request }) => {
    const response = await request.post("/api/gameData", { data: "not-an-object" });

    expect([400, 401, 403]).toContain(response.status());
  });

  test("does not leak a save to an anonymous caller by id", async ({ request }) => {
    const response = await request.get("/api/gameData/some-other-learners-save");

    expect([401, 403, 404]).toContain(response.status());
  });
});
