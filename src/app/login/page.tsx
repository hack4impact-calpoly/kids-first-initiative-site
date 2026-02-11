"use client";

import { Box, Button, VStack, Text, Heading, Flex } from "@chakra-ui/react";
import Link from "next/link";

export default function LoginSelectionPage() {
  return (
    <Flex alignItems="center" justifyContent="center" height="100vh" bg="gray.50">
      <VStack
        gap={8} // <--- CHANGED from spacing to gap
        bg="white"
        p={10}
        borderRadius="xl"
        boxShadow="lg"
        width="100%"
        maxWidth="400px"
      >
        <Heading as="h1" size="xl" textAlign="center" color="blue.600">
          Welcome!
        </Heading>

        <Text fontSize="lg" color="gray.600">
          Please select your login type:
        </Text>

        <VStack gap={4} width="100%">
          {" "}
          {/* <--- CHANGED from spacing to gap */}
          <Link href="/login/admin" style={{ width: "100%" }}>
            <Button colorScheme="blue" size="lg" width="100%">
              I&apos;m an Admin
            </Button>
          </Link>
          <Link href="/login/player" style={{ width: "100%" }}>
            <Button colorScheme="green" size="lg" width="100%">
              I&apos;m a Player
            </Button>
          </Link>
        </VStack>
      </VStack>
    </Flex>
  );
}
