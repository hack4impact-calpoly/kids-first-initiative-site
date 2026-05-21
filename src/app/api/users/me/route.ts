import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import connectDB from "@/database/db";
import User from "@/database/userSchema";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const user = await User.findOne({ clerkId: userId }).lean<{
      name?: string;
      role?: string;
      photo?: string;
      email?: string;
    } | null>();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user, { status: 200 });
  } catch (error: any) {
    console.error("GET /api/users/me error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to load user" }, { status: 500 });
  }
}
