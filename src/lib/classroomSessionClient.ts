export const CLASSROOM_SESSION_KEY = "kfi_current_classroom_session";

export type ClassroomSessionSnapshot = {
  sessionId: string;
  expiresAt: string;
  title?: string;
  displayName?: string;
  code?: string;
  participantId?: string;
};

export function clearClassroomSessionSnapshot() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CLASSROOM_SESSION_KEY);
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
}
