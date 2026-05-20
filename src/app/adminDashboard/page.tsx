"use client";

import {
  Avatar,
  Box,
  Button,
  Container,
  Flex,
  Grid,
  Heading,
  HStack,
  Icon,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useUser } from "@clerk/nextjs";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { FaFlask } from "react-icons/fa";
import { FiCalendar, FiDownload, FiSettings } from "react-icons/fi";
import { AdminMetricsCard } from "@/components/AdminMetricsCard";
import { AdminPeriod, AdminPeriodSelector } from "@/components/AdminPeriodSelector";
import AdminProfileCard from "@/components/AdminProfileCard";
import AdminSettingsPopup from "@/components/AdminSettingsPopup";

type SessionRecord = {
  _id: string;
  anonUserId: string;
  gameId?: "penguinRunGame" | "statesOfMatterGame" | null;
  startedAt: string;
  endedAt: string | null;
  durationMs: number;
};

type SupportedGameId = "penguinRunGame" | "statesOfMatterGame";

type SummaryMetrics = {
  uniquePlayers: number;
  totalPlayTimeMs: number;
};

type TrendMetric = {
  label: string;
  direction: "up" | "down" | "flat" | "na";
};

type AdminUser = {
  _id: string;
  clerkId?: string;
  name?: string;
  email?: string;
  role?: string;
};

const GAME_CARDS = [
  {
    gameId: "penguinRunGame" as SupportedGameId,
    title: "Penguin Run",
    accentColor: "blue.500",
  },
  {
    gameId: "statesOfMatterGame" as SupportedGameId,
    title: "Matter Lab",
    accentColor: "purple.500",
  },
];

const DAY_IN_MS = 24 * 60 * 60 * 1000;

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

