import mongoose from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sessionFind: vi.fn(),
  sessionUpdateMany: vi.fn(),
  codeCreate: vi.fn(),
  codeUpdateMany: vi.fn(),
  userFindOne: vi.fn(),
  teacherFindOneAndUpdate: vi.fn(),
}));

vi.mock("@/database/classroomSessionSchema", () => ({
  default: { find: mocks.sessionFind, updateMany: mocks.sessionUpdateMany },
}));
vi.mock("@/database/studentAccessCodeSchema", () => ({
  default: { create: mocks.codeCreate, updateMany: mocks.codeUpdateMany },
}));
vi.mock("@/database/userSchema", () => ({ default: { findOne: mocks.userFindOne } }));
vi.mock("@/database/teacherSchema", () => ({ default: { findOneAndUpdate: mocks.teacherFindOneAndUpdate } }));

import {
  closeActiveClassroomSessions,
  generateAccessCode,
  getTeacherForCurrentUser,
  issueAccessCode,
} from "@/lib/server/educatorClassroom";

const NOW = new Date("2026-08-22T18:00:00.000Z");
const TEACHER_ID = new mongoose.Types.ObjectId();
const SESSION_A = new mongoose.Types.ObjectId();
const SESSION_B = new mongoose.Types.ObjectId();

function duplicateKeyError() {
  return Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
}

describe("closeActiveClassroomSessions", () => {
  beforeEach(() => {
    mocks.sessionFind.mockReturnValue({ lean: () => Promise.resolve([{ _id: SESSION_A }, { _id: SESSION_B }]) });
    mocks.sessionUpdateMany.mockResolvedValue({});
    mocks.codeUpdateMany.mockResolvedValue({});
  });

  it("closes every active session and deactivates its codes", async () => {
    const closed = await closeActiveClassroomSessions(TEACHER_ID, { now: NOW });

    expect(closed).toEqual([SESSION_A, SESSION_B]);
    expect(mocks.sessionUpdateMany).toHaveBeenCalledWith(
      { _id: { $in: [SESSION_A, SESSION_B] } },
      { $set: { status: "closed", closedAt: NOW } },
    );
    expect(mocks.codeUpdateMany).toHaveBeenCalledWith(
      { sessionId: { $in: [SESSION_A, SESSION_B] }, isActive: true },
      { $set: { isActive: false } },
    );
  });

  it("spares the sessions the caller asked to keep open", async () => {
    const closed = await closeActiveClassroomSessions(TEACHER_ID, { exceptSessionIds: [SESSION_A], now: NOW });

    expect(closed).toEqual([SESSION_B]);
    expect(mocks.sessionUpdateMany).toHaveBeenCalledWith({ _id: { $in: [SESSION_B] } }, expect.anything());
  });

  it("does not write anything when every session is already excluded", async () => {
    const closed = await closeActiveClassroomSessions(TEACHER_ID, {
      exceptSessionIds: [SESSION_A, SESSION_B],
      now: NOW,
    });

    expect(closed).toEqual([]);
    expect(mocks.sessionUpdateMany).not.toHaveBeenCalled();
    expect(mocks.codeUpdateMany).not.toHaveBeenCalled();
  });
});

describe("issueAccessCode", () => {
  it("retries past a colliding code and returns the one that stuck", async () => {
    mocks.codeCreate.mockRejectedValueOnce(duplicateKeyError()).mockResolvedValueOnce({});

    const code = await issueAccessCode(SESSION_A);

    expect(mocks.codeCreate).toHaveBeenCalledTimes(2);
    expect(code).toBe(mocks.codeCreate.mock.calls[1][0].code);
    expect(code).toMatch(/^[A-Z]{6}-[A-Z0-9]{3}$/);
  });

  it("surfaces failures that are not collisions instead of burning retries", async () => {
    mocks.codeCreate.mockRejectedValue(new Error("connection lost"));

    await expect(issueAccessCode(SESSION_A)).rejects.toThrow("connection lost");
    expect(mocks.codeCreate).toHaveBeenCalledTimes(1);
  });

  it("gives up after repeated collisions rather than looping", async () => {
    mocks.codeCreate.mockRejectedValue(duplicateKeyError());

    await expect(issueAccessCode(SESSION_A)).rejects.toThrow(/duplicate key/);
    expect(mocks.codeCreate).toHaveBeenCalledTimes(5);
  });
});

describe("generateAccessCode", () => {
  it("produces a six letter prefix and three alphanumeric suffix", () => {
    for (let attempt = 0; attempt < 25; attempt += 1) {
      expect(generateAccessCode()).toMatch(/^[A-Z]{6}-[A-Z0-9]{3}$/);
    }
  });
});

describe("getTeacherForCurrentUser", () => {
  it("refuses users who are not educators", async () => {
    mocks.userFindOne.mockReturnValue({ lean: () => Promise.resolve({ role: "player" }) });

    const result = await getTeacherForCurrentUser("user_1");

    expect("error" in result && result.error.status).toBe(403);
    expect(mocks.teacherFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("refuses signed-in users with no stored profile", async () => {
    mocks.userFindOne.mockReturnValue({ lean: () => Promise.resolve(null) });

    const result = await getTeacherForCurrentUser("user_1");

    expect("error" in result && result.error.status).toBe(403);
  });

  it("returns the educator's teacher id", async () => {
    mocks.userFindOne.mockReturnValue({
      lean: () => Promise.resolve({ role: "educator", name: "Ada", email: "ada@example.com" }),
    });
    mocks.teacherFindOneAndUpdate.mockReturnValue({ lean: () => Promise.resolve({ _id: TEACHER_ID }) });

    const result = await getTeacherForCurrentUser("user_1");

    expect(result).toEqual({ teacherId: TEACHER_ID });
  });
});
