"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./educatorCreateClass.module.css";

function generateAccessCode() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const alphanumeric = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const pick = (source: string, count: number) =>
    Array.from({ length: count }, () => source[Math.floor(Math.random() * source.length)]).join("");

  return `${pick(letters, 6)}-${pick(alphanumeric, 3)}`;
}

export default function EducatorDashboardPage() {
  const router = useRouter();
  const [className, setClassName] = useState("");
  const [accessCode, setAccessCode] = useState(generateAccessCode);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  // TODO: implement logic for sharing with students
  const shareLink = useMemo(
    () => `https://kidsfirst.example/join?code=${encodeURIComponent(accessCode)}`,
    [accessCode],
  );

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(accessCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleShareLink = async () => {
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

  const handleRegenerate = () => {
    setAccessCode(generateAccessCode());
    setCopied(false);
    setShared(false);
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
          </div>

          <div className={styles.codeBlock}>
            <p className={styles.codeLabel}>Your Access Code</p>
            <div className={styles.codePanel}>{accessCode}</div>
          </div>

          <div className={styles.actions}>
            <button type="button" className={`${styles.button} ${styles.buttonPrimary}`} onClick={handleCopyCode}>
              {copied ? "Copied!" : "Copy Code"}
            </button>
            <button type="button" className={`${styles.button} ${styles.buttonSecondary}`} onClick={handleShareLink}>
              {shared ? "Shared!" : "Share Link"}
            </button>
          </div>
        </div>

        <button type="button" className={styles.regenerateButton} onClick={handleRegenerate}>
          ↻ Regenerate Code
        </button>

        <button type="button" className={styles.createClassButton} onClick={handleCreateClass}>
          Create Class
        </button>
      </section>
    </main>
  );
}
