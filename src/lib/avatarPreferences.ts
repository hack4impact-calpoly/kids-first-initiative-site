import { DEFAULT_AVATAR_PHOTO, isValidAvatarPhoto } from "./avatarPhotos";

export const LOCAL_AVATAR_PHOTO_KEY = "kfi_local_avatar_photo";

function buildAvatarPhotoKey(scope?: string) {
  return scope ? `${LOCAL_AVATAR_PHOTO_KEY}:${scope}` : LOCAL_AVATAR_PHOTO_KEY;
}

export function readLocalAvatarPhoto(scope?: string) {
  if (typeof window === "undefined") return DEFAULT_AVATAR_PHOTO;

  const storedPhoto = window.localStorage.getItem(buildAvatarPhotoKey(scope));
  return isValidAvatarPhoto(storedPhoto) ? storedPhoto : DEFAULT_AVATAR_PHOTO;
}

export function writeLocalAvatarPhoto(photo: string, scope?: string) {
  if (typeof window === "undefined") return;
  if (!isValidAvatarPhoto(photo)) return;

  window.localStorage.setItem(buildAvatarPhotoKey(scope), photo);
}