function getSummaryMetrics(sessions: SessionRecord[], gameId: SupportedGameId): SummaryMetrics {
  const filteredSessions = sessions.filter((session) => session.gameId === gameId);
  const uniquePlayers = new Set(
    filteredSessions.map((session) => session.anonUserId).filter((anonUserId) => Boolean(anonUserId)),
  ).size;
  const totalPlayTimeMs = filteredSessions.reduce((sum, session) => sum + getSessionDurationMs(session), 0);

  return { uniquePlayers, totalPlayTimeMs };
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

function formatTrend(currentValue: number, previousValue: number, period: AdminPeriod): TrendMetric {
  if (period === "all") {
    return { label: "N/A", direction: "na" as const };
  }

  const comparisonLabel = period === "7d" ? "vs LW" : "vs prior 30d";
  if (previousValue <= 0) {
    return { label: `N/A ${comparisonLabel}`, direction: "na" as const };
  }

  const changePercent = ((currentValue - previousValue) / previousValue) * 100;
  const direction: TrendMetric["direction"] = changePercent > 0 ? "up" : changePercent < 0 ? "down" : "flat";
  const prefix = changePercent > 0 ? "+" : "";

  return {
    label: `${prefix}${changePercent.toFixed(1)}% ${comparisonLabel}`,
    direction,
  };
}

function formatDateForRange(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AdminDashboardPage() {
  const { user } = useUser();
  const [period, setPeriod] = useState<AdminPeriod>("7d");
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [allSessions, setAllSessions] = useState<SessionRecord[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionsError, setSessionsError] = useState("");
  const [isAdminProfileOpen, setIsAdminProfileOpen] = useState(false);
  const [isAdminSettingsOpen, setIsAdminSettingsOpen] = useState(false);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);

  const fallbackAdminName = user?.fullName?.trim() || user?.username || "Alex Admin";
  const fallbackAdminEmail = user?.primaryEmailAddress?.emailAddress ?? "";
  const adminName = adminUser?.name ?? fallbackAdminName;
  const adminEmail = adminUser?.email ?? fallbackAdminEmail;

  useEffect(() => {
    let isActive = true;

    async function loadAdminUser() {
      try {
        const response = await fetch("/api/users", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to fetch users.");

        const users: AdminUser[] = await response.json();
        const matchedUser = users.find((candidate) => candidate.clerkId === user?.id) ?? null;

        if (!isActive) return;
        if (!matchedUser?._id) {
          setAdminUser(null);
          return;
        }

        const userResponse = await fetch(`/api/users/${matchedUser._id}`, { cache: "no-store" });
        if (!userResponse.ok) throw new Error("Failed to fetch admin profile.");

        const resolvedUser: AdminUser = await userResponse.json();
        if (isActive) setAdminUser(resolvedUser);
      } catch (error) {
        console.error("Failed to load admin user:", error);
      }
    }

    loadAdminUser();

    return () => {
      isActive = false;
    };
  }, [user?.id]);

  useEffect(() => {
    let isActive = true;

    function sleep(ms: number) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async function fetchSessionsByPeriod(periodValue: AdminPeriod): Promise<SessionRecord[]> {
      const endpoints = [`/api/sessions?period=${periodValue}`, `/api/sessions/?period=${periodValue}`];
      const maxAttempts = 3;

      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        for (const endpoint of endpoints) {
          try {
            const response = await fetch(endpoint, { cache: "no-store" });
            if (response.status === 404) {
              lastError = new Error(`Not found: ${endpoint}`);
              continue;
            }
            if (!response.ok) {
              throw new Error(`Failed to fetch sessions (${response.status})`);
            }
            const data: SessionRecord[] = await response.json();
            return data;
          } catch (error) {
            lastError = error instanceof Error ? error : new Error("Unknown session fetch error");
          }
        }

        if (attempt < maxAttempts) {
          await sleep(300);
        }
      }

      throw lastError ?? new Error("Failed to fetch sessions");
    }

    async function loadSessions() {
      try {
        setLoadingSessions(true);
        setSessionsError("");

        const currentPeriodRequest = fetchSessionsByPeriod(period);
        const allSessionsRequest = period === "all" ? null : fetchSessionsByPeriod("all");
        const currentPeriodSessions = await currentPeriodRequest;
        let comparisonSessions = currentPeriodSessions;

        if (allSessionsRequest) {
          try {
            comparisonSessions = await allSessionsRequest;
          } catch (comparisonError) {
            console.error("Failed to load comparison sessions:", comparisonError);
            comparisonSessions = [];
          }
        }

        if (isActive) {
          setSessions(currentPeriodSessions);
          setAllSessions(comparisonSessions);
        }
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

  const previousWindowSessions = useMemo(() => {
    if (period === "all") return [] as SessionRecord[];

    const windowDurationMs = period === "7d" ? 7 * DAY_IN_MS : 30 * DAY_IN_MS;
    const currentWindowStart = Date.now() - windowDurationMs;
    const previousWindowStart = currentWindowStart - windowDurationMs;

    return allSessions.filter((session) => {
      const sessionStart = new Date(session.startedAt).getTime();
      if (!Number.isFinite(sessionStart)) return false;
      return sessionStart >= previousWindowStart && sessionStart < currentWindowStart;
    });
  }, [allSessions, period]);

  const gameMetrics = useMemo(() => {
    return GAME_CARDS.map((game) => {
      const currentSummary = getSummaryMetrics(sessions, game.gameId);
      const previousSummary = getSummaryMetrics(previousWindowSessions, game.gameId);
      const averageTimeMs =
        currentSummary.uniquePlayers === 0 ? 0 : currentSummary.totalPlayTimeMs / currentSummary.uniquePlayers;

      return {
        ...game,
        playersValue: currentSummary.uniquePlayers.toString(),
        totalPlayTimeValue: formatDuration(currentSummary.totalPlayTimeMs),
        averageTimeValue: formatDuration(averageTimeMs),
        playersTrend: formatTrend(currentSummary.uniquePlayers, previousSummary.uniquePlayers, period),
        totalPlayTimeTrend: formatTrend(currentSummary.totalPlayTimeMs, previousSummary.totalPlayTimeMs, period),
      };
    });
  }, [period, previousWindowSessions, sessions]);

  const periodSummary = useMemo(() => {
    const end = new Date();

    if (period === "7d") {
      const start = new Date(end.getTime() - 7 * DAY_IN_MS);
      return `${formatDateForRange(start)} - ${formatDateForRange(end)}`;
    }

    if (period === "30d") {
      const start = new Date(end.getTime() - 30 * DAY_IN_MS);
      return `${formatDateForRange(start)} - ${formatDateForRange(end)}`;
    }

    return "All time";
  }, [period]);

  return (
    <Box
      minH="100vh"
      bg="linear-gradient(180deg, rgba(245,248,255,1) 0%, rgba(249,250,251,1) 240px, rgba(249,250,251,1) 100%)"
      py={{ base: 5, md: 8 }}
    >
      <Container maxW="6xl">
        <VStack align="stretch" gap={6}>
          <Flex
            bg="white"
            border="1px solid"
            borderColor="gray.200"
            borderRadius="16px"
            px={{ base: 4, md: 5 }}
            py={3}
            justify="space-between"
            align="center"
            direction={{ base: "column", md: "row" }}
            gap={4}
          >
            <HStack gap={3}>
              <Flex
                h="40px"
                w="40px"
                borderRadius="12px"
                bg="blue.600"
                color="white"
                align="center"
                justify="center"
                fontWeight="800"
                fontSize="sm"
              >
                KFI
              </Flex>
              <Box>
                <Text fontWeight="800" color="gray.900" lineHeight="1.2">
                  Kids First Initiative Admin
                </Text>
                <Text fontSize="xs" color="gray.500">
                  Analytics Console
                </Text>
              </Box>
            </HStack>

            <Button
              variant="ghost"
              h="auto"
              p={2}
              borderRadius="14px"
              onClick={() => setIsAdminProfileOpen(true)}
              _hover={{ bg: "gray.50" }}
            >
              <HStack gap={3}>
                <Box textAlign="right">
                  <Text fontWeight="700" color="gray.800" lineHeight="1.2">
                    {adminName}
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    System Administrator
                  </Text>
                </Box>
                <Avatar.Root size="sm">
                  <Avatar.Fallback name={adminName} />
                </Avatar.Root>
              </HStack>
            </Button>
          </Flex>

          <Box>
            <Heading color="gray.900" fontSize={{ base: "3xl", md: "4xl" }} lineHeight="1.1">
              Performance Overview
            </Heading>
            <Text color="blue.600" fontWeight="600" textDecorationLine="underline" textUnderlineOffset="5px" mt={2}>
              Real-time data for your educational gaming suite.
            </Text>
          </Box>

          <Flex
            justify="space-between"
            align={{ base: "stretch", md: "center" }}
            direction={{ base: "column", md: "row" }}
            gap={3}
          >
            <Button
              variant="outline"
              borderColor="gray.300"
              color="gray.700"
              bg="white"
              disabled
              w={{ base: "full", md: "auto" }}
            >
              <HStack gap={2}>
                <Icon as={FiDownload} />
                <Text>Export Data</Text>
              </HStack>
            </Button>
            <Button
              variant="outline"
              borderColor="gray.300"
              color="gray.700"
              bg="white"
              w={{ base: "full", md: "auto" }}
              onClick={() => setIsAdminSettingsOpen(true)}
            >
              <HStack gap={2}>
                <Icon as={FiSettings} />
                <Text>Account Settings</Text>
              </HStack>
            </Button>
            <AdminPeriodSelector value={period} onChange={setPeriod} />
          </Flex>

          <HStack gap={2} color="gray.600">
            <Icon as={FiCalendar} boxSize={4} />
            <Text fontSize="sm" fontWeight="500">
              Showing data for:{" "}
              <Text as="span" fontWeight="700" color="gray.800">
                {periodSummary}
              </Text>
            </Text>
          </HStack>

          {loadingSessions ? (
            <Flex py={14} justify="center">
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
                  icon={
                    game.gameId === "penguinRunGame" ? (
                      <Image src="/Icons/FaPenguin.png" alt="Penguin Run icon" width={28} height={28} />
                    ) : (
                      <Icon as={FaFlask} boxSize={5} color="purple.500" />
                    )
                  }
                  accentColor={game.accentColor}
                  playersValue={game.playersValue}
                  playersTrend={game.playersTrend}
                  totalPlayTimeValue={game.totalPlayTimeValue}
                  totalPlayTimeTrend={game.totalPlayTimeTrend}
                  averageTimeValue={game.averageTimeValue}
                />
              ))}
            </Grid>
          )}
        </VStack>
      </Container>
      <AdminProfileCard
        isOpen={isAdminProfileOpen}
        onClose={() => setIsAdminProfileOpen(false)}
        name={adminName}
        onAccountSettingsClick={() => {
          setIsAdminProfileOpen(false);
          setIsAdminSettingsOpen(true);
        }}
      />
      <AdminSettingsPopup
        isOpen={isAdminSettingsOpen}
        onClose={() => setIsAdminSettingsOpen(false)}
        userId={adminUser?._id}
        fallbackName={adminName}
        fallbackEmail={adminEmail}
        onProfileUpdated={(profile) => {
          setAdminUser((currentUser) => ({
            _id: currentUser?._id ?? "",
            clerkId: currentUser?.clerkId,
            role: currentUser?.role,
            ...profile,
          }));
        }}
      />
    </Box>
  );
}
