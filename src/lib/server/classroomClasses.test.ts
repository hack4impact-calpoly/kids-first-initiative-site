import mongoose from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sessionFindOne: vi.fn(),
  sessionFind: vi.fn(),
  sessionUpdateOne: vi.fn(),
  sessionDeleteOne: vi.fn(),
  sessionCreate: vi.fn(),
  codeFindOne: vi.fn(),
  codeUpdateMany: vi.fn(),
  closeActiveClassroomSessions: vi.fn(),
  issueAccessCode: vi.fn(),
}));

vi.mock("@/database/classroomSessionSchema", () => ({
  default: {
    findOne: mocks.sessionFindOne,
    find: mocks.sessionFind,
    updateOne: mocks.sessionUpdateOne,
    deleteOne: mocks.sessionDeleteOne,
    create: mocks.sessionCreate,
  },
}));
vi.mock("@/database/studentAccessCodeSchema", () => ({
  default: { findOne: mocks.codeFindOne, updateMany: mocks.codeUpdateMany, find: vi.fn() },
}));
vi.mock("@/database/classroomParticipantSchema", () => ({ default: { find: vi.fn() } }));
vi.mock("@/database/gameDataSchema", () => ({ default: { find: vi.fn() } }));
vi.mock("@/database/quizSchema", () => ({ default: { find: vi.fn() } }));
vi.mock("@/lib/server/educatorClassroom", () => ({
  SESSION_DURATION_MS: 8 * 60 * 60 * 1000,
  closeActiveClassroomSessions: mocks.closeActiveClassroomSessions,
  issueAccessCode: mocks.issueAccessCode,
}));

import { parseClassPageLimit, parseClassPageOffset, reopenClassroomClass } from "@/lib/server/classroomClasses";

const NOW = new Date("2026-08-22T18:00:00.000Z");
const TEACHER_ID = new mongoose.Types.ObjectId();
const ROOT_ID = new mongoose.Types.ObjectId();
const CONTINUATION_ID = new mongoose.Types.ObjectId();
const NEW_SESSION_ID = new mongoose.Types.ObjectId();

const EXPIRED_ROOT = {
  _id: ROOT_ID,
  title: "4th Grade Science",
  status: "active" as const,
  createdAt: new Date("2026-08-20T09:00:00.000Z"),
  expiresAt: new Date("2026-08-20T17:00:00.000Z"),
  closedAt: null,
  rootSessionId: null,
};

function leanOf(value: unknown) {
  return { lean: () => Promise.resolve(value) };
}

/** Mirrors `find().select().sort().lean()` on the chain query. */
function sortLeanOf(value: unknown) {
  return { select: () => ({ sort: () => ({ lean: () => Promise.resolve(value) }) }) };
}

/** Answers the root lookup with `rootRecord` and the chain query with `chain`. */
function stubChain(rootRecord: unknown, chain: unknown[]) {
  mocks.sessionFindOne.mockReturnValue(leanOf(rootRecord));
  mocks.sessionFind.mockReturnValue(sortLeanOf(chain));
}

