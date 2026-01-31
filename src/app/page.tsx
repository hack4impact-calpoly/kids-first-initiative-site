import Navbar from "@/components/Navbar";
import UnityIFrame from "@/components/UnityIFrame";

export default function Home() {
  return (
    <main>
      <Navbar />
      <h1>Home</h1>
      <UnityIFrame game="PenguinRun" />
    </main>
  );
}
