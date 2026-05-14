import Navbar from "@/components/Navbar";
import GamePlayer from "@/components/GamePlayer";

export default function CookingGamePage() {
  return (
    <main>
      <Navbar />
      <GamePlayer game="StatesOfMatter" />
    </main>
  );
}
