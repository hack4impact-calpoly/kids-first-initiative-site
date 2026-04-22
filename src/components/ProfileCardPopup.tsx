"use client";

import { Box, Button, HStack, Separator, SimpleGrid, Text, VStack } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { SignOutButton } from "@clerk/nextjs";
import { AVATAR_PHOTOS, avatarPhotoSrc, DEFAULT_AVATAR_PHOTO } from "@/lib/avatarPhotos";

export type AvatarOption = {
  photo: string;
  src: string;
};

export const AVATAR_OPTIONS: AvatarOption[] = AVATAR_PHOTOS.map((photo) => ({ photo, src: avatarPhotoSrc(photo) }));

type ProfileCardPopupProps = {
  isOpen: boolean;
  onClose: () => void;
  onSaveAvatar: (nextPhoto: string) => Promise<boolean>;
  selectedPhoto?: string;
  name?: string;
};

export function ProfileCardPopup({
  isOpen,
  onClose,
  onSaveAvatar,
  selectedPhoto,
  name = "Player",
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
        <Box w="full" maxW="860px" position="relative">
          <Button
            onClick={onClose}
            position="absolute"
            top={{ base: "-8px", md: "-14px" }}
            right={{ base: "-4px", md: "-10px" }}
            zIndex={3}
            w="52px"
            h="52px"
            minW="52px"
            borderRadius="full"
            bg="white"
            border="1px solid"
            borderColor="gray.100"
            boxShadow="0 8px 16px rgba(15, 23, 42, 0.16)"
            _hover={{ bg: "gray.50" }}
            color="#94A3B8"
            fontSize="2xl"
            fontWeight="700"
          >
            x
          </Button>

          <VStack
            w="full"
            bg="#f8f8f8"
            borderRadius={{ base: "24px", md: "36px" }}
            px={{ base: 5, md: 10 }}
            py={{ base: 7, md: 10 }}
            gap={{ base: 5, md: 8 }}
            align="stretch"
            boxShadow="0 22px 48px rgba(15, 23, 42, 0.28)"
          >
            <VStack align="center" textAlign="center" gap={1}>
              <Text color="#273248" fontSize={{ base: "3xl", md: "5xl" }} fontWeight="900" lineHeight="1">
                Your Profile
              </Text>
              <Text color="#5f6f88" fontSize={{ base: "sm", md: "lg" }} fontWeight="700">
                Change your hero or take a break
              </Text>
            </VStack>

            <HStack align="stretch" gap={{ base: 4, md: 7 }} flexDirection={{ base: "column", md: "row" }} w="full">
              <VStack
                flex={{ base: "1", md: "0 0 31%" }}
                bg="#f1f3f6"
                borderRadius="22px"
                border="1px solid"
                borderColor="#e6e9ee"
                px={{ base: 4, md: 5 }}
                py={{ base: 5, md: 6 }}
                align="center"
                justify="center"
                gap={4}
              >
                <Box
                  w={{ base: "132px", md: "156px" }}
                  h={{ base: "132px", md: "156px" }}
                  borderRadius="full"
                  bgImage={`url(${previewAvatarSrc})`}
                  bgRepeat="no-repeat"
                  bgPosition="center"
                  bgSize="cover"
                  border="5px solid"
                  borderColor="white"
                  boxShadow="0 10px 20px rgba(15, 23, 42, 0.18)"
                />

                <Text color="#263247" fontSize={{ base: "xl", md: "2xl" }} fontWeight="900">
                  {name}
                </Text>

                <Separator borderColor="#b9c8df" borderStyle="dashed" />

                <SignOutButton>
                  <Button
                    w="full"
                    h="58px"
                    borderRadius="14px"
                    bg="white"
                    border="1px solid"
                    borderColor="#e4e7ec"
                    color="#4a5568"
                    fontSize="lg"
                    fontWeight="700"
                    boxShadow="0 6px 0 rgba(0, 0, 0, 0.08)"
                    _hover={{ bg: "white" }}
                  >
                    <Text>Sign Out</Text>
                  </Button>
                </SignOutButton>
              </VStack>

              <VStack flex={{ base: "1", md: "0 0 69%" }} align="stretch" gap={4}>
                <HStack gap={3} color="#334155">
                  <Text fontSize={{ base: "xl", md: "3xl" }} fontWeight="900">
                    Change Profile Picture
                  </Text>
                </HStack>

                <SimpleGrid columns={4} gap={4}>
                  {AVATAR_OPTIONS.map((option, index) => (
                    <Button
                      key={`${option.photo}-${index}`}
                      onClick={() => setPendingPhoto(option.photo)}
                      variant="ghost"
                      h="auto"
                      minW="unset"
                      p={0}
                      aspectRatio={1}
                      borderRadius="full"
                      border="3px solid"
                      borderColor={pendingPhoto === option.photo ? "#4ea0df" : "transparent"}
                      _hover={{ bg: "transparent" }}
                    >
                      <Box
                        h="full"
                        w="full"
                        borderRadius="full"
                        bgImage={`url(${option.src})`}
                        bgRepeat="no-repeat"
                        bgPosition="center"
                        bgSize="cover"
                        boxShadow="0 6px 14px rgba(15, 23, 42, 0.08)"
                      />
                    </Button>
                  ))}
                </SimpleGrid>
              </VStack>
            </HStack>

            <Button
              alignSelf="center"
              w={{ base: "100%", md: "340px" }}
              h="78px"
              position="relative"
              overflow="hidden"
              borderRadius="24px"
              bg="#78bf68"
              color="white"
              fontSize={{ base: "xl", md: "2xl" }}
              fontWeight="900"
              letterSpacing="0.04em"
              _hover={{ bg: "#6faf60" }}
              boxShadow="0 12px 0 rgba(0, 0, 0, 0.12)"
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
    </Box>
  );
}
