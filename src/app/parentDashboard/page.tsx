import Link from "next/link";
import styles from "./parentDashboard.module.css";

export default function ParentDashboardPage() {
  return (
    <main className={styles.page}>
      <section className={styles.container}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Welcome, Sam</h1>
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
