"use client";

import UnityIFrame from "@/components/UnityIFrame";
import { useAuth } from "@clerk/nextjs";
import { Box, Button, Flex, HStack, Text } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FiLogIn, FiRefreshCw } from "react-icons/fi";
import { clearClassroomSessionSnapshot, readClassroomSessionSnapshot } from "@/lib/classroomSessionClient";

type Props = {
  game: string;
  saveId?: string;
  sessionId?: string;
  classroomId?: string;
  userId?: string;
  height?: string;
  completionHref?: string;
};

interface ProgressPayload {
  levelCompleted?: number;
  completedLevels?: number[];
  completedStageIds?: string[];
  stageCompleted?: StageCompletion;
  sessionId?: string;
  classroomId?: string;
  gameCompleted?: boolean;
  [key: string]: unknown;
}

interface StageCompletion {
  activityId: string;
  stageId: string;
  attempts?: number;
  completedAt?: string;
}

type ProgressSaveResult =
  | { ok: true; saveId?: string }
  | { ok: false; reason: "save-failed" | "classroom-session-expired" };

type PendingCompletionSave = {
  href: string;
  save: () => Promise<ProgressSaveResult>;
};

function readNumberArray(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === "number" && Number.isInteger(item))
    ? value
    : undefined;
}

function readStringArray(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0) ? value : undefined;
}

function readStageCompletion(value: unknown): StageCompletion | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.activityId !== "string" || typeof candidate.stageId !== "string") return undefined;
  if (!candidate.activityId || !candidate.stageId) return undefined;

  return {
    activityId: candidate.activityId,
    stageId: candidate.stageId,
    attempts: typeof candidate.attempts === "number" ? candidate.attempts : undefined,
    completedAt: typeof candidate.completedAt === "string" ? candidate.completedAt : undefined,
  };
}

// Temporary/demo wrapper for verifying the UnityIFrame bridge.
// Production callers should pass real userId/sessionId/classroomId
// and use onProgress to call the save endpoint.

