"use client";

import { SignIn } from "@clerk/nextjs";
import { Box, Flex, Heading, Link, Text, VStack } from "@chakra-ui/react";
import NextLink from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import styles from "./playerLogin.module.css";

export default function PlayerLoginPage() {
  const params = useParams();
  const rest = params?.rest as string[] | undefined;
  const isClerkRoute = rest && rest.length > 0;

  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (!accessCode.trim()) {
      setError("Please enter an access code.");
      return;
    }
    console.log("Access code submitted:", accessCode);
  };

  //if handling a sub royte show sign in
  if (isClerkRoute) {
    return (
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center" }}>
        <SignIn path="/login/player" />
      </div>
    );
  }

  // otherwise show the access code page
  return (
    <Flex height="100vh" alignItems="center" justifyContent="center" bg="gray.50">
      <VStack gap={8}>
        {/* Header Section */}
        <VStack gap={2} mb={6} textAlign="center">
          <Heading as="h1" size="xl" color="green.500">
            Welcome, Player!
          </Heading>
          <Text color="gray.500">Enter your email to start playing.</Text>
        </VStack>

        {/* Login Box */}
        <Box transform="scale(1.2)">
          <SignIn
            path="/login/player"
            forceRedirectUrl="/playerDashboard"
            appearance={{
              elements: {
                footerAction: { display: "none" }, // Hides the default broken "Sign up" link
              },
              layout: {
                showOptionalFields: false,
              },
            }}
          />
        </Box>

        {/* CUSTOM FOOTER */}
        {/* Changed mt={4} to mt={10} to give the scaled box more room */}
        <Text fontSize="md" color="gray.600" mt={10}>
          Don&apos;t have an account?{" "}
          <Link as={NextLink} href="/sign-up/player" color="green.500" fontWeight="bold">
            Sign up here
          </Link>
        </Text>
      </VStack>
    </Flex>
  );
}
