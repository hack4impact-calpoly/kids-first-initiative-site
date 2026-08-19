export const CLASSROOM_SESSION_KEY = "kfi_current_classroom_session";
const CLASSROOM_PROVENANCE_KEY = "kfi_classroom_session_provenance";
const CLASSROOM_PROVENANCE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type ClassroomSessionSnapshot = {
  sessionId: string;
  expiresAt: string;
  title?: string;
  displayName?: string;
  code?: string;
  participantId?: string;
};

type ClassroomSessionProvenance = {
  participantId: string;
  recordedAt: number;
};

function rememberClassroomParticipant(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return;

  const participantId = (snapshot as Partial<ClassroomSessionSnapshot>).participantId;
  if (typeof participantId !== "string" || participantId.length === 0) return;

  const provenance: ClassroomSessionProvenance = { participantId, recordedAt: Date.now() };
  window.localStorage.setItem(CLASSROOM_PROVENANCE_KEY, JSON.stringify(provenance));
}

export function clearClassroomSessionSnapshot() {
  if (typeof window === "undefined") return;

  try {
    const raw = window.localStorage.getItem(CLASSROOM_SESSION_KEY);
    if (raw) rememberClassroomParticipant(JSON.parse(raw));
  } catch {
    // Invalid or unavailable storage should not prevent clearing the active snapshot.
  }

  window.localStorage.removeItem(CLASSROOM_SESSION_KEY);
}

export function readClassroomParticipantProvenance(now = Date.now()) {
  if (typeof window === "undefined") return undefined;

  try {
    const raw = window.localStorage.getItem(CLASSROOM_PROVENANCE_KEY);
    if (!raw) return undefined;

    const parsed = JSON.parse(raw) as Partial<ClassroomSessionProvenance>;
    const isCurrent =
      typeof parsed.participantId === "string" &&
      parsed.participantId.length > 0 &&
      typeof parsed.recordedAt === "number" &&
      Number.isFinite(parsed.recordedAt) &&
      parsed.recordedAt <= now &&
      now - parsed.recordedAt <= CLASSROOM_PROVENANCE_MAX_AGE_MS;
    if (isCurrent) return parsed.participantId;
  } catch {
    // Invalid provenance is discarded below.
  }

  window.localStorage.removeItem(CLASSROOM_PROVENANCE_KEY);
  return undefined;
}

export function isClassroomSessionSnapshotActive(
  snapshot: unknown,
  now = Date.now(),
): snapshot is ClassroomSessionSnapshot {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return false;

  const candidate = snapshot as Partial<ClassroomSessionSnapshot>;
  const expiresAt = typeof candidate.expiresAt === "string" ? Date.parse(candidate.expiresAt) : NaN;
  return (
    typeof candidate.sessionId === "string" &&
    candidate.sessionId.length > 0 &&
    Number.isFinite(expiresAt) &&
    expiresAt > now
  );
}

export function readClassroomSessionSnapshot() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(CLASSROOM_SESSION_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (isClassroomSessionSnapshotActive(parsed)) return parsed;

    clearClassroomSessionSnapshot();
    return null;
  } catch {
    clearClassroomSessionSnapshot();
    return null;
  }
}

export function writeClassroomSessionSnapshot(snapshot: ClassroomSessionSnapshot) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(CLASSROOM_SESSION_KEY, JSON.stringify(snapshot));
  rememberClassroomParticipant(snapshot);
}
