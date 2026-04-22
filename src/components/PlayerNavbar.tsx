"use client";

import { useEffect, useState } from "react";
import { Box, Button, HStack, Spacer, Text } from "@chakra-ui/react";
import ChakraButton from "./ChakraButton";
import { ProfileCardPopup } from "./ProfileCardPopup";
import { avatarPhotoSrc, DEFAULT_AVATAR_PHOTO, isValidAvatarPhoto } from "@/lib/avatarPhotos";

type NavbarProps = {
  role?: string;
  name?: string;
  coins?: string;
  photo?: string;
};

export function PlayerNavbar({ role, name, coins = "0", photo }: NavbarProps) {
  const [isProfileCardPopupOpen, setProfileCardPopupOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(isValidAvatarPhoto(photo) ? photo : DEFAULT_AVATAR_PHOTO);

  useEffect(() => {
    if (!photo) return;
    setSelectedPhoto(isValidAvatarPhoto(photo) ? photo : DEFAULT_AVATAR_PHOTO);
  }, [photo]);

  const handleSaveAvatar = async (nextPhoto: string) => {
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

  return (
    <>
      <Box as="header" w="full" bg="gray.50" px={{ base: 4, md: 8 }} py={2}>
        <HStack mx="auto" w="full" align="center">
          {/* Left profile pill */}
          <Button
            onClick={() => setProfileCardPopupOpen(true)}
            variant="ghost"
            h="auto"
            minW="unset"
            p={0}
            borderRadius="50px"
            _hover={{ bg: "transparent" }}
          >
            <HStack
              bg="white"
              borderRadius="50px"
              px={3}
              py={2}
              gap={3}
              boxShadow="0 10px 20px rgba(15, 23, 42, 0.10)"
              border="1px solid"
              borderColor="gray.100"
            >
              <Box
                w="32px"
                h="32px"
                borderRadius="full"
                bgImage={`url(${activeAvatarSrc})`}
                bgRepeat="no-repeat"
                bgPosition="center"
                bgSize="cover"
                border="2px solid"
                borderColor="white"
              />

              <Box lineHeight="1.1">
                <Text fontSize="xs" fontWeight="800" letterSpacing="0.06em" color="blue.500">
                  {role}
                </Text>
                <Text fontSize="sm" fontWeight="800" color="gray.800">
                  {name}
                </Text>
              </Box>
            </HStack>
          </Button>

          <Spacer />

          {/* Right side actions */}
          <HStack>
            <ChakraButton href="/shop" color="red" label="SHOP" width="140px" iconSrc="/Icons/FaShoppingBag.png" />
            <ChakraButton href="/" color="yellow" label={coins} width="140px" iconSrc="/Icons/FaStar.png" />
          </HStack>
        </HStack>
      </Box>

      <ProfileCardPopup
        isOpen={isProfileCardPopupOpen}
        onClose={() => setProfileCardPopupOpen(false)}
        onSaveAvatar={handleSaveAvatar}
        selectedPhoto={selectedPhoto}
        name={name}
      />
    </>
  );
}
