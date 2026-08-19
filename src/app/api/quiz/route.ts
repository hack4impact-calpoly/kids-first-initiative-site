import connectDB from "@/database/db";
import User from "@/database/userSchema";
import Quiz from "@/database/quizSchema";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getRequestActor, requireAdmin } from "@/lib/server/apiAuthorization";
import { resolveDataPrincipal } from "@/lib/server/classroomAuthorization";
import { ApiInputError } from "@/lib/server/apiErrors";

type QuizQuestionResultInput = {
  questionId?: unknown;
  questionText?: unknown;
  answerOptions?: unknown;
  selectedAnswer?: unknown;
  correctAnswer?: unknown;
  isCorrect?: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new ApiInputError(`${field} must be a number`);
  }
  return value;
}

function parseString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiInputError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function parseBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new ApiInputError(`${field} must be a boolean`);
  }
  return value;
}

function normalizeQuestionResults(rawResults: unknown, fieldName: string) {
  if (!Array.isArray(rawResults)) {
    throw new ApiInputError(`${fieldName} must be an array`);
  }

  return rawResults.map((rawResult) => {
    if (!isObject(rawResult)) {
      throw new ApiInputError(`${fieldName} contains an invalid question result`);
    }

    const incoming = rawResult as QuizQuestionResultInput;
    const answerOptions = Array.isArray(incoming.answerOptions)
      ? incoming.answerOptions.map((option, index) => parseString(option, `${fieldName}.answerOptions[${index}]`))
      : [];

    return {
      questionId: parseString(incoming.questionId, `${fieldName}.questionId`),
      questionText: parseString(incoming.questionText, `${fieldName}.questionText`),
      answerOptions,
      selectedAnswer: parseString(incoming.selectedAnswer, `${fieldName}.selectedAnswer`),
      correctAnswer: parseString(incoming.correctAnswer, `${fieldName}.correctAnswer`),
      isCorrect: parseBoolean(incoming.isCorrect, `${fieldName}.isCorrect`),
    };
  });
}

// GET /api/quiz
// Fetch all quiz documents for administrators.
export async function GET() {
  try {
    const admin = requireAdmin(await getRequestActor());
    if (!admin.ok) return admin.response;

    await connectDB();
    const quizzes = await Quiz.find({}).sort({ createdAt: -1 }).lean();
    return NextResponse.json(quizzes, { status: 200 });
  } catch (err: any) {
    // Any DB/query failure is returned as a 500 so callers can treat this as a server-side error.
    console.error("GET /api/quiz error:", err);
    return NextResponse.json({ error: "Failed to load quizzes" }, { status: 500 });
  }
}

// POST /api/quiz
// Creates a quiz record for the signed-in user or updates the existing one.
export async function POST(req: NextRequest) {
  try {
    const rawBody: unknown = await req.json().catch(() => null);
    if (!isObject(rawBody)) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};

    if (rawBody.statesOfMatterScoreBefore !== undefined) {
      updates.statesOfMatterScoreBefore = parseNumber(rawBody.statesOfMatterScoreBefore, "statesOfMatterScoreBefore");
    }
    if (rawBody.stateOfMatterScoreAfter !== undefined) {
      updates.stateOfMatterScoreAfter = parseNumber(rawBody.stateOfMatterScoreAfter, "stateOfMatterScoreAfter");
    }
    if (rawBody.penguinRunScoreBefore !== undefined) {
      updates.penguinRunScoreBefore = parseNumber(rawBody.penguinRunScoreBefore, "penguinRunScoreBefore");
    }
    if (rawBody.penguinRunScoreAfter !== undefined) {
      updates.penguinRunScoreAfter = parseNumber(rawBody.penguinRunScoreAfter, "penguinRunScoreAfter");
    }
    if (rawBody.completed !== undefined) {
      updates.completed = parseBoolean(rawBody.completed, "completed");
    }
    if (rawBody.statesOfMatterQuestionResults !== undefined) {
      updates.statesOfMatterQuestionResults = normalizeQuestionResults(
        rawBody.statesOfMatterQuestionResults,
        "statesOfMatterQuestionResults",
      );
    }
    if (rawBody.penguinRunQuestionResults !== undefined) {
      updates.penguinRunQuestionResults = normalizeQuestionResults(
        rawBody.penguinRunQuestionResults,
        "penguinRunQuestionResults",
      );
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields provided for update" }, { status: 400 });
    }

    const classroomParticipantId =
      typeof rawBody.classroomParticipantId === "string" ? rawBody.classroomParticipantId.trim() : "";
    await connectDB();
    const principal = await resolveDataPrincipal(req, await getRequestActor(), classroomParticipantId || undefined);
    if (!principal.ok) return principal.response;

    const recordKey = principal.value.ownerId;
    if (principal.value.classroom) {
      updates.classroomParticipantId = principal.value.classroom.participantId;
      updates.classroomSessionId = principal.value.classroom.sessionId;
      updates.studentDisplayName = principal.value.classroom.displayName;
    }

    const quiz = await Quiz.findOneAndUpdate(
      { clerkId: recordKey },
      {
        $set: updates,
        $setOnInsert: {
          clerkId: recordKey,
          quizId: `quiz-${recordKey}`,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      },
    );

    if (
      principal.value.actor.userId &&
      !principal.value.classroom &&
      quiz?._id &&
      mongoose.Types.ObjectId.isValid(String(quiz._id))
    ) {
      await User.findOneAndUpdate(
        { clerkId: principal.value.actor.userId },
        { $set: { quizId: quiz._id } },
        { runValidators: true },
      );
    }

    return NextResponse.json(quiz, { status: 200 });
  } catch (err) {
    if (err instanceof ApiInputError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("POST /api/quiz error:", err);
    return NextResponse.json({ error: "Failed to save quiz" }, { status: 500 });
  }
}
