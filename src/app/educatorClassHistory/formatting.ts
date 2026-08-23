import { ClassroomSessionState } from "@/lib/server/classroomHistory";
import styles from "./educatorClassHistory.module.css";

export const STATE_LABELS: Record<ClassroomSessionState, string> = {
  active: "Active",
  expired: "Expired",
  closed: "Closed",
};

export const STATE_BADGE_CLASS: Record<ClassroomSessionState, string> = {
  active: styles.badgeActive,
  expired: styles.badgeExpired,
  closed: styles.badgeClosed,
};

export function formatDateTime(value: Date | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

export function formatScore(value: number | null) {
  return value === null ? "—" : `${Math.round(value)}%`;
}
