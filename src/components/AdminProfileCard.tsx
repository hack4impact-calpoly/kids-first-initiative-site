"use client";

import { useEffect } from "react";
import { Avatar, Box, Button, HStack, Separator, Text, VStack } from "@chakra-ui/react";
import { SignOutButton } from "@clerk/nextjs";
import { FiLogOut, FiUserCheck } from "react-icons/fi";

type AdminProfileCardProps = {
  isOpen: boolean;
  onClose: () => void;
  name: string;
  avatarSrc?: string;
  onAccountSettingsClick?: () => void;
};

export default function AdminProfileCard({
  isOpen,
  onClose,
  name,
  avatarSrc,
  onAccountSettingsClick,
}: AdminProfileCardProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <Box position="fixed" inset={0} zIndex={1500}>
      <Box position="absolute" inset={0} bg="blackAlpha.500" backdropFilter="blur(7px)" onClick={onClose} />

      <Box position="relative" h="full" display="flex" alignItems="center" justifyContent="center" p={4}>
        <VStack
          w="full"
          maxW="420px"
          bg="white"
          borderRadius={{ base: "28px", md: "36px" }}
          px={{ base: 7, md: 9 }}
          pt={{ base: 7, md: 8 }}
          pb={{ base: 8, md: 9 }}
          gap={6}
          align="stretch"
          boxShadow="0 22px 48px rgba(15, 23, 42, 0.24)"
        >
          <HStack gap={{ base: 4, md: 6 }} align="center">
            <Avatar.Root boxSize={{ base: "76px", md: "88px" }}>
              <Avatar.Fallback name={name} />
              <Avatar.Image src={avatarSrc} />
            </Avatar.Root>

            <Box minW={0}>
              <Text color="#202638" fontSize={{ base: "xl", md: "2xl" }} fontWeight="900" lineHeight="1.05">
                {name}
              </Text>
              <Text color="#6c7078" fontSize={{ base: "md", md: "xl" }} fontWeight="700" lineHeight="1.15" mt={1}>
                System Admin
              </Text>
            </Box>
          </HStack>

          <Separator borderColor="#edf0f4" />

          <VStack align="stretch" gap={6}>
            <Button
              onClick={onAccountSettingsClick}
              variant="ghost"
              h="54px"
              px={4}
              justifyContent="flex-start"
              color="#273248"
              borderRadius="14px"
              _hover={{ bg: "gray.50" }}
            >
              <HStack gap={4}>
                <FiUserCheck size={24} color="#2e74a1" />
                <Text fontSize={{ base: "md", md: "xl" }} fontWeight="900">
                  Account Settings
                </Text>
              </HStack>
            </Button>

            <SignOutButton redirectUrl="/home">
              <Button
                variant="ghost"
                h="54px"
                px={4}
                justifyContent="flex-start"
                color="#c74740"
                borderRadius="14px"
                _hover={{ bg: "red.50" }}
              >
                <HStack gap={4}>
                  <FiLogOut size={24} />
                  <Text fontSize={{ base: "md", md: "xl" }} fontWeight="900">
                    Sign Out
                  </Text>
                </HStack>
              </Button>
            </SignOutButton>
          </VStack>
        </VStack>
      </Box>
    </Box>
  );
}
