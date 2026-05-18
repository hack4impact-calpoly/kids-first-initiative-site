import connectDB from "@/database/db";
import User from "@/database/userSchema";
import Quiz from "@/database/quizSchema";
import { NextRequest, NextResponse } from "next/server";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }

  return value.trim();
}

// GET /api/quiz
// Fetch all quiz documents
export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const clerkId = req.nextUrl.searchParams.get("clerkId")?.trim();
    const filter = clerkId ? { clerkId } : {};
    const quizzes = await Quiz.find(filter).sort({ createdAt: -1 }).lean();
    return NextResponse.json(quizzes, { status: 200 });
  } catch (err: any) {
    // Any DB/query failure is returned as a 500 so callers can treat this as a server-side error.
    console.error("GET /api/quiz error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/quiz
// Create the initial quiz document for a user.
export async function POST(req: NextRequest) {
  try {
    const rawBody: unknown = await req.json();
    if (!isObject(rawBody)) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
    }

    const clerkId = parseString(rawBody.clerkId, "clerkId");
    const quizId = rawBody.quizId === undefined ? clerkId : parseString(rawBody.quizId, "quizId");

    await connectDB();

    const existingQuiz = await Quiz.findOne({ clerkId }).lean();
    if (existingQuiz) {
      return NextResponse.json(existingQuiz, { status: 200 });
    }

    const quiz = await Quiz.create({
      ...rawBody,
      clerkId,
      quizId,
    });

    await User.findOneAndUpdate({ clerkId }, { $set: { quizId: quiz._id } }, { new: true }).lean();

    return NextResponse.json(quiz, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/quiz error:", err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
