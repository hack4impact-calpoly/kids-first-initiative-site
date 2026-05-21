import QuizExperience from "@/components/QuizExperience";
import { getQuizQuestions } from "@/data/quizData";

type QuizPageProps = {
  searchParams?: Promise<{
    saveId?: string;
  }>;
};

export default async function ThreeStatesOfMatterQuizPage({ searchParams }: QuizPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const saveId = resolvedSearchParams?.saveId;
  const statesOfMatterQuestions = getQuizQuestions("statesOfMatterQuiz");

  const gameHref = saveId ? `/statesOfMatterGame?saveId=${saveId}` : "/statesOfMatterGame";

  return (
    <main>
      <QuizExperience
        quizTitle="Three States of Matter Quiz 🧪"
        quizSubtitle="Let's see what you know about solids, liquids, and gases!"
        questions={statesOfMatterQuestions}
        backToGamesHref={gameHref}
        backToGamesText="Play games"
      />
    </main>
  );
}
