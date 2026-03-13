"use client";

import { useUser, SignOutButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Flex, Heading, Text, VStack, Box, Button, Spinner } from "@chakra-ui/react";
import { useEffect } from "react";

export default function AdminDashboardPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  // 1. SECURITY CHECK (Client Side)
  useEffect(() => {
    if (isLoaded) {
      if (!user) {
        // Not logged in? Go to login
        router.push("/login/admin");
      } else if (user.publicMetadata?.role !== "admin") {
        // Logged in but not Admin? Kick them out
        router.push("/");
      }
    }
  }, [isLoaded, user, router]);

  // 2. Loading State (Prevents "Flash" of content)
  if (!isLoaded) {
    return (
      <Flex height="100vh" alignItems="center" justifyContent="center">
        <Spinner size="xl" color="blue.500" />
      </Flex>
    );
  }

  // 3. Final Gate: If checks fail, don't show anything (wait for redirect)
  if (!user || user.publicMetadata?.role !== "admin") return null;

  // 4. Render Dashboard
  return (
    <Flex height="100vh" alignItems="center" justifyContent="center">
      <VStack gap={4}>
        <Heading color="blue.600">Admin Dashboard</Heading>
        <Text>Welcome, {user.firstName}! You have full access.</Text>
        <Text fontSize="sm" color="gray.500">
          Security Status: Verified Admin
        </Text>

        {/* THIS BUTTON KILLS THE SESSION INSTANTLY */}
        <Box>
          <SignOutButton redirectUrl="/login/admin">
            <Button colorScheme="red">Sign Out (Reset Test)</Button>
          </SignOutButton>
        </Box>
      </VStack>
    </Flex>
  );
}
