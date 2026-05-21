import QuizExperience from "@/components/QuizExperience";
import { getQuizQuestions } from "@/data/quizData";

export default function ThreeStatesOfMatterQuizPage() {
  const statesOfMatterQuestions = getQuizQuestions("statesOfMatterQuiz");

  return (
    <main>
      <QuizExperience
        quizId="statesOfMatterQuiz"
        quizTitle="Three States of Matter Quiz 🧪"
        quizSubtitle="Let's see what you know about solids, liquids, and gases!"
        questions={statesOfMatterQuestions}
      />
    </main>
  );
}
