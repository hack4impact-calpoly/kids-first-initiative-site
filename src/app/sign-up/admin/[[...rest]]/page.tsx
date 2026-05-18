"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SignUp, useAuth, useSignUp } from "@clerk/nextjs";
import { Box, Button, chakra, Flex, Heading, Input, Link as ChakraLink, PinInput, Stack, Text } from "@chakra-ui/react";

const LOGIN_ROUTE = "/login/admin";
const POST_SIGNUP_ROUTE = "/signupredirect";

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

type Role = "educator" | "parent";
type Step = "form" | "verify_email";

type ClerkApiError = { errors?: Array<{ longMessage?: string; message?: string }> };
const messageFromClerkError = (err: unknown, fallback: string) => {
  const e = err as ClerkApiError;
  return e?.errors?.[0]?.longMessage || e?.errors?.[0]?.message || fallback;
};

function PasswordRequirement({ met, text }: { met: boolean; text: string }) {
  return (
    <Flex align="center" gap={2}>
      <Text as="span" fontSize="xs" fontWeight={700} color={met ? "green.600" : "gray.400"} w="10px">
        {met ? "✓" : "•"}
      </Text>
      <Text fontSize="xs" color={met ? "green.700" : "gray.600"}>
        {text}
      </Text>
    </Flex>
  );
}

type RoleCardProps = {
  selected: boolean;
  emoji: string;
  title: string;
  subtitle: string;
  onClick: () => void;
};

function RoleCard({ selected, emoji, title, subtitle, onClick }: RoleCardProps) {
  return (
    <chakra.button
      type="button"
      onClick={onClick}
      flex="1"
      textAlign="left"
      bg={selected ? NAVY : "white"}
      color={selected ? "white" : "black"}
      border={selected ? "none" : `1px solid ${INPUT_BORDER}`}
      borderRadius="10px"
      px={4}
      py={3}
      _hover={{ bg: selected ? "#1a1850" : "gray.50" }}
      cursor="pointer"
    >
      <Stack gap={1} align="flex-start">
        <Flex align="center" gap={2}>
          <Box as="span" fontSize="lg" aria-hidden>
            {emoji}
          </Box>
          <Text fontWeight={700} fontSize="sm">
            {title}
          </Text>
        </Flex>
        <Text fontSize="xs" color={selected ? "whiteAlpha.800" : "gray.600"}>
          {subtitle}
        </Text>
      </Stack>
    </chakra.button>
  );
}

