import StatesOfMatterGameCard from "@/components/StatesOfMatterGameCard";
import { Box, Flex, Heading, Text, SimpleGrid } from "@chakra-ui/react";

export default function StatesOfMatterPage() {
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
        {/* Main Title: Bumped to 5xl for maximum impact */}
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
      </Flex>
    </Box>
  );
}
