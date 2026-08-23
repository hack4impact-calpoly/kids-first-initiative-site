import quizData from "@/data/quiz.json";

const typedQuizData = quizData as {
  penguinRunQuiz?: unknown[];
  statesOfMatterQuiz?: unknown[];
};

export const PENGUIN_RUN_QUESTION_COUNT = typedQuizData.penguinRunQuiz?.length || 1;
export const STATES_OF_MATTER_QUESTION_COUNT = typedQuizData.statesOfMatterQuiz?.length || 1;

export type QuizScoreRecord = {
  statesOfMatterScoreBefore?: number;
  stateOfMatterScoreAfter?: number;
  penguinRunScoreBefore?: number;
  penguinRunScoreAfter?: number;
};

export type QuizResultBreakdown = {
  key: string;
  label: string;
  game: "statesOfMatter" | "penguinRun";
  phase: "pre" | "post";
  score: number;
};

// Unattempted quizzes are stored as -1 rather than null, so anything negative is "no result yet".
// NaN has to be rejected explicitly: `NaN < 0` is false, so a bare comparison would let it through
// and render as "NaN%", and one NaN poisons every average it is included in.
export function normalizeQuizScore(score: unknown, questionCount: number): number | null {
  if (typeof score !== "number" || !Number.isFinite(score) || score < 0) return null;
  return (score / questionCount) * 100;
}

export function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

export function averagePercent(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function getPreQuizPercentages(quiz: QuizScoreRecord) {
  return [
    normalizeQuizScore(quiz.statesOfMatterScoreBefore, STATES_OF_MATTER_QUESTION_COUNT),
    normalizeQuizScore(quiz.penguinRunScoreBefore, PENGUIN_RUN_QUESTION_COUNT),
  ].filter((score): score is number => score !== null);
}

export function getPostQuizPercentages(quiz: QuizScoreRecord) {
  return [
    normalizeQuizScore(quiz.stateOfMatterScoreAfter, STATES_OF_MATTER_QUESTION_COUNT),
    normalizeQuizScore(quiz.penguinRunScoreAfter, PENGUIN_RUN_QUESTION_COUNT),
  ].filter((score): score is number => score !== null);
}

export function getAveragePreQuizScore(quizzes: QuizScoreRecord[]) {
  return averagePercent(quizzes.flatMap(getPreQuizPercentages));
}

export function getAveragePostQuizScore(quizzes: QuizScoreRecord[]) {
  return averagePercent(quizzes.flatMap(getPostQuizPercentages));
}

// Ordered post-quiz first so recent-activity feeds surface the outcome before the baseline.
export function getQuizResultBreakdown(quiz: QuizScoreRecord): QuizResultBreakdown[] {
  const candidates: Array<Omit<QuizResultBreakdown, "score"> & { score: number | null }> = [
    {
      key: "states-post",
      label: "States of Matter post-quiz",
      game: "statesOfMatter",
      phase: "post",
      score: normalizeQuizScore(quiz.stateOfMatterScoreAfter, STATES_OF_MATTER_QUESTION_COUNT),
    },
    {
      key: "penguin-post",
      label: "Penguin Run post-quiz",
      game: "penguinRun",
      phase: "post",
      score: normalizeQuizScore(quiz.penguinRunScoreAfter, PENGUIN_RUN_QUESTION_COUNT),
    },
    {
      key: "states-pre",
      label: "States of Matter pre-quiz",
      game: "statesOfMatter",
      phase: "pre",
      score: normalizeQuizScore(quiz.statesOfMatterScoreBefore, STATES_OF_MATTER_QUESTION_COUNT),
    },
    {
      key: "penguin-pre",
      label: "Penguin Run pre-quiz",
      game: "penguinRun",
      phase: "pre",
      score: normalizeQuizScore(quiz.penguinRunScoreBefore, PENGUIN_RUN_QUESTION_COUNT),
    },
  ];

  return candidates.filter((result): result is QuizResultBreakdown => result.score !== null);
}
