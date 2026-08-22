import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import connectDB from "@/database/db";
import { loadClassDetail } from "@/lib/server/classroomClasses";
import { getGameLabel } from "@/lib/server/classroomHistory";
import { findEducatorTeacher } from "@/lib/server/educatorClassroom";
import { PENGUIN_RUN_QUESTION_COUNT, STATES_OF_MATTER_QUESTION_COUNT, normalizeQuizScore } from "@/lib/quizScoring";
import ReopenClassButton from "../ReopenClassButton";
import { STATE_BADGE_CLASS, STATE_LABELS, formatDateTime, formatScore } from "../formatting";
import styles from "../educatorClassHistory.module.css";

export const dynamic = "force-dynamic";

const ACTIVITY_LIMIT = 12;

export default async function EducatorClassDetailPage({ params }: { params: Promise<{ classId: string }> }) {
  const { userId } = await auth();
  if (!userId) return null;

  await connectDB();

  const educator = await findEducatorTeacher(userId);
  if (!educator) return null;

  const { classId } = await params;
  const detail = await loadClassDetail(classId, educator.teacherId);
  if (!detail) notFound();

  const { summary, roster, sessionStates, gameData, quizzes, activity } = detail;
  const recentActivity = activity.slice(0, ACTIVITY_LIMIT);

  return (
    <main className={styles.shell}>
      <section className={styles.main}>
        <div className={styles.headerRow}>
          <div className={styles.headerCopy}>
            <Link href="/educatorClassHistory" className={styles.backLink}>
              ← Back to class history
            </Link>
            <h1 className={styles.title}>{summary.title}</h1>
            <p className={styles.subtitle}>
              Started {formatDateTime(summary.createdAt)} · {summary.sessions.length} session
              {summary.sessions.length === 1 ? "" : "s"}
              {summary.reopenCount > 0
                ? ` · reopened ${summary.reopenCount} time${summary.reopenCount === 1 ? "" : "s"}`
                : ""}
            </p>
          </div>
          <span className={`${styles.badge} ${STATE_BADGE_CLASS[summary.state]}`}>{STATE_LABELS[summary.state]}</span>
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
            <p className={styles.statLabel}>Quiz Records</p>
            <p className={styles.statValue}>{summary.quizzesRecorded}</p>
          </div>
          <div className={styles.stat}>
            <p className={styles.statLabel}>Avg. Pre-Quiz</p>
            <p className={styles.statValue}>{formatScore(summary.averagePreQuizScore)}</p>
          </div>
          <div className={styles.stat}>
            <p className={styles.statLabel}>Avg. Post-Quiz</p>
            <p className={styles.statValue}>{formatScore(summary.averagePostQuizScore)}</p>
          </div>
        </div>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Access</h2>
          {summary.state === "active" ? (
            <p className={styles.mutedText}>
              This class is live until {formatDateTime(summary.expiresAt)}. Students can join with{" "}
              <span className={styles.accessCodeInline}>{summary.activeAccessCode ?? "—"}</span>.
            </p>
          ) : (
            <ReopenClassButton classId={summary.classId} className={summary.title} />
          )}
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Session timeline</h2>
          <div className={styles.timeline}>
            {sessionStates.map((session, index) => (
              <article key={session.sessionId} className={styles.timelineItem}>
                <div className={styles.timelineHeader}>
                  <p className={styles.timelineLabel}>{index === 0 ? "Original session" : `Continuation ${index}`}</p>
                  <span className={`${styles.badge} ${STATE_BADGE_CLASS[session.state]}`}>
                    {STATE_LABELS[session.state]}
                  </span>
                </div>
                <p className={styles.classMeta}>
                  Opened {formatDateTime(session.createdAt)} · expires {formatDateTime(session.expiresAt)}
                  {session.closedAt ? ` · closed ${formatDateTime(session.closedAt)}` : ""}
                </p>
                {session.accessCodes.length ? (
                  <ul className={styles.codeList}>
                    {session.accessCodes.map((accessCode) => (
                      <li key={accessCode.code} className={styles.codeItem}>
                        <span className={accessCode.isActive ? styles.codeValue : styles.codeRetired}>
                          {accessCode.code}
                        </span>{" "}
                        {accessCode.isActive ? "active" : "retired"}
                        {accessCode.lastSeenAt ? ` · last used ${formatDateTime(accessCode.lastSeenAt)}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.classMeta}>No access code issued.</p>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Roster</h2>
          {roster.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Student</th>
                    <th scope="col">First joined</th>
                    <th scope="col">Last seen</th>
                    <th scope="col">Sessions attended</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((entry) => (
                    <tr key={entry.participantKey}>
                      <td>{entry.displayName}</td>
                      <td>{formatDateTime(entry.joinedAt)}</td>
                      <td>{formatDateTime(entry.lastSeenAt)}</td>
                      <td>{entry.sessionIds.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.mutedText}>No students joined this class.</p>
          )}
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Quiz results</h2>
          {quizzes.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Student</th>
                    <th scope="col">States pre</th>
                    <th scope="col">States post</th>
                    <th scope="col">Penguin pre</th>
                    <th scope="col">Penguin post</th>
                    <th scope="col">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {quizzes.map((quiz) => (
                    <tr key={String(quiz._id)}>
                      <td>{quiz.studentDisplayName || "A student"}</td>
                      <td>
                        {formatScore(
                          normalizeQuizScore(quiz.statesOfMatterScoreBefore, STATES_OF_MATTER_QUESTION_COUNT),
                        )}
                      </td>
                      <td>
                        {formatScore(normalizeQuizScore(quiz.stateOfMatterScoreAfter, STATES_OF_MATTER_QUESTION_COUNT))}
                      </td>
                      <td>{formatScore(normalizeQuizScore(quiz.penguinRunScoreBefore, PENGUIN_RUN_QUESTION_COUNT))}</td>
                      <td>{formatScore(normalizeQuizScore(quiz.penguinRunScoreAfter, PENGUIN_RUN_QUESTION_COUNT))}</td>
                      <td>{formatDateTime(quiz.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.mutedText}>No quiz results were recorded for this class.</p>
          )}
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Game progress</h2>
          {gameData.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Student</th>
                    <th scope="col">Game</th>
                    <th scope="col">Levels completed</th>
                    <th scope="col">Stages completed</th>
                    <th scope="col">Last updated</th>
                  </tr>
                </thead>
                <tbody>
                  {gameData.map((game) => (
                    <tr key={String(game._id)}>
                      <td>{game.studentDisplayName || "A student"}</td>
                      <td>{getGameLabel(game.gameId)}</td>
                      <td>{game.completedLevels?.length ?? 0}</td>
                      <td>{game.completedStageIds?.length ?? 0}</td>
                      <td>{formatDateTime(game.lastUpdated)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.mutedText}>No game progress was saved for this class.</p>
          )}
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Recent activity</h2>
          {recentActivity.length ? (
            <div className={styles.activityList}>
              {recentActivity.map((item) => (
                <article key={item.id} className={styles.activityItem}>
                  <div className={styles.activityDot} aria-hidden="true" />
                  <div className={styles.activityContent}>
                    <p className={styles.activityDescription}>{item.description}</p>
                    <p className={styles.mutedText}>{formatDateTime(item.occurredAt)}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.mutedText}>Nothing has happened in this class yet.</p>
          )}
        </section>
      </section>
    </main>
  );
}
