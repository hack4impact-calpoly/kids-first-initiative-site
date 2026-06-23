export const CLASSROOM_SESSION_KEY = "kfi_current_classroom_session";

export type ClassroomSessionSnapshot = {
  sessionId: string;
  title?: string;
  displayName?: string;
  code?: string;
  participantId?: string;
};

export function readClassroomSessionSnapshot() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(CLASSROOM_SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as ClassroomSessionSnapshot;
    return parsed?.sessionId ? parsed : null;
  } catch {
    return null;
  }
}

export function writeClassroomSessionSnapshot(snapshot: ClassroomSessionSnapshot) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(CLASSROOM_SESSION_KEY, JSON.stringify(snapshot));
}
