import Navbar from "@/components/Navbar";
import UnityIFrame from "@/components/UnityIFrame";

export default function CookingGamePage() {
  return (
    <main>
      <Navbar />
      <UnityIFrame game="StatesOfMatter" />
    </main>
  );
}
