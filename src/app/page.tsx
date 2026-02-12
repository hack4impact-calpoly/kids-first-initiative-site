import Navbar from "@/components/Navbar";
import { Button } from "@chakra-ui/react";

export default function Home() {
  return (
    <main>
      <Navbar />
      <Button>example chakra button</Button>
      <h1>Home</h1>
    </main>
  );
}
