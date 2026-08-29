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
  resolveClassroomOwnerKeys,
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

describe("resolveClassroomOwnerKeys", () => {
  afterEach(() => vi.restoreAllMocks());

  const ROOT = new mongoose.Types.ObjectId();
  const CONTINUATION = new mongoose.Types.ObjectId();
  const OLD_PARTICIPANT = new mongoose.Types.ObjectId();
  const NEW_PARTICIPANT = new mongoose.Types.ObjectId();

  const participant = (sessionId: string, participantId: string) => ({
    participantId,
    sessionId,
    displayName: "Ada",
    clerkId: "clerk-student",
  });

  function stubChain(options: { chain: mongoose.Types.ObjectId[]; siblings: mongoose.Types.ObjectId[] }) {
    vi.spyOn(ClassroomSession, "findOne").mockReturnValue({
      select: () => ({ lean: async () => ({ _id: CONTINUATION, rootSessionId: ROOT }) }),
    } as never);
    vi.spyOn(ClassroomSession, "find").mockReturnValue({
      select: () => ({ lean: async () => options.chain.map((id) => ({ _id: id })) }),
    } as never);
    vi.spyOn(ClassroomParticipant, "findOne").mockReturnValue({
      select: () => ({ lean: async () => ({ participantKey: "clerk:clerk-student" }) }),
    } as never);
    vi.spyOn(ClassroomParticipant, "find").mockReturnValue({
      select: () => ({ sort: () => ({ lean: async () => options.siblings.map((id) => ({ _id: id })) }) }),
    } as never);
  }

  it("includes the student's earlier participant rows in the same class", async () => {
    stubChain({ chain: [ROOT, CONTINUATION], siblings: [NEW_PARTICIPANT, OLD_PARTICIPANT] });

    const keys = await resolveClassroomOwnerKeys(participant(String(CONTINUATION), String(NEW_PARTICIPANT)));

    // Current key first, so callers that want "most current" can take the head.
    expect(keys).toEqual([`participant:${NEW_PARTICIPANT}`, `participant:${OLD_PARTICIPANT}`]);
  });

  it("only matches rows sharing the caller's own participantKey", async () => {
    stubChain({ chain: [ROOT, CONTINUATION], siblings: [NEW_PARTICIPANT] });

    await resolveClassroomOwnerKeys(participant(String(CONTINUATION), String(NEW_PARTICIPANT)));

    // The key is what scopes this to one student; without it the chain query would return the
    // whole class roster.
    expect(ClassroomParticipant.find).toHaveBeenCalledWith(
      expect.objectContaining({ participantKey: "clerk:clerk-student" }),
    );
  });

  it("stays within the class chain rather than searching every session", async () => {
    stubChain({ chain: [ROOT, CONTINUATION], siblings: [NEW_PARTICIPANT] });

    await resolveClassroomOwnerKeys(participant(String(CONTINUATION), String(NEW_PARTICIPANT)));

    expect(ClassroomSession.find).toHaveBeenCalledWith({ $or: [{ _id: ROOT }, { rootSessionId: ROOT }] });
    const participantQuery = (ClassroomParticipant.find as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0][0];
    expect(participantQuery).toMatchObject({ sessionId: { $in: [ROOT, CONTINUATION] } });
  });

  it("returns only the current key for a class that has never been reopened", async () => {
    stubChain({ chain: [ROOT], siblings: [NEW_PARTICIPANT, OLD_PARTICIPANT] });

    const keys = await resolveClassroomOwnerKeys(participant(String(ROOT), String(NEW_PARTICIPANT)));

    // A single-session chain cannot have lineage, so it short-circuits before querying participants.
    expect(keys).toEqual([`participant:${NEW_PARTICIPANT}`]);
    expect(ClassroomParticipant.find).not.toHaveBeenCalled();
  });

  it("falls back to the current key when the session cannot be found", async () => {
    vi.spyOn(ClassroomSession, "findOne").mockReturnValue({
      select: () => ({ lean: async () => null }),
    } as never);

    const keys = await resolveClassroomOwnerKeys(participant(String(CONTINUATION), String(NEW_PARTICIPANT)));

    expect(keys).toEqual([`participant:${NEW_PARTICIPANT}`]);
  });

  it("falls back to the current key for a malformed session id", async () => {
    const keys = await resolveClassroomOwnerKeys(participant("not-an-object-id", String(NEW_PARTICIPANT)));

    expect(keys).toEqual([`participant:${NEW_PARTICIPANT}`]);
  });
});
