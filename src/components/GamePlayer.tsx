"use client";

import UnityIFrame from "@/components/UnityIFrame";
import { useAuth } from "@clerk/nextjs";

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

  const handleProgress = async (payload: unknown) => {
    const progressPayload = payload as ProgressPayload;
    const resolvedSessionId = progressPayload.sessionId ?? sessionId;
    console.log("Unity progress received: ", progressPayload);

    try {
      // Save player progress to gameData endpoint
      if (progressPayload.completedLevels && Array.isArray(progressPayload.completedLevels)) {
        const response = await fetch(`/api/gameData/${saveId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            completedLevels: progressPayload.completedLevels,
            lastUpdated: new Date().toISOString(),
          }),
        });

        if (!response.ok) {
          console.error("Failed to save game data:", response.statusText);
          return;
        }

        const updatedData = await response.json();
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
      saveId={saveId}
      userId={resolvedUserId}
      sessionId={sessionId}
      classroomId={classroomId}
      onProgress={handleProgress}
      height={height}
    />
  );
}
