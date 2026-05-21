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
      <Box position="absolute" inset={0} onClick={onClose} />

      <Box
        position="absolute"
        top={{ base: "88px", md: "96px" }}
        right={{ base: "14px", md: "20px", lg: "28px" }}
        w={{ base: "300px", md: "340px" }}
        bg="white"
        border="1px solid #D9D9D9"
        borderRadius="18px"
        boxShadow="0 14px 34px rgba(0, 0, 0, 0.12)"
        overflow="hidden"
      >
        <HStack align="center" gap={4} px={5} pt={5} pb={4}>
          <Avatar.Root boxSize="58px" flexShrink={0}>
            <Avatar.Fallback name={name} />
            <Avatar.Image src={avatarSrc} />
          </Avatar.Root>

          <VStack align="flex-start" gap={0.5} flex="1" minW={0}>
            <Text
              fontFamily='"Poppins", "Trebuchet MS", "Avenir Next", sans-serif'
              fontWeight="600"
              fontSize="17px"
              lineHeight="24px"
              color="#1B1B1B"
              truncate
            >
              {name}
            </Text>
            <Text
              fontFamily='"Poppins", "Trebuchet MS", "Avenir Next", sans-serif'
              fontWeight="400"
              fontSize="14px"
              lineHeight="20px"
              color="#747474"
            >
              System Admin
            </Text>
            <Box mt={1} px={3} py={1} borderRadius="999px" bg="#E6ECFA">
              <Text
                fontFamily='"Poppins", "Trebuchet MS", "Avenir Next", sans-serif'
                fontWeight="600"
                fontSize="12px"
                lineHeight="18px"
                letterSpacing="0.5px"
                color="#3952A4"
              >
                KFI ADMIN
              </Text>
            </Box>
          </VStack>
        </HStack>

        <Separator borderColor="#D9D9D9" />

        <Button
          onClick={onAccountSettingsClick}
          variant="ghost"
          w="full"
          h="54px"
          px={4}
          borderRadius="0"
          justifyContent="flex-start"
          _hover={{ bg: "#F8FAFD" }}
        >
          <HStack gap={3}>
            <FiUserCheck size={18} color="#3952A4" />
            <Text
              fontFamily='"Poppins", "Trebuchet MS", "Avenir Next", sans-serif'
              fontWeight="500"
              fontSize="15px"
              lineHeight="22px"
              color="#1B1B1B"
            >
              Account Settings
            </Text>
          </HStack>
        </Button>

        <Separator borderColor="#D9D9D9" />

        <SignOutButton redirectUrl="/home">
          <Button
            variant="ghost"
            w="full"
            h="54px"
            px={4}
            borderRadius="0"
            justifyContent="flex-start"
            _hover={{ bg: "#FCF4F4" }}
          >
            <HStack gap={3}>
              <FiLogOut size={18} color="#C83C3C" />
              <Text
                fontFamily='"Poppins", "Trebuchet MS", "Avenir Next", sans-serif'
                fontWeight="500"
                fontSize="15px"
                lineHeight="22px"
                color="#C83C3C"
              >
                Sign Out
              </Text>
            </HStack>
          </Button>
        </SignOutButton>
      </Box>
    </Box>
  );
}
