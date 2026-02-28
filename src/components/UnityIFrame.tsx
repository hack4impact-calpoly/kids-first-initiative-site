export default function UnityIFrame({ game, saveId }: { game: string; saveId?: string }) {
  return (
    <iframe
      src={`/game/${game}/index.html?saveId=${saveId}`}
      style={{ width: "100%", height: "100vh", border: 0, display: "block" }}
      allow="autoplay; fullscreen; gamepad"
    />
  );
}
