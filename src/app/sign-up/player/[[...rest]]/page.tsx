"use client";

import { SignUp } from "@clerk/nextjs";
import { Flex, Box, Heading, VStack, Text, Link } from "@chakra-ui/react";
import NextLink from "next/link";

export default function PlayerSignUpPage() {
  return (
    <Flex height="100vh" alignItems="center" justifyContent="center" bg="gray.50">
      {/* GLOBAL CSS OVERRIDE */}
      <style jsx global>{`
        .cl-socialButtonsBlockButton,
        .cl-dividerRow,
        .cl-formFieldRow__emailAddress {
          display: none !important;
        }
      `}</style>

      <VStack gap={6}>
        <VStack gap={2} textAlign="center">
          <Heading as="h1" size="xl" color="green.500">
            Create Player Account
          </Heading>
          <Text color="gray.500">Pick a username to get started.</Text>
        </VStack>

        <Box transform="scale(1.2)">
          <SignUp path="/sign-up/player" signInUrl="/login/player" forceRedirectUrl="/login/player" />
        </Box>
      </VStack>
    </Flex>
  );
}
