"use client";

import { Box, Button, Circle, SimpleGrid, Text, VStack } from "@chakra-ui/react";

type QuizIntroViewProps = {
  quizTitle: string;
  quizSubtitle: string;
  totalQuestions: number;
  estimatedMinutes: number;
  maxPoints: number;
  onStart: () => void;
};

export default function QuizIntroView({
  quizTitle,
  quizSubtitle,
  totalQuestions,
  estimatedMinutes,
  maxPoints,
  onStart,
}: QuizIntroViewProps) {
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
      <VStack maxW="520px" mx="auto" textAlign="center" gap={0}>
        {/* <Circle size={{ base: "64px", md: "80px" }} bg="#b8b8bb" mb={{ base: 5, md: 6 }} /> */}

        <Text
          as="h1"
          mb={{ base: 2, md: 3 }}
          fontSize={{ base: "24px", md: "32px" }}
          lineHeight={1.05}
          color="#1a1b1f"
          letterSpacing="-0.02em"
          fontWeight="700"
        >
          {quizTitle}
        </Text>

        <Text mb={{ base: 7, md: 9 }} fontSize={{ base: "13px", md: "18px" }} color="#6e7076" lineHeight={1.25}>
          {quizSubtitle}
        </Text>

        <Box
          w="100%"
          maxW="460px"
          bg="#f1f1f2"
          borderRadius="16px"
          px={{ base: 3, md: 4 }}
          py={{ base: 3, md: 4 }}
          mb={8}
        >
          <SimpleGrid columns={{ base: 1, md: 3 }} gap={0}>
            <VStack
              py={{ base: 3, md: 0 }}
              borderBottom={{ base: "1px solid #d6d6d7", md: "none" }}
              borderRight={{ base: "none", md: "1px solid #d6d6d7" }}
            >
              <Text mb={1} fontSize={{ base: "24px", md: "30px" }} color="#3f54a5" fontWeight="600" lineHeight={1}>
                {totalQuestions}
              </Text>
              <Text fontSize={{ base: "12px", md: "14px" }} color="#64666b" fontWeight="500" letterSpacing="0.02em">
                QUESTIONS
              </Text>
            </VStack>

            <VStack
              py={{ base: 3, md: 0 }}
              borderBottom={{ base: "1px solid #d6d6d7", md: "none" }}
              borderRight={{ base: "none", md: "1px solid #d6d6d7" }}
            >
              <Text mb={1} fontSize={{ base: "24px", md: "30px" }} color="#3f54a5" fontWeight="600" lineHeight={1}>
                ~{estimatedMinutes}
              </Text>
              <Text fontSize={{ base: "12px", md: "14px" }} color="#64666b" fontWeight="500" letterSpacing="0.02em">
                MINUTES
              </Text>
            </VStack>

            <VStack py={{ base: 3, md: 0 }}>
              <Text mb={1} fontSize={{ base: "24px", md: "30px" }} color="#3f54a5" fontWeight="600" lineHeight={1}>
                {maxPoints}
              </Text>
              <Text fontSize={{ base: "12px", md: "14px" }} color="#64666b" fontWeight="500" letterSpacing="0.02em">
                POINTS
              </Text>
            </VStack>
          </SimpleGrid>
        </Box>

        <Button
          type="button"
          mb={5}
          bg="#25256d"
          color="white"
          borderRadius="12px"
          px={{ base: 7, md: 8 }}
          h={{ base: "42px", md: "48px" }}
          fontSize={{ base: "14px", md: "18px" }}
          fontWeight="600"
          letterSpacing="0.03em"
          _hover={{ bg: "#1f1f5f" }}
          _active={{ bg: "#1f1f5f" }}
          boxShadow="0 6px 14px rgba(37,37,109,0.2)"
          onClick={onStart}
        >
          START QUIZ ▶
        </Button>

        <Text fontSize={{ base: "12px", md: "16px" }} color="#7b7d82">
          Don&apos;t worry - there&apos;s no grade. Just have fun!
        </Text>
      </VStack>
    </Box>
  );
}
