"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Flex, Spinner } from "@chakra-ui/react";

function getClerkName(nameParts: Array<string | null | undefined>) {
  return nameParts.filter(Boolean).join(" ").trim();
}

export default function SignUpRedirectPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasPosted = useRef(false);
  const role = searchParams.get("role") || "player";

  useEffect(() => {
    if (!isLoaded || hasPosted.current) return;

    if (!isSignedIn || !user) {
      router.replace("/login/player");
      return;
    }

    const email = user.primaryEmailAddress?.emailAddress;
    if (!email) {
      console.error("Unable to create database user: missing Clerk email address.");
      router.replace("/login/player");
      return;
    }

    hasPosted.current = true;

    const createUser = async () => {
      const name = user.fullName?.trim() || getClerkName([user.firstName, user.lastName]) || user.username || "Player";

      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          role,
          email,
          clerkId: user.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create player record.");
      }

      router.replace("/playerDashboard");
    };

    createUser().catch((error) => {
      console.error(error);
      hasPosted.current = false;
      router.replace("/login/player");
    });
  }, [isLoaded, isSignedIn, role, router, user]);

  return (
    <Flex minH="100vh" align="center" justify="center">
      <Spinner size="xl" color="green.500" />
    </Flex>
  );
}
