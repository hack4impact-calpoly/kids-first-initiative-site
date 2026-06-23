"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Box, Button, Flex, HStack, Spinner, Text } from "@chakra-ui/react";
import { ProfileCardPopup } from "./ProfileCardPopup";
import AdminProfileCard from "./AdminProfileCard";
import AdminSettingsPopup from "./AdminSettingsPopup";
import { avatarPhotoSrc, DEFAULT_AVATAR_PHOTO, isValidAvatarPhoto } from "@/lib/avatarPhotos";
import { readLocalAvatarPhoto, writeLocalAvatarPhoto } from "@/lib/avatarPreferences";
import { readClassroomSessionSnapshot } from "@/lib/classroomSessionClient";

const STUDENT_EXPERIENCE_PREFIXES = [
  "/playerDashboard",
  "/penguinRunGame",
  "/penguinRunQuiz",
  "/statesOfMatterGame",
  "/threeStatesOfMatterQuiz",
  "/shop",
];

type CurrentUserResponse = {
  _id?: string;
  name?: string;
  role?: string;
  photo?: string;
  email?: string;
};

function formatRole(role?: string) {
  if (!role) return "";
  if (role === "educator") return "EDUCATOR";
  if (role === "parent") return "PARENT";
  if (role === "admin") return "ADMIN";
  return role.toUpperCase();
}

export default function Navbar() {
  const pathname = usePathname();
  const { user } = useUser();
  const isStudentExperience = pathname
    ? STUDENT_EXPERIENCE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
    : false;
  const joinedSession = isStudentExperience ? readClassroomSessionSnapshot() : null;
  const isJoinedStudent = Boolean(joinedSession);
  const joinedSessionDisplayName = joinedSession?.displayName?.trim();
  const studentAvatarScope = joinedSession?.participantId ?? joinedSession?.sessionId;
  const [isProfileCardPopupOpen, setProfileCardPopupOpen] = useState(false);
  const [isAdminProfileCardOpen, setAdminProfileCardOpen] = useState(false);
  const [isAdminSettingsOpen, setAdminSettingsOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
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

        setCurrentUserId(data._id?.trim() || "");
        setDisplayName(
          joinedSessionDisplayName || data.name?.trim() || user?.fullName?.trim() || user?.username || "Player",
        );
        setDisplayRole(isJoinedStudent ? "STUDENT" : formatRole(data.role));
        setSelectedPhoto(
          isJoinedStudent
            ? readLocalAvatarPhoto(studentAvatarScope)
            : isValidAvatarPhoto(data.photo)
              ? data.photo
              : readLocalAvatarPhoto(),
        );
        setDisplayEmail(data.email?.trim() || user?.primaryEmailAddress?.emailAddress || "");
      } catch {
        if (!isActive) return;

        setCurrentUserId("");
        setDisplayName(joinedSessionDisplayName || user?.fullName?.trim() || user?.username || "Player");
        setDisplayRole("STUDENT");
        setSelectedPhoto(readLocalAvatarPhoto(studentAvatarScope));
        setDisplayEmail(user?.primaryEmailAddress?.emailAddress || "");
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    loadCurrentUser();

    return () => {
      isActive = false;
    };
  }, [
    isStudentExperience,
    isJoinedStudent,
    joinedSessionDisplayName,
    studentAvatarScope,
    user?.fullName,
    user?.username,
    user?.primaryEmailAddress?.emailAddress,
  ]);

  const handleSaveAvatar = async (nextPhoto: string) => {
    if (!isValidAvatarPhoto(nextPhoto)) return false;

    const previousPhoto = selectedPhoto;
    setSelectedPhoto(nextPhoto);
    writeLocalAvatarPhoto(nextPhoto, joinedSession ? studentAvatarScope : undefined);

    if (joinedSession) {
      return true;
    }

    try {
      const response = await fetch("/api/users/me/photo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo: nextPhoto }),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 404) {
          return true;
        }

        setSelectedPhoto(previousPhoto);
        writeLocalAvatarPhoto(previousPhoto);
        return false;
      }

      return true;
    } catch {
      setSelectedPhoto(previousPhoto);
      writeLocalAvatarPhoto(previousPhoto);
      return false;
    }
  };

  const activeAvatarSrc = avatarPhotoSrc(selectedPhoto);
  const isAdmin = displayRole === "ADMIN";

  return (
    <>
      <Box as="header" w="full" bg="white" borderBottom="1px solid" borderColor="#edf1f5">
        <Flex w="full" minH="64px" align="center" justify="space-between" px={{ base: 5, md: 8, lg: 12 }} py={4}>
          <HStack gap={4}>
            <Link href="/dashboard" aria-label="Kids First Initiative Dashboard">
              <Image
                src="/Icons/kfi-logo.jpeg"
                alt="Kids First Initiative logo"
                width={52}
                height={46}
                style={{
                  display: "block",
                  width: "52px",
                  height: "46px",
                  objectFit: "cover",
                  objectPosition: "center top",
                }}
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
                if (isAdmin) {
                  setAdminProfileCardOpen(true);
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
        role={displayRole}
      />
      <AdminProfileCard
        isOpen={isAdminProfileCardOpen}
        onClose={() => setAdminProfileCardOpen(false)}
        name={displayName}
        avatarSrc={activeAvatarSrc}
        onAccountSettingsClick={() => {
          setAdminProfileCardOpen(false);
          setAdminSettingsOpen(true);
        }}
      />

      <AdminSettingsPopup
        isOpen={isAdminSettingsOpen}
        onClose={() => setAdminSettingsOpen(false)}
        userId={currentUserId || undefined}
        fallbackName={displayName}
        fallbackEmail={displayEmail}
        onProfileUpdated={(profile) => {
          setDisplayName(profile.name);
          setDisplayEmail(profile.email);
        }}
      />
    </>
  );
}
