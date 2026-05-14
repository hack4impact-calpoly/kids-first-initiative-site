"use client";

import UnityIFrame from "@/components/UnityIFrame";

type Props = {
  game: string;
};

// Temporary/demo wrapper for verifying the UnityIFrame bridge.
// Production callers should pass real userId/sessionId/classroomId
// and use onProgress to call the save endpoint.

export default function GamePlayer({ game }: Props) {
  return (
    <UnityIFrame
      game={game}
      saveId="test-save"
      userId="test-user"
      sessionId="test-session"
      classroomId="test-classroom"
      onProgress={(payload) => {
        console.log("Unity progress received: ", payload);
      }}
    />
  );
}
