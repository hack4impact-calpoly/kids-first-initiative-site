import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import connectDB from "@/database/db";
import User from "@/database/userSchema";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const clerkRole = typeof clerkUser.publicMetadata?.role === "string" ? clerkUser.publicMetadata.role : undefined;

    await connectDB();

    const user = await User.findOne({ clerkId: userId }).lean<{
      _id?: { toString(): string } | string;
      name?: string;
      role?: string;
      photo?: string;
      email?: string;
    } | null>();

    if (!user && !clerkRole) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        _id: user?._id ? String(user._id) : undefined,
        name: user?.name ?? clerkUser.fullName ?? clerkUser.username ?? undefined,
        role: clerkRole === "admin" ? "admin" : (user?.role ?? clerkRole),
        photo: user?.photo,
        email: user?.email ?? clerkUser.primaryEmailAddress?.emailAddress ?? undefined,
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("GET /api/users/me error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to load user" }, { status: 500 });
  }
}
