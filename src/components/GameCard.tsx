import { Box, Button, Circle, HStack, LinkBox, LinkOverlay, Progress, Text, VStack } from "@chakra-ui/react";
import Link from "next/link";
import Image from "next/Image";

/* NOTE
  The "CONTINUE MISSION" button is redircting directly to the game page url with Link.
  Passing saveId upon navigation game/[saveId] would make sense. 
  Currently the users completedLevels and total is hardcoded.
*/

type GameCardProps = {
  game: "statesOfMatterGame" | "penguinRunGame"; // name of game folder (used for link)
  completedLevels: number;
  //saveId: string;
};

// can be placed in a gameConfig.ts file for future customization
export const GAME_CONFIG = {
  statesOfMatterGame: {
    title: "Matter Lab",
    subtitle: "Explore solids, liquids, and gases!",
    iconSrc: "/game/StatesOfMatter/Icon.png",
    defaultColor: "green",
    totalLevels: 5,
  },
  penguinRunGame: {
    title: "Penguin Run",
    subtitle: "Race across the icy glaciers!",
    iconSrc: "/game/PenguinRun/Icon.png",
    defaultColor: "orange",
    totalLevels: 20,
  },
};

export function GameCard({ game, completedLevels }: GameCardProps) {
  const config = GAME_CONFIG[game];
  const levelProgress = Math.round((completedLevels / config.totalLevels) * 100);

  return (
    // OUTER WRAPPER: This is so outer icons can extend outside the box
    <Box position="relative" w="full" maxW="420px">
      {/* Floating icon (NOT clipped) */}
      <Circle
        position="absolute"
        top="-76px"
        left="50%"
        transform="translateX(-50%)"
        size="120px"
        bg="white"
        border="2px solid"
        borderColor="gray.100"
        boxShadow="0 10px 22px rgba(15, 23, 42, 0.12)"
        zIndex={3}
      >
        <Image
          src={config.iconSrc}
          alt={`${config.title} icon`}
          width={64}
          height={64}
          style={{ objectFit: "contain" }}
          priority
        />
      </Circle>

      {/* INNER SURFACE: Overflow is hidden */}
      <Box
        position="relative"
        bg="white"
        borderRadius="28px"
        overflow="hidden"
        boxShadow="10px 40px 40px rgba(15, 23, 42, 0.12)"
        px={{ base: 6, md: 8 }}
        pt={{ base: 12, md: 14 }}
        pb={{ base: 6, md: 7 }}
        _before={{
          content: '""',
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: "14px",
          bg: `${config.defaultColor}.200`,
          pointerEvents: "none",
        }}
      >
        {/* Title and description */}
        <VStack py={8} align="stretch" textAlign="center" position="relative" zIndex={1}>
          <VStack>
            <Text fontSize={{ base: "2xl", md: "3xl" }} fontWeight="800" color="gray.800">
              {config.title}
            </Text>
            <Text fontSize="sm" color="gray.500">
              {config.subtitle}
            </Text>
          </VStack>
          {/* Progress bar */}
          <Box pt={2} p={4} bg="gray.100" borderRadius="28px">
            <HStack justify="space-between" mb={2}>
              <Text fontSize="xs" fontWeight="800" letterSpacing="0.06em" color={`${config.defaultColor}.400`}>
                LEVEL {completedLevels}/{config.totalLevels}
              </Text>
              <Text fontSize="xs" fontWeight="700" color="gray.500">
                {/* completedLevels here as well */}
                {levelProgress}%
              </Text>
            </HStack>

            {/* pass the users completedLevels % * 100 for the value. Range: 0-100 */}
            <Progress.Root value={levelProgress} min={0} max={100}>
              <Progress.Track height="12px" borderRadius="50px" bg="gray.200">
                <Progress.Range bg={`${config.defaultColor}.400`} borderRadius="50px" />
              </Progress.Track>
            </Progress.Root>
          </Box>
          <LinkBox>
            <Button
              w="full"
              size="lg"
              py={8}
              mt={4}
              position="relative"
              overflow="hidden" // keeps the blue bottom highlight within the button
              borderRadius="18px"
              bg="blue.500"
              color="white"
              _hover={{ bg: "blue.600" }}
              boxShadow="0 14px 28px rgba(15, 23, 42, 0.16)"
              _after={{
                content: '""',
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: "8px",
                bg: "rgba(0,0,0,0.12)",
                pointerEvents: "none",
              }}
            >
              <LinkOverlay href={`/${game}`}>CONTINUE MISSION</LinkOverlay>
            </Button>
          </LinkBox>
        </VStack>
      </Box>
    </Box>
  );
}
