"use client";

import UnityIFrame from "@/components/UnityIFrame";
import { useAuth } from "@clerk/nextjs";
import { useState } from "react";
import { readClassroomSessionSnapshot } from "@/lib/classroomSessionClient";

type Props = {
  game: string;
  saveId?: string;
  sessionId?: string;
  classroomId?: string;
  userId?: string;
  height?: string;
};

interface ProgressPayload {
  levelCompleted?: number;
  completedLevels?: number[];
  sessionId?: string;
  classroomId?: string;
  [key: string]: unknown;
}

// Temporary/demo wrapper for verifying the UnityIFrame bridge.
// Production callers should pass real userId/sessionId/classroomId
// and use onProgress to call the save endpoint.

export default function GamePlayer({ game, saveId, sessionId, classroomId, userId, height }: Props) {
  const { userId: authUserId } = useAuth();
  const resolvedUserId = userId ?? authUserId ?? undefined;
  const [clientSaveId, setClientSaveId] = useState<string | undefined>(saveId);

  const activeClassroomSession = readClassroomSessionSnapshot();
  const classroomSessionId = activeClassroomSession?.sessionId ?? classroomId;
  const classroomParticipantId = activeClassroomSession?.participantId;
  const studentDisplayName = activeClassroomSession?.displayName;
  const effectiveSaveId = saveId ?? clientSaveId;

  const handleProgress = async (payload: unknown) => {
    const progressPayload = payload as ProgressPayload;
    const resolvedSessionId = progressPayload.sessionId ?? sessionId;
    console.log("Unity progress received: ", progressPayload);

    try {
      // Save player progress to gameData endpoint
      if (progressPayload.completedLevels && Array.isArray(progressPayload.completedLevels)) {
        const payload = {
          completedLevels: progressPayload.completedLevels,
          lastUpdated: new Date().toISOString(),
          classroomSessionId: classroomSessionId ?? null,
          classroomParticipantId: classroomParticipantId ?? null,
          studentDisplayName: studentDisplayName ?? null,
        };

        const response = effectiveSaveId
          ? await fetch(`/api/gameData/${effectiveSaveId}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload),
            })
          : await fetch("/api/gameData", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                saveId: crypto.randomUUID(),
                saveVersion: 1,
                gameVersion: "1.0.0",
                gameId: game,
                userId:
                  resolvedUserId ?? (classroomParticipantId ? `participant:${classroomParticipantId}` : "guest-player"),
                ...payload,
              }),
            });

        if (!response.ok) {
          console.error("Failed to save game data:", response.statusText);
          return;
        }

        const updatedData = await response.json();
        if (!effectiveSaveId && typeof updatedData?.saveId === "string") {
          setClientSaveId(updatedData.saveId);
        }
        console.log("Game data saved successfully:", updatedData);
      }

      // Create an event record for level completion
      if (progressPayload.levelCompleted !== undefined && resolvedSessionId && resolvedUserId) {
        const eventId = `level-complete-${game}-${progressPayload.levelCompleted}-${Date.now()}`;
        const response = await fetch("/api/events", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            eventId,
            anonUserId: resolvedUserId,
            sessionId: resolvedSessionId,
            event: "level_completed",
            ts: new Date().toISOString(),
            props: {
              gameId: game,
              levelCompleted: progressPayload.levelCompleted,
            },
          }),
        });

        if (!response.ok) {
          console.error("Failed to save event:", response.statusText);
          return;
        }

        const eventData = await response.json();
        console.log("Event saved successfully:", eventData);
      }
    } catch (error) {
      console.error("Error saving player data:", error);
    }
  };

  return (
    <UnityIFrame
      game={game}
      saveId={effectiveSaveId}
      userId={resolvedUserId}
      sessionId={sessionId}
      classroomId={classroomId}
      onProgress={handleProgress}
      height={height}
    />
  );
}
