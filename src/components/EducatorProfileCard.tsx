"use client";

import { useEffect } from "react";
import { SignOutButton } from "@clerk/nextjs";
import { Box, Button, Flex, HStack, Separator, Text, VStack } from "@chakra-ui/react";

type EducatorProfileCardProps = {
  isOpen: boolean;
  onClose: () => void;
  name?: string;
  email?: string;
  avatarSrc?: string;
  classCode?: string;
};

export default function EducatorProfileCard({
  isOpen,
  onClose,
  name = "Ms. Rodriguez",
  email = "rodriguez@lincoln.edu",
  avatarSrc,
  classCode = "MARBLE-7T9",
}: EducatorProfileCardProps) {
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
    <Box position="fixed" inset={0} zIndex={1400}>
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
          <Box
            w="58px"
            h="58px"
            borderRadius="full"
            bg="#C7C7C7"
            bgImage={avatarSrc ? `url(${avatarSrc})` : undefined}
            bgRepeat="no-repeat"
            backgroundPosition="center"
            bgSize="cover"
            flexShrink={0}
          />

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
              truncate
            >
              {email}
            </Text>

            <Flex mt={1} align="center" justify="center" px={3} py={1} borderRadius="999px" bg="#E6ECFA">
              <Text
                fontFamily='"Poppins", "Trebuchet MS", "Avenir Next", sans-serif'
                fontWeight="600"
                fontSize="12px"
                lineHeight="18px"
                letterSpacing="0.5px"
                color="#3952A4"
              >
                EDUCATOR
              </Text>
            </Flex>
          </VStack>
        </HStack>

        <Separator borderColor="#D9D9D9" />

        <HStack justify="space-between" align="center" px={5} py={3.5} bg="#F8F8F8">
          <Text
            fontFamily='"Poppins", "Trebuchet MS", "Avenir Next", sans-serif'
            fontWeight="500"
            fontSize="13px"
            lineHeight="18px"
            letterSpacing="0.5px"
            color="#747474"
          >
            CLASS CODE
          </Text>
          <Text
            fontFamily='"Poppins", "Trebuchet MS", "Avenir Next", sans-serif'
            fontWeight="700"
            fontSize="18px"
            lineHeight="24px"
            letterSpacing="0.5px"
            color="#3952A4"
          >
            {classCode}
          </Text>
        </HStack>

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
              <Box w="18px" h="18px" borderRadius="4px" bg="#C83C3C" />
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
