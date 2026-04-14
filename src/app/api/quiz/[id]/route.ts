import connectDB from "@/database/db";
import Quiz from "@/database/quizSchema";
import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

function getQuizLookupFilter(id: string) {
  if (mongoose.Types.ObjectId.isValid(id)) {
    return { _id: id };
  }

  return { quizId: id };
}

// GET /api/quiz/:id
// Finds a quiz by ObjectId or quizId
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    await connectDB();

    const quiz = await Quiz.findOne(getQuizLookupFilter(id)).lean();
    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    return NextResponse.json(quiz, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/quiz/:id error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT /api/quiz/:id
// Updates an existing quiz by ObjectId or quizId
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const changes = await req.json();
    await connectDB();

    const updatedQuiz = await Quiz.findOneAndUpdate(
      getQuizLookupFilter(id),
      { $set: changes },
      { new: true, runValidators: true },
    ).lean();

    if (!updatedQuiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    return NextResponse.json(updatedQuiz, { status: 200 });
  } catch (err: any) {
    console.error("PUT /api/quiz/:id error:", err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
