"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./adminDashboard.module.css";
import quizData from "@/data/quiz.json";

type AdminUser = {
  _id: string;
  clerkId?: string;
  name?: string;
  username?: string;
  role?: string;
};

type QuizRecord = {
  clerkId: string;
  statesOfMatterScoreBefore?: number;
  stateOfMatterScoreAfter?: number;
  penguinRunScoreBefore?: number;
  penguinRunScoreAfter?: number;
};

type GameDataRecord = {
  _id?: string;
  saveId: string;
  userId: string;
  gameId: string;
  lastUpdated?: string;
};

type ActivityRow = {
  userLabel: string;
  gameLabel: string;
  averageScoreLabel: string;
  lastActiveLabel: string;
  lastUpdatedMs: number;
};

type SessionState = "active" | "expired" | "closed";

type AdminClassRow = {
  classId: string;
  title: string;
  educatorName: string;
  state: SessionState;
  participantCount: number;
  gamesPlayed: number;
  averageGain: number | null;
  lastActivityAt: string | null;
};

type AdminAnalytics = {
  scope: { includedStates: SessionState[] };
  sessionCounts: { active: number; expired: number; closed: number; total: number };
  classCount: number;
  learners: { personal: number; classroom: number; total: number };
  gamesPlayed: number;
  averageGain: number | null;
  classes: AdminClassRow[];
  classesTruncated: boolean;
};

type DashboardData = {
  users: AdminUser[];
  quizzes: QuizRecord[];
  gameData: GameDataRecord[];
  analytics: AdminAnalytics | null;
};

type StatCard = {
  label: string;
  value: string;
  helper: string;
};

