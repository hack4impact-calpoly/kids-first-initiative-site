"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SignIn, useAuth, useSignIn } from "@clerk/nextjs";
import {
  Box,
  Button,
  Flex,
  Heading,
  Input,
  Link as ChakraLink,
  PinInput,
  Stack,
  Text,
  Tooltip,
} from "@chakra-ui/react";

const SIGNUP_ROUTE = "/sign-up/admin";

const NAVY = "#211E5D";
const CARD_BG = "#F8F8F8";
const INPUT_BORDER = "#D9D9D9";
const LINK_BLUE = "#4476BB";

const fieldInputStyle = {
  bg: "white",
  border: `1px solid ${INPUT_BORDER}`,
  borderRadius: "8px",
  h: "44px",
  px: 3,
  fontSize: "sm",
  _focus: { borderColor: NAVY, boxShadow: `0 0 0 1px ${NAVY}` },
};

const codeBoxStyle = {
  width: "48px",
  height: "56px",
  borderRadius: "7px",
  border: `1.5px solid ${INPUT_BORDER}`,
  bg: "white",
  textAlign: "center" as const,
  fontSize: "xl",
  fontWeight: 600,
  _focus: { borderColor: NAVY, boxShadow: `0 0 0 1px ${NAVY}` },
};

type Step = "credentials" | "verify_totp";

type ClerkApiError = { errors?: Array<{ longMessage?: string; message?: string }> };
const messageFromClerkError = (err: unknown, fallback: string) => {
  const e = err as ClerkApiError;
  return e?.errors?.[0]?.longMessage || e?.errors?.[0]?.message || fallback;
};

