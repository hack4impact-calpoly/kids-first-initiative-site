"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { SignIn } from "@clerk/nextjs";
import { Box, Button, Flex, Heading, Link as ChakraLink, PinInput, Stack, Text, Tooltip } from "@chakra-ui/react";

const FACILITATOR_LOGIN_ROUTE = "/login/facilitator";

const NAVY = "#211E5D";
const CARD_BG = "#F8F8F8";
const INPUT_BORDER = "#D9D9D9";
const LINK_BLUE = "#4476BB";

const inputBoxStyle = {
  width: "55px",
  height: "62px",
  borderRadius: "7px",
  border: `1.5px solid ${INPUT_BORDER}`,
  bg: "white",
  textAlign: "center" as const,
  fontSize: "xl",
  fontWeight: 600,
  _focus: { borderColor: NAVY, boxShadow: `0 0 0 1px ${NAVY}` },
};

export default function PlayerLoginPage() {
  const params = useParams();
  const rest = params?.rest as string[] | undefined;
  const isClerkRoute = rest && rest.length > 0;

  const [code, setCode] = useState<string[]>(["", "", "", "", "", ""]);
  const isComplete = code.every((c) => c.length === 1);

  const handleSubmit = () => {
    if (!isComplete) return;
    // TODO(K1-68): submit access code to backend session-join endpoint
    console.log("Access code submitted:", code.join(""));
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
            Enter your classroom access code to begin.
          </Text>
        </Stack>

        <Box bg={CARD_BG} borderRadius="12px" px={{ base: 6, md: 10 }} py={{ base: 6, md: 8 }} w="full">
          <Stack gap={6} align="center">
            <Text fontWeight={700} fontSize="lg" color="black">
              Access Code
            </Text>

            <PinInput.Root value={code} onValueChange={(e) => setCode(e.value)}>
              <PinInput.Control display="flex" alignItems="center" gap="14px">
                <PinInput.Input index={0} {...inputBoxStyle} />
                <PinInput.Input index={1} {...inputBoxStyle} />
                <PinInput.Input index={2} {...inputBoxStyle} />
                <Text color="gray.400" fontSize="2xl" fontWeight={500} px={1} aria-hidden>
                  —
                </Text>
                <PinInput.Input index={3} {...inputBoxStyle} />
                <PinInput.Input index={4} {...inputBoxStyle} />
                <PinInput.Input index={5} {...inputBoxStyle} />
              </PinInput.Control>
              <PinInput.HiddenInput />
            </PinInput.Root>

            <Button
              onClick={handleSubmit}
              disabled={!isComplete}
              bg={NAVY}
              color="white"
              _hover={{ bg: "#1a1850" }}
              opacity={isComplete ? 1 : 0.6}
              h="48px"
              w="full"
              borderRadius="10px"
              fontWeight={600}
              fontSize="md"
            >
              Continue
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
