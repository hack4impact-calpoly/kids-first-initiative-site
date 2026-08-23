import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import connectDB from "@/database/db";
import {
  DEFAULT_CLASS_PAGE_SIZE,
  loadTeacherClassSummaries,
  parseClassPageLimit,
  parseClassPageOffset,
} from "@/lib/server/classroomClasses";
import { findEducatorTeacher } from "@/lib/server/educatorClassroom";
import { STATE_BADGE_CLASS, STATE_LABELS, formatDateTime, formatScore } from "./formatting";
import styles from "./educatorClassHistory.module.css";

export const dynamic = "force-dynamic";

type ClassHistoryPageProps = {
  searchParams?: Promise<{ limit?: string; offset?: string }>;
};

export default async function EducatorClassHistoryPage({ searchParams }: ClassHistoryPageProps) {
  const { userId } = await auth();
  if (!userId) return null;

  await connectDB();

  const educator = await findEducatorTeacher(userId);
  if (!educator) return null;

  const params = await searchParams;
  const limit = parseClassPageLimit(params?.limit);
  const requestedOffset = parseClassPageOffset(params?.offset);

  // An educator with no Teacher record yet has simply never run a class, so fall through to the
  // empty state rather than rendering a blank document.
  const page = educator.teacherId
    ? await loadTeacherClassSummaries(educator.teacherId, new Date(), limit, requestedOffset)
    : { classes: [], total: 0, offset: 0, hasMore: false };
  const { classes, total, offset, hasMore } = page;

  const pageHref = (nextOffset: number) => {
    const search = new URLSearchParams();
    if (limit !== DEFAULT_CLASS_PAGE_SIZE) search.set("limit", String(limit));
    if (nextOffset > 0) search.set("offset", String(nextOffset));
    const query = search.toString();
    return query ? `/educatorClassHistory?${query}` : "/educatorClassHistory";
  };

  return (
    <main className={styles.shell}>
      <section className={styles.main}>
        <div className={styles.headerRow}>
          <div className={styles.headerCopy}>
            <Link href="/educatorDashboard" className={styles.backLink}>
              ← Back to dashboard
            </Link>
            <h1 className={styles.title}>Class History</h1>
            <p className={styles.subtitle}>
              {total > classes.length
                ? `Showing ${offset + 1}–${offset + classes.length} of ${total} classes, newest first.`
                : "Every class you have run, including the ones that have closed or expired."}{" "}
              Open a class to review its roster, game activity, and quiz results, or reopen it to keep going.
            </p>
          </div>
          <Link href="/educatorCreateClass?fresh=1" className={styles.primaryLink}>
            Start New Class
          </Link>
        </div>

        {classes.length === 0 ? (
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>No classes yet</h2>
            <p className={styles.mutedText}>
              Once you start a class and students join, it will appear here — and stay here after it closes.
            </p>
          </section>
        ) : (
          <div className={styles.classList}>
            {classes.map((summary) => (
              <article key={summary.classId} className={styles.classCard}>
                <div className={styles.classCardHeader}>
                  <div className={styles.classHeading}>
                    <h2 className={styles.classTitle}>{summary.title}</h2>
                    <p className={styles.classMeta}>
                      Started {formatDateTime(summary.createdAt)}
                      {summary.reopenCount > 0
                        ? ` · reopened ${summary.reopenCount} time${summary.reopenCount === 1 ? "" : "s"}`
                        : ""}
                      {summary.state === "active"
                        ? ` · expires ${formatDateTime(summary.expiresAt)}`
                        : summary.state === "closed"
                          ? ` · closed ${formatDateTime(summary.closedAt)}`
                          : ` · expired ${formatDateTime(summary.expiresAt)}`}
                    </p>
                    {summary.activeAccessCode ? (
                      <p className={styles.classMeta}>
                        Active access code: <span className={styles.accessCodeInline}>{summary.activeAccessCode}</span>
                      </p>
                    ) : (
                      <p className={styles.classMeta}>No active access code. Reopen the class to issue a new one.</p>
                    )}
                  </div>
                  <div className={styles.classActions}>
                    <span className={`${styles.badge} ${STATE_BADGE_CLASS[summary.state]}`}>
                      {STATE_LABELS[summary.state]}
                    </span>
                    <Link href={`/educatorClassHistory/${summary.classId}`} className={styles.detailLink}>
                      View class
                    </Link>
                  </div>
                </div>

                <div className={styles.statGrid}>
                  <div className={styles.stat}>
                    <p className={styles.statLabel}>Students</p>
                    <p className={styles.statValue}>{summary.participantCount}</p>
                  </div>
                  <div className={styles.stat}>
                    <p className={styles.statLabel}>Games Played</p>
                    <p className={styles.statValue}>{summary.gamesPlayed}</p>
                  </div>
                  <div className={styles.stat}>
                    <p className={styles.statLabel}>Avg. Pre-Quiz</p>
                    <p className={styles.statValue}>{formatScore(summary.averagePreQuizScore)}</p>
                  </div>
                  <div className={styles.stat}>
                    <p className={styles.statLabel}>Avg. Post-Quiz</p>
                    <p className={styles.statValue}>{formatScore(summary.averagePostQuizScore)}</p>
                  </div>
                  <div className={styles.stat}>
                    <p className={styles.statLabel}>Last Activity</p>
                    <p className={styles.statValueSmall}>{formatDateTime(summary.lastActivityAt)}</p>
                  </div>
                </div>
              </article>
            ))}
            {offset > 0 || hasMore ? (
              <div className={styles.pager}>
                {offset > 0 ? (
                  <Link href={pageHref(Math.max(0, offset - limit))} className={styles.detailLink}>
                    ← Newer classes
                  </Link>
                ) : null}
                {hasMore ? (
                  <Link href={pageHref(offset + limit)} className={styles.detailLink}>
                    Older classes →
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}