export default function AdminLoginPage() {
  const params = useParams();
  const rest = params?.rest as string[] | undefined;
  const isClerkRoute = rest && rest.length > 0;

  const router = useRouter();
  const { isLoaded, signIn, setActive } = useSignIn();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (authLoaded && isSignedIn) {
      router.replace("/adminDashboard");
    }
  }, [authLoaded, isSignedIn, router]);

  const [step, setStep] = useState<Step>("credentials");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState<string[]>(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = identifier.trim().length > 0 && password.length > 0;
  const isCodeComplete = code.every((c) => c.length === 1);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !canSubmit || loading) return;
    setError("");
    setLoading(true);
    try {
      const result = await signIn.create({ identifier, password });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/adminDashboard");
        return;
      }
      if (result.status === "needs_second_factor") {
        const hasTotp = (result.supportedSecondFactors ?? []).some((f) => f.strategy === "totp");
        if (hasTotp) {
          setCode(["", "", "", "", "", ""]);
          setStep("verify_totp");
          return;
        }
      }
      // Anything else (needs_first_factor, needs_new_password, non-TOTP second factor, captcha, etc.)
      // hands off to Clerk's drop-in via the [[...rest]] catch-all.
      router.replace("/login/admin/factor-one");
    } catch (err) {
      setError(messageFromClerkError(err, "Sign in failed. Check your credentials and try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyTotp = async (e: FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !isCodeComplete || loading) return;
    setError("");
    setLoading(true);
    try {
      const result = await signIn.attemptSecondFactor({
        strategy: "totp",
        code: code.join(""),
      });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/adminDashboard");
        return;
      }
      router.replace("/login/admin/factor-one");
    } catch (err) {
      setError(messageFromClerkError(err, "That code didn't work. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const restartSignIn = () => {
    setStep("credentials");
    setCode(["", "", "", "", "", ""]);
    setError("");
  };

  if (isClerkRoute) {
    return (
      <Flex height="100vh" alignItems="center" justifyContent="center">
        <SignIn path="/login/admin" forceRedirectUrl="/adminDashboard" />
      </Flex>
    );
  }

  return (
    <Flex minH="100vh" bg="white" justify="center" pt={{ base: "48px", md: "96px" }} px={4}>
      <Stack gap={6} align="center" w="full" maxW="520px">
        <Stack gap={2} align="center" textAlign="center">
          <Heading as="h1" fontSize={{ base: "2xl", md: "3xl" }} color="black" fontWeight={700}>
            Welcome Back
          </Heading>
          <Text color="gray.600" fontSize="md">
            {step === "credentials"
              ? "Log in to your KFI account."
              : "Enter the 6-digit code from your authenticator app."}
          </Text>
        </Stack>

        {step === "credentials" ? (
          <Box
            as="form"
            onSubmit={handleSubmit}
            bg={CARD_BG}
            borderRadius="12px"
            px={{ base: 6, md: 8 }}
            py={{ base: 6, md: 7 }}
            w="full"
          >
            <Stack gap={4} align="stretch">
              <Stack gap={1}>
                <Text fontWeight={700} fontSize="sm" color="black">
                  Username or Email
                </Text>
                <Input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Placeholder"
                  autoComplete="username"
                  {...fieldInputStyle}
                />
              </Stack>

              <Stack gap={1}>
                <Text fontWeight={700} fontSize="sm" color="black">
                  Password
                </Text>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Placeholder"
                  autoComplete="current-password"
                  {...fieldInputStyle}
                />
              </Stack>

              <div id="clerk-captcha" />

              {/* TODO(future ticket): wire to Clerk reset_password_email_code flow */}
              <Tooltip.Root openDelay={150}>
                <Tooltip.Trigger asChild>
                  <Text
                    as="span"
                    color={LINK_BLUE}
                    fontSize="sm"
                    fontWeight={500}
                    textAlign="center"
                    alignSelf="center"
                    cursor="help"
                    tabIndex={0}
                  >
                    Forgot Password?
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
                    Password reset isn&apos;t available yet — coming soon.
                  </Tooltip.Content>
                </Tooltip.Positioner>
              </Tooltip.Root>

              {error && (
                <Text color="red.600" fontSize="sm" textAlign="center">
                  {error}
                </Text>
              )}

              <Button
                type="submit"
                disabled={!canSubmit || loading}
                bg={NAVY}
                color="white"
                _hover={{ bg: "#1a1850" }}
                opacity={canSubmit ? 1 : 0.6}
                h="48px"
                w="full"
                borderRadius="12px"
                fontWeight={600}
                fontSize="md"
              >
                {loading ? "Logging in..." : "Log In"}
              </Button>

              <Box h="1px" bg={INPUT_BORDER} mt={2} />

              <Text color="gray.600" fontSize="sm" textAlign="center">
                Don&apos;t have an account?{" "}
                <ChakraLink href={SIGNUP_ROUTE} color={LINK_BLUE} fontWeight={700} textDecoration="underline">
                  Sign Up
                </ChakraLink>
              </Text>
            </Stack>
          </Box>
        ) : (
          <Box
            as="form"
            onSubmit={handleVerifyTotp}
            bg={CARD_BG}
            borderRadius="12px"
            px={{ base: 6, md: 8 }}
            py={{ base: 6, md: 7 }}
            w="full"
          >
            <Stack gap={5} align="center">
              <PinInput.Root value={code} onValueChange={(e) => setCode(e.value)} otp>
                <PinInput.Control display="flex" alignItems="center" gap="10px">
                  <PinInput.Input index={0} {...codeBoxStyle} />
                  <PinInput.Input index={1} {...codeBoxStyle} />
                  <PinInput.Input index={2} {...codeBoxStyle} />
                  <PinInput.Input index={3} {...codeBoxStyle} />
                  <PinInput.Input index={4} {...codeBoxStyle} />
                  <PinInput.Input index={5} {...codeBoxStyle} />
                </PinInput.Control>
                <PinInput.HiddenInput />
              </PinInput.Root>

              {error && (
                <Text color="red.600" fontSize="sm" textAlign="center">
                  {error}
                </Text>
              )}

              <Button
                type="submit"
                disabled={!isCodeComplete || loading}
                bg={NAVY}
                color="white"
                _hover={{ bg: "#1a1850" }}
                opacity={isCodeComplete ? 1 : 0.6}
                h="48px"
                w="full"
                borderRadius="12px"
                fontWeight={600}
                fontSize="md"
              >
                {loading ? "Verifying..." : "Verify & Log In"}
              </Button>

              <ChakraLink
                as="button"
                type="button"
                onClick={restartSignIn}
                color="gray.600"
                fontSize="sm"
                fontWeight={500}
                textAlign="center"
                alignSelf="center"
              >
                Use a different account
              </ChakraLink>
            </Stack>
          </Box>
        )}
      </Stack>
    </Flex>
  );
}
