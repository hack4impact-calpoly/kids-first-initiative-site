import { auth } from "@clerk/nextjs/server";
import connectDB from "@/database/db";
import ClassroomParticipant from "@/database/classroomParticipantSchema";
import ClassroomSession from "@/database/classroomSessionSchema";
import GameData from "@/database/gameDataSchema";
import Quiz from "@/database/quizSchema";
import StudentAccessCode from "@/database/studentAccessCodeSchema";
import Teacher from "@/database/teacherSchema";
import User from "@/database/userSchema";
import { formatPercent, getAveragePostQuizScore, getAveragePreQuizScore } from "@/lib/quizScoring";
import {
  ClassroomGameRecord,
  ClassroomParticipantRecord,
  ClassroomQuizRecord,
  buildClassroomActivity,
  getClassId,
} from "@/lib/server/classroomHistory";
import Link from "next/link";
import DashboardAutoRefresh from "./DashboardAutoRefresh";
import styles from "./educatorDashboard.module.css";

const ACTIVITY_LIMIT = 8;

function DashboardHeaderActions() {
  return (
    <div className={styles.headerActions}>
      <Link href="/educatorClassHistory" className={styles.secondaryButton}>
        Class History
      </Link>
      <Link href="/educatorCreateClass?fresh=1" className={styles.restartButton}>
        Start New Class
      </Link>
    </div>
  );
}

export default async function EducatorDashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  await connectDB();

  const dbUser = await User.findOne({ clerkId: userId }).lean<{ name?: string; role?: string } | null>();
  const teacher = await Teacher.findOne({ clerkId: userId }).lean<{ _id: { toString(): string } } | null>();

  if (dbUser?.role !== "educator" || !teacher) {
    return null;
  }

  const classroomSession = await ClassroomSession.findOne({ teacherId: teacher._id })
    .sort({ status: 1, createdAt: -1 })
    .lean<{
      _id: { toString(): string };
      title: string;
      status: "active" | "closed";
      createdAt: Date;
      rootSessionId?: { toString(): string } | null;
    } | null>();

  if (!classroomSession) {
    return (
      <main className={styles.shell}>
        <section className={styles.main}>
          <DashboardAutoRefresh />
          <div className={styles.headerRow}>
            <div className={styles.headerCopy}>
              <h1 className={styles.title}>Dashboard</h1>
              <p className={styles.subtitle}>Create a classroom session to start seeing live student activity.</p>
            </div>
            <DashboardHeaderActions />
          </div>
          <section className={styles.emptyCard}>
            <h2 className={styles.emptyTitle}>No classroom data yet</h2>
            <p className={styles.emptyText}>
              Generate an access code, have students join, and this dashboard will populate automatically.
            </p>
          </section>
        </section>
      </main>
    );
  }

  const sessionId = String(classroomSession._id);

  const [participants, gameData, quizzes, accessCode] = await Promise.all([
    ClassroomParticipant.find({ sessionId }).sort({ joinedAt: 1 }).lean<ClassroomParticipantRecord[]>(),
    GameData.find({ classroomSessionId: sessionId }).sort({ lastUpdated: -1 }).lean<ClassroomGameRecord[]>(),
    Quiz.find({ classroomSessionId: sessionId }).sort({ updatedAt: -1 }).lean<ClassroomQuizRecord[]>(),
    StudentAccessCode.findOne({ sessionId, isActive: true }).lean<{
      code: string;
    } | null>(),
  ]);

  const metrics = [
    { label: "Total Students", value: String(participants.length) },
    { label: "Avg. Pre-Quiz Score", value: quizzes.length ? formatPercent(getAveragePreQuizScore(quizzes)) : "0%" },
    { label: "Avg. Post-Quiz Score", value: quizzes.length ? formatPercent(getAveragePostQuizScore(quizzes)) : "0%" },
    { label: "Games Played", value: String(gameData.length) },
  ];

  const activityItems = buildClassroomActivity({
    classTitle: classroomSession.title,
    participants,
    gameData,
    quizzes,
  }).slice(0, ACTIVITY_LIMIT);

  return (
    <main className={styles.shell}>
      <section className={styles.main}>
        <DashboardAutoRefresh />
        <div className={styles.headerRow}>
          <div className={styles.headerCopy}>
            <h1 className={styles.title}>Dashboard</h1>
            <p className={styles.subtitle}>
              Welcome back, {dbUser?.name || "Educator"}. Viewing{" "}
              {classroomSession.status === "active" ? "live" : "most recent"} activity for {classroomSession.title}.
            </p>
          </div>
          <DashboardHeaderActions />
        </div>

        {accessCode ? (
          <section className={styles.accessCodeCard}>
            <div className={styles.accessCodeCopy}>
              <p className={styles.accessCodeLabel}>Active Access Code</p>
              <h2 className={styles.accessCodeValue}>{accessCode.code}</h2>
            </div>
          </section>
        ) : null}

        <div className={styles.metricsRow}>
          {metrics.map((metric) => (
            <article key={metric.label} className={styles.metricCard}>
              <p className={styles.metricLabel}>{metric.label}</p>
              <p className={styles.metricValue}>{metric.value}</p>
            </article>
          ))}
        </div>

        <section className={styles.activityCard}>
          <div className={styles.activityHeader}>
            <h2 className={styles.activityTitle}>Recent Student Activity</h2>
            <Link href={`/educatorClassHistory/${getClassId(classroomSession)}`} className={styles.activityLink}>
              View full class record
            </Link>
          </div>

          {activityItems.length ? (
            <div className={styles.activityList}>
              {activityItems.map((item) => (
                <article key={item.id} className={styles.activityItem}>
                  <div className={styles.activityDot} aria-hidden="true" />
                  <div className={styles.activityContent}>
                    <p className={styles.activityDescription}>{item.description}</p>
                    <p className={styles.activityTimestamp}>
                      {new Intl.DateTimeFormat(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      }).format(item.occurredAt)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptyActivity}>
              <p className={styles.emptyTitle}>No tracked activity yet</p>
              <p className={styles.emptyText}>
                Students have joined, but game and quiz activity will appear here after they start playing.
              </p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
