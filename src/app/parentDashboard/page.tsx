"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import styles from "./parentDashboard.module.css";

export default function ParentDashboardPage() {
  const { user } = useUser();
  const [displayName, setDisplayName] = useState("Player");

  useEffect(() => {
    let isActive = true;

    async function loadCurrentUser() {
      try {
        const response = await fetch("/api/users/me", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to load current user.");

        const data = await response.json();
        if (!isActive) return;

        setDisplayName(data.name?.trim() || user?.fullName?.trim() || user?.username || "Player");
      } catch {
        if (!isActive) return;
        setDisplayName(user?.fullName?.trim() || user?.username || "Player");
      }
    }

    loadCurrentUser();

    return () => {
      isActive = false;
    };
  }, [user?.fullName, user?.username]);

  return (
    <main className={styles.page}>
      <section className={styles.container}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Welcome, {displayName}</h1>
          <p className={styles.subtitle}>Here&apos;s how they&apos;re doing.</p>
        </div>

        <div className={styles.handoffCard}>
          <div className={styles.copyBlock}>
            <h2 className={styles.cardTitle}>Ready to play?</h2>
            <p className={styles.cardSubtitle}>Pass the device to your student so they can start a game.</p>
          </div>

          <Link href="/parentHandoff" className={styles.handoffButton}>
            Hand Off
          </Link>
        </div>
      </section>
    </main>
  );
}
