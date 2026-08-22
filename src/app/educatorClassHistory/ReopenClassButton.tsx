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
  const [accessCode, setAccessCode] = useState<string | null>(null);

  const handleReopen = async () => {
    setPending(true);
    setError("");

    try {
      const response = await fetch(`/api/classroom-sessions/history/${encodeURIComponent(classId)}/reopen`, {
        method: "POST",
      });
      const result = (await response.json()) as ReopenResponse;

      if (!response.ok) {
        throw new Error(result.error || "Unable to reopen this class.");
      }

      setAccessCode(result.accessCode ?? null);
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
      {accessCode ? (
        <p className={styles.reopenSuccess} role="status">
          Class reopened. New access code: <span className={styles.accessCodeInline}>{accessCode}</span>
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