describe("reopenClassroomClass", () => {
  beforeEach(() => {
    mocks.sessionUpdateOne.mockResolvedValue({});
    mocks.sessionDeleteOne.mockResolvedValue({});
    mocks.codeUpdateMany.mockResolvedValue({});
    mocks.closeActiveClassroomSessions.mockResolvedValue([]);
    mocks.issueAccessCode.mockResolvedValue("NEWCODE-9Z8");
    mocks.sessionCreate.mockResolvedValue({ _id: NEW_SESSION_ID });
  });

  it("rejects an id that is not a classroom session id", async () => {
    const result = await reopenClassroomClass({ classId: "not-an-object-id", teacherId: TEACHER_ID, now: NOW });

    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(mocks.sessionCreate).not.toHaveBeenCalled();
  });

  it("refuses to reopen a class that does not belong to the educator", async () => {
    // The teacher-scoped lookup finds nothing, which is how another educator's class presents.
    stubChain(null, []);

    const result = await reopenClassroomClass({
      classId: String(ROOT_ID),
      teacherId: TEACHER_ID,
      now: NOW,
    });

    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect(mocks.sessionFindOne).toHaveBeenCalledWith(expect.objectContaining({ teacherId: TEACHER_ID }));
    expect(mocks.sessionCreate).not.toHaveBeenCalled();
    expect(mocks.closeActiveClassroomSessions).not.toHaveBeenCalled();
  });

  it("appends a linked continuation and issues a fresh code when reopening an expired class", async () => {
    stubChain(EXPIRED_ROOT, [EXPIRED_ROOT]);

    const result = await reopenClassroomClass({ classId: String(ROOT_ID), teacherId: TEACHER_ID, now: NOW });

    expect(result).toMatchObject({
      ok: true,
      reopened: true,
      classId: String(ROOT_ID),
      sessionId: String(NEW_SESSION_ID),
      accessCode: "NEWCODE-9Z8",
    });

    // The continuation points back at the session it continues and at the class root.
    expect(mocks.sessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        teacherId: TEACHER_ID,
        title: "4th Grade Science",
        status: "active",
        continuedFromId: ROOT_ID,
        rootSessionId: ROOT_ID,
        closedAt: null,
      }),
    );
    expect(mocks.sessionCreate.mock.calls[0][0].expiresAt).toEqual(new Date("2026-08-23T02:00:00.000Z"));
    expect(mocks.issueAccessCode).toHaveBeenCalledWith(NEW_SESSION_ID);
  });

  it("retires every code the class ever issued so a stale code cannot rejoin", async () => {
    const continuation = { ...EXPIRED_ROOT, _id: CONTINUATION_ID, rootSessionId: ROOT_ID };
    stubChain(EXPIRED_ROOT, [EXPIRED_ROOT, continuation]);

    await reopenClassroomClass({ classId: String(ROOT_ID), teacherId: TEACHER_ID, now: NOW });

    expect(mocks.codeUpdateMany).toHaveBeenCalledWith(
      { sessionId: { $in: [ROOT_ID, CONTINUATION_ID] }, isActive: true },
      { $set: { isActive: false } },
    );
  });

  it("closes any other class the educator still has open, sparing this whole chain", async () => {
    stubChain(EXPIRED_ROOT, [EXPIRED_ROOT]);

    await reopenClassroomClass({ classId: String(ROOT_ID), teacherId: TEACHER_ID, now: NOW });

    // Excluded by chain root, not by a list of session ids read earlier: a concurrent reopen can
    // append a continuation in between, and a stale list would close it as an unrelated class.
    expect(mocks.closeActiveClassroomSessions).toHaveBeenCalledWith(TEACHER_ID, {
      exceptChainRootId: String(ROOT_ID),
      now: NOW,
    });
  });

  it("closes the educator's other class only after the reopen has succeeded", async () => {
    stubChain(EXPIRED_ROOT, [EXPIRED_ROOT]);
    mocks.issueAccessCode.mockRejectedValue(new Error("no code available"));

    await expect(reopenClassroomClass({ classId: String(ROOT_ID), teacherId: TEACHER_ID, now: NOW })).rejects.toThrow(
      "no code available",
    );

    // Otherwise a failed reopen would leave another class's students locked out for nothing.
    expect(mocks.closeActiveClassroomSessions).not.toHaveBeenCalled();
  });

  it("closes an expired session against its own expiry rather than the reopen time", async () => {
    stubChain(EXPIRED_ROOT, [EXPIRED_ROOT]);

    await reopenClassroomClass({ classId: String(ROOT_ID), teacherId: TEACHER_ID, now: NOW });

    expect(mocks.sessionUpdateOne).toHaveBeenCalledWith(
      { _id: ROOT_ID },
      { $set: { status: "closed", closedAt: EXPIRED_ROOT.expiresAt } },
    );
  });

  it("leaves a live class untouched and hands back the code it already has", async () => {
    const liveSession = {
      ...EXPIRED_ROOT,
      expiresAt: new Date(NOW.getTime() + 60_000),
    };
    stubChain(liveSession, [liveSession]);
    mocks.codeFindOne.mockReturnValue(leanOf({ code: "LIVECODE-1A2" }));

    const result = await reopenClassroomClass({ classId: String(ROOT_ID), teacherId: TEACHER_ID, now: NOW });

    expect(result).toMatchObject({ ok: true, reopened: false, accessCode: "LIVECODE-1A2" });
    expect(mocks.sessionCreate).not.toHaveBeenCalled();
    expect(mocks.codeUpdateMany).not.toHaveBeenCalled();
    expect(mocks.closeActiveClassroomSessions).not.toHaveBeenCalled();
  });

  it("deletes the continuation when no access code can be issued", async () => {
    stubChain(EXPIRED_ROOT, [EXPIRED_ROOT]);
    mocks.issueAccessCode.mockRejectedValue(new Error("no code available"));

    await expect(reopenClassroomClass({ classId: String(ROOT_ID), teacherId: TEACHER_ID, now: NOW })).rejects.toThrow(
      "no code available",
    );

    // Closing it instead would leave a phantom newest session that hijacks the class's title,
    // expiry, and reopen count, and renders in the timeline as a continuation nobody ever joined.
    expect(mocks.sessionDeleteOne).toHaveBeenCalledWith({ _id: NEW_SESSION_ID });
    expect(mocks.sessionUpdateOne).not.toHaveBeenCalledWith({ _id: NEW_SESSION_ID }, expect.anything());
  });

  it("yields to a concurrent reopen instead of creating a second live session", async () => {
    stubChain(EXPIRED_ROOT, [EXPIRED_ROOT]);
    // The unique partial index rejects the second continuation of the same chain.
    mocks.sessionCreate.mockRejectedValue(Object.assign(new Error("E11000 duplicate key"), { code: 11000 }));
    mocks.sessionFindOne.mockReturnValueOnce(leanOf(EXPIRED_ROOT)).mockReturnValueOnce({
      sort: () => leanOf({ ...EXPIRED_ROOT, _id: CONTINUATION_ID, expiresAt: new Date(NOW.getTime() + 60_000) }),
    });
    mocks.codeFindOne.mockReturnValue(leanOf({ code: "WINNER-1A2" }));

    const result = await reopenClassroomClass({ classId: String(ROOT_ID), teacherId: TEACHER_ID, now: NOW });

    expect(result).toMatchObject({
      ok: true,
      reopened: false,
      sessionId: String(CONTINUATION_ID),
      accessCode: "WINNER-1A2",
    });
    expect(mocks.issueAccessCode).not.toHaveBeenCalled();
  });

  it("surfaces a create failure that is not a uniqueness collision", async () => {
    stubChain(EXPIRED_ROOT, [EXPIRED_ROOT]);
    mocks.sessionCreate.mockRejectedValue(new Error("connection lost"));

    await expect(reopenClassroomClass({ classId: String(ROOT_ID), teacherId: TEACHER_ID, now: NOW })).rejects.toThrow(
      "connection lost",
    );
  });

  it("normalizes a continuation id to the class root before reopening", async () => {
    const continuation = { ...EXPIRED_ROOT, _id: CONTINUATION_ID, rootSessionId: ROOT_ID };
    stubChain(continuation, [EXPIRED_ROOT, continuation]);

    const result = await reopenClassroomClass({
      classId: String(CONTINUATION_ID),
      teacherId: TEACHER_ID,
      now: NOW,
    });

    expect(result).toMatchObject({ ok: true, reopened: true, classId: String(ROOT_ID) });
    // The chain is re-queried from the root, not from the id the caller happened to hold.
    expect(mocks.sessionFind).toHaveBeenCalledWith(
      expect.objectContaining({ $or: [{ _id: ROOT_ID }, { rootSessionId: ROOT_ID }] }),
    );
    expect(mocks.sessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ continuedFromId: CONTINUATION_ID, rootSessionId: ROOT_ID }),
    );
  });
});

describe("class page parameters", () => {
  it("falls back to the default page size for missing or nonsense limits", () => {
    expect(parseClassPageLimit(undefined)).toBe(25);
    expect(parseClassPageLimit("0")).toBe(25);
    expect(parseClassPageLimit("-5")).toBe(25);
    expect(parseClassPageLimit("banana")).toBe(25);
  });

  it("caps the page size rather than honouring an arbitrary one", () => {
    expect(parseClassPageLimit("50")).toBe(50);
    expect(parseClassPageLimit("100000")).toBe(200);
  });

  it("treats a missing or negative offset as the first page", () => {
    expect(parseClassPageOffset(undefined)).toBe(0);
    expect(parseClassPageOffset("-3")).toBe(0);
    expect(parseClassPageOffset("banana")).toBe(0);
    expect(parseClassPageOffset("40")).toBe(40);
  });
});
