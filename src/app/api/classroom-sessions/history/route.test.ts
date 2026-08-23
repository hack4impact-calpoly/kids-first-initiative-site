import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  connectDB: vi.fn(),
  findEducatorTeacher: vi.fn(),
  canEducatorReadClassroom: vi.fn(),
  loadTeacherClassSummaries: vi.fn(),
  loadClassDetail: vi.fn(),
  reopenClassroomClass: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/database/db", () => ({ default: mocks.connectDB }));
vi.mock("@/lib/server/educatorClassroom", () => ({ findEducatorTeacher: mocks.findEducatorTeacher }));
vi.mock("@/lib/server/classroomAuthorization", () => ({ canEducatorReadClassroom: mocks.canEducatorReadClassroom }));
vi.mock("@/lib/server/classroomClasses", () => ({
  DEFAULT_CLASS_PAGE_SIZE: 25,
  loadTeacherClassSummaries: mocks.loadTeacherClassSummaries,
  loadClassDetail: mocks.loadClassDetail,
  reopenClassroomClass: mocks.reopenClassroomClass,
}));

import { GET as listClasses } from "@/app/api/classroom-sessions/history/route";
import { GET as getClass } from "@/app/api/classroom-sessions/history/[classId]/route";
import { POST as reopenClass } from "@/app/api/classroom-sessions/history/[classId]/reopen/route";

const TEACHER_ID = new mongoose.Types.ObjectId();
const CLASS_ID = String(new mongoose.Types.ObjectId());
const params = Promise.resolve({ classId: CLASS_ID });

const EDUCATOR = { userId: "user_educator", sessionClaims: { role: "educator" } };
const ADMIN = { userId: "user_admin", sessionClaims: { role: "admin" } };
const ANONYMOUS = { userId: null, sessionClaims: null };

const listRequest = (search = "") => new NextRequest(`http://localhost/api/classroom-sessions/history${search}`);

function summary(overrides: Record<string, unknown> = {}) {
  return {
    classId: CLASS_ID,
    title: "4th Grade Science",
    state: "closed",
    createdAt: new Date(),
    expiresAt: new Date(),
    closedAt: new Date(),
    sessions: [{}, {}],
    reopenCount: 1,
    participantCount: 3,
    gamesPlayed: 2,
    quizzesRecorded: 1,
    averagePreQuizScore: 40,
    averagePostQuizScore: 80,
    lastActivityAt: new Date(),
    activeAccessCode: null,
    ...overrides,
  };
}

describe("GET /api/classroom-sessions/history", () => {
  beforeEach(() => {
    mocks.findEducatorTeacher.mockResolvedValue({ name: "Educator", teacherId: TEACHER_ID });
    mocks.loadTeacherClassSummaries.mockResolvedValue({ classes: [summary()], total: 1, hasMore: false });
  });

  it("rejects anonymous callers", async () => {
    mocks.auth.mockResolvedValue(ANONYMOUS);

    expect((await listClasses(listRequest())).status).toBe(401);
    expect(mocks.loadTeacherClassSummaries).not.toHaveBeenCalled();
  });

  it("rejects signed-in users who are not educators", async () => {
    mocks.auth.mockResolvedValue({ userId: "user_player", sessionClaims: { role: "player" } });
    mocks.findEducatorTeacher.mockResolvedValue(null);

    expect((await listClasses(listRequest())).status).toBe(403);
    expect(mocks.loadTeacherClassSummaries).not.toHaveBeenCalled();
  });

  it("lists only the calling educator's classes", async () => {
    mocks.auth.mockResolvedValue(EDUCATOR);

    const response = await listClasses(listRequest());
    expect(response.status).toBe(200);
    expect(mocks.loadTeacherClassSummaries).toHaveBeenCalledWith(TEACHER_ID, expect.any(Date), 25);

    const body = await response.json();
    expect(body.classes).toHaveLength(1);
    expect(body.classes[0]).toMatchObject({ classId: CLASS_ID, sessionCount: 2, reopenCount: 1 });
  });
});

