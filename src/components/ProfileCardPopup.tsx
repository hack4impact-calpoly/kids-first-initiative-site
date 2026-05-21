"use client";

import { Box, Button, HStack, Separator, SimpleGrid, Text, VStack } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { SignOutButton } from "@clerk/nextjs";
import { AVATAR_PHOTOS, avatarPhotoSrc, DEFAULT_AVATAR_PHOTO } from "@/lib/avatarPhotos";

export type AvatarOption = {
  photo: string;
  src: string;
};

export const AVATAR_OPTIONS: AvatarOption[] = AVATAR_PHOTOS.slice(0, 4).map((photo) => ({
  photo,
  src: avatarPhotoSrc(photo),
}));

type ProfileCardPopupProps = {
  isOpen: boolean;
  onClose: () => void;
  onSaveAvatar: (nextPhoto: string) => Promise<boolean>;
  selectedPhoto?: string;
  name?: string;
  role?: string;
};

function formatProfileRole(role?: string) {
  if (!role) return "STUDENT";
  return role.toUpperCase();
}

export function ProfileCardPopup({
  isOpen,
  onClose,
  onSaveAvatar,
  selectedPhoto,
  name = "Player",
  role,
}: ProfileCardPopupProps) {
  const [pendingPhoto, setPendingPhoto] = useState(selectedPhoto || DEFAULT_AVATAR_PHOTO);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    setPendingPhoto(selectedPhoto || DEFAULT_AVATAR_PHOTO);
  }, [isOpen, selectedPhoto]);

  if (!isOpen) return null;

  const selectedOption = AVATAR_OPTIONS.find((option) => option.photo === pendingPhoto);
  const previewAvatarSrc = selectedOption?.src || AVATAR_OPTIONS[0].src;

  return (
    <Box position="fixed" inset={0} zIndex={1500}>
      <Box position="absolute" inset={0} bg="blackAlpha.500" backdropFilter="blur(7px)" onClick={onClose} />

      <Box position="relative" h="full" display="flex" alignItems="center" justifyContent="center" p={4}>
        <VStack
          w="full"
          maxW="720px"
          bg="white"
          border="1px solid"
          borderColor="#D9D9D9"
          borderRadius="20px"
          px={{ base: 5, md: 9 }}
          py={{ base: 6, md: 7 }}
          gap={{ base: 5, md: 6 }}
          align="center"
          boxShadow="0 20px 50px rgba(15, 23, 42, 0.18)"
        >
          <VStack w="full" align="center" textAlign="center" gap={1}>
            <Text
              fontFamily='"Poppins", "Trebuchet MS", "Avenir Next", sans-serif'
              color="#1B1B1B"
              fontSize={{ base: "3xl", md: "5xl" }}
              fontWeight="700"
              lineHeight="1"
            >
              Your Profile
            </Text>
            <Text
              fontFamily='"Poppins", "Trebuchet MS", "Avenir Next", sans-serif'
              color="#747474"
              fontSize={{ base: "sm", md: "md" }}
              fontWeight="400"
            >
              Pick a new hero or take a break.
            </Text>
          </VStack>

          <HStack w="full" align="stretch" gap={{ base: 4, md: 6 }} flexDirection={{ base: "column", md: "row" }}>
            <VStack
              flex={{ base: "1", md: "0 0 200px" }}
              bg="#F8F8F8"
              borderRadius="14px"
              px={{ base: 4, md: 4 }}
              py={{ base: 5, md: 5 }}
              gap={3}
              align="center"
            >
              <Box
                w={{ base: "110px", md: "120px" }}
                h={{ base: "110px", md: "120px" }}
                borderRadius="full"
                bgImage={`url(${previewAvatarSrc})`}
                bgRepeat="no-repeat"
                backgroundPosition="center"
                bgSize="cover"
                border="3px solid"
                borderColor="#3952A4"
              />

              <Text
                textAlign="center"
                fontFamily='"Poppins", "Trebuchet MS", "Avenir Next", sans-serif'
                fontSize={{ base: "xl", md: "2xl" }}
                fontWeight="700"
                color="#1B1B1B"
              >
                {name}
              </Text>

              <Text
                textAlign="center"
                fontFamily='"Poppins", "Trebuchet MS", "Avenir Next", sans-serif'
                fontSize="12px"
                fontWeight="500"
                letterSpacing="0.5px"
                color="#747474"
              >
                {formatProfileRole(role)}
              </Text>

              <Box flex="1" />

              <SignOutButton redirectUrl="/home">
                <Button
                  w="102px"
                  h="100px"
                  minW="102px"
                  borderRadius="999px"
                  bg="white"
                  border="1px solid"
                  borderColor="#D9D9D9"
                  _hover={{ bg: "white" }}
                >
                  <VStack gap={2}>
                    <Box w="12px" h="12px" bg="#747474" />
                    <Text
                      fontFamily='"Poppins", "Trebuchet MS", "Avenir Next", sans-serif'
                      fontWeight="600"
                      fontSize="12px"
                      lineHeight="18px"
                      color="#1B1B1B"
                    >
                      Sign Out
                    </Text>
                  </VStack>
                </Button>
              </SignOutButton>
            </VStack>

            <VStack flex="1" align="stretch" gap={4}>
              <Text
                fontFamily='"Poppins", "Trebuchet MS", "Avenir Next", sans-serif'
                fontWeight="600"
                fontSize="14px"
                lineHeight="21px"
                color="#1B1B1B"
              >
                Change Profile Picture
              </Text>

              <SimpleGrid columns={4} gap={3}>
                {AVATAR_OPTIONS.map((option, index) => {
                  const isSelected = pendingPhoto === option.photo;

                  return (
                    <Button
                      key={`${option.photo}-${index}`}
                      onClick={() => setPendingPhoto(option.photo)}
                      variant="ghost"
                      h="76px"
                      minW="unset"
                      p={0}
                      borderRadius="12px"
                      bg={isSelected ? "#E6ECFA" : "#F8F8F8"}
                      border="2px solid"
                      borderColor={isSelected ? "#3952A4" : "#D9D9D9"}
                      _hover={{ bg: isSelected ? "#E6ECFA" : "#F8F8F8" }}
                    >
                      <Box
                        w="48px"
                        h="48px"
                        borderRadius="full"
                        bgImage={`url(${option.src})`}
                        bgRepeat="no-repeat"
                        backgroundPosition="center"
                        bgSize="cover"
                      />
                    </Button>
                  );
                })}
              </SimpleGrid>
            </VStack>
          </HStack>

          <Button
            alignSelf="center"
            minW={{ base: "100%", md: "212px" }}
            h="56px"
            borderRadius="999px"
            bg="#229C54"
            color="white"
            fontFamily='"Poppins", "Trebuchet MS", "Avenir Next", sans-serif'
            fontSize="16px"
            fontWeight="700"
            letterSpacing="0.5px"
            _hover={{ bg: "#1f8d4c" }}
            onClick={async () => {
              if (isSaving) return;
              setIsSaving(true);
              let saved = false;
              try {
                saved = await onSaveAvatar(pendingPhoto);
              } finally {
                setIsSaving(false);
              }
              if (saved) onClose();
            }}
            disabled={isSaving}
          >
            <Text>{isSaving ? "SAVING..." : "SAVE & CLOSE"}</Text>
          </Button>
        </VStack>
      </Box>
    </Box>
  );
}
