import rawQuizData from "@/data/quiz.json";
import { QuizDataMap, QuizId, QuizQuestion } from "@/components/quiz/types";

const quizData = rawQuizData as QuizDataMap;

export function getQuizQuestions(quizId: QuizId): QuizQuestion[] {
  return quizData[quizId] ?? [];
}
