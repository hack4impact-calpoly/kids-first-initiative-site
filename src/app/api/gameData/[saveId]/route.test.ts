import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  connectDB: vi.fn(),
  findOneAndUpdate: vi.fn(),
  lean: vi.fn(),
  resolveDataPrincipal: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/database/db", () => ({ default: mocks.connectDB }));
vi.mock("@/database/gameDataSchema", () => ({
  default: { findOneAndUpdate: mocks.findOneAndUpdate },
}));
vi.mock("@/lib/server/classroomAuthorization", () => ({
  canEducatorReadClassroom: vi.fn(),
  resolveDataPrincipal: mocks.resolveDataPrincipal,
}));

import { PATCH } from "@/app/api/gameData/[saveId]/route";

describe("/api/gameData/:saveId ownership", () => {
  beforeEach(() => {
    mocks.auth.mockResolvedValue({ userId: "owner-1", sessionClaims: { role: "player" } });
    mocks.resolveDataPrincipal.mockResolvedValue({
      ok: true,
      value: { ownerId: "owner-1", actor: { userId: "owner-1", role: "player" }, classroom: null },
    });
    mocks.lean.mockResolvedValue({ saveId: "save-1", userId: "owner-1" });
    mocks.findOneAndUpdate.mockReturnValue({ lean: mocks.lean });
  });

  it("scopes updates to both save ID and server-derived owner", async () => {
    const request = new NextRequest("http://localhost/api/gameData/save-1", {
      method: "PATCH",
      body: JSON.stringify({ completedLevels: [2], userId: "forged-user", gameId: "forged-game" }),
      headers: { "content-type": "application/json" },
    });

    expect((await PATCH(request, { params: Promise.resolve({ saveId: "save-1" }) })).status).toBe(200);
    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      { saveId: "save-1", userId: "owner-1" },
      expect.objectContaining({
        $addToSet: { completedLevels: { $each: [2] } },
      }),
      { new: true, runValidators: true },
    );
  });

  it("rejects updates containing no mutable progress fields", async () => {
    const request = new NextRequest("http://localhost/api/gameData/save-1", {
      method: "PATCH",
      body: JSON.stringify({ userId: "forged-user", gameId: "forged-game" }),
      headers: { "content-type": "application/json" },
    });

    expect((await PATCH(request, { params: Promise.resolve({ saveId: "save-1" }) })).status).toBe(400);
    expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
