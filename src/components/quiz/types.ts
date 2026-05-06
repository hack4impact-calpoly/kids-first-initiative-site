"use client";

export type QuizOption = {
  id: string;
  text: string;
};

export type QuizQuestion = {
  questionId: string;
  question: string;
  options: QuizOption[];
  correctOptionId: string;
};

export type QuizId = "penguinRunQuiz" | "statesOfMatterQuiz";

export type QuizDataMap = Record<QuizId, QuizQuestion[]>;
