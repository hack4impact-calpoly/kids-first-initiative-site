"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useClerk, useSignIn } from "@clerk/nextjs";
import { Box, Button, Flex, Heading, Input, Stack, Text } from "@chakra-ui/react";

const ADMIN_DASHBOARD_ROUTE = "/adminDashboard";
const ADMIN_CLERK_FALLBACK_ROUTE = "/login/admin/factor-one";
const HOME_ROUTE = "/home";
const IMPROPER_CREDENTIALS_MESSAGE =
  "You do not have the proper credentials to login as admin, try another login method.";

const NAVY = "#211E5D";
const INPUT_BORDER = "#D9D9D9";

const fieldInputStyle = {
  bg: "white",
  border: `1.5px solid ${INPUT_BORDER}`,
  borderRadius: "8px",
  h: "41px",
  px: 3,
  fontSize: "sm",
  _focus: { borderColor: NAVY, boxShadow: `0 0 0 1px ${NAVY}` },
};

type Step = "credentials" | "verify_totp";

type ClerkApiError = { errors?: Array<{ longMessage?: string; message?: string }> };
const messageFromClerkError = (err: unknown) => {
  const e = err as ClerkApiError;
  return e?.errors?.[0]?.longMessage || e?.errors?.[0]?.message || IMPROPER_CREDENTIALS_MESSAGE;
};

async function verifyAdminAccess() {
  const response = await fetch("/api/auth/admin-access", { cache: "no-store" });
  return response.ok;
}

async function signOutToImproperCredentialsHome(signOut: ReturnType<typeof useClerk>["signOut"]) {
  const searchParams = new URLSearchParams({ message: IMPROPER_CREDENTIALS_MESSAGE });
  await signOut({ redirectUrl: `${HOME_ROUTE}?${searchParams.toString()}` });
}

export default function AdminLoginPage() {
  const router = useRouter();
  const { signOut } = useClerk();
  const { isLoaded, signIn, setActive } = useSignIn();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();

  const [step, setStep] = useState<Step>("credentials");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = identifier.trim().length > 0 && password.length > 0;

  useEffect(() => {
    if (!authLoaded || !isSignedIn) return;

    let isActive = true;

    async function validateSignedInAdmin() {
      const hasAdminAccess = await verifyAdminAccess();
      if (!isActive) return;

      if (hasAdminAccess) {
        router.replace(ADMIN_DASHBOARD_ROUTE);
        return;
      }

      await signOutToImproperCredentialsHome(signOut);
    }

    validateSignedInAdmin();

    return () => {
      isActive = false;
    };
  }, [authLoaded, isSignedIn, router, signOut]);

  const finalizeAdminLogin = async (sessionId: string | null | undefined) => {
    if (!sessionId || !setActive) throw new Error(IMPROPER_CREDENTIALS_MESSAGE);

    await setActive({ session: sessionId });
    const hasAdminAccess = await verifyAdminAccess();

    if (!hasAdminAccess) {
      await signOutToImproperCredentialsHome(signOut);
      return;
    }

    router.replace(ADMIN_DASHBOARD_ROUTE);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !canSubmit || loading) return;
    setError("");
    setLoading(true);

    try {
      const result = await signIn.create({ identifier, password });

      if (result.status === "complete") {
        await finalizeAdminLogin(result.createdSessionId);
        return;
      }

      // Hand off MFA and any other additional Clerk verification requirements
      // to Clerk's hosted flow instead of forcing a specific strategy here.
      router.replace(ADMIN_CLERK_FALLBACK_ROUTE);
    } catch (err) {
      setError(messageFromClerkError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Flex minH="100vh" bg="#F7F9FB" direction="column">
      <Flex flex="1" align="center" justify="center" px={4} py={{ base: 10, md: 16 }}>
        <Box
          as="section"
          w="full"
          maxW="480px"
          bg="white"
          border="1px solid #E3E6ED"
          borderRadius="16px"
          px={{ base: 6, md: 10 }}
          py={{ base: 7, md: 10 }}
        >
          <Stack gap={6}>
            <Stack gap={2}>
              <Heading
                as="h1"
                fontFamily='"Poppins", "Trebuchet MS", "Avenir Next", sans-serif'
                fontWeight="700"
                fontSize="28px"
                lineHeight="1.4"
                letterSpacing="-0.01em"
                color="#1B1B1B"
              >
                KFI Admin Log In
              </Heading>
              <Text
                fontFamily='"Poppins", "Trebuchet MS", "Avenir Next", sans-serif'
                fontWeight="400"
                fontSize="14px"
                lineHeight="1.4"
                color="#525252"
              >
                Use the credentials issued by your KFI admin team.
              </Text>
            </Stack>

            {step === "credentials" ? (
              <Box as="form" onSubmit={handleSubmit}>
                <Stack gap={6}>
                  <Stack gap={4}>
                    <Stack gap={1}>
                      <Text fontWeight={600} fontSize="14px" lineHeight="21px" color="#1B1B1B">
                        Username
                      </Text>
                      <Input
                        value={identifier}
                        onChange={(event) => setIdentifier(event.target.value)}
                        placeholder="Placeholder"
                        autoComplete="username"
                        {...fieldInputStyle}
                      />
                    </Stack>

                    <Stack gap={1}>
                      <Text fontWeight={600} fontSize="14px" lineHeight="21px" color="#1B1B1B">
                        Password
                      </Text>
                      <Input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Placeholder"
                        autoComplete="current-password"
                        {...fieldInputStyle}
                      />
                    </Stack>
                  </Stack>

                  {error ? (
                    <Text color="red.600" fontSize="sm">
                      {error}
                    </Text>
                  ) : null}

                  <Button
                    type="submit"
                    disabled={!canSubmit || loading}
                    h="44px"
                    w="full"
                    borderRadius="12px"
                    bg={NAVY}
                    color="#F8F8F8"
                    fontFamily='"Karla", "Avenir Next", "Segoe UI", sans-serif'
                    fontWeight="600"
                    fontSize="16px"
                    _hover={{ bg: "#1a1850" }}
                    opacity={canSubmit ? 1 : 0.65}
                  >
                    {loading ? "Logging In..." : "Log In"}
                  </Button>
                </Stack>
              </Box>
            ) : null}
          </Stack>
        </Box>
      </Flex>
    </Flex>
  );
}
