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
    participantId?: string;
  }>;
};

export default async function PeguinRunQuizPage({ searchParams }: QuizPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const saveId = resolvedSearchParams?.saveId;
  const quizPhase = resolvedSearchParams?.phase === "after" ? "after" : "before";
  const penguinQuestions = getQuizQuestions("penguinRunQuiz");
  let previousCorrectCount = -1;

  if (quizPhase === "after") {
    const cookieStore = await cookies();
    previousCorrectCount = await getPreviousQuizScore(
      "penguinRunQuiz",
      await getRequestActor(),
      cookieStore.get(CLASSROOM_ACCESS_COOKIE)?.value,
      resolvedSearchParams?.participantId,
    );
  }

  const gameHref =
    quizPhase === "after" ? "/playerDashboard" : saveId ? `/penguinRunGame?saveId=${saveId}` : "/penguinRunGame";

  return (
    <main>
      <QuizExperience
        quizKey="penguinRunQuiz"
        quizPhase={quizPhase}
        quizTitle="Penguin Run Quiz"
        quizSubtitle={
          quizPhase === "after"
            ? "Let's see what you have learned about forces and energy!"
            : "Let's see what you already know about forces and energy!"
        }
        resultsSubtitle={quizPhase === "after" ? undefined : "You're ready to play Penguin Run."}
        previousCorrectCount={previousCorrectCount}
        questions={penguinQuestions}
        backToGamesHref={gameHref}
        backToGamesText={quizPhase === "after" ? "Back to games" : "Play game"}
      />
    </main>
  );
}
