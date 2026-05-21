import QuizExperience from "@/components/QuizExperience";
import { getQuizQuestions } from "@/data/quizData";
import connectDB from "@/database/db";
import Quiz from "@/database/quizSchema";
import { auth } from "@clerk/nextjs/server";

type QuizPageProps = {
  searchParams?: Promise<{
    saveId?: string;
    phase?: string;
  }>;
};

export default async function PeguinRunQuizPage({ searchParams }: QuizPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const saveId = resolvedSearchParams?.saveId;
  const quizPhase = resolvedSearchParams?.phase === "after" ? "after" : "before";
  const penguinQuestions = getQuizQuestions("penguinRunQuiz");
  let previousCorrectCount = 0;

  if (quizPhase === "after") {
    const { userId } = await auth();

    if (userId) {
      await connectDB();
      const quiz = await Quiz.findOne({ clerkId: userId }).lean<{ penguinRunScoreBefore?: number } | null>();
      previousCorrectCount = typeof quiz?.penguinRunScoreBefore === "number" ? quiz.penguinRunScoreBefore : 0;
    }
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
