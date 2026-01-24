import connectDB from "@/database/db";
import { NextResponse } from "next/server";
import User from "@/database/userSchema";

// Get a specific user, finding the user by username
// ** NOTE ** : This is under the assumption that the username will be a unique field
// If username is not going to be a unique field, it would likely be a good idea to add a primary key like a UUID
export async function GET(_req: Request, { params }: { params: { username: String } }) {
  try {
    await connectDB();

    const { username } = params;

    const user = User.findOne({ username }).lean();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json(user, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

// Update a specific user, finding the user by username
// ** NOTE ** : This is under the assumption that the username will be a unique field
// If username is not going to be a unique field, it would likely be a good idea to add a primary key like a UUID
export async function PUT(req: Request, { params }: { params: { username: String } }) {
  try {
    await connectDB();

    const { username } = params;
    const changes = await req.json();

    const updatedUser = await User.findOneAndUpdate(
      username,
      { $set: changes },
      { new: true, runValidators: true },
    ).lean();

    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json(updatedUser, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
