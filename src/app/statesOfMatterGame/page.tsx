import GamePlayer from "@/components/GamePlayer";
import Link from "next/link";
import { Box, Flex, Text, VStack } from "@chakra-ui/react";

type StatesOfMatterGamePageProps = {
  searchParams?: Promise<{
    saveId?: string;
  }>;
};

export default async function StatesOfMatterGamePage({ searchParams }: StatesOfMatterGamePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const saveId = resolvedSearchParams?.saveId;
  const finishHref = saveId
    ? `/threeStatesOfMatterQuiz?saveId=${saveId}&phase=after`
    : "/threeStatesOfMatterQuiz?phase=after";

  return (
    <main>
      <Flex bg="#F7F9FB" h="calc(100vh - 64px)" overflow="hidden" justify="center">
        <VStack align="stretch" gap={4} w="full" h="full" px={{ base: 4, md: 8, lg: 10 }} py={{ base: 5, md: 6 }}>
          <Flex justify="space-between" align="center" w="full" flexShrink={0}>
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
                States of Matter
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
                flexShrink: 0,
              }}
            >
              End Game
            </Link>
          </Flex>

          <Box flex="1" minH={0} w="full" display="flex" alignItems="center" justifyContent="center" overflow="hidden">
            <Box w="80vw" h="80vh" borderRadius="8px" overflow="hidden">
              <GamePlayer game="StatesOfMatter" saveId={saveId} height="100%" />
            </Box>
          </Box>
        </VStack>
      </Flex>
    </main>
  );
}
