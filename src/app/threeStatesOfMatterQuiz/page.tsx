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

export default async function ThreeStatesOfMatterQuizPage({ searchParams }: QuizPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const saveId = resolvedSearchParams?.saveId;
  const quizPhase = resolvedSearchParams?.phase === "after" ? "after" : "before";
  const statesOfMatterQuestions = getQuizQuestions("statesOfMatterQuiz");
  let previousCorrectCount = -1;

  if (quizPhase === "after") {
    const { userId } = await auth();

    if (userId) {
      await connectDB();
      const quiz = await Quiz.findOne({ clerkId: userId }).lean<{ statesOfMatterScoreBefore?: number } | null>();
      previousCorrectCount = typeof quiz?.statesOfMatterScoreBefore === "number" ? quiz.statesOfMatterScoreBefore : -1;
    }
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
