"use client";

import { SignIn } from "@clerk/nextjs";
import { Flex, Box, Heading, VStack, Text } from "@chakra-ui/react";

export default function AdminLoginPage() {
  return (
    <Flex height="100vh" alignItems="center" justifyContent="center" bg="gray.50">
      <VStack gap={8}>
        {/* Added "mb={6}" (margin-bottom) to push the text higher up, away from the card */}
        <VStack gap={2} mb={6} textAlign="center">
          <Heading as="h1" size="xl" color="blue.600">
            Welcome back, Admin!
          </Heading>
          <Text color="gray.500">Please sign in to access the dashboard.</Text>
        </VStack>

        <Box transform="scale(1.2)">
          <SignIn
            path="/login/admin"
            appearance={{
              elements: {
                footerAction: { display: "none" }, // Hides "Sign up" link at bottom
                socialButtonsBlockButton: { display: "none" }, // HIDES THE GOOGLE BUTTON
                dividerRow: { display: "none" }, // Hides the "or" divider line
              },
            }}
          />
        </Box>
      </VStack>
    </Flex>
  );
}
