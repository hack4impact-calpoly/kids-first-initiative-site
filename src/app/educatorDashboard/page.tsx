import styles from "./educatorDashboard.module.css";

const METRICS = [
  { label: "Total Students", value: "24" },
  { label: "Avg. Quiz Score", value: "78%" },
  { label: "Games Played", value: "142" },
];

const ACTIVITY_PLACEHOLDERS = [
  "Maya completed States of Matter Quiz with a score of 90%.",
  "Jordan joined 4th Grade Science - Period 2.",
  "Class redeemed 18 new play sessions this week.",
  "Three students improved their quiz scores today.",
];

export default function EducatorDashboardPage() {
  return (
    <main className={styles.shell}>
      <section className={styles.main}>
        <h1 className={styles.title}>Dashboard</h1>
        <p className={styles.subtitle}>Welcome back, Ms. Rodriguez.</p>

        <div className={styles.metricsRow}>
          {METRICS.map((metric) => (
            <article key={metric.label} className={styles.metricCard}>
              <p className={styles.metricLabel}>{metric.label}</p>
              <p className={styles.metricValue}>{metric.value}</p>
            </article>
          ))}
        </div>

        <section className={styles.activityCard}>
          <h2 className={styles.activityTitle}>Recent Student Activity</h2>

          <div className={styles.activityList} aria-hidden="true">
            {ACTIVITY_PLACEHOLDERS.map((item) => (
              <div key={item} className={styles.activityRow}>
                <span className={styles.activityBar} />
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
