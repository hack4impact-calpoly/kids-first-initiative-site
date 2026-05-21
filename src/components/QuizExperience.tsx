"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, VStack } from "@chakra-ui/react";
import QuizIntroView from "@/components/quiz/QuizIntroView";
import QuizQuestionView from "@/components/quiz/QuizQuestionView";
import QuizResultsView from "@/components/quiz/QuizResultsView";
import { QuizQuestion } from "@/components/quiz/types";

export type { QuizOption, QuizQuestion } from "@/components/quiz/types";

type QuizExperienceProps = {
  quizKey: "penguinRunQuiz" | "statesOfMatterQuiz";
  quizTitle: string;
  quizSubtitle: string;
  questions: QuizQuestion[];
  pointsPerQuestion?: number;
  estimatedMinutes?: number;
  previousCorrectCount?: number;
  backToGamesHref?: string;
  backToGamesText?: string;
};

type QuizStage = "intro" | "questions" | "results";

export default function QuizExperience({
  quizKey,
  quizTitle,
  quizSubtitle,
  questions,
  pointsPerQuestion = 10,
  estimatedMinutes = 5,
  previousCorrectCount = 0,
  backToGamesHref = "/playerDashboard",
  backToGamesText,
}: QuizExperienceProps) {
  const [stage, setStage] = useState<QuizStage>("intro");
  const [isReviewingAnswers, setIsReviewingAnswers] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answersByQuestionId, setAnswersByQuestionId] = useState<Record<string, string>>({});
  const [hasSavedResults, setHasSavedResults] = useState(false);
  const saveAttemptKeyRef = useRef<string | null>(null);

  const totalQuestions = questions.length;
  const maxPoints = totalQuestions * pointsPerQuestion;
  const currentQuestion = questions[currentIndex];
  const selectedOptionId = currentQuestion ? answersByQuestionId[currentQuestion.questionId] : undefined;
  const hasSelectedOption = Boolean(selectedOptionId);
  const isLastQuestion = currentIndex === totalQuestions - 1;
  const answeredCount = Object.keys(answersByQuestionId).length;
  const shouldComputeScore = stage !== "intro";

  const provisionalCorrectCount = useMemo(() => {
    if (!shouldComputeScore) return 0;
    return questions.reduce((total, question) => {
      const selected = answersByQuestionId[question.questionId];
      return total + (selected === question.correctOptionId ? 1 : 0);
    }, 0);
  }, [answersByQuestionId, questions, shouldComputeScore]);

  const finalCorrectCount = provisionalCorrectCount;
  const finalPoints = finalCorrectCount * pointsPerQuestion;
  const boundedPreviousCorrect = Math.min(Math.max(previousCorrectCount, 0), totalQuestions);
  const improvementPct =
    totalQuestions > 0 ? Math.round(((finalCorrectCount - boundedPreviousCorrect) / totalQuestions) * 100) : 0;
  const progressPct = totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0;

  useEffect(() => {
    if (stage !== "results") return;

    const saveKey = `${quizKey}:${finalCorrectCount}:${Object.keys(answersByQuestionId)
      .sort()
      .map((questionId) => `${questionId}:${answersByQuestionId[questionId]}`)
      .join("|")}`;

    if (saveAttemptKeyRef.current === saveKey) return;
    saveAttemptKeyRef.current = saveKey;

    const payload =
      quizKey === "statesOfMatterQuiz"
        ? {
            statesOfMatterScoreBefore: finalCorrectCount,
            statesOfMatterQuestionResults: questions.map((question) => {
              const selectedOptionId = answersByQuestionId[question.questionId];
              const selectedOption = question.options.find((option) => option.id === selectedOptionId);
              const correctOption = question.options.find((option) => option.id === question.correctOptionId);

              return {
                questionId: question.questionId,
                questionText: question.question,
                answerOptions: question.options.map((option) => option.text),
                selectedAnswer: selectedOption?.text ?? "",
                correctAnswer: correctOption?.text ?? "",
                isCorrect: selectedOptionId === question.correctOptionId,
              };
            }),
          }
        : {
            penguinRunScoreBefore: finalCorrectCount,
            penguinRunQuestionResults: questions.map((question) => {
              const selectedOptionId = answersByQuestionId[question.questionId];
              const selectedOption = question.options.find((option) => option.id === selectedOptionId);
              const correctOption = question.options.find((option) => option.id === question.correctOptionId);

              return {
                questionId: question.questionId,
                questionText: question.question,
                answerOptions: question.options.map((option) => option.text),
                selectedAnswer: selectedOption?.text ?? "",
                correctAnswer: correctOption?.text ?? "",
                isCorrect: selectedOptionId === question.correctOptionId,
              };
            }),
          };

    void (async () => {
      try {
        const response = await fetch("/api/quiz", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error("Failed to save quiz results");
        }

        setHasSavedResults(true);
      } catch (error) {
        console.error("Failed to save quiz results:", error);
      }
    })();
  }, [answersByQuestionId, finalCorrectCount, questions, quizKey, stage]);

  function handleSelect(optionId: string) {
    if (!currentQuestion || isReviewingAnswers) return;
    setAnswersByQuestionId((prev) => ({
      ...prev,
      [currentQuestion.questionId]: optionId,
    }));
  }

  function handleNext() {
    if (!currentQuestion) return;
    if (!isReviewingAnswers && !hasSelectedOption) return;
    if (isLastQuestion) {
      setStage("results");
      setIsReviewingAnswers(false);
      return;
    }
    setCurrentIndex((prev) => prev + 1);
  }

  function handleStart() {
    setStage("questions");
    setIsReviewingAnswers(false);
    setCurrentIndex(0);
    setAnswersByQuestionId({});
    setHasSavedResults(false);
    saveAttemptKeyRef.current = null;
  }

  function handleReviewAnswers() {
    setStage("questions");
    setIsReviewingAnswers(true);
    setCurrentIndex(0);
  }

  if (totalQuestions === 0) {
    return (
      <Box minH="100vh" bg="#f5f5f6" display="flex" alignItems="center" justifyContent="center" p={6}>
        <VStack bg="#eeeeef" borderRadius="24px" p={8} textAlign="center">
          <Text fontSize="2xl" fontWeight="700" color="#1a1b1f">
            No quiz questions found.
          </Text>
          <Text color="#6e7076">Please add questions to `src/data/quiz.json`.</Text>
        </VStack>
      </Box>
    );
  }

  if (stage === "intro") {
    return (
      <QuizIntroView
        quizTitle={quizTitle}
        quizSubtitle={quizSubtitle}
        totalQuestions={totalQuestions}
        estimatedMinutes={estimatedMinutes}
        maxPoints={maxPoints}
        onStart={handleStart}
      />
    );
  }

  if (stage === "results") {
    return (
      <QuizResultsView
        quizTitle={quizTitle}
        totalQuestions={totalQuestions}
        finalCorrectCount={finalCorrectCount}
        finalPoints={finalPoints}
        boundedPreviousCorrect={boundedPreviousCorrect}
        improvementPct={improvementPct}
        backToGamesHref={backToGamesHref}
        backToGamesText={backToGamesText}
        onReviewAnswers={handleReviewAnswers}
        hasSavedResults={hasSavedResults}
      />
    );
  }

  if (!currentQuestion) return null;

  return (
    <QuizQuestionView
      question={currentQuestion}
      currentIndex={currentIndex}
      totalQuestions={totalQuestions}
      progressPct={progressPct}
      answeredCount={answeredCount}
      selectedOptionId={selectedOptionId}
      isReviewingAnswers={isReviewingAnswers}
      isLastQuestion={isLastQuestion}
      onSelect={handleSelect}
      onNext={handleNext}
    />
  );
}
