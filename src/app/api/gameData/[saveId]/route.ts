import connectDB from "@/database/db";
import { auth } from "@clerk/nextjs/server";
import GameData from "@/database/gameDataSchema";
import { NextResponse, NextRequest } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ saveId: string }> }) {
  const { userId } = await auth();
  await connectDB();
  const { saveId } = await params;

  const data = await GameData.findOne({ saveId, userId }).lean();
  if (!data) {
    return NextResponse.json({ error: "Game data not found" }, { status: 404 });
  }
  return NextResponse.json(data, { status: 200 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ saveId: string }> }) {
  try {
    await connectDB();
    const { saveId } = await params;
    const changes = await req.json();
    if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
      return NextResponse.json({ error: "Invalid patch" }, { status: 400 });
    }

    const updated = await GameData.findOneAndUpdate(
      { saveId },
      { $set: changes },
      { new: true, runValidators: true },
    ).lean();
    if (!updated) {
      return NextResponse.json({ error: "Save not found" }, { status: 404 });
    }
    return NextResponse.json(updated, { status: 200 });
  } catch (err: any) {
    console.error("Server error", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
