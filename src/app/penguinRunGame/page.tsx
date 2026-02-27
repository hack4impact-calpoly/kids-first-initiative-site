import Navbar from "@/components/Navbar";
import UnityIFrame from "@/components/UnityIFrame";

export default function PenguinRunPage() {
  return (
    <main>
      <Navbar />
      <UnityIFrame game="PenguinRun" />
    </main>
  );
}
