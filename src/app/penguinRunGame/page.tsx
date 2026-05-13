import Navbar from "@/components/Navbar";
import GamePlayer from "@/components/GamePlayer";

export default function PenguinRunPage() {
  return (
    <main>
      <Navbar />
      <GamePlayer game="PenguinRun" />
    </main>
  );
}
