export const AVATAR_PHOTOS = [
  "avatar-1.jpeg",
  "avatar-2.jpeg",
  "avatar-3.jpeg",
  "avatar-4.jpeg",
  "avatar-5.jpeg",
  "avatar-6.jpeg",
  "avatar-7.jpeg",
  "avatar-8.jpeg",
] as const;

export type AvatarPhoto = (typeof AVATAR_PHOTOS)[number];

export const DEFAULT_AVATAR_PHOTO: AvatarPhoto = AVATAR_PHOTOS[0];

export function isValidAvatarPhoto(photo: unknown): photo is AvatarPhoto {
  return typeof photo === "string" && AVATAR_PHOTOS.includes(photo as AvatarPhoto);
}

export function avatarPhotoSrc(photo: string) {
  return `/avatars/${photo}`;
}
