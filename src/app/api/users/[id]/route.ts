import connectDB from "@/database/db";
import { NextResponse, NextRequest } from "next/server";
import User from "@/database/userSchema";
import mongoose from "mongoose";

// Get a specific user, finding the user by their userID
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
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
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const changes = await req.json();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }
    await connectDB();

    const updatedUser = await User.findByIdAndUpdate(id, { $set: changes }, { new: true, runValidators: true }).lean();
    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(updatedUser, { status: 200 });
  } catch (err: any) {
    console.error("Caught an error", err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
