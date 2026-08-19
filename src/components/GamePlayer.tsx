"use client";

import UnityIFrame from "@/components/UnityIFrame";
import { useAuth } from "@clerk/nextjs";
import { Box, Button, HStack, Text } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FiRefreshCw } from "react-icons/fi";
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

type ProgressSaveResult = { ok: true; saveId?: string } | { ok: false };

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
  const completionStarted = useRef(false);
  const pendingCompletionSave = useRef<PendingCompletionSave>();

  const classroomSessionId = activeClassroomSession?.sessionId ?? classroomId;
  const classroomParticipantId = activeClassroomSession?.participantId;
  const effectiveSaveId = classroomParticipantId ? classroomSaveId : (saveId ?? personalSaveId);

  const navigateToCompletion = (href: string, completedSaveId?: string) => {
    const destination = new URL(href, window.location.origin);
    if (completedSaveId && !destination.searchParams.has("saveId")) {
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
    let retryProgressSave: (() => Promise<ProgressSaveResult>) | undefined;
    console.log("Unity progress received: ", progressPayload);

    try {
      // Save player progress to gameData endpoint
      if (completedLevels || completedStageIds) {
        const progressData = {
          ...(completedLevels ? { completedLevels } : {}),
          ...(completedStageIds ? { completedStageIds } : {}),
          classroomParticipantId: classroomParticipantId ?? null,
        };
        const createdSaveId = crypto.randomUUID();
        const patchSave = (targetSaveId: string) =>
          fetch(`/api/gameData/${targetSaveId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(progressData),
          });
        const createSave = () =>
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
            let attemptedCreate = false;
            const attemptCreate = () => {
              attemptedCreate = true;
              return createSave();
            };

            let response = effectiveSaveId ? await patchSave(effectiveSaveId) : await attemptCreate();

            if (response.status === 404 && classroomParticipantId && effectiveSaveId) {
              response = await attemptCreate();
            }

            // A lost POST response means the stable save ID may already exist. Finish with an idempotent PATCH.
            if (response.status === 409 && attemptedCreate) {
              response = await patchSave(createdSaveId);
            }

            if (!response.ok) {
              if (classroomParticipantId && (response.status === 401 || response.status === 403)) {
                clearClassroomSessionSnapshot();
                setActiveClassroomSession(null);
                setClassroomSaveId(undefined);
              }
              console.error("Failed to save game data:", response.statusText);
              return { ok: false };
            }

            const updatedData = await response.json();
            const updatedSaveId =
              typeof updatedData?.saveId === "string"
                ? updatedData.saveId
                : attemptedCreate
                  ? createdSaveId
                  : effectiveSaveId;
            if (updatedSaveId) {
              if (classroomParticipantId) {
                setClassroomSaveId(updatedSaveId);
              } else {
                setPersonalSaveId(updatedSaveId);
              }
            }
            console.log("Game data saved successfully:", updatedData);
            return { ok: true, saveId: updatedSaveId };
          } catch (error) {
            console.error("Error saving game data:", error);
            return { ok: false };
          }
        };

        const saveResult = await retryProgressSave();
        progressSaveSucceeded = saveResult.ok;
        if (saveResult.ok) {
          completionSaveId = saveResult.saveId;
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
      return;
    }

    pendingCompletionSave.current = undefined;
    setCompletionSaveFailed(false);
    setCompletionRetrying(false);
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
            We could not save your game. Check your connection and try again.
          </Text>
          <Button
            onClick={() => void retryCompletionSave()}
            disabled={completionRetrying}
            flexShrink={0}
            w={{ base: "full", sm: "auto" }}
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
        </HStack>
      ) : null}
    </Box>
  );
}
