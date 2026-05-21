import GamePlayer from "@/components/GamePlayer";
import Link from "next/link";
import { Box, VStack } from "@chakra-ui/react";

type PenguinRunPageProps = {
  searchParams?: Promise<{
    saveId?: string;
  }>;
};

export default async function PenguinRunPage({ searchParams }: PenguinRunPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const saveId = resolvedSearchParams?.saveId;
  const finishHref = saveId ? `/penguinRunQuiz?saveId=${saveId}&phase=after` : "/penguinRunQuiz?phase=after";

  return (
    <main>
      <VStack align="stretch" gap={4} bg="#F7F9FB" minH="100vh" px={{ base: 4, md: 6 }} py={{ base: 4, md: 5 }}>
        <Box flex="1">
          <GamePlayer game="PenguinRun" saveId={saveId} />
        </Box>

        <Box display="flex" justifyContent="flex-end">
          <Link
            href={finishHref}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "46px",
              padding: "0 32px",
              backgroundColor: "#211E5D",
              color: "#F8F8F8",
              borderRadius: "12px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Finish
          </Link>
        </Box>
      </VStack>
    </main>
  );
}
