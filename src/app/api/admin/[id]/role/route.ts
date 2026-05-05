import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import connectDB from "@/database/db";
import User from "@/database/userSchema";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId, sessionClaims } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // IMPORTANT perhaps uncomment this in production
  // if (sessionClaims?.role !== "admin") {
  //   return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // }

  const { role } = await req.json();

  await connectDB();
  const { id } = await params;

  // Update Mongo ( new: true will pass the updated document to mongo)
  const updated = await User.findByIdAndUpdate(id, { role }, { new: true }).lean<{ clerkId: string } | null>();
  if (!updated) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Sync Clerk metadata
  const client = await clerkClient();

  await client.users.updateUserMetadata(updated.clerkId, {
    publicMetadata: { role },
  });

  return NextResponse.json({ ok: true, user: updated }, { status: 200 });
}
