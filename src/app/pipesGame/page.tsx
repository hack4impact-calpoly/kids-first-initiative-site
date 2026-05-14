import Navbar from "@/components/Navbar";
import GamePlayer from "@/components/GamePlayer";

export default function PipesGamePage() {
  return (
    <main>
      <Navbar />
      <GamePlayer game="StatesOfMatter" />
    </main>
  );
}
