"use client";

import { Box, Text, Avatar, VStack, Button } from "@chakra-ui/react";

type ProfileProps = {
  isOpen: boolean;
  onClose: () => void;
  name?: string;
  role?: string;
  avatarSrc?: string;
};

export default function Profile({
  isOpen,
  onClose,
  name = "Alex Cloudwalker",
  role = "EXPLORER",
  avatarSrc,
}: ProfileProps) {
  if (!isOpen) return null;

  return (
    <Box
      position="fixed"
      inset="0"
      bg="blackAlpha.600"
      display="flex"
      alignItems="center"
      justifyContent="center"
      zIndex={1000}
      onClick={onClose}
    >
      {/* Stop closing when clicking inside card */}
      <Box
        bg="white"
        p={8}
        borderRadius="2xl"
        boxShadow="2xl"
        textAlign="center"
        minW="300px"
        position="relative"
        onClick={(e) => e.stopPropagation()}
      >
        <VStack gap={4}>
          <Avatar.Root size="2xl">
            <Avatar.Fallback name={name} />
            <Avatar.Image src={avatarSrc} />
          </Avatar.Root>

          <Box>
            <Text fontSize="xs" fontWeight="bold" color="blue.500" letterSpacing="0.1em">
              {role}
            </Text>
            <Text fontSize="xl" fontWeight="extrabold" color="gray.800">
              {name}
            </Text>
          </Box>

          <Button mt={4} colorScheme="blue" borderRadius="full" px={6} onClick={onClose}>
            Close
          </Button>
        </VStack>
      </Box>
    </Box>
  );
}
