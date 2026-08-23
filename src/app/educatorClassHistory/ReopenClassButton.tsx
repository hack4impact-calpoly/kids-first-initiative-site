"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./educatorClassHistory.module.css";

type ReopenResponse = {
  error?: string;
  reopened?: boolean;
  accessCode?: string | null;
};

export default function ReopenClassButton({ classId, className }: { classId: string; className: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<{ reopened: boolean; accessCode: string | null } | null>(null);

  const handleReopen = async () => {
    setPending(true);
    setError("");
    // A previous success must not stay on screen next to a new failure — it would show an access
    // code the failed request never issued.
    setOutcome(null);

    try {
      const response = await fetch(`/api/classroom-sessions/history/${encodeURIComponent(classId)}/reopen`, {
        method: "POST",
      });
      const result = (await response.json()) as ReopenResponse;

      if (!response.ok) {
        throw new Error(result.error || "Unable to reopen this class.");
      }

      // `reopened: false` means the class was already live — a stale page, a second tab, or a
      // double submit. Saying "reopened" there would claim an action that never happened.
      setOutcome({ reopened: Boolean(result.reopened), accessCode: result.accessCode ?? null });
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to reopen this class.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={styles.reopenPanel}>
      <button type="button" className={styles.reopenButton} onClick={handleReopen} disabled={pending}>
        {pending ? "Reopening..." : "Reopen class"}
      </button>
      <p className={styles.mutedText}>
        Reopening {className} starts a new session linked to this class. Past rosters, game saves, and quiz results stay
        exactly as they are, and any other class you have open will be closed.
      </p>
      {outcome ? (
        <p className={styles.reopenSuccess} role="status">
          {outcome.reopened ? "Class reopened." : "This class was already open."}{" "}
          {outcome.accessCode ? (
            <>
              {outcome.reopened ? "New access code" : "Access code"}:{" "}
              <span className={styles.accessCodeInline}>{outcome.accessCode}</span>
            </>
          ) : (
            "Refresh to see its current access code."
          )}
        </p>
      ) : null}
      {error ? (
        <p className={styles.reopenError} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
