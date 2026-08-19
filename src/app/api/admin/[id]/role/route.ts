import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import connectDB from "@/database/db";
import User from "@/database/userSchema";
import mongoose from "mongoose";
import { getRequestActor, normalizeRole, requireAdmin } from "@/lib/server/apiAuthorization";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = requireAdmin(await getRequestActor());
  if (!admin.ok) return admin.response;

  const body = await req.json().catch(() => ({}));
  const role = normalizeRole(body.role);
  if (!role) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  await connectDB();
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  // Update Mongo ( new: true will pass the updated document to mongo)
  const updated = await User.findByIdAndUpdate(id, { role }, { new: true, runValidators: true }).lean<{
    clerkId: string;
  } | null>();
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
