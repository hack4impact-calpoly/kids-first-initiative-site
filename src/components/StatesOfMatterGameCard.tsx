import { Box, Heading, Text, Button } from "@chakra-ui/react";
import Link from "next/link";
import Image from "next/image";

interface StatesOfMatterGameCardProps {
  title: string;
  description: string;
  href: string;
  bgGradient: string;
  iconSrc: string;
}

export default function StatesOfMatterGameCard({
  title,
  description,
  href,
  bgGradient,
  iconSrc,
}: StatesOfMatterGameCardProps) {
  return (
    <Box
      bg="white"
      borderRadius="2xl"
      boxShadow="sm"
      _hover={{ boxShadow: "md", transform: "translateY(-4px)" }}
      transition="all 0.2s"
      overflow="hidden"
      display="flex"
      flexDirection="column"
    >
      {/* TOP HALF: Adaptive Graphic Area */}
      <Box
        h="200px"
        w="full"
        bgGradient={bgGradient}
        display="flex"
        alignItems="center"
        justifyContent="center"
        position="relative"
        overflow="hidden"
      >
        <Box
          position="relative"
          w="full"
          h="full"
          transform="scale(1.0)" // Slightly zoomed out from 1.5
          transition="transform 0.3s ease" // Smooth transition if you add hover effects later
        >
          <Image src={iconSrc} alt={`${title} icon`} fill style={{ objectFit: "cover" }} priority />
        </Box>
      </Box>

      {/* BOTTOM HALF: Large Titles and Playful Text */}
      <Box display="flex" flexDirection="column" alignItems="center" textAlign="center" p={8} flexGrow={1}>
        <Heading size="xl" mb={3} color="gray.800" fontWeight="800" letterSpacing="tight">
          {title}
        </Heading>
        <Text fontSize="md" color="gray.500" mb={8} flexGrow={1} lineHeight="tall">
          {description}
        </Text>

        <Link href={href} style={{ width: "100%" }}>
          <Button
            w="full"
            bg="#2B8BFF"
            color="white"
            _hover={{ bg: "blue.500" }}
            borderRadius="full"
            size="lg"
            display="flex"
            gap={2}
            fontWeight="bold"
            boxShadow="0 4px 14px 0 rgba(43, 139, 255, 0.39)" // Added a slight glow/shadow to match Figma
          >
            <svg width="1.2em" height="1.2em" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            PLAY
          </Button>
        </Link>
      </Box>
    </Box>
  );
}
