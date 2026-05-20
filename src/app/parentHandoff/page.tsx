import Link from "next/link";
import styles from "./parentHandoff.module.css";

export default function ParentHandoffPage() {
  return (
    <main className={styles.page}>
      <section className={styles.content}>
        <div className={styles.iconBg} aria-hidden="true">
          <span className={styles.icon}>🤝</span>
        </div>

        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Pass it to your Child! 👋</h1>
          <p className={styles.subtitle}>Hand the device over so they can play.</p>
        </div>

        <Link href="/playerDashboard" className={styles.playButton}>
          Play
        </Link>
      </section>
    </main>
  );
}
