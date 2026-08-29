import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  connectDB: vi.fn(),
  find: vi.fn(),
  select: vi.fn(),
  sort: vi.fn(),
  lean: vi.fn(),
  auth: vi.fn(),
  resolveDataPrincipal: vi.fn(),
  resolveClassroomOwnerKeys: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/database/db", () => ({ default: mocks.connectDB }));
vi.mock("@/database/gameDataSchema", () => ({ default: { find: mocks.find } }));
vi.mock("@/lib/server/classroomAuthorization", () => ({
  resolveDataPrincipal: mocks.resolveDataPrincipal,
  resolveClassroomOwnerKeys: mocks.resolveClassroomOwnerKeys,
}));

import { GET } from "@/app/api/gameData/mine/route";

const request = (search = "") => new NextRequest(`http://localhost/api/gameData/mine${search}`);

const CLASSROOM = {
  participantId: "participant-new",
  sessionId: "session-continuation",
  displayName: "Ada",
  clerkId: "clerk-student",
};

describe("GET /api/gameData/mine", () => {
  beforeEach(() => {
    mocks.auth.mockResolvedValue({ userId: "clerk-student", sessionClaims: { role: "player" } });
    mocks.lean.mockResolvedValue([
      { saveId: "save-new", gameId: "statesOfMatterGame", lastUpdated: new Date(), completedLevels: [1, 2] },
    ]);
    mocks.sort.mockReturnValue({ lean: mocks.lean });
    mocks.select.mockReturnValue({ sort: mocks.sort });
    mocks.find.mockReturnValue({ select: mocks.select });
    mocks.resolveDataPrincipal.mockResolvedValue({
      ok: true,
      value: { ownerId: "participant:participant-new", actor: {}, classroom: CLASSROOM },
    });
    mocks.resolveClassroomOwnerKeys.mockResolvedValue(["participant:participant-new", "participant:participant-old"]);
  });

  it("refuses a caller the principal resolver rejects", async () => {
    mocks.resolveDataPrincipal.mockResolvedValue({
      ok: false,
      response: new Response(null, { status: 401 }) as never,
    });

    expect((await GET(request())).status).toBe(401);
    expect(mocks.find).not.toHaveBeenCalled();
  });

  it("refuses an anonymous caller with no owner", async () => {
    mocks.resolveDataPrincipal.mockResolvedValue({ ok: true, value: { ownerId: null, actor: {}, classroom: null } });

    expect((await GET(request())).status).toBe(401);
    expect(mocks.find).not.toHaveBeenCalled();
  });

  it("searches the classroom participant's whole lineage so a reopen does not lose progress", async () => {
    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(mocks.resolveClassroomOwnerKeys).toHaveBeenCalledWith(CLASSROOM);
    expect(mocks.find).toHaveBeenCalledWith({
      userId: { $in: ["participant:participant-new", "participant:participant-old"] },
      gameId: { $in: ["statesOfMatterGame", "penguinRunGame"] },
    });
    await expect(response.json()).resolves.toMatchObject({
      saves: [{ saveId: "save-new", completedLevelCount: 2 }],
    });
  });

  it("uses only the personal owner key when there is no classroom context", async () => {
    mocks.resolveDataPrincipal.mockResolvedValue({
      ok: true,
      value: { ownerId: "clerk-student", actor: {}, classroom: null },
    });

    await GET(request());

    expect(mocks.resolveClassroomOwnerKeys).not.toHaveBeenCalled();
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ userId: { $in: ["clerk-student"] } }));
  });

  it("ignores an unsupported gameId rather than filtering on it", async () => {
    await GET(request("?gameId=../../etc/passwd"));

    expect(mocks.find).toHaveBeenCalledWith(
      expect.objectContaining({ gameId: { $in: ["statesOfMatterGame", "penguinRunGame"] } }),
    );
  });

  it("filters to a supported gameId when asked", async () => {
    await GET(request("?gameId=penguinRunGame"));

    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ gameId: "penguinRunGame" }));
  });
});
