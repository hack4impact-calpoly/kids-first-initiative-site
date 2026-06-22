"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { SignIn, useUser } from "@clerk/nextjs";
import { Box, Button, Flex, Heading, Input, Link as ChakraLink, Stack, Text, Tooltip } from "@chakra-ui/react";

const FACILITATOR_LOGIN_ROUTE = "/login/facilitator";

const NAVY = "#211E5D";
const CARD_BG = "#F8F8F8";
const INPUT_BORDER = "#D9D9D9";
const LINK_BLUE = "#4476BB";

const fieldInputStyle = {
  width: "100%",
  height: "56px",
  borderRadius: "10px",
  border: `1.5px solid ${INPUT_BORDER}`,
  bg: "white",
  textAlign: "left" as const,
  fontSize: "lg",
  fontWeight: 600,
  px: 4,
  _focus: { borderColor: NAVY, boxShadow: `0 0 0 1px ${NAVY}` },
};

const CLASSROOM_SESSION_KEY = "kfi_current_classroom_session";
const GUEST_TOKEN_KEY = "kfi_guest_participant_token";

function getStoredGuestToken() {
  if (typeof window === "undefined") return "";

  const existing = window.sessionStorage.getItem(GUEST_TOKEN_KEY);
  if (existing) return existing;

  const created = crypto.randomUUID();
  window.sessionStorage.setItem(GUEST_TOKEN_KEY, created);
  return created;
}

export default function PlayerLoginPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const rest = params?.rest as string[] | undefined;
  const isClerkRoute = rest && rest.length > 0;

  const [studentName, setStudentName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const prefilledCode = searchParams.get("code")?.trim().toUpperCase();
    if (prefilledCode) {
      setCode(prefilledCode);
    }
  }, [searchParams]);

  useEffect(() => {
    if (user && !studentName.trim()) {
      const suggestedName = user.fullName?.trim() || user.username?.trim() || user.firstName?.trim() || "";
      if (suggestedName) {
        setStudentName(suggestedName);
      }
    }
  }, [studentName, user]);

  const normalizedCode = code.trim().toUpperCase();
  const canSubmit = normalizedCode.length >= 4 && studentName.trim().length > 0;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || loading) return;

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/classroom-sessions/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: normalizedCode,
          displayName: studentName.trim(),
          guestToken: getStoredGuestToken(),
        }),
      });

      const result = (await response.json()) as {
        error?: string;
        sessionId?: string;
        title?: string;
        participant?: { displayName: string };
      };

      if (!response.ok || !result.sessionId) {
        throw new Error(result.error || "Unable to join classroom session.");
      }

      window.localStorage.setItem(
        CLASSROOM_SESSION_KEY,
        JSON.stringify({
          sessionId: result.sessionId,
          title: result.title,
          displayName: result.participant?.displayName ?? studentName.trim(),
          code: normalizedCode,
        }),
      );
      window.sessionStorage.removeItem(GUEST_TOKEN_KEY);

      router.push("/playerDashboard");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to join classroom session.");
    } finally {
      setLoading(false);
    }
  };

  if (isClerkRoute) {
    return (
      <Flex height="100vh" alignItems="center" justifyContent="center">
        <SignIn path="/login/player" />
      </Flex>
    );
  }

  return (
    <Flex minH="100vh" bg="white" justify="center" pt={{ base: "48px", md: "96px" }} px={4}>
      <Stack gap={6} align="center" w="full" maxW="640px">
        <Stack gap={2} align="center" textAlign="center">
          <Heading as="h1" fontSize={{ base: "2xl", md: "3xl" }} color="black" fontWeight={700}>
            Hello!{" "}
            <Box as="span" role="img" aria-label="waving hand">
              👋
            </Box>
          </Heading>
          <Text color="gray.600" fontSize="md">
            Enter your name and classroom access code to begin.
          </Text>
        </Stack>

        <Box
          as="form"
          onSubmit={handleSubmit}
          bg={CARD_BG}
          borderRadius="12px"
          px={{ base: 6, md: 10 }}
          py={{ base: 6, md: 8 }}
          w="full"
        >
          <Stack gap={6} align="center">
            <Stack gap={4} w="full">
              <Box w="full">
                <Text fontWeight={700} fontSize="sm" color="black" mb={2}>
                  Student Name
                </Text>
                <Input
                  value={studentName}
                  onChange={(event) => setStudentName(event.target.value)}
                  placeholder="Enter your name"
                  autoComplete="name"
                  {...fieldInputStyle}
                />
              </Box>

              <Box w="full">
                <Text fontWeight={700} fontSize="sm" color="black" mb={2}>
                  Access Code
                </Text>
                <Input
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  placeholder="ABCDEF-123"
                  autoCapitalize="characters"
                  spellCheck={false}
                  {...fieldInputStyle}
                />
              </Box>
            </Stack>

            {error ? (
              <Box w="full" borderRadius="10px" bg="#FFF3F3" border="1px solid #F3B3B3" px={4} py={3}>
                <Text color="#9B2C2C" fontSize="sm" fontWeight={600}>
                  {error}
                </Text>
              </Box>
            ) : null}

            <Button
              type="submit"
              disabled={!canSubmit || loading}
              bg={NAVY}
              color="white"
              _hover={{ bg: "#1a1850" }}
              opacity={canSubmit ? 1 : 0.6}
              h="48px"
              w="full"
              borderRadius="10px"
              fontWeight={600}
              fontSize="md"
            >
              {loading ? "Joining..." : "Continue"}
            </Button>

            <Tooltip.Root openDelay={150}>
              <Tooltip.Trigger asChild>
                <Text
                  as="span"
                  color={LINK_BLUE}
                  fontSize="sm"
                  fontWeight={500}
                  textDecoration="underline"
                  cursor="help"
                  tabIndex={0}
                >
                  What is an access code?
                </Text>
              </Tooltip.Trigger>
              <Tooltip.Positioner>
                <Tooltip.Content
                  bg="gray.800"
                  color="white"
                  fontSize="sm"
                  px={3}
                  py={2}
                  borderRadius="6px"
                  maxW="260px"
                >
                  Ask your teacher or parent for your classroom code.
                </Tooltip.Content>
              </Tooltip.Positioner>
            </Tooltip.Root>
          </Stack>
        </Box>

        <Text color="gray.600" fontSize="sm" textAlign="center" pt={2}>
          Are you a teacher or parent?{" "}
          <ChakraLink href={FACILITATOR_LOGIN_ROUTE} color={LINK_BLUE} fontWeight={700} textDecoration="underline">
            Switch to Facilitator View
          </ChakraLink>
        </Text>
      </Stack>
    </Flex>
  );
}
