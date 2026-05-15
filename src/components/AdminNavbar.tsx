import { Box, HStack, Spacer, Button } from "@chakra-ui/react";
import { useState } from "react";
import Link from "next/link";
import AdminProfileCard from "@/components/AdminProfileCard";

type AdminNavbarProps = {
  name: string;
  avatarSrc?: string;
};

export function AdminNavbar({ name, avatarSrc }: AdminNavbarProps) {
  const [showProfile, setShowProfile] = useState(false);

  return (
    <Box as="header" w="full" bg="white" px={{ base: 4, md: 8 }} py={2} borderBottom="1px solid" borderColor="gray.200">
      <HStack w="full" align="center">
        <Link href="/dashboard">
          <Button variant="ghost" borderRadius="full">
            {" "}
            Home
          </Button>
        </Link>

        <Spacer />

        <Button variant="ghost" borderRadius="full" onClick={() => setShowProfile(true)}>
          👤 Profile
        </Button>
      </HStack>

      <AdminProfileCard isOpen={showProfile} onClose={() => setShowProfile(false)} name={name} avatarSrc={avatarSrc} />
    </Box>
  );
}
