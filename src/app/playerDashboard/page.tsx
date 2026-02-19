import { GameCard } from "@/components/GameCard";
import { Box } from "@chakra-ui/react";

//The playerDashboard lacks any authentication for preventing logged out users currently
//information about the user should be passed here for completedLevels

export default function PlayerDashboard() {
  return (
    <main>
      <Box minH="100vh" bg="blue.50" display="flex" justifyContent="space-around" placeItems="center" p={8}>
        <GameCard game="statesOfMatterGame" completedLevels={1} />
        <GameCard game="penguinRunGame" completedLevels={6} />
      </Box>
    </main>
  );
}
