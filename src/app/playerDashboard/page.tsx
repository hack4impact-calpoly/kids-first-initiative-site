import { auth } from "@clerk/nextjs/server";
import { GameCard } from "@/components/GameCard";
import { PlayerNavbar } from "@/components/PlayerNavbar";
import { Box } from "@chakra-ui/react";
import connectDB from "@/database/db";
import GameData from "@/database/gameDataSchema";

//in the mongodb, saveId's are unique,
//this is cool but this unique is enforced across all users (better if only for specific user)

//TEST IT OUT!
//hi u can return <h1>{userId}</h1>; below, then paste ur userId into mongo and yay u can see progress

export default async function PlayerDashboard() {
  // VERY helpful info if your confused on auth https://clerk.com/docs/reference/nextjs/app-router/auth
  const { userId } = await (await auth()).protect(); //redirects if signed out
  await connectDB();

  //Ensure the saveId route is protected /api/gameData/:saveId
  const saves = await GameData.find(
    { userId, gameId: { $in: ["statesOfMatterGame", "penguinRunGame"] } }, // gameId should be one of these two
    { gameId: 1, saveId: 1, completedLevels: 1 }, //tell mongo to only return these fields from the document
  ).lean();

  const states = saves.find((s) => s.gameId === "statesOfMatterGame");
  const penguin = saves.find((s) => s.gameId === "penguinRunGame");

  const statesCompleted = states?.completedLevels?.length ?? 0;
  const penguinCompleted = penguin?.completedLevels?.length ?? 0;

  return (
    <main>
      <PlayerNavbar role="EXPLORER" name="Alex Cloudwalker" coins="1240" />
      <Box minH="100vh" bg="blue.50" display="flex" justifyContent="space-around" alignItems="center" p={8}>
        <GameCard game="statesOfMatterGame" completedLevels={statesCompleted} saveId={states?.saveId} />
        <GameCard game="penguinRunGame" completedLevels={penguinCompleted} saveId={penguin?.saveId} />
      </Box>
    </main>
  );
}
