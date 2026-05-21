"use client";

import { Box, Button, Circle, HStack, Text, VStack } from "@chakra-ui/react";
import { QuizQuestion } from "./types";

type QuizQuestionViewProps = {
  question: QuizQuestion;
  currentIndex: number;
  totalQuestions: number;
  progressPct: number;
  answeredCount: number;
  isLastQuestion: boolean;
  selectedOptionId?: string;
  isReviewingAnswers: boolean;
  onSelect: (optionId: string) => void;
  onNext: () => void;
};

export default function QuizQuestionView({
  question,
  currentIndex,
  totalQuestions,
  progressPct,
  answeredCount,
  isLastQuestion,
  selectedOptionId,
  isReviewingAnswers,
  onSelect,
  onNext,
}: QuizQuestionViewProps) {
  return (
    <Box
      minH="100vh"
      bg="#f5f5f6"
      px={{ base: 4, md: 8 }}
      py={{ base: 6, md: 8 }}
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      <VStack maxW="840px" mx="auto" align="stretch">
        <HStack justify="flex-start" mb={2}>
          <Text color="#3f54a5" fontWeight="700" letterSpacing="0.05em" fontSize={{ base: "12px", md: "16px" }}>
            {isReviewingAnswers ? "REVIEWING ANSWERS" : "QUESTION"} {Math.min(currentIndex + 1, totalQuestions)} OF{" "}
            {totalQuestions}
          </Text>
        </HStack>
        <Box h="12px" bg="#e0e0e2" borderRadius="999px" overflow="hidden" mb={4}>
          <Box h="100%" w={`${progressPct}%`} bg="#3f54a5" borderRadius="999px" />
        </Box>

        <Box bg="#ececee" borderRadius="20px" p={{ base: 5, md: 7 }}>
          <Text
            as="h2"
            fontSize={{ base: "28px", md: "42px" }}
            color="#1a1b1f"
            fontWeight="700"
            lineHeight={1.1}
            mb={6}
          >
            {question.question}
          </Text>
          <VStack align="stretch" gap={3}>
            {question.options.map((option) => {
              const isSelected = selectedOptionId === option.id;
              const isCorrectAnswer = isReviewingAnswers && option.id === question.correctOptionId;
              const isSelectedCorrect = isReviewingAnswers && isSelected && option.id === question.correctOptionId;
              const isSelectedWrong = isReviewingAnswers && isSelected && option.id !== question.correctOptionId;

              const optionBorderColor = isSelectedCorrect
                ? "#2f9e44"
                : isSelectedWrong
                  ? "#d64545"
                  : isCorrectAnswer
                    ? "#2f9e44"
                    : isSelected
                      ? "#3f54a5"
                      : "#d0d0d3";
              const optionBg = isSelectedCorrect
                ? "#d8f5df"
                : isSelectedWrong
                  ? "#f9dddd"
                  : isCorrectAnswer
                    ? "#d8f5df"
                    : isSelected
                      ? "#d8dded"
                      : "white";
              const badgeBg = isSelectedCorrect
                ? "#2f9e44"
                : isSelectedWrong
                  ? "#d64545"
                  : isCorrectAnswer
                    ? "#2f9e44"
                    : isSelected
                      ? "#3f54a5"
                      : "#f4f4f4";
              const badgeColor = isSelected || isCorrectAnswer ? "white" : "#1a1b1f";
              const isEmphasized = isSelected || isCorrectAnswer;

              return (
                <Button
                  key={option.id}
                  onClick={isReviewingAnswers ? undefined : () => onSelect(option.id)}
                  justifyContent="flex-start"
                  h={{ base: "62px", md: "72px" }}
                  borderRadius="14px"
                  borderWidth={isSelected ? "2px" : "1px"}
                  borderColor={optionBorderColor}
                  bg={optionBg}
                  _hover={{ bg: isReviewingAnswers ? optionBg : isSelected ? "#d8dded" : "#f7f7f8" }}
                  cursor={isReviewingAnswers ? "default" : "pointer"}
                  px={5}
                >
                  <Circle
                    size={{ base: "34px", md: "40px" }}
                    bg={badgeBg}
                    color={badgeColor}
                    border={isSelected ? "none" : "1px solid #ceced0"}
                    fontWeight="700"
                    mr={4}
                  >
                    {option.id}
                  </Circle>
                  <Text
                    fontSize={{ base: "22px", md: "29px" }}
                    color="#1a1b1f"
                    fontWeight={isEmphasized ? "700" : "500"}
                  >
                    {option.text}
                  </Text>
                </Button>
              );
            })}
          </VStack>
        </Box>

        <HStack justify="flex-end" mt={5}>
          <Button
            onClick={onNext}
            bg="#25256d"
            color="white"
            borderRadius="14px"
            px={8}
            h="54px"
            fontWeight="700"
            _hover={{ bg: "#1f1f5f" }}
            disabled={!isReviewingAnswers && !selectedOptionId}
          >
            {isLastQuestion ? (isReviewingAnswers ? "Back to Results →" : "Finish →") : "Next →"}
          </Button>
        </HStack>
        <Text color="#7b7d82" fontSize={{ base: "13px", md: "15px" }}>
          {answeredCount}/{totalQuestions} answered
        </Text>
      </VStack>
    </Box>
  );
}
