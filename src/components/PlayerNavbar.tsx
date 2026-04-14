"use client";

import { useState } from "react";
import { Box, HStack, Text, Avatar, Spacer } from "@chakra-ui/react";
import ChakraButton from "./ChakraButton";
import Profile from "@/components/ProfilePopup";

type NavbarProps = {
  role?: string;
  name?: string;
  coins?: string;
  avatarSrc?: string;
};

export function PlayerNavbar({ role, name, coins = "0", avatarSrc }: NavbarProps) {
  const [open, setOpen] = useState(false);

  return (
    <Box as="header" w="full" bg="gray.50" px={{ base: 4, md: 8 }} py={2}>
      <HStack mx="auto" w="full" align="center">
        {/* Left profile pill */}
        <HStack
          onClick={() => setOpen(true)}
          cursor="pointer"
          bg="white"
          borderRadius="50px"
          px={3}
          py={2}
          gap={3}
          boxShadow="0 10px 20px rgba(15, 23, 42, 0.10)"
          border="1px solid"
          borderColor="gray.100"
          _after={{
            content: '""',
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "8px",
            bg: "rgba(0,0,0,0.12)",
            pointerEvents: "none",
          }}
        >
          <Avatar.Root size="sm">
            <Avatar.Fallback name={name} />
            <Avatar.Image src={avatarSrc} />
          </Avatar.Root>

          <Box lineHeight="1.1">
            <Text fontSize="xs" fontWeight="800" letterSpacing="0.06em" color="blue.500">
              {role}
            </Text>
            <Text fontSize="sm" fontWeight="800" color="gray.800">
              {name}
            </Text>
          </Box>
        </HStack>

        <Spacer />

        {/* Right side actions */}
        <HStack>
          <ChakraButton href="/shop" color="red" label="SHOP" width="140px" iconSrc="/Icons/FaShoppingBag.png" />
          <ChakraButton href="/" color="yellow" label={coins} width="140px" iconSrc="/Icons/FaStar.png" />
        </HStack>
      </HStack>
    </Box>
  );
}
