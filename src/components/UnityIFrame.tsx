"use client";

export default function UnityIFrame({ game }: { game: string }) {
  return (
    <iframe
      src={`/game/${game}/index.html`}
      style={{ width: "100%", height: "100vh", border: 0, display: "block" }}
      allow="autoplay; fullscreen; gamepad"
    />
  );
}
