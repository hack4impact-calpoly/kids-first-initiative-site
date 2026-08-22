import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import ClassroomParticipant from "@/database/classroomParticipantSchema";
import ClassroomSession from "@/database/classroomSessionSchema";
import {
  authorizeClassroomParticipant,
  createClassroomCredential,
  hashClassroomSecret,
  parseClassroomCredential,
  resolveDataPrincipal,
  resolveDataPrincipalFromCredential,
  setClassroomCredentialCookie,
} from "@/lib/server/classroomAuthorization";

describe("classroom participant credentials", () => {
  afterEach(() => vi.restoreAllMocks());

  it("creates an opaque credential that resolves to the intended participant", () => {
    const participantId = new mongoose.Types.ObjectId().toString();
    const credential = createClassroomCredential(participantId);
    const parsed = parseClassroomCredential(credential.cookieValue);

    expect(parsed).toEqual({ participantId, tokenHash: credential.tokenHash });
    expect(credential.cookieValue).not.toContain(credential.tokenHash);
  });

  it("rejects malformed or truncated credentials", () => {
    const participantId = new mongoose.Types.ObjectId().toString();
    expect(parseClassroomCredential(undefined)).toBeNull();
    expect(parseClassroomCredential("not-a-credential")).toBeNull();
    expect(parseClassroomCredential(`${participantId}.short`)).toBeNull();
  });

  it("changes the stored digest when a token is tampered with", () => {
    expect(hashClassroomSecret("a-valid-secret-value")).not.toBe(hashClassroomSecret("a-tampered-secret-value"));
  });

  it("sets the credential as an HTTP-only same-origin cookie", () => {
    const response = NextResponse.json({ ok: true });
    setClassroomCredentialCookie(response, "participant.secret", new Date("2030-01-01T00:00:00.000Z"));

    const header = response.headers.get("set-cookie");
    expect(header).toContain("kfi_classroom_access=participant.secret");
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=lax");
    expect(header).toContain("Path=/");
  });

  it("authorizes a guest only when the cookie digest matches the claimed participant", async () => {
    const participantId = new mongoose.Types.ObjectId().toString();
    const sessionId = new mongoose.Types.ObjectId();
    const credential = createClassroomCredential(participantId);
    const lean = vi.fn().mockResolvedValue({
      _id: new mongoose.Types.ObjectId(participantId),
      sessionId,
      clerkId: null,
      displayName: "Student",
    });
    const findOne = vi.spyOn(ClassroomParticipant, "findOne").mockReturnValue({ lean } as never);
    vi.spyOn(ClassroomSession, "exists").mockResolvedValue({ _id: sessionId } as never);

    const request = new NextRequest("http://localhost/api/gameData", {
      headers: { cookie: `kfi_classroom_access=${credential.cookieValue}` },
    });
    const result = await authorizeClassroomParticipant(request, { userId: null, role: null }, participantId);

    expect(result).toMatchObject({
      ok: true,
      value: { participantId, sessionId: String(sessionId), displayName: "Student", clerkId: null },
    });
    expect(findOne).toHaveBeenCalledWith({
      _id: participantId,
      authTokenHash: credential.tokenHash,
      clerkId: null,
    });
  });

  it("rejects a guest who claims a different participant", async () => {
    const credentialParticipantId = new mongoose.Types.ObjectId().toString();
    const claimedParticipantId = new mongoose.Types.ObjectId().toString();
    const credential = createClassroomCredential(credentialParticipantId);
    const request = new NextRequest("http://localhost/api/gameData", {
      headers: { cookie: `kfi_classroom_access=${credential.cookieValue}` },
    });

    const result = await authorizeClassroomParticipant(request, { userId: null, role: null }, claimedParticipantId);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it("uses the classroom participant as owner even when the student is signed in", async () => {
    const participantId = new mongoose.Types.ObjectId().toString();
    const sessionId = new mongoose.Types.ObjectId();
    const lean = vi.fn().mockResolvedValue({
      _id: new mongoose.Types.ObjectId(participantId),
      sessionId,
      clerkId: "clerk-student",
      displayName: "Signed-in Student",
    });
    vi.spyOn(ClassroomParticipant, "findOne").mockReturnValue({ lean } as never);
    vi.spyOn(ClassroomSession, "exists").mockResolvedValue({ _id: sessionId } as never);

    const request = new NextRequest("http://localhost/api/quiz");
    const result = await resolveDataPrincipal(request, { userId: "clerk-student", role: "player" }, participantId);

    expect(result).toMatchObject({
      ok: true,
      value: {
        ownerId: `participant:${participantId}`,
        classroom: { participantId, sessionId: String(sessionId), clerkId: "clerk-student" },
      },
    });
  });

  it("uses the signed-in student's classroom credential when a read has no participant claim", async () => {
    const participantId = new mongoose.Types.ObjectId().toString();
    const sessionId = new mongoose.Types.ObjectId();
    const credential = createClassroomCredential(participantId);
    const lean = vi.fn().mockResolvedValue({
      _id: new mongoose.Types.ObjectId(participantId),
      sessionId,
      clerkId: "clerk-student",
      displayName: "Signed-in Student",
    });
    const findOne = vi.spyOn(ClassroomParticipant, "findOne").mockReturnValue({ lean } as never);
    vi.spyOn(ClassroomSession, "exists").mockResolvedValue({ _id: sessionId } as never);

    const request = new NextRequest("http://localhost/api/gameData/save-1", {
      headers: { cookie: `kfi_classroom_access=${credential.cookieValue}` },
    });
    const result = await resolveDataPrincipal(request, { userId: "clerk-student", role: "player" });

    expect(result).toMatchObject({
      ok: true,
      value: {
        ownerId: `participant:${participantId}`,
        classroom: { participantId, sessionId: String(sessionId), clerkId: "clerk-student" },
      },
    });
    expect(findOne).toHaveBeenCalledWith({
      _id: participantId,
      clerkId: "clerk-student",
      authTokenHash: credential.tokenHash,
    });
  });

  it("resolves a server-rendered read from the classroom cookie without a client claim", async () => {
    const participantId = new mongoose.Types.ObjectId().toString();
    const sessionId = new mongoose.Types.ObjectId();
    const credential = createClassroomCredential(participantId);
    const lean = vi.fn().mockResolvedValue({
      _id: new mongoose.Types.ObjectId(participantId),
      sessionId,
      clerkId: null,
      displayName: "Guest Student",
    });
    const findOne = vi.spyOn(ClassroomParticipant, "findOne").mockReturnValue({ lean } as never);
    vi.spyOn(ClassroomSession, "exists").mockResolvedValue({ _id: sessionId } as never);

    const result = await resolveDataPrincipalFromCredential(credential.cookieValue, { userId: null, role: null });

    expect(result).toMatchObject({
      ok: true,
      value: {
        ownerId: `participant:${participantId}`,
        classroom: { participantId, sessionId: String(sessionId) },
      },
    });
    expect(findOne).toHaveBeenCalledWith({
      _id: participantId,
      authTokenHash: credential.tokenHash,
      clerkId: null,
    });
  });

  it("does not resolve an expired or invalid server classroom credential", async () => {
    const result = await resolveDataPrincipalFromCredential("invalid", { userId: null, role: null });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });
});
