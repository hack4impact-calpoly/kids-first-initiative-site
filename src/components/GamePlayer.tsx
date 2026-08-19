"use client";

import UnityIFrame from "@/components/UnityIFrame";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
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
  const completionStarted = useRef(false);

  const classroomSessionId = activeClassroomSession?.sessionId ?? classroomId;
  const classroomParticipantId = activeClassroomSession?.participantId;
  const effectiveSaveId = classroomParticipantId ? classroomSaveId : (saveId ?? personalSaveId);

  const handleProgress = async (payload: unknown) => {
    const progressPayload = payload as ProgressPayload;
    const shouldCompleteGame =
      progressPayload.gameCompleted === true && Boolean(completionHref) && !completionStarted.current;
    if (shouldCompleteGame) {
      completionStarted.current = true;
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
    console.log("Unity progress received: ", progressPayload);

    try {
      // Save player progress to gameData endpoint
      if (completedLevels || completedStageIds) {
        const payload = {
          ...(completedLevels ? { completedLevels } : {}),
          ...(completedStageIds ? { completedStageIds } : {}),
          classroomParticipantId: classroomParticipantId ?? null,
        };

        const createSave = () =>
          fetch("/api/gameData", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              saveId: crypto.randomUUID(),
              saveVersion: 1,
              gameVersion: "1.0.0",
              gameId: game,
              ...payload,
            }),
          });

        let response = effectiveSaveId
          ? await fetch(`/api/gameData/${effectiveSaveId}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload),
            })
          : await createSave();

        if (response.status === 404 && classroomParticipantId && effectiveSaveId) {
          response = await createSave();
        }

        if (!response.ok) {
          if (classroomParticipantId && (response.status === 401 || response.status === 403)) {
            clearClassroomSessionSnapshot();
            setActiveClassroomSession(null);
            setClassroomSaveId(undefined);
          }
          console.error("Failed to save game data:", response.statusText);
        } else {
          const updatedData = await response.json();
          if (typeof updatedData?.saveId === "string") {
            completionSaveId = updatedData.saveId;
            if (classroomParticipantId) {
              setClassroomSaveId(updatedData.saveId);
            } else {
              setPersonalSaveId(updatedData.saveId);
            }
          }
          console.log("Game data saved successfully:", updatedData);
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
      const destination = new URL(completionHref, window.location.origin);
      if (completionSaveId && !destination.searchParams.has("saveId")) {
        destination.searchParams.set("saveId", completionSaveId);
      }
      router.push(`${destination.pathname}${destination.search}${destination.hash}`);
    }
  };

  return (
    <UnityIFrame
      game={game}
      saveId={effectiveSaveId}
      userId={resolvedUserId}
      sessionId={sessionId ?? classroomSessionId}
      classroomId={classroomId ?? classroomSessionId}
      onProgress={handleProgress}
      height={height}
    />
  );
}
