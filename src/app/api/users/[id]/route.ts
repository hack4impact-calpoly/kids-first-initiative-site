import connectDB from "@/database/db";
import { NextResponse, NextRequest } from "next/server";
import User from "@/database/userSchema";
import mongoose from "mongoose";
import { isValidAvatarPhoto } from "@/lib/avatarPhotos";
import { auth } from "@clerk/nextjs/server";

// Get a specific user, finding the user by their userID
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }
    await connectDB();

    const user = await User.findById(id).lean();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json(user, { status: 200 });
  } catch (err: any) {
    console.error("Caught an error", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Update a specific user, finding the user by their userID
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId: authenticatedClerkId, sessionClaims } = await auth.protect();
    const role = sessionClaims?.role;
    const { id } = await params;
    const body = await req.json();
    const changes = body && typeof body === "object" && !Array.isArray(body) ? { ...body } : null;

    if (!changes) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if ("photo" in changes) {
      const requestedPhoto = typeof changes.photo === "string" ? changes.photo.trim() : "";
      if (!isValidAvatarPhoto(requestedPhoto)) {
        return NextResponse.json({ error: "Invalid photo value" }, { status: 400 });
      }
      changes.photo = requestedPhoto;
    }

    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    if (!isObjectId && !id.trim()) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }
    await connectDB();

    const userFilter =
      role === "admin"
        ? isObjectId
          ? { _id: id }
          : { clerkId: id }
        : isObjectId
          ? { _id: id, clerkId: authenticatedClerkId }
          : { clerkId: authenticatedClerkId };

    const updatedUser = await User.findOneAndUpdate(
      userFilter,
      { $set: changes },
      { new: true, runValidators: true },
    ).lean();
    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(updatedUser, { status: 200 });
  } catch (err: any) {
    console.error("Caught an error", err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
