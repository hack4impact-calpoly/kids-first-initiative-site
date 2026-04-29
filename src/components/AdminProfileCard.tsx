"use client";

import { Box, VStack, HStack, Text, Avatar, Separator } from "@chakra-ui/react";
import { SignOutButton } from "@clerk/nextjs";
import { FiUsers, FiLogOut } from "react-icons/fi";

type AdminProfileCardProps = {
  isOpen: boolean;
  onClose: () => void;
  name: string;
  avatarSrc?: string;
};

export default function AdminProfileCard({ isOpen, onClose, name, avatarSrc }: AdminProfileCardProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <Box position="fixed" top={0} left={0} right={0} bottom={0} bg="blackAlpha.400" zIndex={99} onClick={onClose} />

      {/* Card */}
      <Box
        position="fixed"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        bg="white"
        borderRadius="xl"
        boxShadow="lg"
        zIndex={100}
        w="320px"
        p={6}
      >
        {/* Profile header */}
        <HStack gap={4} mb={4}>
          <Avatar.Root size="lg">
            <Avatar.Fallback name={name} />
            <Avatar.Image src={avatarSrc} />
          </Avatar.Root>
          <Box>
            <Text fontWeight="bold" fontSize="lg" color="gray.800">
              {name}
            </Text>
            <Text fontSize="sm" color="gray.500">
              System Admin
            </Text>
          </Box>
        </HStack>

        <Separator />

        {/* Menu items */}
        <VStack gap={0} mt={2} align="stretch">
          {/* Account Settings (placeholder) */}
          <HStack gap={3} px={2} py={3} borderRadius="md" cursor="pointer" _hover={{ bg: "gray.50" }}>
            <FiUsers size={18} color="#2B6CB0" />
            <Text fontSize="md" color="gray.700">
              Account Settings
            </Text>
          </HStack>

          {/* Sign Out */}
          <SignOutButton redirectUrl="/login">
            <HStack gap={3} px={2} py={3} borderRadius="md" cursor="pointer" _hover={{ bg: "gray.50" }}>
              <FiLogOut size={18} color="#E53E3E" />
              <Text fontSize="md" color="red.500">
                Sign Out
              </Text>
            </HStack>
          </SignOutButton>
        </VStack>
      </Box>
    </>
  );
}
