export const CLASSROOM_SESSION_KEY = "kfi_current_classroom_session";
const CLASSROOM_PROVENANCE_MAX_AGE_MS = 30_000;

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
  pathname: string;
  documentTimeOrigin: number;
};

let pendingClassroomSessionProvenance: ClassroomSessionProvenance | undefined;

function rememberClassroomParticipant(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return;

  const participantId = (snapshot as Partial<ClassroomSessionSnapshot>).participantId;
  if (typeof participantId !== "string" || participantId.length === 0) return;

  pendingClassroomSessionProvenance = {
    participantId,
    recordedAt: Date.now(),
    pathname: window.location.pathname,
    documentTimeOrigin: window.performance.timeOrigin,
  };
}

export function clearClassroomSessionSnapshot(options?: { preserveParticipantForCurrentPage?: boolean }) {
  if (typeof window === "undefined") return;

  if (options?.preserveParticipantForCurrentPage) {
    try {
      const raw = window.localStorage.getItem(CLASSROOM_SESSION_KEY);
      if (raw) rememberClassroomParticipant(JSON.parse(raw));
    } catch {
      // Invalid or unavailable storage should not prevent clearing the active snapshot.
    }
  }

  window.localStorage.removeItem(CLASSROOM_SESSION_KEY);
}

export function readClassroomParticipantProvenance(now = Date.now()) {
  if (typeof window === "undefined") return undefined;

  const provenance = pendingClassroomSessionProvenance;
  const isCurrent =
    provenance &&
    provenance.pathname === window.location.pathname &&
    provenance.documentTimeOrigin === window.performance.timeOrigin &&
    provenance.recordedAt <= now &&
    now - provenance.recordedAt <= CLASSROOM_PROVENANCE_MAX_AGE_MS;
  return isCurrent ? provenance.participantId : undefined;
}

export function clearClassroomParticipantProvenance() {
  pendingClassroomSessionProvenance = undefined;
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

    clearClassroomSessionSnapshot({ preserveParticipantForCurrentPage: true });
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
