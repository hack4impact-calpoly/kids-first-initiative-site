import connectDB from "@/database/db";
import { auth } from "@clerk/nextjs/server";
import GameData from "@/database/gameDataSchema";
import { NextResponse, NextRequest } from "next/server";

function isIntegerArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number" && Number.isInteger(item));
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0);
}

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

    const patch = changes as Record<string, unknown>;
    const hasCompletedLevels = Object.prototype.hasOwnProperty.call(patch, "completedLevels");
    const hasCompletedStageIds = Object.prototype.hasOwnProperty.call(patch, "completedStageIds");

    if (hasCompletedLevels && !isIntegerArray(patch.completedLevels)) {
      return NextResponse.json({ error: "completedLevels must be an array of integers" }, { status: 400 });
    }
    if (hasCompletedStageIds && !isNonEmptyStringArray(patch.completedStageIds)) {
      return NextResponse.json({ error: "completedStageIds must be an array of non-empty strings" }, { status: 400 });
    }

    const { completedLevels, completedStageIds, ...fieldsToSet } = patch;
    const update: Record<string, unknown> = {};
    const completionAdditions: Record<string, unknown> = {};

    if (Object.keys(fieldsToSet).length > 0) {
      update.$set = fieldsToSet;
    }
    if (hasCompletedLevels) {
      completionAdditions.completedLevels = { $each: Array.from(new Set(completedLevels as number[])) };
    }
    if (hasCompletedStageIds) {
      completionAdditions.completedStageIds = { $each: Array.from(new Set(completedStageIds as string[])) };
    }
    if (Object.keys(completionAdditions).length > 0) {
      update.$addToSet = completionAdditions;
    }

    const updated = await GameData.findOneAndUpdate({ saveId }, update, { new: true, runValidators: true }).lean();
    if (!updated) {
      return NextResponse.json({ error: "Save not found" }, { status: 404 });
    }
    return NextResponse.json(updated, { status: 200 });
  } catch (err: any) {
    console.error("Server error", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
