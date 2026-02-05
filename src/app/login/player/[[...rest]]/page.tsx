"use client";

import { SignIn } from "@clerk/nextjs";
import { Flex, Box } from "@chakra-ui/react";

export default function PlayerLoginPage() {
  return (
    <>
      <Flex height="100vh" alignItems="center" justifyContent="center">
        {/* We use a Box for the scaling transform */}
        <Box transform="scale(1.2)">
          <SignIn path="/login/player" />
        </Box>
      </Flex>
    </>
  );
}
