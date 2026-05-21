import GamePlayer from "@/components/GamePlayer";
import Link from "next/link";
import { Box, Flex, Text, VStack } from "@chakra-ui/react";

type PenguinRunPageProps = {
  searchParams?: Promise<{
    saveId?: string;
  }>;
};

export default async function PenguinRunPage({ searchParams }: PenguinRunPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const saveId = resolvedSearchParams?.saveId;
  const finishHref = saveId ? `/penguinRunQuiz?saveId=${saveId}&phase=after` : "/penguinRunQuiz?phase=after";

  return (
    <main>
      <VStack
        align="stretch"
        gap={3}
        bg="#F7F9FB"
        minH="calc(100vh - 64px)"
        px={{ base: 4, md: 6 }}
        py={{ base: 5, md: 6 }}
      >
        <Flex justify="space-between" align="center" px={{ base: 1, md: 1 }}>
          <VStack align="flex-start" gap={0.5}>
            <Text
              fontFamily='"Poppins", "Trebuchet MS", "Avenir Next", sans-serif'
              fontWeight="600"
              fontSize="11px"
              lineHeight="140%"
              letterSpacing="0.8px"
              color="#525252"
            >
              NOW PLAYING
            </Text>
            <Text
              fontFamily='"Poppins", "Trebuchet MS", "Avenir Next", sans-serif'
              fontWeight="700"
              fontSize={{ base: "xl", md: "2xl" }}
              lineHeight="120%"
              letterSpacing="-0.005em"
              color="#1B1B1B"
            >
              Penguin Run
            </Text>
          </VStack>

          <Link
            href={finishHref}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "44px",
              padding: "0 24px",
              border: "2px solid #4476BB",
              color: "#4476BB",
              borderRadius: "12px",
              fontWeight: 600,
              textDecoration: "none",
              fontFamily: "Karla, Avenir Next, Segoe UI, sans-serif",
              fontSize: "16px",
            }}
          >
            End Game
          </Link>
        </Flex>

        <Box
          flex="1"
          minH={{ base: "480px", md: "586px" }}
          maxW="1232px"
          w="full"
          mx="auto"
          borderRadius="8px"
          overflow="hidden"
        >
          <GamePlayer game="PenguinRun" saveId={saveId} height="586px" />
        </Box>
      </VStack>
    </main>
  );
}
