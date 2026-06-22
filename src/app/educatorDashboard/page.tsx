import { auth } from "@clerk/nextjs/server";
import connectDB from "@/database/db";
import ClassroomParticipant from "@/database/classroomParticipantSchema";
import ClassroomSession from "@/database/classroomSessionSchema";
import GameData from "@/database/gameDataSchema";
import Quiz from "@/database/quizSchema";
import Teacher from "@/database/teacherSchema";
import User from "@/database/userSchema";
import quizData from "@/data/quiz.json";
import Link from "next/link";
import DashboardAutoRefresh from "./DashboardAutoRefresh";
import styles from "./educatorDashboard.module.css";

type ActivityItem = {
  id: string;
  description: string;
  occurredAt: Date;
};

const typedQuizData = quizData as {
  penguinRunQuiz?: unknown[];
  statesOfMatterQuiz?: unknown[];
};

const PENGUIN_RUN_QUESTION_COUNT = typedQuizData.penguinRunQuiz?.length || 1;
const STATES_OF_MATTER_QUESTION_COUNT = typedQuizData.statesOfMatterQuiz?.length || 1;

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function getAverageQuizScore(
  quizzes: Array<{
    statesOfMatterScoreBefore?: number;
    stateOfMatterScoreAfter?: number;
    penguinRunScoreBefore?: number;
    penguinRunScoreAfter?: number;
  }>,
) {
  const scores = quizzes.flatMap((quiz) => {
    const normalizedScores = [
      typeof quiz.statesOfMatterScoreBefore === "number" && quiz.statesOfMatterScoreBefore >= 0
        ? (quiz.statesOfMatterScoreBefore / STATES_OF_MATTER_QUESTION_COUNT) * 100
        : null,
      typeof quiz.stateOfMatterScoreAfter === "number" && quiz.stateOfMatterScoreAfter >= 0
        ? (quiz.stateOfMatterScoreAfter / STATES_OF_MATTER_QUESTION_COUNT) * 100
        : null,
      typeof quiz.penguinRunScoreBefore === "number" && quiz.penguinRunScoreBefore >= 0
        ? (quiz.penguinRunScoreBefore / PENGUIN_RUN_QUESTION_COUNT) * 100
        : null,
      typeof quiz.penguinRunScoreAfter === "number" && quiz.penguinRunScoreAfter >= 0
        ? (quiz.penguinRunScoreAfter / PENGUIN_RUN_QUESTION_COUNT) * 100
        : null,
    ];

    return normalizedScores.filter((score): score is number => typeof score === "number");
  });

  if (scores.length === 0) return 0;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function getAveragePreQuizScore(
  quizzes: Array<{
    statesOfMatterScoreBefore?: number;
    penguinRunScoreBefore?: number;
  }>,
) {
  const scores = quizzes.flatMap((quiz) => {
    const normalizedScores = [
      typeof quiz.statesOfMatterScoreBefore === "number" && quiz.statesOfMatterScoreBefore >= 0
        ? (quiz.statesOfMatterScoreBefore / STATES_OF_MATTER_QUESTION_COUNT) * 100
        : null,
      typeof quiz.penguinRunScoreBefore === "number" && quiz.penguinRunScoreBefore >= 0
        ? (quiz.penguinRunScoreBefore / PENGUIN_RUN_QUESTION_COUNT) * 100
        : null,
    ];

    return normalizedScores.filter((score): score is number => typeof score === "number");
  });

  if (scores.length === 0) return 0;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function getAveragePostQuizScore(
  quizzes: Array<{
    stateOfMatterScoreAfter?: number;
    penguinRunScoreAfter?: number;
  }>,
) {
  const scores = quizzes.flatMap((quiz) => {
    const normalizedScores = [
      typeof quiz.stateOfMatterScoreAfter === "number" && quiz.stateOfMatterScoreAfter >= 0
        ? (quiz.stateOfMatterScoreAfter / STATES_OF_MATTER_QUESTION_COUNT) * 100
        : null,
      typeof quiz.penguinRunScoreAfter === "number" && quiz.penguinRunScoreAfter >= 0
        ? (quiz.penguinRunScoreAfter / PENGUIN_RUN_QUESTION_COUNT) * 100
        : null,
    ];

    return normalizedScores.filter((score): score is number => typeof score === "number");
  });

  if (scores.length === 0) return 0;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function buildQuizActivities(quiz: {
  _id: { toString(): string } | string;
  studentDisplayName?: string | null;
  updatedAt?: Date;
  statesOfMatterScoreBefore?: number;
  stateOfMatterScoreAfter?: number;
  penguinRunScoreBefore?: number;
  penguinRunScoreAfter?: number;
}) {
  if (!quiz.updatedAt) return [];

  const quizResults = [
    typeof quiz.stateOfMatterScoreAfter === "number" && quiz.stateOfMatterScoreAfter >= 0
      ? {
          label: "States of Matter post-quiz",
          score: (quiz.stateOfMatterScoreAfter / STATES_OF_MATTER_QUESTION_COUNT) * 100,
          key: "states-post",
        }
      : null,
    typeof quiz.penguinRunScoreAfter === "number" && quiz.penguinRunScoreAfter >= 0
      ? {
          label: "Penguin Run post-quiz",
          score: (quiz.penguinRunScoreAfter / PENGUIN_RUN_QUESTION_COUNT) * 100,
          key: "penguin-post",
        }
      : null,
    typeof quiz.statesOfMatterScoreBefore === "number" && quiz.statesOfMatterScoreBefore >= 0
      ? {
          label: "States of Matter pre-quiz",
          score: (quiz.statesOfMatterScoreBefore / STATES_OF_MATTER_QUESTION_COUNT) * 100,
          key: "states-pre",
        }
      : null,
    typeof quiz.penguinRunScoreBefore === "number" && quiz.penguinRunScoreBefore >= 0
      ? {
          label: "Penguin Run pre-quiz",
          score: (quiz.penguinRunScoreBefore / PENGUIN_RUN_QUESTION_COUNT) * 100,
          key: "penguin-pre",
        }
      : null,
  ].filter((result): result is { label: string; score: number; key: string } => Boolean(result));

  return quizResults.map((result) => ({
    id: `quiz-${String(quiz._id)}-${result.key}`,
    description: `${quiz.studentDisplayName || "A student"} completed ${result.label} with ${formatPercent(result.score)}.`,
    occurredAt: quiz.updatedAt as Date,
  }));
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
            <Link href="/educatorCreateClass?fresh=1" className={styles.restartButton}>
              Start New Class
            </Link>
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

  const [participants, gameData, quizzes] = await Promise.all([
    ClassroomParticipant.find({ sessionId }).sort({ joinedAt: 1 }).lean<
      Array<{
        _id: { toString(): string } | string;
        displayName: string;
        joinedAt: Date;
      }>
    >(),
    GameData.find({ classroomSessionId: sessionId }).sort({ lastUpdated: -1 }).lean<
      Array<{
        _id: { toString(): string } | string;
        gameId: string;
        lastUpdated: Date;
        studentDisplayName?: string | null;
      }>
    >(),
    Quiz.find({ classroomSessionId: sessionId }).sort({ updatedAt: -1 }).lean<
      Array<{
        _id: { toString(): string } | string;
        updatedAt?: Date;
        studentDisplayName?: string | null;
        statesOfMatterScoreBefore?: number;
        stateOfMatterScoreAfter?: number;
        penguinRunScoreBefore?: number;
        penguinRunScoreAfter?: number;
      }>
    >(),
  ]);

  const metrics = [
    { label: "Total Students", value: String(participants.length) },
    { label: "Avg. Quiz Score", value: quizzes.length ? formatPercent(getAverageQuizScore(quizzes)) : "0%" },
    { label: "Avg. Pre-Quiz Score", value: quizzes.length ? formatPercent(getAveragePreQuizScore(quizzes)) : "0%" },
    { label: "Avg. Post-Quiz Score", value: quizzes.length ? formatPercent(getAveragePostQuizScore(quizzes)) : "0%" },
    { label: "Games Played", value: String(gameData.length) },
  ];

  const activityItems: ActivityItem[] = [
    ...participants.map((participant) => ({
      id: `participant-${String(participant._id)}`,
      description: `${participant.displayName} joined ${classroomSession.title}.`,
      occurredAt: participant.joinedAt,
    })),
    ...gameData.map((game) => ({
      id: `game-${String(game._id)}`,
      description: `${game.studentDisplayName || "A student"} played ${game.gameId === "statesOfMatterGame" ? "States of Matter" : "Penguin Run"}.`,
      occurredAt: game.lastUpdated,
    })),
    ...quizzes.flatMap((quiz) => buildQuizActivities(quiz)),
  ]
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .slice(0, 8);

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
          <Link href="/educatorCreateClass?fresh=1" className={styles.restartButton}>
            Start New Class
          </Link>
        </div>

        <div className={styles.metricsRow}>
          {metrics.map((metric) => (
            <article key={metric.label} className={styles.metricCard}>
              <p className={styles.metricLabel}>{metric.label}</p>
              <p className={styles.metricValue}>{metric.value}</p>
            </article>
          ))}
        </div>

        <section className={styles.activityCard}>
          <h2 className={styles.activityTitle}>Recent Student Activity</h2>

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
