import Navbar from "@/components/Navbar";
import Link from "next/link";

export default function StatesOfMatterPage() {
  return (
    <main>
      <Navbar />

      {/* TODO: Implement the Figma Design here */}
      <div className="flex flex-col items-center justify-center p-24">
        <h1 className="text-4xl font-bold mb-8">Choose a Game</h1>

        {/* Placeholder links to verify your routing works */}
        <div className="flex gap-4">
          <Link href="/wireGame" className="px-4 py-2 bg-blue-500 text-white rounded">
            Wire Game
          </Link>
          <Link href="/cookingGame" className="px-4 py-2 bg-blue-500 text-white rounded">
            Cooking Game
          </Link>
          <Link href="/pipesGame" className="px-4 py-2 bg-blue-500 text-white rounded">
            Pipes Game
          </Link>
        </div>
      </div>
    </main>
  );
}
