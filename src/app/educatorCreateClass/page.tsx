"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./educatorCreateClass.module.css";

type ClassroomParticipant = {
  id: string;
  displayName: string;
  joinedAt: string;
  lastSeenAt: string;
};

type ClassroomSession = {
  sessionId: string;
  title: string;
  accessCode: string;
  participants: ClassroomParticipant[];
};

const DEFAULT_CLASS_NAME = "Untitled Class";

function formatJoinTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

async function loadCurrentSession() {
  const response = await fetch("/api/classroom-sessions", { cache: "no-store" });
  const result = (await response.json()) as { error?: string; session?: ClassroomSession | null };

  if (!response.ok) {
    throw new Error(result.error || "Unable to load classroom session.");
  }

  return result.session ?? null;
}

async function requestNewSession(title: string) {
  const response = await fetch("/api/classroom-sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title }),
  });
  const result = (await response.json()) as { error?: string; session?: ClassroomSession | null };

  if (!response.ok || !result.session) {
    throw new Error(result.error || "Unable to start a classroom session.");
  }

  return result.session;
}

export default function EducatorDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [className, setClassName] = useState("");
  const [session, setSession] = useState<ClassroomSession | null>(null);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState("");
  const hasInitialized = useRef(false);
  const shouldStartFresh = searchParams.get("fresh") === "1";

  const accessCode = session?.accessCode ?? "Loading...";
  const resolvedClassName = className.trim() || session?.title || DEFAULT_CLASS_NAME;
  const participantCount = session?.participants.length ?? 0;

  const shareLink = useMemo(() => {
    if (typeof window === "undefined") {
      return `/login/player?code=${encodeURIComponent(accessCode)}`;
    }

    return `${window.location.origin}/login/player?code=${encodeURIComponent(accessCode)}`;
  }, [accessCode]);

  const createSession = async (titleOverride?: string) => {
    const nextSession = await requestNewSession((titleOverride ?? className).trim() || DEFAULT_CLASS_NAME);

    setSession(nextSession);
    setClassName(nextSession.title === DEFAULT_CLASS_NAME && !className.trim() ? "" : nextSession.title);
    setCopied(false);
    setShared(false);
    setError("");
    return nextSession;
  };

  useEffect(() => {
    let ignore = false;

    const initialize = async () => {
      setLoading(true);
      try {
        const currentSession = await loadCurrentSession();
        if (ignore) return;

        if (shouldStartFresh && !hasInitialized.current) {
          hasInitialized.current = true;
          const nextSession = await requestNewSession(DEFAULT_CLASS_NAME);
          if (ignore) return;
          setSession(nextSession);
          setClassName("");
          setCopied(false);
          setShared(false);
          setError("");
          router.replace("/educatorCreateClass");
        } else if (currentSession && !hasInitialized.current) {
          hasInitialized.current = true;
          setSession(currentSession);
          setClassName(currentSession.title === DEFAULT_CLASS_NAME ? "" : currentSession.title);
        } else if (!hasInitialized.current) {
          hasInitialized.current = true;
          const nextSession = await requestNewSession(DEFAULT_CLASS_NAME);
          if (ignore) return;
          setSession(nextSession);
          setClassName("");
          setCopied(false);
          setShared(false);
          setError("");
        }
      } catch (caughtError) {
        if (!ignore) {
          setError(caughtError instanceof Error ? caughtError.message : "Unable to load classroom session.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    initialize();

    return () => {
      ignore = true;
    };
  }, [router, shouldStartFresh]);

  useEffect(() => {
    if (!session?.sessionId) return;

    const intervalId = window.setInterval(async () => {
      try {
        const currentSession = await loadCurrentSession();
        if (currentSession?.sessionId === session.sessionId) {
          setSession(currentSession);
        }
      } catch {
        // Keep the current roster visible if a background refresh fails.
      }
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [session?.sessionId]);

  useEffect(() => {
    if (!session?.sessionId) return;

    const trimmedClassName = className.trim();
    if (!trimmedClassName || trimmedClassName === session.title) return;

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/classroom-sessions", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ title: trimmedClassName }),
        });
        const result = (await response.json()) as { session?: ClassroomSession };
        if (response.ok && result.session) {
          setSession(result.session);
        }
      } catch {
        // Avoid interrupting the educator while typing.
      }
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [className, session]);

  const handleCopyCode = async () => {
    if (!session?.accessCode) return;

    await navigator.clipboard.writeText(accessCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleShareLink = async () => {
    if (!session?.accessCode) return;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "KFI Access Code",
          text: `Join my class with access code ${accessCode}.`,
          url: shareLink,
        });
      } else {
        await navigator.clipboard.writeText(shareLink);
      }

      setShared(true);
      window.setTimeout(() => setShared(false), 2000);
    } catch {
      // Ignore cancelled share interactions.
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await createSession();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to regenerate the access code.");
    } finally {
      setRegenerating(false);
    }
  };

  const handleCreateClass = () => {
    router.push("/educatorDashboard");
  };

  return (
    <main className={styles.page}>
      <section className={styles.content}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Generate an Access Code</h1>
          <p className={styles.subtitle}>Create a new code so a class or group can join.</p>
        </div>

        <div className={styles.card}>
          {error ? <p className={styles.errorBanner}>{error}</p> : null}

          <div className={styles.fieldBlock}>
            <label htmlFor="class-name" className={styles.label}>
              Class Name
            </label>
            <input
              id="class-name"
              className={styles.input}
              type="text"
              value={className}
              onChange={(event) => setClassName(event.target.value)}
              placeholder="e.g. 4th Grade Science – Period 2"
            />
            <p className={styles.helperText}>Students who join this code will appear below automatically.</p>
          </div>

          <div className={styles.codeBlock}>
            <p className={styles.codeLabel}>Your Access Code</p>
            <div className={styles.codePanel}>{loading ? "Starting..." : accessCode}</div>
            <p className={styles.sessionStatus}>
              {loading
                ? "Creating a classroom session..."
                : `Live session for ${resolvedClassName} is ready for student joins.`}
            </p>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={`${styles.button} ${styles.buttonPrimary}`}
              onClick={handleCopyCode}
              disabled={!session}
            >
              {copied ? "Copied!" : "Copy Code"}
            </button>
            <button
              type="button"
              className={`${styles.button} ${styles.buttonSecondary}`}
              onClick={handleShareLink}
              disabled={!session}
            >
              {shared ? "Shared!" : "Share Link"}
            </button>
          </div>

          <section className={styles.rosterSection} aria-live="polite">
            <div className={styles.rosterHeader}>
              <div>
                <p className={styles.rosterEyebrow}>Joined Students</p>
                <h2 className={styles.rosterTitle}>
                  {participantCount} student{participantCount === 1 ? "" : "s"} in class
                </h2>
              </div>
            </div>

            {participantCount > 0 && session ? (
              <div className={styles.rosterList}>
                {session.participants.map((participant, index) => (
                  <article key={participant.id} className={styles.rosterCard}>
                    <div className={styles.rosterAvatar}>{participant.displayName.charAt(0).toUpperCase()}</div>
                    <div className={styles.rosterMeta}>
                      <p className={styles.rosterName}>{participant.displayName}</p>
                      <p className={styles.rosterTime}>Joined at {formatJoinTime(participant.joinedAt)}</p>
                    </div>
                    <span className={styles.rosterIndex}>{String(index + 1).padStart(2, "0")}</span>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <p className={styles.emptyStateTitle}>Waiting for students to join.</p>
                <p className={styles.emptyStateText}>
                  Share the access code above, and this list will update as they enter.
                </p>
              </div>
            )}
          </section>
        </div>

        <button type="button" className={styles.regenerateButton} onClick={handleRegenerate} disabled={regenerating}>
          {regenerating ? "Creating New Session..." : "↻ Regenerate Code"}
        </button>

        <button type="button" className={styles.createClassButton} onClick={handleCreateClass}>
          Open Dashboard
        </button>
      </section>
    </main>
  );
}