export default function AdminSignUpPage() {
  const params = useParams();
  const rest = params?.rest as string[] | undefined;
  const isClerkRoute = rest && rest.length > 0;

  const router = useRouter();
  const { isLoaded, signUp, setActive } = useSignUp();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (authLoaded && isSignedIn) {
      router.replace("/adminDashboard");
    }
  }, [authLoaded, isSignedIn, router]);

  // TODO(K1-79): persist chosen role to Mongo via /signupredirect (currently local only).
  const [role, setRole] = useState<Role>("educator");
  const [step, setStep] = useState<Step>("form");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState<string[]>(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const passwordLongEnough = password.length >= 8;
  const passwordHasLetter = /[a-zA-Z]/.test(password);
  const passwordHasNumber = /\d/.test(password);
  const passwordHasSpecial = /[^A-Za-z0-9]/.test(password);
  const passwordValid = passwordLongEnough && passwordHasLetter && passwordHasNumber && passwordHasSpecial;
  const canSubmitForm =
    username.trim().length > 0 &&
    email.trim().length > 0 &&
    schoolName.trim().length > 0 &&
    passwordValid &&
    passwordsMatch;
  const isCodeComplete = code.every((c) => c.length === 1);

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !canSubmitForm || loading) return;
    setError("");
    setLoading(true);
    try {
      const result = await signUp.create({
        username: username.trim(),
        emailAddress: email.trim(),
        password,
        unsafeMetadata: {
          // TODO(K1-79): /signupredirect reads these to set role + school in Mongo
          role,
          schoolName: schoolName.trim(),
        },
      });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace(POST_SIGNUP_ROUTE);
        return;
      }
      // Common case: Clerk requires email verification before activating the session.
      if (result.unverifiedFields?.includes("email_address")) {
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        setCode(["", "", "", "", "", ""]);
        setStep("verify_email");
        return;
      }
      // Anything else (phone verification, other requirements, captcha redirect, etc.) hands off to Clerk's drop-in.
      router.replace("/sign-up/admin/factor-one");
    } catch (err) {
      setError(messageFromClerkError(err, "Could not create the account. Please check the fields and try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !isCodeComplete || loading) return;
    setError("");
    setLoading(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code: code.join("") });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace(POST_SIGNUP_ROUTE);
        return;
      }
      router.replace("/sign-up/admin/factor-one");
    } catch (err) {
      setError(messageFromClerkError(err, "That code didn't work. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!isLoaded || !signUp || loading) return;
    setError("");
    setLoading(true);
    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
    } catch (err) {
      setError(messageFromClerkError(err, "Could not resend the code."));
    } finally {
      setLoading(false);
    }
  };

  const restartSignUp = () => {
    setStep("form");
    setCode(["", "", "", "", "", ""]);
    setError("");
  };

  if (isClerkRoute) {
    return (
      <Flex height="100vh" alignItems="center" justifyContent="center">
        <SignUp path="/sign-up/admin" signInUrl={LOGIN_ROUTE} forceRedirectUrl={POST_SIGNUP_ROUTE} />
      </Flex>
    );
  }

  return (
    <Flex minH="100vh" bg="white" justify="center" pt={{ base: "48px", md: "72px" }} px={4} pb={8}>
      <Stack gap={6} align="center" w="full" maxW="560px">
        <Stack gap={2} align="center" textAlign="center">
          <Heading as="h1" fontSize={{ base: "2xl", md: "3xl" }} color="black" fontWeight={700}>
            Create Your Account
          </Heading>
          <Text color="gray.600" fontSize="md">
            {step === "form"
              ? "Choose your role to get started."
              : `Enter the 6-digit code sent to ${email || "your email"}.`}
          </Text>
        </Stack>

        {step === "form" ? (
          <Box as="form" onSubmit={handleFormSubmit} w="full">
            <Stack gap={4}>
              <Stack gap={2}>
                <Text fontWeight={700} fontSize="sm" color="black">
                  I am a(n)...
                </Text>
                <Flex gap={3} direction={{ base: "column", sm: "row" }}>
                  <RoleCard
                    selected={role === "educator"}
                    emoji="🏫"
                    title="Educator"
                    subtitle="Set up a classroom & share access codes"
                    onClick={() => setRole("educator")}
                  />
                  <RoleCard
                    selected={role === "parent"}
                    emoji="👨‍👩‍👧"
                    title="Parent/Guardian"
                    subtitle="Monitor your child's game progress"
                    onClick={() => setRole("parent")}
                  />
                </Flex>
              </Stack>

              <Box bg={CARD_BG} borderRadius="12px" px={{ base: 6, md: 8 }} py={{ base: 6, md: 7 }} w="full">
                <Stack gap={4} align="stretch">
                  <Stack gap={1}>
                    <Text fontWeight={700} fontSize="sm" color="black">
                      Username
                    </Text>
                    <Input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter username"
                      autoComplete="username"
                      {...fieldInputStyle}
                    />
                  </Stack>

                  <Stack gap={1}>
                    <Text fontWeight={700} fontSize="sm" color="black">
                      Email Address
                    </Text>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter email"
                      autoComplete="email"
                      {...fieldInputStyle}
                    />
                  </Stack>

                  <Stack gap={1}>
                    <Text fontWeight={700} fontSize="sm" color="black">
                      School / Organization Name
                    </Text>
                    <Input
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      placeholder="Name"
                      autoComplete="organization"
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
                      placeholder="Enter password"
                      autoComplete="new-password"
                      {...fieldInputStyle}
                    />
                    {password.length > 0 && (
                      <Stack gap={1} pl={1} pt={1}>
                        <PasswordRequirement met={passwordLongEnough} text="At least 8 characters" />
                        <PasswordRequirement met={passwordHasLetter} text="Contains a letter" />
                        <PasswordRequirement met={passwordHasNumber} text="Contains a number" />
                        <PasswordRequirement met={passwordHasSpecial} text="Contains a special character" />
                      </Stack>
                    )}
                  </Stack>

                  <Stack gap={1}>
                    <Text fontWeight={700} fontSize="sm" color="black">
                      Confirm Password
                    </Text>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      autoComplete="new-password"
                      {...fieldInputStyle}
                    />
                  </Stack>

                  {password.length > 0 && confirmPassword.length > 0 && !passwordsMatch && (
                    <Text color="red.600" fontSize="sm" textAlign="center">
                      Passwords don&apos;t match.
                    </Text>
                  )}

                  <div id="clerk-captcha" />

                  {error && (
                    <Text color="red.600" fontSize="sm" textAlign="center">
                      {error}
                    </Text>
                  )}

                  <Button
                    type="submit"
                    disabled={!canSubmitForm || loading}
                    bg={NAVY}
                    color="white"
                    _hover={{ bg: "#1a1850" }}
                    opacity={canSubmitForm ? 1 : 0.6}
                    h="48px"
                    w="full"
                    borderRadius="12px"
                    fontWeight={600}
                    fontSize="md"
                  >
                    {loading ? "Creating..." : "Create Account"}
                  </Button>

                  <Box h="1px" bg={INPUT_BORDER} mt={2} />

                  <Text color="gray.600" fontSize="sm" textAlign="center">
                    Already have an account?{" "}
                    <ChakraLink href={LOGIN_ROUTE} color={LINK_BLUE} fontWeight={700} textDecoration="underline">
                      Log In
                    </ChakraLink>
                  </Text>
                </Stack>
              </Box>
            </Stack>
          </Box>
        ) : (
          <Box
            as="form"
            onSubmit={handleVerifyCode}
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
                {loading ? "Verifying..." : "Verify & Create Account"}
              </Button>

              <Flex gap={4} justify="center" wrap="wrap">
                <ChakraLink
                  as="button"
                  type="button"
                  onClick={handleResendCode}
                  color={LINK_BLUE}
                  fontSize="sm"
                  fontWeight={500}
                >
                  Resend code
                </ChakraLink>
                <ChakraLink
                  as="button"
                  type="button"
                  onClick={restartSignUp}
                  color="gray.600"
                  fontSize="sm"
                  fontWeight={500}
                >
                  Edit details
                </ChakraLink>
              </Flex>
            </Stack>
          </Box>
        )}
      </Stack>
    </Flex>
  );
}
