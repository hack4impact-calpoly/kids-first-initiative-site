import connectDB from "@/database/db";
import { NextRequest, NextResponse } from "next/server";
import User from "@/database/userSchema";
import { DEFAULT_AVATAR_PHOTO, isValidAvatarPhoto } from "@/lib/avatarPhotos";
import {
  getRequestActor,
  isPlainObject,
  normalizeRole,
  normalizeSelfAssignableRole,
  requireAdmin,
  requireSignedIn,
} from "@/lib/server/apiAuthorization";
import { clerkClient } from "@clerk/nextjs/server";

function deriveUsername(email: string, name: string, clerkUsername: string | null) {
  return clerkUsername?.trim() || email.split("@")[0] || name.toLowerCase().replace(/\s+/g, "");
}

export async function POST(request: NextRequest) {
  try {
    const signedIn = requireSignedIn(await getRequestActor());
    if (!signedIn.ok) return signedIn.response;

    const rawBody: unknown = await request.json().catch(() => null);
    if (!isPlainObject(rawBody)) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
    }

    const client = await clerkClient();
    const clerkUser = await client.users.getUser(signedIn.value.userId);
    const email = clerkUser.primaryEmailAddress?.emailAddress?.trim();
    if (!email) {
      return NextResponse.json({ error: "A verified Clerk email address is required" }, { status: 400 });
    }

    const name = clerkUser.fullName?.trim() || clerkUser.username?.trim() || "Player";
    const requestedPhoto = typeof rawBody.photo === "string" ? rawBody.photo.trim() : DEFAULT_AVATAR_PHOTO;
    const photo = isValidAvatarPhoto(requestedPhoto) ? requestedPhoto : DEFAULT_AVATAR_PHOTO;
    const clerkRole = normalizeRole(clerkUser.publicMetadata?.role);
    const requestedRole = normalizeSelfAssignableRole(rawBody.role);

    await connectDB();
    const existingUser = await User.findOne({ clerkId: signedIn.value.userId }).lean<{
      role?: string;
      photo?: string;
    } | null>();
    const existingRole = normalizeRole(existingUser?.role);
    const role =
      clerkRole === "admin"
        ? "admin"
        : existingRole && existingRole !== "admin"
          ? existingRole
          : clerkRole
            ? clerkRole
            : requestedRole;

    const user = await User.findOneAndUpdate(
      { clerkId: signedIn.value.userId },
      {
        $set: {
          name,
          username: deriveUsername(email, name, clerkUser.username),
          email,
          role,
          photo: existingUser?.photo && isValidAvatarPhoto(existingUser.photo) ? existingUser.photo : photo,
        },
        $setOnInsert: { clerkId: signedIn.value.userId },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
    ).lean();

    await client.users.updateUserMetadata(signedIn.value.userId, {
      publicMetadata: { ...clerkUser.publicMetadata, role },
    });

    return NextResponse.json(user, { status: existingUser ? 200 : 201 });
  } catch (error) {
    console.error("POST /api/users error:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const admin = requireAdmin(await getRequestActor());
    if (!admin.ok) return admin.response;

    await connectDB();
    const users = await User.find({}).lean();
    return NextResponse.json(users, { status: 200 });
  } catch (error) {
    console.error("GET /api/users error:", error);
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }
}
