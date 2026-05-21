import Link from "next/link";
import StatesOfMatterGameCard from "@/components/StatesOfMatterGameCard";
import { Box, Flex, Heading, Text, SimpleGrid } from "@chakra-ui/react";

type StatesOfMatterPageProps = {
  searchParams?: Promise<{
    saveId?: string;
  }>;
};

export default async function StatesOfMatterPage({ searchParams }: StatesOfMatterPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const saveId = resolvedSearchParams?.saveId;
  const finishHref = saveId
    ? `/threeStatesOfMatterQuiz?saveId=${saveId}&phase=after`
    : "/threeStatesOfMatterQuiz?phase=after";

  const games = [
    {
      title: "Wire Spark",
      description: "Master the circuits and light up the city!",
      href: "/wireGame",
      bgGradient: "linear(to-br, blue.400, blue.600)",
      iconSrc: "/icons/wire-icon.svg",
    },
    {
      title: "Heating Station",
      description: "Cook up some science in the heat lab!",
      href: "/cookingGame",
      bgGradient: "linear(to-br, orange.400, red.500)",
      iconSrc: "/icons/heat-icon.svg",
    },
    {
      title: "Pipe Flow",
      description: "Connect the flow and fix the leaks!",
      href: "/pipesGame",
      bgGradient: "linear(to-br, teal.400, teal.500)",
      iconSrc: "/icons/pipe-icon.svg",
    },
  ];

  return (
    <Box minH="100vh" bg="#F4F8FB">
      <Flex direction="column" align="center" pt={16} px={4}>
        <Heading as="h1" size={{ base: "3xl", md: "5xl" }} color="gray.900" mb={4} fontWeight="900" textAlign="center">
          Choose Your Experiment
        </Heading>

        <Text color="gray.500" fontSize="xl" fontWeight="medium" mb={16} textAlign="center">
          Ready to become a scientist today?
        </Text>

        <SimpleGrid columns={{ base: 1, md: 3 }} gap={10} maxW="6xl" w="full" px={4}>
          {games.map((game, index) => (
            <StatesOfMatterGameCard key={index} {...game} />
          ))}
        </SimpleGrid>

        <Box mt={12} w="full" maxW="6xl" px={4} display="flex" justifyContent="flex-end">
          <Link
            href={finishHref}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "46px",
              padding: "0 32px",
              backgroundColor: "#211E5D",
              color: "#F8F8F8",
              borderRadius: "12px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Finish
          </Link>
        </Box>
      </Flex>
    </Box>
  );
}
