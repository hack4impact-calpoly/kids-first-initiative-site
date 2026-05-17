import { Box, Container, Flex, Grid, Heading, HStack, Link as ChakraLink, Text, VStack } from "@chakra-ui/react";
import type { ReactNode } from "react";

const STUDENT_ACCESS_CODE_ROUTE = "/login/player";
const FACILITATOR_LOGIN_ROUTE = "/login/admin";
const AUTH_SIGNUP_ROUTE = "/sign-up/admin";

type EntryCardProps = {
  accentBg: string;
  icon: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  primary?: boolean;
  footer?: ReactNode;
};

function EntryCard({ accentBg, icon, title, description, ctaLabel, ctaHref, primary = false, footer }: EntryCardProps) {
  return (
    <Box bg="white" borderRadius="18px" overflow="hidden" border="1px solid" borderColor="gray.200" minH="380px">
      <Flex align="center" justify="center" h={{ base: "130px", md: "150px" }} bg={accentBg} fontSize="56px">
        <Text aria-hidden>{icon}</Text>
      </Flex>

      <VStack align="stretch" gap={5} px={{ base: 5, md: 7 }} py={{ base: 6, md: 7 }}>
        <VStack align="stretch" gap={2}>
          <Heading as="h2" fontSize={{ base: "2xl", md: "3xl" }} color="gray.900" lineHeight="1.1">
            {title}
          </Heading>
          <Text color="gray.600" fontSize={{ base: "md", md: "lg" }} lineHeight="1.5">
            {description}
          </Text>
        </VStack>

        <ChakraLink
          href={ctaHref}
          display="inline-flex"
          alignItems="center"
          justifyContent="center"
          h="54px"
          fontSize="xl"
          fontWeight="700"
          borderRadius="14px"
          bg={primary ? "#2d2a72" : "white"}
          color={primary ? "white" : "#2b6dc9"}
          border={primary ? "none" : "2px solid"}
          borderColor={primary ? "transparent" : "#2b6dc9"}
          textDecoration="none"
          _hover={{
            bg: primary ? "#25225f" : "blue.50",
            textDecoration: "none",
          }}
        >
          {ctaLabel}
        </ChakraLink>

        {footer}
      </VStack>
    </Box>
  );
}

export default function Home() {
  return (
    <Box minH="100vh" bg="#f3f5f8" px={{ base: 4, md: 8 }} pb={{ base: 8, md: 12 }}>
      <Container maxW="6xl" pt={{ base: 10, md: 16 }}>
        <VStack textAlign="center" gap={4} mb={{ base: 8, md: 12 }}>
          <Text fontWeight="800" color="#3554a6" letterSpacing="0.08em" textTransform="uppercase" fontSize="sm">
            Welcome
          </Text>
          <Heading as="h1" fontSize={{ base: "4xl", md: "6xl" }} lineHeight="1.05" color="gray.900">
            Let&apos;s play &amp; learn.
          </Heading>
          <Text color="gray.600" fontSize={{ base: "lg", md: "2xl" }}>
            Pick the option that fits you.
          </Text>

          <HStack gap={5} pt={1} color="gray.700" fontWeight="600" fontSize="sm">
            <ChakraLink href={FACILITATOR_LOGIN_ROUTE} _hover={{ color: "blue.600" }}>
              Log In
            </ChakraLink>
            <ChakraLink href={AUTH_SIGNUP_ROUTE} _hover={{ color: "blue.600" }}>
              Sign Up
            </ChakraLink>
          </HStack>
        </VStack>

        <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={6}>
          <EntryCard
            accentBg="#c8daf1"
            icon="🎮"
            title="I'm a Student"
            description="Got an access code from your teacher or parent? Jump in and start playing."
            ctaLabel="Enter Access Code"
            ctaHref={STUDENT_ACCESS_CODE_ROUTE}
            primary
          />

          <EntryCard
            accentBg="#dcc8e6"
            icon="👩‍🏫"
            title="I'm a Facilitator"
            description="Teachers and parents sign in to set up classrooms, hand off to your kids, and review progress."
            ctaLabel="Sign In"
            ctaHref={FACILITATOR_LOGIN_ROUTE}
            footer={
              <Text fontSize="sm" color="gray.600" textAlign="center">
                Need an account?{" "}
                <ChakraLink href={AUTH_SIGNUP_ROUTE} color="blue.600" fontWeight="700" textDecoration="underline">
                  Sign Up
                </ChakraLink>
              </Text>
            }
          />
        </Grid>
      </Container>
    </Box>
  );
}