export default function GamePlayer({ game, saveId, sessionId, classroomId, userId, height, completionHref }: Props) {
  const { userId: authUserId } = useAuth();
  const router = useRouter();
  const resolvedUserId = userId ?? authUserId ?? undefined;
  const [personalSaveId, setPersonalSaveId] = useState<string | undefined>(saveId);
  const [classroomSaveId, setClassroomSaveId] = useState<string | undefined>();
  const [activeClassroomSession, setActiveClassroomSession] = useState(() => readClassroomSessionSnapshot());
  const [completionSaveFailed, setCompletionSaveFailed] = useState(false);
  const [completionRetrying, setCompletionRetrying] = useState(false);
  const [completionNeedsRejoin, setCompletionNeedsRejoin] = useState(false);
  const completionStarted = useRef(false);
  const pendingCompletionSave = useRef<PendingCompletionSave>();
  const personalSaveIdRef = useRef(saveId);
  const classroomSaveIdRef = useRef<string>();

  const classroomSessionId = activeClassroomSession?.sessionId ?? classroomId;
  const classroomParticipantId = activeClassroomSession?.participantId;
  const effectiveSaveId = classroomParticipantId ? classroomSaveId : personalSaveId;

  const navigateToCompletion = (href: string, completedSaveId?: string) => {
    const destination = new URL(href, window.location.origin);
    if (completedSaveId) {
      destination.searchParams.set("saveId", completedSaveId);
    }
    router.push(`${destination.pathname}${destination.search}${destination.hash}`);
  };

  const handleProgress = async (payload: unknown) => {
    const progressPayload = payload as ProgressPayload;
    const isCompletionSignal = progressPayload.gameCompleted === true && Boolean(completionHref);
    if (isCompletionSignal && completionStarted.current) return;

    const shouldCompleteGame = isCompletionSignal && !completionStarted.current;
    if (shouldCompleteGame) {
      completionStarted.current = true;
      setCompletionSaveFailed(false);
      setCompletionRetrying(true);
      setCompletionNeedsRejoin(false);
    }

    const completedLevels = readNumberArray(progressPayload.completedLevels);
    const completedStageIds = readStringArray(progressPayload.completedStageIds);
    const stageCompleted = readStageCompletion(progressPayload.stageCompleted);
    const levelCompleted =
      typeof progressPayload.levelCompleted === "number" && Number.isInteger(progressPayload.levelCompleted)
        ? progressPayload.levelCompleted
        : undefined;
    const resolvedSessionId = progressPayload.sessionId ?? sessionId ?? classroomSessionId;
    const eventUserId =
      resolvedUserId ?? (classroomParticipantId ? `participant:${classroomParticipantId}` : undefined);
    let completionSaveId = effectiveSaveId;
    let progressSaveSucceeded = !completedLevels && !completedStageIds;
    let progressSaveFailureReason: "save-failed" | "classroom-session-expired" | undefined;
    let retryProgressSave: (() => Promise<ProgressSaveResult>) | undefined;
    console.log("Unity progress received: ", progressPayload);

    try {
      // Save player progress to gameData endpoint
      if (completedLevels || completedStageIds) {
        const createdSaveIds = new Map<string, string>();
        const getCreatedSaveId = (participantId?: string) => {
          const principalKey = participantId ? `classroom:${participantId}` : "personal";
          const existingSaveId = createdSaveIds.get(principalKey);
          if (existingSaveId) return existingSaveId;

          const createdSaveId = crypto.randomUUID();
          createdSaveIds.set(principalKey, createdSaveId);
          return createdSaveId;
        };
        const patchSave = (targetSaveId: string, progressData: Record<string, unknown>) =>
          fetch(`/api/gameData/${targetSaveId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(progressData),
          });
        const createSave = (createdSaveId: string, progressData: Record<string, unknown>) =>
          fetch("/api/gameData", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              saveId: createdSaveId,
              saveVersion: 1,
              gameVersion: "1.0.0",
              gameId: game,
              ...progressData,
            }),
          });

        retryProgressSave = async () => {
          try {
            const currentClassroomSession = readClassroomSessionSnapshot();
            const currentParticipantId = currentClassroomSession?.participantId;
            if (!resolvedUserId && classroomParticipantId && !currentParticipantId) {
              return { ok: false, reason: "classroom-session-expired" };
            }

            const currentSaveId = currentParticipantId ? classroomSaveIdRef.current : personalSaveIdRef.current;
            const createdSaveId = getCreatedSaveId(currentParticipantId);
            const progressData = {
              ...(completedLevels ? { completedLevels } : {}),
              ...(completedStageIds ? { completedStageIds } : {}),
              classroomParticipantId: currentParticipantId ?? null,
            };
            let attemptedCreate = false;
            const attemptCreate = () => {
              attemptedCreate = true;
              return createSave(createdSaveId, progressData);
            };

            let response = currentSaveId ? await patchSave(currentSaveId, progressData) : await attemptCreate();

            if (response.status === 404 && currentSaveId) {
              response = await attemptCreate();
            }

            // A lost POST response means the stable save ID may already exist. Finish with an idempotent PATCH.
            if (response.status === 409 && attemptedCreate) {
              response = await patchSave(createdSaveId, progressData);
            }

            if (!response.ok) {
              if (currentParticipantId && (response.status === 401 || response.status === 403)) {
                clearClassroomSessionSnapshot();
                setActiveClassroomSession(null);
                setClassroomSaveId(undefined);
                classroomSaveIdRef.current = undefined;
                return {
                  ok: false,
                  reason: resolvedUserId ? "save-failed" : "classroom-session-expired",
                };
              }
              console.error("Failed to save game data:", response.statusText);
              return { ok: false, reason: "save-failed" };
            }

            const updatedData = await response.json();
            const updatedSaveId =
              typeof updatedData?.saveId === "string"
                ? updatedData.saveId
                : attemptedCreate
                  ? createdSaveId
                  : currentSaveId;
            if (updatedSaveId) {
              if (currentParticipantId) {
                classroomSaveIdRef.current = updatedSaveId;
                setClassroomSaveId(updatedSaveId);
                setActiveClassroomSession(currentClassroomSession);
              } else {
                personalSaveIdRef.current = updatedSaveId;
                setPersonalSaveId(updatedSaveId);
              }
            }
            console.log("Game data saved successfully:", updatedData);
            return { ok: true, saveId: updatedSaveId };
          } catch (error) {
            console.error("Error saving game data:", error);
            return { ok: false, reason: "save-failed" };
          }
        };

        const saveResult = await retryProgressSave();
        progressSaveSucceeded = saveResult.ok;
        if (saveResult.ok) {
          completionSaveId = saveResult.saveId;
        } else {
          progressSaveFailureReason = saveResult.reason;
        }
      }

      // Create an event record for level completion
      if ((levelCompleted !== undefined || stageCompleted) && resolvedSessionId && eventUserId) {
        const completionId = stageCompleted
          ? `${stageCompleted.activityId}-${stageCompleted.stageId}`
          : String(levelCompleted);
        const eventId = `level-complete-${game}-${completionId}-${Date.now()}`;
        const response = await fetch("/api/events", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            eventId,
            sessionId: resolvedSessionId,
            event: "level_completed",
            classroomParticipantId: classroomParticipantId ?? null,
            props: {
              gameId: game,
              ...(levelCompleted !== undefined ? { levelCompleted } : {}),
              ...(stageCompleted ?? {}),
            },
          }),
        });

        if (!response.ok) {
          console.error("Failed to save event:", response.statusText);
        } else {
          const eventData = await response.json();
          console.log("Event saved successfully:", eventData);
        }
      }
    } catch (error) {
      console.error("Error saving player data:", error);
    }

    if (shouldCompleteGame && completionHref) {
      if (!progressSaveSucceeded) {
        if (retryProgressSave) {
          pendingCompletionSave.current = { href: completionHref, save: retryProgressSave };
        }
        setCompletionRetrying(false);
        setCompletionSaveFailed(true);
        setCompletionNeedsRejoin(progressSaveFailureReason === "classroom-session-expired");
        return;
      }

      pendingCompletionSave.current = undefined;
      setCompletionRetrying(false);
      navigateToCompletion(completionHref, completionSaveId);
    }
  };

  const retryCompletionSave = async () => {
    const pending = pendingCompletionSave.current;
    if (!pending || completionRetrying) return;

    setCompletionRetrying(true);
    const saveResult = await pending.save();
    if (!saveResult.ok) {
      setCompletionRetrying(false);
      setCompletionNeedsRejoin(saveResult.reason === "classroom-session-expired");
      return;
    }

    pendingCompletionSave.current = undefined;
    setCompletionSaveFailed(false);
    setCompletionRetrying(false);
    setCompletionNeedsRejoin(false);
    navigateToCompletion(pending.href, saveResult.saveId);
  };

  return (
    <Box position="relative" w="full" h={height}>
      <UnityIFrame
        game={game}
        saveId={effectiveSaveId}
        userId={resolvedUserId}
        sessionId={sessionId ?? classroomSessionId}
        classroomId={classroomId ?? classroomSessionId}
        onProgress={handleProgress}
        height="100%"
      />

      {completionSaveFailed ? (
        <HStack
          role="alert"
          position="absolute"
          left="50%"
          bottom={{ base: 3, md: 5 }}
          transform="translateX(-50%)"
          w="calc(100% - 24px)"
          maxW="620px"
          p={3}
          gap={3}
          justify="space-between"
          align={{ base: "stretch", sm: "center" }}
          flexDirection={{ base: "column", sm: "row" }}
          bg="white"
          border="2px solid #B42318"
          borderRadius="8px"
          boxShadow="0 8px 24px rgba(0, 0, 0, 0.2)"
        >
          <Text color="#7A271A" fontWeight="700" fontSize={{ base: "14px", md: "16px" }}>
            {completionNeedsRejoin
              ? "Your class session ended. Ask your teacher to help you rejoin, then try again."
              : "We could not save your game. Check your connection and try again."}
          </Text>
          <Flex gap={2} flexWrap="wrap" flexShrink={0} w={{ base: "full", sm: "auto" }}>
            {completionNeedsRejoin ? (
              <Button
                onClick={() => window.open("/login/player", "_blank", "noopener,noreferrer")}
                disabled={completionRetrying}
                flex="1"
                minH="44px"
                px={4}
                bg="white"
                color="#4476BB"
                border="2px solid #4476BB"
                borderRadius="8px"
                fontWeight="700"
                _hover={{ bg: "#EEF4FC" }}
              >
                <FiLogIn aria-hidden="true" />
                Rejoin Class
              </Button>
            ) : null}
            <Button
              onClick={() => void retryCompletionSave()}
              disabled={completionRetrying}
              flex="1"
              minW="116px"
              minH="44px"
              px={4}
              bg="#4476BB"
              color="white"
              borderRadius="8px"
              fontWeight="700"
              _hover={{ bg: "#365F99" }}
            >
              <FiRefreshCw aria-hidden="true" />
              {completionRetrying ? "Saving..." : "Try Again"}
            </Button>
          </Flex>
        </HStack>
      ) : null}
    </Box>
  );
}
