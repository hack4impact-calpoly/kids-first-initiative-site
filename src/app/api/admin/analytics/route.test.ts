import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  connectDB: vi.fn(),
  loadAdminAnalytics: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/database/db", () => ({ default: mocks.connectDB }));
vi.mock("@/lib/server/adminAnalytics", () => ({
  ALL_SESSION_STATES: ["active", "expired", "closed"],
  DEFAULT_ADMIN_CLASS_LIMIT: 50,
  loadAdminAnalytics: mocks.loadAdminAnalytics,
}));

import { GET } from "@/app/api/admin/analytics/route";

const request = (search = "") => new NextRequest(`http://localhost/api/admin/analytics${search}`);

describe("GET /api/admin/analytics", () => {
  beforeEach(() => {
    mocks.loadAdminAnalytics.mockResolvedValue({ sessionCounts: { active: 1, expired: 0, closed: 2, total: 3 } });
  });

  it("rejects anonymous callers", async () => {
    mocks.auth.mockResolvedValue({ userId: null, sessionClaims: null });

    expect((await GET(request())).status).toBe(401);
    expect(mocks.loadAdminAnalytics).not.toHaveBeenCalled();
  });

  it("rejects signed-in non-administrators, including educators", async () => {
    for (const role of ["player", "parent", "educator"]) {
      mocks.auth.mockResolvedValue({ userId: "user_1", sessionClaims: { role } });
      expect((await GET(request())).status).toBe(403);
    }

    // Cross-class aggregate data must not be reachable without the admin role.
    expect(mocks.loadAdminAnalytics).not.toHaveBeenCalled();
  });

  it("serves administrators", async () => {
    mocks.auth.mockResolvedValue({ userId: "admin_1", sessionClaims: { role: "admin" } });

    const response = await GET(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ sessionCounts: { total: 3 } });
  });

  it("passes through the supported filters", async () => {
    mocks.auth.mockResolvedValue({ userId: "admin_1", sessionClaims: { role: "admin" } });

    await GET(request("?classId=c1&educatorId=e1&gameId=penguinRunGame&states=active,closed&from=2026-08-01"));

    expect(mocks.loadAdminAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({
        classId: "c1",
        educatorId: "e1",
        gameId: "penguinRunGame",
        states: ["active", "closed"],
        from: new Date("2026-08-01"),
      }),
    );
  });

  it("ignores unrecognised states and unparseable dates rather than filtering on them", async () => {
    mocks.auth.mockResolvedValue({ userId: "admin_1", sessionClaims: { role: "admin" } });

    await GET(request("?states=bogus&from=not-a-date"));

    expect(mocks.loadAdminAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({ states: undefined, from: undefined }),
    );
  });

  it("caps the class limit", async () => {
    mocks.auth.mockResolvedValue({ userId: "admin_1", sessionClaims: { role: "admin" } });

    await GET(request("?limit=99999"));

    expect(mocks.loadAdminAnalytics).toHaveBeenCalledWith(expect.objectContaining({ limit: 200 }));
  });
});
