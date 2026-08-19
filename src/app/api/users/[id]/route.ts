import connectDB from "@/database/db";
import { NextRequest, NextResponse } from "next/server";
import User from "@/database/userSchema";
import mongoose from "mongoose";
import { getRequestActor, isPlainObject, requireAdmin } from "@/lib/server/apiAuthorization";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = requireAdmin(await getRequestActor());
    if (!admin.ok) return admin.response;

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
  } catch (error) {
    console.error("GET /api/users/:id error:", error);
    return NextResponse.json({ error: "Failed to load user" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = requireAdmin(await getRequestActor());
    if (!admin.ok) return admin.response;

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    const rawBody: unknown = await request.json();
    if (!isPlainObject(rawBody)) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
    }

    const name = typeof rawBody.name === "string" ? rawBody.name.trim() : "";
    const email = typeof rawBody.email === "string" ? rawBody.email.trim() : "";
    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }

    await connectDB();
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { $set: { name, email } },
      { new: true, runValidators: true },
    ).lean();
    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(updatedUser, { status: 200 });
  } catch (error) {
    console.error("PUT /api/users/:id error:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
