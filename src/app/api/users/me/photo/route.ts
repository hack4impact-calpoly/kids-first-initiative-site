import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import connectDB from "@/database/db";
import User from "@/database/userSchema";
import { isValidAvatarPhoto } from "@/lib/avatarPhotos";

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth.protect();
    const body = await req.json();
    const requestedPhoto = typeof body.photo === "string" ? body.photo.trim() : "";

    if (!isValidAvatarPhoto(requestedPhoto)) {
      return NextResponse.json({ error: "Invalid photo value" }, { status: 400 });
    }

    await connectDB();

    const updatedUser = await User.findOneAndUpdate(
      { clerkId: userId },
      { $set: { photo: requestedPhoto } },
      { new: true, runValidators: true },
    ).lean<{ photo: string } | null>();

    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, photo: updatedUser.photo }, { status: 200 });
  } catch (error: any) {
    console.error("PATCH /api/users/me/photo error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to update photo" }, { status: 500 });
  }
}
