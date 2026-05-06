"use client";

import Link from "next/link";
import { Box, Button, Circle, HStack, SimpleGrid, Text, VStack } from "@chakra-ui/react";

type QuizResultsViewProps = {
  quizTitle: string;
  totalQuestions: number;
  finalCorrectCount: number;
  finalPoints: number;
  boundedPreviousCorrect: number;
  improvementPct: number;
  backToGamesHref: string;
  onReviewAnswers: () => void;
};

export default function QuizResultsView({
  quizTitle,
  totalQuestions,
  finalCorrectCount,
  finalPoints,
  boundedPreviousCorrect,
  improvementPct,
  backToGamesHref,
  onReviewAnswers,
}: QuizResultsViewProps) {
  const beforeProgressPct = totalQuestions > 0 ? (boundedPreviousCorrect / totalQuestions) * 100 : 0;
  const afterProgressPct = totalQuestions > 0 ? (finalCorrectCount / totalQuestions) * 100 : 0;

  return (
    <Box
      minH="100vh"
      bg="#f5f5f6"
      px={{ base: 4, md: 6 }}
      py={{ base: 6, md: 8 }}
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      <VStack maxW="700px" mx="auto" align="stretch" textAlign="center" gap={3}>
        <Circle size={{ base: "70px", md: "85px" }} bg="#b8b8bb" mx="auto" mb={{ base: 2, md: 3 }} />

        <Text fontSize={{ base: "32px", md: "48px" }} fontWeight="900" color="#1a1b1f" lineHeight={1}>
          Awesome Job! 🌟
        </Text>
        <Text mb={{ base: 3, md: 5 }} fontSize={{ base: "16px", md: "30px" }} color="#6e7076">
          You&apos;ve finished the {quizTitle}.
        </Text>

        <Box bg="#ededee" borderRadius="15px" px={{ base: 5, md: 8 }} py={{ base: 5, md: 7 }}>
          <SimpleGrid columns={2}>
            <VStack borderRight="1px solid #d6d6d7">
              <Text fontSize={{ base: "36px", md: "48px" }} color="#3f54a5" fontWeight="700" lineHeight={1}>
                {finalCorrectCount}/{totalQuestions}
              </Text>
              <Text color="#6a6b70" fontWeight="600" letterSpacing="0.06em" fontSize={{ base: "12px", md: "14px" }}>
                CORRECT
              </Text>
            </VStack>
            <VStack>
              <Text fontSize={{ base: "36px", md: "48px" }} color="#1e9c54" fontWeight="700" lineHeight={1}>
                +{finalPoints}
              </Text>
              <Text color="#6a6b70" fontWeight="600" letterSpacing="0.06em" fontSize={{ base: "12px", md: "14px" }}>
                POINTS EARNED
              </Text>
            </VStack>
          </SimpleGrid>
        </Box>

        <Box border="1px solid #ceced0" borderRadius="15px" px={{ base: 4, md: 7 }} py={{ base: 4, md: 5 }}>
          <Text
            textAlign="left"
            fontWeight="700"
            color="#6a6b70"
            letterSpacing="0.05em"
            mb={3}
            fontSize={{ base: "12px", md: "14px" }}
          >
            YOUR LEARNING PROGRESS
          </Text>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
            <VStack align="stretch">
              <Text fontSize={{ base: "34px", md: "39px" }} color="#1a1b1f" fontWeight="700" lineHeight={1}>
                {boundedPreviousCorrect}/{totalQuestions}
              </Text>
              <Box h="12px" bg="#e2e2e4" borderRadius="999px" overflow="hidden">
                <Box h="100%" w={`${beforeProgressPct}%`} bg="#cb4d4d" borderRadius="999px" />
              </Box>
              <Text color="#6a6b70" fontWeight="600" letterSpacing="0.05em" fontSize={{ base: "12px", md: "14px" }}>
                BEFORE PLAYING
              </Text>
            </VStack>
            <VStack align="stretch">
              <Text fontSize={{ base: "34px", md: "39px" }} color="#1a1b1f" fontWeight="700" lineHeight={1}>
                {finalCorrectCount}/{totalQuestions}
              </Text>
              <Box h="12px" bg="#e2e2e4" borderRadius="999px" overflow="hidden">
                <Box h="100%" w={`${afterProgressPct}%`} bg="#1e9c54" borderRadius="999px" />
              </Box>
              <Text color="#6a6b70" fontWeight="600" letterSpacing="0.05em" fontSize={{ base: "12px", md: "14px" }}>
                AFTER PLAYING
              </Text>
            </VStack>
          </SimpleGrid>
          <Text mt={3} color="#1e9c54" fontSize={{ base: "20px", md: "30px" }} fontWeight="700">
            {improvementPct > 0
              ? `📈 You improved by ${improvementPct}% - way to go!`
              : "Great effort - keep practicing!"}
          </Text>
        </Box>

        <HStack justify="center" mt={2} gap={4} flexWrap="wrap">
          <Button
            variant="ghost"
            color="#3f54a5"
            fontWeight="700"
            fontSize={{ base: "14px", md: "16px" }}
            onClick={onReviewAnswers}
          >
            Review Answers
          </Button>
          <Button
            as={Link}
            href={backToGamesHref}
            bg="#25256d"
            color="white"
            borderRadius="12px"
            px={7}
            h="46px"
            fontWeight="700"
            fontSize={{ base: "14px", md: "16px" }}
            _hover={{ bg: "#1f1f5f" }}
          >
            Back to Games →
          </Button>
        </HStack>
      </VStack>
    </Box>
  );
}