describe("GET /api/classroom-sessions/history/:classId", () => {
  beforeEach(() => {
    mocks.findEducatorTeacher.mockResolvedValue({ name: "Educator", teacherId: TEACHER_ID });
    mocks.canEducatorReadClassroom.mockResolvedValue(true);
    mocks.loadClassDetail.mockResolvedValue({ summary: summary(), roster: [] });
  });

  it("rejects anonymous callers", async () => {
    mocks.auth.mockResolvedValue(ANONYMOUS);

    expect((await getClass(new Request("http://localhost"), { params })).status).toBe(401);
    expect(mocks.loadClassDetail).not.toHaveBeenCalled();
  });

  it("hides another educator's class behind a 404 instead of confirming it exists", async () => {
    mocks.auth.mockResolvedValue(EDUCATOR);
    mocks.canEducatorReadClassroom.mockResolvedValue(false);

    const response = await getClass(new Request("http://localhost"), { params });

    expect(response.status).toBe(404);
    expect(mocks.loadClassDetail).not.toHaveBeenCalled();
  });

  it("scopes an educator's read to the classes they own", async () => {
    mocks.auth.mockResolvedValue(EDUCATOR);

    expect((await getClass(new Request("http://localhost"), { params })).status).toBe(200);
    expect(mocks.loadClassDetail).toHaveBeenCalledWith(CLASS_ID, String(TEACHER_ID));
  });

  it("lets an admin read across educators without a teacher scope", async () => {
    mocks.auth.mockResolvedValue(ADMIN);

    expect((await getClass(new Request("http://localhost"), { params })).status).toBe(200);
    expect(mocks.loadClassDetail).toHaveBeenCalledWith(CLASS_ID, null);
    expect(mocks.findEducatorTeacher).not.toHaveBeenCalled();
  });

  it("answers 404 when the class does not exist", async () => {
    mocks.auth.mockResolvedValue(EDUCATOR);
    mocks.loadClassDetail.mockResolvedValue(null);

    expect((await getClass(new Request("http://localhost"), { params })).status).toBe(404);
  });
});

describe("POST /api/classroom-sessions/history/:classId/reopen", () => {
  beforeEach(() => {
    mocks.findEducatorTeacher.mockResolvedValue({ name: "Educator", teacherId: TEACHER_ID });
    mocks.reopenClassroomClass.mockResolvedValue({
      ok: true,
      reopened: true,
      classId: CLASS_ID,
      sessionId: "new-session",
      accessCode: "NEWCODE-9Z8",
      expiresAt: new Date(),
    });
  });

  it("rejects anonymous callers", async () => {
    mocks.auth.mockResolvedValue(ANONYMOUS);

    expect((await reopenClass(new Request("http://localhost"), { params })).status).toBe(401);
    expect(mocks.reopenClassroomClass).not.toHaveBeenCalled();
  });

  it("rejects signed-in users who are not educators", async () => {
    mocks.auth.mockResolvedValue({ userId: "user_player", sessionClaims: { role: "player" } });
    mocks.findEducatorTeacher.mockResolvedValue(null);

    expect((await reopenClass(new Request("http://localhost"), { params })).status).toBe(403);
    expect(mocks.reopenClassroomClass).not.toHaveBeenCalled();
  });

  it("offers admins no bypass: reopening still requires educator standing", async () => {
    mocks.auth.mockResolvedValue(ADMIN);
    mocks.findEducatorTeacher.mockResolvedValue(null);

    expect((await reopenClass(new Request("http://localhost"), { params })).status).toBe(403);
    expect(mocks.reopenClassroomClass).not.toHaveBeenCalled();
    // The read-side admin bypass is never consulted here, so it cannot widen who may reopen.
    expect(mocks.canEducatorReadClassroom).not.toHaveBeenCalled();
  });

  it("always reopens as the calling educator, never as the requested owner", async () => {
    mocks.auth.mockResolvedValue(EDUCATOR);

    const response = await reopenClass(new Request("http://localhost"), { params });

    expect(response.status).toBe(200);
    expect(mocks.reopenClassroomClass).toHaveBeenCalledWith({ classId: CLASS_ID, teacherId: TEACHER_ID });
    await expect(response.json()).resolves.toMatchObject({ reopened: true, accessCode: "NEWCODE-9Z8" });
  });

  it("answers 404 when the class is not the educator's to reopen", async () => {
    mocks.auth.mockResolvedValue(EDUCATOR);
    mocks.reopenClassroomClass.mockResolvedValue({ ok: false, reason: "not_found" });

    expect((await reopenClass(new Request("http://localhost"), { params })).status).toBe(404);
  });
});
