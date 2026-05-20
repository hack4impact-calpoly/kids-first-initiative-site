"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { Box, Button, Flex, HStack, Spinner, Text } from "@chakra-ui/react";
import { ProfileCardPopup } from "./ProfileCardPopup";
import EducatorProfileCard from "./EducatorProfileCard";
import { avatarPhotoSrc, DEFAULT_AVATAR_PHOTO, isValidAvatarPhoto } from "@/lib/avatarPhotos";

type CurrentUserResponse = {
  name?: string;
  role?: string;
  photo?: string;
  email?: string;
};

function formatRole(role?: string) {
  if (!role) return "STUDENT";
  if (role === "educator") return "EDUCATOR";
  if (role === "parent") return "PARENT";
  if (role === "admin") return "ADMIN";
  return role.toUpperCase();
}

export default function Navbar() {
  const { user } = useUser();
  const [isProfileCardPopupOpen, setProfileCardPopupOpen] = useState(false);
  const [isEducatorProfileCardOpen, setEducatorProfileCardOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(DEFAULT_AVATAR_PHOTO);
  const [displayName, setDisplayName] = useState("Player");
  const [displayRole, setDisplayRole] = useState("STUDENT");
  const [displayEmail, setDisplayEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    async function loadCurrentUser() {
      try {
        const response = await fetch("/api/users/me", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to load current user.");

        const data = (await response.json()) as CurrentUserResponse;
        if (!isActive) return;

        setDisplayName(data.name?.trim() || user?.fullName?.trim() || user?.username || "Player");
        setDisplayRole(formatRole(data.role));
        setSelectedPhoto(isValidAvatarPhoto(data.photo) ? data.photo : DEFAULT_AVATAR_PHOTO);
        setDisplayEmail(data.email?.trim() || user?.primaryEmailAddress?.emailAddress || "");
      } catch {
        if (!isActive) return;
        setDisplayName(user?.fullName?.trim() || user?.username || "Player");
        setDisplayRole("STUDENT");
        setSelectedPhoto(DEFAULT_AVATAR_PHOTO);
        setDisplayEmail(user?.primaryEmailAddress?.emailAddress || "");
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    loadCurrentUser();

    return () => {
      isActive = false;
    };
  }, [user?.fullName, user?.username, user?.primaryEmailAddress?.emailAddress]);

  const handleSaveAvatar = async (nextPhoto: string) => {
    if (!isValidAvatarPhoto(nextPhoto)) return false;

    const previousPhoto = selectedPhoto;
    setSelectedPhoto(nextPhoto);

    try {
      const response = await fetch("/api/users/me/photo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo: nextPhoto }),
      });

      if (!response.ok) {
        setSelectedPhoto(previousPhoto);
        return false;
      }

      return true;
    } catch {
      setSelectedPhoto(previousPhoto);
      return false;
    }
  };

  const activeAvatarSrc = avatarPhotoSrc(selectedPhoto);
  const isEducator = displayRole === "EDUCATOR";

  return (
    <>
      <Box as="header" w="full" bg="white" borderBottom="1px solid" borderColor="#edf1f5">
        <Flex w="full" minH="64px" align="center" justify="space-between" px={{ base: 5, md: 8, lg: 12 }} py={4}>
          <HStack gap={4}>
            <Link href="/dashboard" aria-label="Kids First Initiative Dashboard">
              <Box
                w={{ base: "42px", md: "46px" }}
                h={{ base: "42px", md: "46px" }}
                borderRadius="8px"
                bg="#4761B2"
                boxShadow="inset 0 1px 0 rgba(255,255,255,0.16)"
              />
            </Link>
            <Text
              fontFamily='"Poppins", "Trebuchet MS", "Avenir Next", sans-serif'
              fontWeight="700"
              fontSize={{ base: "xl", md: "2xl" }}
              color="#1B1B1B"
              letterSpacing="-0.02em"
            >
              Kids First Initiative
            </Text>
          </HStack>

          <HStack gap={4}>
            <Text
              fontFamily='"Karla", "Avenir Next", "Segoe UI", sans-serif'
              fontSize={{ base: "sm", md: "md" }}
              fontWeight="800"
              letterSpacing="0.08em"
              color="#4761B2"
            >
              {displayRole}
            </Text>

            <Button
              onClick={() => {
                if (isEducator) {
                  setEducatorProfileCardOpen(true);
                  return;
                }
                setProfileCardPopupOpen(true);
              }}
              variant="ghost"
              minW="unset"
              h="auto"
              p={0}
              borderRadius="full"
              _hover={{ bg: "transparent" }}
              aria-label="Open profile card"
            >
              <Box
                w={{ base: "48px", md: "58px" }}
                h={{ base: "48px", md: "58px" }}
                borderRadius="full"
                bg={isLoading ? "#D8E2F5" : undefined}
                bgImage={isLoading ? undefined : `url(${activeAvatarSrc})`}
                bgRepeat="no-repeat"
                backgroundPosition="center"
                bgSize="cover"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                {isLoading ? <Spinner size="sm" color="#4761B2" /> : null}
              </Box>
            </Button>
          </HStack>
        </Flex>
      </Box>

      <ProfileCardPopup
        isOpen={isProfileCardPopupOpen}
        onClose={() => setProfileCardPopupOpen(false)}
        onSaveAvatar={handleSaveAvatar}
        selectedPhoto={selectedPhoto}
        name={displayName}
      />

      <EducatorProfileCard
        isOpen={isEducatorProfileCardOpen}
        onClose={() => setEducatorProfileCardOpen(false)}
        name={displayName}
        email={displayEmail}
        avatarSrc={activeAvatarSrc}
      />
    </>
  );
}
