import connectDB from "@/database/db";
import { NextResponse, NextRequest } from "next/server";
import User from "@/database/userSchema";
import { DEFAULT_AVATAR_PHOTO, isValidAvatarPhoto } from "@/lib/avatarPhotos";

function deriveUsername(body: Record<string, unknown>) {
  const username = typeof body.username === "string" ? body.username.trim() : "";
  if (username) return username;

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (email) return email.split("@")[0];

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name) return name.toLowerCase().replace(/\s+/g, "");

  const clerkId = typeof body.clerkId === "string" ? body.clerkId.trim() : "";
  return clerkId;
}

// CREATE a user with the parameters that are passed in, catching any server connection or bad requestst that may occur
export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const body = await req.json();
    const requestedPhoto = typeof body.photo === "string" ? body.photo.trim() : DEFAULT_AVATAR_PHOTO;
    const photo = isValidAvatarPhoto(requestedPhoto) ? requestedPhoto : DEFAULT_AVATAR_PHOTO;
    const userData = {
      ...body,
      username: deriveUsername(body),
      photo,
    };

    if (userData.clerkId) {
      const existingUser = await User.findOne({ clerkId: userData.clerkId }).lean();
      if (existingUser) {
        return NextResponse.json(existingUser, { status: 200 });
      }
    }

    const user = await User.create(userData);
    return NextResponse.json(user, { status: 201 });
  } catch (err: any) {
    console.error("Caught an error", err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

// RETRIEVE all users from the database, catching any errors that may occur
export async function GET() {
  try {
    await connectDB();

    const retrieved_users = await User.find({}).lean();
    return NextResponse.json(retrieved_users, { status: 200 });
  } catch (err: any) {
    console.error("Caught an error", err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
