"use client";

import { useCallback, useEffect, useRef } from "react";
// useEffect tells react to re-run your effect based on the defined dependency:
// [] - runs once mount
// [variable] - runs everytime the variable is updated

// useRef is a box that allows you to mutate values without triggering re-renders
// .current is the saved data inside the box

// This implementation assumes, all data but saveId and classroomId is provided
// Id's are treated as client-visible.
// workflow: React waits for unity to flag ready, then react sends context

type Props = {
  game: string;
  saveId?: string;
  userId: string;
  sessionId: string;
  classroomId?: string;
  onProgress?: (payload: unknown) => void;
};

export default function UnityIFrame({ game, saveId, userId, sessionId, classroomId, onProgress }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // useCallback caches a function defintion between re-renders
  // if any of the dependencies change, a new function instance is created
  const sendContext = useCallback(() => {
    // postMessage enables communication between the parent page and its iframe
    // https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage

    // React -> Unity
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: "site-context",
        payload: {
          saveId,
          sessionId,
          userId,
          classroomId,
        },
      },
      window.location.origin, // Restricts message to same origin only
    );
  }, [saveId, sessionId, userId, classroomId]);

  // postMessage can receive messages from other windows,
  // so we need to verify the origin and source of the request
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // verify origin of the message
      if (event.origin !== window.location.origin) return;
      // ensure message came from THIS iframe
      if (event.source !== iframeRef.current?.contentWindow) return;

      const data = event.data;
      // Unity -> React
      switch (data?.type) {
        // Send initial context into unity after unity reports its ready
        case "unity-ready": {
          sendContext();
          return;
        }

        // Unity sends this when player progress or save state changes.
        case "unity-progress": {
          const payload = data.payload && typeof data.payload === "object" ? data.payload : {};

          onProgress?.({
            ...payload,
            sessionId,
            classroomId,
          });
          return;
        }

        default:
          return;
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [sendContext, onProgress, sessionId, classroomId]);

  // UPDATE: url no longer needs saveId since its sent in site-context
  return (
    <iframe
      ref={iframeRef}
      src={`/game/${encodeURIComponent(game)}/index.html`}
      style={{ width: "100%", height: "100vh", border: 0, display: "block" }}
      allow="autoplay; fullscreen; gamepad"
      referrerPolicy="no-referrer"
    />
  );
}
