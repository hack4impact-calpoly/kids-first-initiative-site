import QuizExperience from "@/components/QuizExperience";
import { getQuizQuestions } from "@/data/quizData";

export default function PeguinRunQuizPage() {
  const penguinQuestions = getQuizQuestions("penguinRunQuiz");

  return (
    <main>
      <QuizExperience
        quizId="penguinRunQuiz"
        quizTitle="Penguin Run Quiz 🎢"
        quizSubtitle="Let's see what you already know about forces and energy!"
        questions={penguinQuestions}
      />
    </main>
  );
}