const STATE_LABELS: Record<SessionState, string> = {
  active: "Active",
  expired: "Expired",
  closed: "Closed",
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const PENGUIN_RUN_QUESTION_COUNT = quizData.penguinRunQuiz.length || 1;
const STATES_OF_MATTER_QUESTION_COUNT = quizData.statesOfMatterQuiz.length || 1;

function getGameLabel(gameId?: string) {
  if (gameId === "penguinRunGame") return "Penguin Run";
  if (gameId === "statesOfMatterGame") return "3 States of Matter";
  return "No game yet";
}

function formatRelativeTime(dateLike?: string) {
  if (!dateLike) return "No activity";

  const dateMs = new Date(dateLike).getTime();
  if (!Number.isFinite(dateMs)) return "No activity";

  const diffMs = Date.now() - dateMs;
  const minutes = Math.max(0, Math.floor(diffMs / 60000));

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function toPercentLabel(value: number) {
  const rounded = Math.round(value);
  return `${rounded}%`;
}

function getAverageScore(quiz?: QuizRecord) {
  if (!quiz) return 0;

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
  const scores = normalizedScores.filter((score): score is number => typeof score === "number");

  if (scores.length === 0) return 0;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function getWeeklyChartData(gameData: GameDataRecord[]) {
  const today = new Date();
  const bars = DAY_LABELS.map((label, offset) => {
    const day = new Date(today);
    const startOffset = 6 - offset;
    day.setHours(0, 0, 0, 0);
    day.setDate(today.getDate() - startOffset);

    const nextDay = new Date(day);
    nextDay.setDate(day.getDate() + 1);

    const count = gameData.filter((entry) => {
      const updatedMs = entry.lastUpdated ? new Date(entry.lastUpdated).getTime() : NaN;
      return Number.isFinite(updatedMs) && updatedMs >= day.getTime() && updatedMs < nextDay.getTime();
    }).length;

    return { label, count };
  });

  const maxCount = Math.max(...bars.map((bar) => bar.count), 1);
  return bars.map((bar) => ({
    ...bar,
    heightPercent: Math.max(18, Math.round((bar.count / maxCount) * 100)),
  }));
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData>({ users: [], quizzes: [], gameData: [], analytics: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");

        const [usersResponse, quizzesResponse, gameDataResponse, analyticsResponse] = await Promise.all([
          fetch("/api/users", { cache: "no-store" }),
          fetch("/api/quiz", { cache: "no-store" }),
          fetch("/api/gameData", { cache: "no-store" }),
          fetch("/api/admin/analytics", { cache: "no-store" }),
        ]);

        if (!usersResponse.ok || !quizzesResponse.ok || !gameDataResponse.ok || !analyticsResponse.ok) {
          throw new Error("Failed to load dashboard data.");
        }

        const [users, quizzes, gameData, analytics] = await Promise.all([
          usersResponse.json() as Promise<AdminUser[]>,
          quizzesResponse.json() as Promise<QuizRecord[]>,
          gameDataResponse.json() as Promise<GameDataRecord[]>,
          analyticsResponse.json() as Promise<AdminAnalytics>,
        ]);

        if (!isActive) return;
        setData({ users, quizzes, gameData, analytics });
      } catch (loadError) {
        console.error("Failed to load admin dashboard:", loadError);
        if (isActive) setError("Could not load admin statistics.");
      } finally {
        if (isActive) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      isActive = false;
    };
  }, []);

  const quizByClerkId = useMemo(() => new Map(data.quizzes.map((quiz) => [quiz.clerkId, quiz])), [data.quizzes]);

  const mostRecentGameByUserId = useMemo(() => {
    const map = new Map<string, GameDataRecord>();

    data.gameData.forEach((entry) => {
      const current = map.get(entry.userId);
      const entryMs = entry.lastUpdated ? new Date(entry.lastUpdated).getTime() : 0;
      const currentMs = current?.lastUpdated ? new Date(current.lastUpdated).getTime() : 0;

      if (!current || entryMs > currentMs) {
        map.set(entry.userId, entry);
      }
    });

    return map;
  }, [data.gameData]);

  const statCards = useMemo<StatCard[]>(() => {
    const analytics = data.analytics;
    const gain = analytics?.averageGain ?? null;
    const gainPrefix = gain !== null && gain > 0 ? "+" : "";

    return [
      {
        label: "TOTAL LEARNERS",
        value: (analytics ? analytics.learners.total : data.users.length).toLocaleString(),
        helper: analytics
          ? `${analytics.learners.personal.toLocaleString()} with accounts, ${analytics.learners.classroom.toLocaleString()} in classrooms`
          : "All registered users",
      },
      {
        label: "ACTIVE CLASSROOMS",
        value: (analytics?.sessionCounts.active ?? 0).toLocaleString(),
        helper: analytics
          ? `${analytics.sessionCounts.expired.toLocaleString()} expired, ${analytics.sessionCounts.closed.toLocaleString()} closed`
          : "—",
      },
      {
        label: "GAMES PLAYED",
        value: data.gameData.length.toLocaleString(),
        helper: "All saved records, personal and classroom",
      },
      {
        label: "AVG PRE→POST GAIN",
        // Distinguishes "no measured gain" from "a gain of zero", which the previous card could not.
        value: gain === null ? "—" : `${gainPrefix}${Math.round(gain)}%`,
        helper: gain === null ? "No completed pre and post pairs yet" : "Across classes in scope",
      },
    ];
  }, [data.analytics, data.gameData.length, data.users.length]);

  const activityRows = useMemo<ActivityRow[]>(() => {
    return data.users
      .map((user) => {
        const latestGame = user.clerkId ? mostRecentGameByUserId.get(user.clerkId) : undefined;
        const latestUpdatedMs = latestGame?.lastUpdated ? new Date(latestGame.lastUpdated).getTime() : 0;
        const averageScore = user.clerkId ? getAverageScore(quizByClerkId.get(user.clerkId)) : 0;

        return {
          userLabel: user.username || user.name || "Unknown user",
          gameLabel: getGameLabel(latestGame?.gameId),
          averageScoreLabel: toPercentLabel(averageScore),
          lastActiveLabel: formatRelativeTime(latestGame?.lastUpdated),
          lastUpdatedMs: latestUpdatedMs,
        };
      })
      .sort((a, b) => b.lastUpdatedMs - a.lastUpdatedMs)
      .slice(0, 5);
  }, [data.users, mostRecentGameByUserId, quizByClerkId]);

  const chartData = useMemo(() => getWeeklyChartData(data.gameData), [data.gameData]);

  return (
    <main className={styles.page}>
      <section className={styles.main}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Statistics</h1>
          <p className={styles.subtitle}>Usage across all classrooms and families.</p>
        </div>

        {loading ? (
          <div className={styles.statusCard}>Loading statistics...</div>
        ) : error ? (
          <div className={styles.statusCard}>{error}</div>
        ) : (
          <>
            <section className={styles.statsRow}>
              {statCards.map((card) => (
                <article key={card.label} className={styles.statCard}>
                  <p className={styles.statLabel}>{card.label}</p>
                  <p className={styles.statValue}>{card.value}</p>
                  <p className={styles.statHelper}>{card.helper}</p>
                </article>
              ))}
            </section>

            <section className={styles.activityCard}>
              <h2 className={styles.cardTitle}>Recent Activity</h2>

              <div className={styles.tableHeader}>
                <span>CLASSROOM / FAMILY</span>
                <span>GAME</span>
                <span>AVG SCORE</span>
                <span>LAST ACTIVE</span>
              </div>

              <div className={styles.tableBody}>
                {activityRows.length === 0 ? (
                  <p className={styles.emptyState}>No recent activity yet.</p>
                ) : (
                  activityRows.map((row) => (
                    <div key={`${row.userLabel}-${row.lastUpdatedMs}`} className={styles.tableRow}>
                      <span className={styles.userName}>{row.userLabel}</span>
                      <span className={styles.gameName}>{row.gameLabel}</span>
                      <span className={styles.scoreValue}>{row.averageScoreLabel}</span>
                      <span className={styles.lastActive}>{row.lastActiveLabel}</span>
                    </div>
                  ))
                )}
              </div>
            </section>

            {data.analytics ? (
              <section className={styles.activityCard}>
                <h2 className={styles.cardTitle}>Classrooms</h2>
                <p className={styles.scopeNote}>
                  Showing {data.analytics.classCount.toLocaleString()} class
                  {data.analytics.classCount === 1 ? "" : "es"} across{" "}
                  {data.analytics.scope.includedStates.map((state) => STATE_LABELS[state].toLowerCase()).join(", ")}{" "}
                  sessions.
                  {data.analytics.classesTruncated ? " Older classes are not listed." : ""}
                </p>

                <div className={styles.classroomHeader}>
                  <span>CLASS</span>
                  <span>EDUCATOR</span>
                  <span>STATE</span>
                  <span>STUDENTS</span>
                  <span>GAMES</span>
                  <span>GAIN</span>
                </div>

                <div className={styles.tableBody}>
                  {data.analytics.classes.length === 0 ? (
                    <p className={styles.emptyState}>No classrooms in this scope.</p>
                  ) : (
                    data.analytics.classes.map((row) => (
                      <a
                        key={row.classId}
                        href={`/educatorClassHistory/${row.classId}`}
                        className={styles.classroomRow}
                      >
                        <span className={styles.userName}>{row.title}</span>
                        <span className={styles.gameName}>{row.educatorName}</span>
                        <span className={styles.gameName}>{STATE_LABELS[row.state]}</span>
                        <span className={styles.scoreValue}>{row.participantCount.toLocaleString()}</span>
                        <span className={styles.scoreValue}>{row.gamesPlayed.toLocaleString()}</span>
                        <span className={styles.scoreValue}>
                          {row.averageGain === null
                            ? "—"
                            : `${row.averageGain > 0 ? "+" : ""}${Math.round(row.averageGain)}%`}
                        </span>
                      </a>
                    ))
                  )}
                </div>
              </section>
            ) : null}

            <section className={styles.chartCard}>
              <h2 className={styles.cardTitle}>Games Played — Last 7 Days</h2>

              <div className={styles.bars}>
                {chartData.map((bar) => (
                  <div key={bar.label} className={styles.barColumn}>
                    <div className={styles.barTrack}>
                      <div className={styles.bar} style={{ height: `${bar.heightPercent}%` }} />
                    </div>
                    <span className={styles.barLabel}>{bar.label}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  );
}
