import connectDB from "@/database/db";
import Quiz from "@/database/quizSchema";
import { NextResponse } from "next/server";

// GET /api/quiz
// Fetch all quiz documents
export async function GET() {
  try {
    await connectDB();

    const quizzes = await Quiz.find({}).sort({ createdAt: -1 }).lean();
    return NextResponse.json(quizzes, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/quiz error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
