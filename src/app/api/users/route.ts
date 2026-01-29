import connectDB from "@/database/db";
import { NextResponse, NextRequest } from "next/server";
import User from "@/database/userSchema";

// CREATE a user with the parameters that are passed in, catching any server connection or bad requestst that may occur
export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const body = await req.json();
    const user = await User.create(body);
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
