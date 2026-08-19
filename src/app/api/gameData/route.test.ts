import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  connectDB: vi.fn(),
  create: vi.fn(),
  find: vi.fn(),
  lean: vi.fn(),
  resolveDataPrincipal: vi.fn(),
  sort: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/database/db", () => ({ default: mocks.connectDB }));
vi.mock("@/database/gameDataSchema", () => ({
  default: {
    create: mocks.create,
    find: mocks.find,
  },
}));
vi.mock("@/lib/server/classroomAuthorization", () => ({
  resolveDataPrincipal: mocks.resolveDataPrincipal,
}));

import { GET, POST } from "@/app/api/gameData/route";

describe("/api/gameData authorization", () => {
  beforeEach(() => {
    mocks.lean.mockResolvedValue([]);
    mocks.sort.mockReturnValue({ lean: mocks.lean });
    mocks.find.mockReturnValue({ sort: mocks.sort });
  });

  it("denies anonymous and non-admin aggregate reads", async () => {
    mocks.auth.mockResolvedValueOnce({ userId: null, sessionClaims: null });
    expect((await GET()).status).toBe(401);

    mocks.auth.mockResolvedValueOnce({ userId: "player-1", sessionClaims: { role: "player" } });
    expect((await GET()).status).toBe(403);
    expect(mocks.find).not.toHaveBeenCalled();
  });

  it("allows administrators to list game data", async () => {
    mocks.auth.mockResolvedValue({ userId: "admin-1", sessionClaims: { role: "admin" } });
    expect((await GET()).status).toBe(200);
    expect(mocks.find).toHaveBeenCalledWith({});
  });

  it("derives save ownership from the authorized principal", async () => {
    mocks.auth.mockResolvedValue({ userId: "real-user", sessionClaims: { role: "player" } });
    mocks.resolveDataPrincipal.mockResolvedValue({
      ok: true,
      value: { ownerId: "real-user", actor: { userId: "real-user", role: "player" }, classroom: null },
    });
    mocks.create.mockImplementation(async (value) => value);

    const request = new NextRequest("http://localhost/api/gameData", {
      method: "POST",
      body: JSON.stringify({
        saveId: "save-1",
        saveVersion: 1,
        gameVersion: "1.0.0",
        gameId: "PenguinRun",
        completedLevels: [1],
        userId: "forged-user",
        classroomSessionId: "forged-session",
      }),
      headers: { "content-type": "application/json" },
    });

    expect((await POST(request)).status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "real-user",
        classroomSessionId: null,
        classroomParticipantId: null,
      }),
    );
    expect(mocks.create.mock.calls[0][0]).not.toMatchObject({ userId: "forged-user" });
  });
});
