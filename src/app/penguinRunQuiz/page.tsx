import QuizExperience from "@/components/QuizExperience";
import { getQuizQuestions } from "@/data/quizData";

type QuizPageProps = {
  searchParams?: Promise<{
    saveId?: string;
  }>;
};

export default async function PeguinRunQuizPage({ searchParams }: QuizPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const saveId = resolvedSearchParams?.saveId;
  const penguinQuestions = getQuizQuestions("penguinRunQuiz");

  const gameHref = saveId ? `/penguinRunGame?saveId=${saveId}` : "/penguinRunGame";

  return (
    <main>
      <QuizExperience
        quizKey="penguinRunQuiz"
        quizTitle="Penguin Run Quiz 🎢"
        quizSubtitle="Let's see what you already know about forces and energy!"
        questions={penguinQuestions}
        backToGamesHref={gameHref}
        backToGamesText="Play game"
      />
    </main>
  );
}
