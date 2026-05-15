import { Box, HStack, Spacer, Button } from "@chakra-ui/react";
import Link from "next/link";
import { useState } from "react";
import "@/styles/playernavbar.css";
import ProfileCard from "@/components/ProfileCard"; // for whenever K1-33 is done

export function PlayerNavbar() {
  const [showProfile, setShowProfile] = useState(false);

  return (
    <Box
      as="header"
      w="full"
      bg="gray.50"
      px={{ base: 4, md: 8 }}
      py={2}
      borderBottom="1px solid"
      borderColor="gray.200"
    >
      <HStack w="full" align="center">
        <HStack>
          <Link href="/dashboard">
            <Button variant="ghost" borderRadius="full">
              🏠 Home
            </Button>
          </Link>
          <Link href="/statesOfMatterGame">
            <Button borderRadius="full" bg="blue.500" color="white" _hover={{ bg: "blue.600" }}>
              🧪 Matter Lab
            </Button>
          </Link>
          <Link href="/penguinRun">
            <Button variant="ghost" borderRadius="full">
              🐾 Penguin Run
            </Button>
          </Link>
        </HStack>

        <Spacer />

        <Button variant="ghost" borderRadius="full" onClick={() => setShowProfile(true)}>
          👤 Profile
        </Button>
      </HStack>

      {showProfile && <ProfileCard onClose={() => setShowProfile(false)} />}
    </Box>
  );
}
