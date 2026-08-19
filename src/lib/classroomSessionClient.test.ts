import { describe, expect, it } from "vitest";
import { isClassroomSessionSnapshotActive } from "@/lib/classroomSessionClient";

describe("classroom session snapshots", () => {
  const now = Date.parse("2030-01-01T12:00:00.000Z");

  it("accepts a classroom snapshot before its server expiry", () => {
    expect(
      isClassroomSessionSnapshotActive(
        { sessionId: "session-1", participantId: "participant-1", expiresAt: "2030-01-01T13:00:00.000Z" },
        now,
      ),
    ).toBe(true);
  });

  it("rejects expired, legacy, and malformed snapshots", () => {
    expect(
      isClassroomSessionSnapshotActive({ sessionId: "session-1", expiresAt: "2030-01-01T11:00:00.000Z" }, now),
    ).toBe(false);
    expect(isClassroomSessionSnapshotActive({ sessionId: "session-1" }, now)).toBe(false);
    expect(isClassroomSessionSnapshotActive("not-a-snapshot", now)).toBe(false);
  });
});
