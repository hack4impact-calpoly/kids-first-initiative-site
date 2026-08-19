import { describe, expect, it } from "vitest";
import {
  normalizeRole,
  normalizeSelfAssignableRole,
  requireAdmin,
  requireSignedIn,
} from "@/lib/server/apiAuthorization";

describe("API role policy", () => {
  it("accepts only known application roles", () => {
    expect(normalizeRole("player")).toBe("player");
    expect(normalizeRole("admin")).toBe("admin");
    expect(normalizeRole("owner")).toBeNull();
    expect(normalizeRole(undefined)).toBeNull();
  });

  it("never allows self-registration to assign administrator access", () => {
    expect(normalizeSelfAssignableRole("educator")).toBe("educator");
    expect(normalizeSelfAssignableRole("parent")).toBe("parent");
    expect(normalizeSelfAssignableRole("admin")).toBe("player");
    expect(normalizeSelfAssignableRole("anything-else")).toBe("player");
  });

  it("requires a Clerk user for signed-in operations", async () => {
    const result = requireSignedIn({ userId: null, role: null });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("requires both a Clerk user and the administrator claim for admin operations", () => {
    const player = requireAdmin({ userId: "user-1", role: "player" });
    expect(player.ok).toBe(false);
    if (!player.ok) expect(player.response.status).toBe(403);

    const admin = requireAdmin({ userId: "admin-1", role: "admin" });
    expect(admin).toMatchObject({ ok: true, value: { userId: "admin-1", role: "admin" } });
  });
});
