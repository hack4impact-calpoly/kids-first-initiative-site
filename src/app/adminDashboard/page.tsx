"use client";

import { Box, Button, Container, Flex, Grid, Heading, Spinner, Text, VStack } from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { AdminMetricsCard } from "@/components/AdminMetricsCard";
import { AdminPeriod, AdminPeriodSelector } from "@/components/AdminPeriodSelector";

type SessionRecord = {
  _id: string;
  anonUserId: string;
  gameId?: "penguinRunGame" | "statesOfMatterGame" | null;
  startedAt: string;
  endedAt: string | null;
  durationMs: number;
};

const GAME_CARDS = [
  {
    gameId: "penguinRunGame" as const,
    title: "Penguin Run",
    subtitle: "Track player engagement and activity trends.",
    iconSrc: "/Icons/FaPenguin.png",
    accentColor: "orange",
  },
  {
    gameId: "statesOfMatterGame" as const,
    title: "Matter Lab",
    subtitle: "Track player engagement and activity trends.",
    iconSrc: "/Icons/FaSeedling.png",
    accentColor: "green",
  },
];

function getSessionDurationMs(session: SessionRecord): number {
  if (typeof session.durationMs === "number" && session.durationMs > 0) {
    return session.durationMs;
  }

  if (!session.startedAt || !session.endedAt) return 0;

  const startedAt = new Date(session.startedAt).getTime();
  const endedAt = new Date(session.endedAt).getTime();
  const diff = endedAt - startedAt;

  if (!Number.isFinite(diff) || diff <= 0) return 0;
  return diff;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "0m";

  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function formatDateForRange(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AdminDashboardPage() {
  const [period, setPeriod] = useState<AdminPeriod>("7d");
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionsError, setSessionsError] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadSessions() {
      try {
        setLoadingSessions(true);
        setSessionsError("");

        const response = await fetch(`/api/sessions?period=${period}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch sessions (${response.status})`);
        }

        const data: SessionRecord[] = await response.json();
        if (isActive) setSessions(data);
      } catch (error) {
        console.error("Failed to load sessions for admin dashboard:", error);
        if (isActive) setSessionsError("Could not load session data.");
      } finally {
        if (isActive) setLoadingSessions(false);
      }
    }

    loadSessions();
    return () => {
      isActive = false;
    };
  }, [period]);

  const gameMetrics = useMemo(() => {
    return GAME_CARDS.map((game) => {
      const gameSessions = sessions.filter((session) => session.gameId === game.gameId);
      const uniquePlayers = new Set(
        gameSessions.map((session) => session.anonUserId).filter((anonUserId) => Boolean(anonUserId)),
      );

      const totalPlayTimeMs = gameSessions.reduce((sum, session) => sum + getSessionDurationMs(session), 0);
      const averageTimeMs = uniquePlayers.size === 0 ? 0 : totalPlayTimeMs / uniquePlayers.size;

      return {
        ...game,
        metrics: [
          { label: "Players (Unique)", value: uniquePlayers.size.toString() },
          { label: "Total Play Time", value: formatDuration(totalPlayTimeMs) },
          { label: "Average Time / Player", value: formatDuration(averageTimeMs) },
        ],
      };
    });
  }, [sessions]);

  const periodSummary = useMemo(() => {
    const end = new Date();

    if (period === "7d") {
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      return {
        label: "Last 7 Days",
        range: `${formatDateForRange(start)} - ${formatDateForRange(end)}`,
      };
    }

    if (period === "30d") {
      const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      return {
        label: "Monthly (Last 30 Days)",
        range: `${formatDateForRange(start)} - ${formatDateForRange(end)}`,
      };
    }

    return {
      label: "All Time",
      range: "All available session data",
    };
  }, [period]);

  return (
    <Box minH="100vh" bg="gray.50" py={{ base: 8, md: 12 }}>
      <Container maxW="6xl">
        <VStack align="stretch" gap={7}>
          <Flex
            justify="space-between"
            align={{ base: "start", md: "center" }}
            direction={{ base: "column", md: "row" }}
            gap={4}
          >
            <Box>
              <Heading color="blue.700" fontSize={{ base: "3xl", md: "4xl" }}>
                Admin Dashboard
              </Heading>
              <Text color="gray.600" fontWeight="500">
                Welcome, Admin
              </Text>
            </Box>
          </Flex>

          <Flex
            justify="space-between"
            align={{ base: "start", md: "center" }}
            direction={{ base: "column", md: "row" }}
            gap={3}
          >
            <Box>
              <Text fontSize="xs" fontWeight="700" color="gray.500" textTransform="uppercase" letterSpacing="0.06em">
                Showing Data For
              </Text>
              <Text fontSize="sm" color="gray.700" fontWeight="600">
                {periodSummary.label} - {periodSummary.range}
              </Text>
            </Box>

            <Flex
              w={{ base: "full", md: "auto" }}
              ml={{ md: "auto" }}
              gap={3}
              align={{ base: "stretch", md: "center" }}
            >
              <Button colorScheme="blue" variant="outline" disabled>
                Export Data
              </Button>
              <AdminPeriodSelector value={period} onChange={setPeriod} />
            </Flex>
          </Flex>

          {loadingSessions ? (
            <Flex py={12} justify="center">
              <Spinner size="lg" color="blue.500" />
            </Flex>
          ) : sessionsError ? (
            <Box bg="red.50" border="1px solid" borderColor="red.200" borderRadius="16px" p={4}>
              <Text color="red.600" fontWeight="600">
                {sessionsError}
              </Text>
            </Box>
          ) : (
            <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={6}>
              {gameMetrics.map((game) => (
                <AdminMetricsCard
                  key={game.gameId}
                  title={game.title}
                  subtitle={game.subtitle}
                  iconSrc={game.iconSrc}
                  accentColor={game.accentColor}
                  metrics={game.metrics}
                />
              ))}
            </Grid>
          )}
        </VStack>
      </Container>
    </Box>
  );
}
