import connectDB from "@/database/db";
import { NextResponse } from "next/server";
import User from "@/database/userSchema";
import mongoose from "mongoose";

// Get a specific user, finding the user by their userID
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB();

    const { id } = params;

    const user = await User.findById(id).lean();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json(user, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Update a specific user, finding the user by their userID
export async function PUT(req: Request, { params }: { params: { id: String } }) {
  try {
    await connectDB();

    const { id } = params;
    const changes = await req.json();

    const updatedUser = await User.findByIdAndUpdate(id, { $set: changes }, { new: true, runValidators: true }).lean();

    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json(updatedUser, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
