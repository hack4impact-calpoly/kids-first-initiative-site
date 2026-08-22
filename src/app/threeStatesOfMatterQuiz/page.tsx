import QuizExperience from "@/components/QuizExperience";
import { getQuizQuestions } from "@/data/quizData";
import { cookies } from "next/headers";
import { getRequestActor } from "@/lib/server/apiAuthorization";
import { CLASSROOM_ACCESS_COOKIE } from "@/lib/server/classroomAuthorization";
import { getPreviousQuizScore } from "@/lib/server/quizProgress";

type QuizPageProps = {
  searchParams?: Promise<{
    saveId?: string;
    phase?: string;
  }>;
};

export default async function ThreeStatesOfMatterQuizPage({ searchParams }: QuizPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const saveId = resolvedSearchParams?.saveId;
  const quizPhase = resolvedSearchParams?.phase === "after" ? "after" : "before";
  const statesOfMatterQuestions = getQuizQuestions("statesOfMatterQuiz");
  let previousCorrectCount = -1;

  if (quizPhase === "after") {
    const cookieStore = await cookies();
    previousCorrectCount = await getPreviousQuizScore(
      "statesOfMatterQuiz",
      await getRequestActor(),
      cookieStore.get(CLASSROOM_ACCESS_COOKIE)?.value,
    );
  }

  const gameHref =
    quizPhase === "after"
      ? "/playerDashboard"
      : saveId
        ? `/statesOfMatterGame?saveId=${saveId}`
        : "/statesOfMatterGame";

  return (
    <main>
      <QuizExperience
        quizKey="statesOfMatterQuiz"
        quizPhase={quizPhase}
        quizTitle="Three States of Matter Quiz"
        quizSubtitle={
          quizPhase === "after"
            ? "Let's see what you have learned about solids, liquids, and gases!"
            : "Let's see what you know about solids, liquids, and gases!"
        }
        previousCorrectCount={previousCorrectCount}
        questions={statesOfMatterQuestions}
        backToGamesHref={gameHref}
        backToGamesText={quizPhase === "after" ? "Back to games" : "Play games"}
      />
    </main>
  );
}
