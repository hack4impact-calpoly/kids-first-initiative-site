import { DEFAULT_AVATAR_PHOTO, isValidAvatarPhoto } from "./avatarPhotos";

export const LOCAL_AVATAR_PHOTO_KEY = "kfi_local_avatar_photo";

export function readLocalAvatarPhoto() {
  if (typeof window === "undefined") return DEFAULT_AVATAR_PHOTO;

  const storedPhoto = window.localStorage.getItem(LOCAL_AVATAR_PHOTO_KEY);
  return isValidAvatarPhoto(storedPhoto) ? storedPhoto : DEFAULT_AVATAR_PHOTO;
}

export function writeLocalAvatarPhoto(photo: string) {
  if (typeof window === "undefined") return;
  if (!isValidAvatarPhoto(photo)) return;

  window.localStorage.setItem(LOCAL_AVATAR_PHOTO_KEY, photo);
}
