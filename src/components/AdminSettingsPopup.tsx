"use client";

import { FormEvent, useEffect, useState } from "react";
import { Avatar, Box, Button, HStack, Input, Text, VStack } from "@chakra-ui/react";
import { FiSettings, FiX } from "react-icons/fi";

type AdminSettingsPopupProps = {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  fallbackName: string;
  fallbackEmail?: string;
  onProfileUpdated?: (profile: { name: string; email: string }) => void;
};

type UserResponse = {
  _id: string;
  name?: string;
  email?: string;
};

export default function AdminSettingsPopup({
  isOpen,
  onClose,
  userId,
  fallbackName,
  fallbackEmail = "",
  onProfileUpdated,
}: AdminSettingsPopupProps) {
  const [name, setName] = useState(fallbackName);
  const [email, setEmail] = useState(fallbackEmail);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

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

    let isActive = true;
    setName(fallbackName);
    setEmail(fallbackEmail);
    setError("");

    async function loadUser() {
      if (!userId) return;

      try {
        setIsLoading(true);
        const response = await fetch(`/api/users/${userId}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Could not load profile.");

        const user: UserResponse = await response.json();
        if (!isActive) return;

        setName(user.name ?? fallbackName);
        setEmail(user.email ?? fallbackEmail);
      } catch (loadError) {
        console.error("Failed to load admin profile:", loadError);
        if (isActive) setError("Could not load profile details.");
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    loadUser();

    return () => {
      isActive = false;
    };
  }, [fallbackEmail, fallbackName, isOpen, userId]);

  const handleSubmit = async (event: FormEvent<HTMLDivElement>) => {
    event.preventDefault();
    setError("");

    if (!userId) {
      setError("Could not find a database profile to update.");
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
        }),
      });

      if (!response.ok) throw new Error("Could not save profile changes.");

      const updatedUser: UserResponse = await response.json();
      const updatedProfile = {
        name: updatedUser.name ?? name.trim(),
        email: updatedUser.email ?? email.trim(),
      };

      onProfileUpdated?.(updatedProfile);
      onClose();
    } catch (saveError) {
      console.error("Failed to save admin profile:", saveError);
      setError("Could not save profile changes.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Box position="fixed" inset={0} zIndex={1600}>
      <Box position="absolute" inset={0} bg="blackAlpha.500" backdropFilter="blur(7px)" onClick={onClose} />

      <Box position="relative" minH="100%" display="flex" alignItems="center" justifyContent="center" p={4}>
        <Box
          w="full"
          maxW="760px"
          bg="#eef5fb"
          borderRadius={{ base: "22px", md: "26px" }}
          boxShadow="0 24px 56px rgba(15, 23, 42, 0.28)"
          overflow="hidden"
        >
          <HStack bg="white" px={{ base: 4, md: 6 }} py={4} justify="space-between">
            <HStack gap={3}>
              <Box borderRadius="full" bg="#e8f6fb" color="#2e7fab" p={2}>
                <FiSettings size={16} />
              </Box>
              <Text color="#202638" fontSize={{ base: "md", md: "lg" }} fontWeight="900">
                Account Settings
              </Text>
            </HStack>
            <Button
              aria-label="Close account settings"
              onClick={onClose}
              variant="ghost"
              size="sm"
              minW="36px"
              px={0}
              color="#667085"
            >
              <FiX size={18} />
            </Button>
          </HStack>

          <HStack
            align="stretch"
            gap={{ base: 4, md: 7 }}
            p={{ base: 4, md: 7 }}
            flexWrap={{ base: "wrap", md: "nowrap" }}
          >
            <VStack
              w={{ base: "full", md: "210px" }}
              bg="white"
              borderRadius="18px"
              py={7}
              px={4}
              gap={3}
              boxShadow="0 18px 34px rgba(64, 112, 146, 0.10)"
            >
              <Avatar.Root boxSize="86px">
                <Avatar.Fallback name={name} />
              </Avatar.Root>
              <Box textAlign="center">
                <Text color="#202638" fontSize="lg" fontWeight="900" lineHeight="1.1">
                  {name || "Admin"}
                </Text>
                <Text color="#6c7078" fontSize="sm" fontWeight="700">
                  System Administrator
                </Text>
              </Box>
            </VStack>

            <Box
              as="form"
              onSubmit={handleSubmit}
              flex="1"
              minW={{ base: "full", md: 0 }}
              bg="white"
              borderRadius="18px"
              p={{ base: 5, md: 7 }}
              boxShadow="0 18px 34px rgba(64, 112, 146, 0.10)"
            >
              <VStack align="stretch" gap={4}>
                <Box>
                  <Text color="#202638" fontSize="lg" fontWeight="900" lineHeight="1.1">
                    Personal Information
                  </Text>
                  <Text color="#6c7078" fontSize="sm" fontWeight="600">
                    Update your name and primary contact email.
                  </Text>
                </Box>

                <Box>
                  <Text color="#5b6472" fontSize="xs" fontWeight="900" letterSpacing="0.08em" mb={2}>
                    FULL NAME
                  </Text>
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    disabled={isLoading || isSaving}
                    bg="#edf3f8"
                    borderColor="#dce7ef"
                    color="#202638"
                    fontWeight="700"
                    borderRadius="14px"
                    _focus={{ borderColor: "#2f8ed8", boxShadow: "0 0 0 3px rgba(47, 142, 216, 0.25)" }}
                  />
                </Box>

                <Box>
                  <Text color="#5b6472" fontSize="xs" fontWeight="900" letterSpacing="0.08em" mb={2}>
                    EMAIL ADDRESS
                  </Text>
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={isLoading || isSaving}
                    bg="#edf3f8"
                    borderColor="#dce7ef"
                    color="#202638"
                    fontWeight="700"
                    borderRadius="14px"
                    _focus={{ borderColor: "#2f8ed8", boxShadow: "0 0 0 3px rgba(47, 142, 216, 0.25)" }}
                  />
                </Box>

                {error ? (
                  <Text color="red.500" fontSize="sm" fontWeight="700">
                    {error}
                  </Text>
                ) : null}

                <HStack justify="flex-end" pt={2}>
                  <Button
                    type="submit"
                    bg="#2f7ea8"
                    color="white"
                    borderRadius="14px"
                    px={7}
                    loading={isSaving}
                    loadingText="Saving"
                    disabled={isLoading || !name.trim() || !email.trim()}
                    _hover={{ bg: "#246b90" }}
                  >
                    Save Profile Changes
                  </Button>
                </HStack>
              </VStack>
            </Box>
          </HStack>
        </Box>
      </Box>
    </Box>
  );
}
