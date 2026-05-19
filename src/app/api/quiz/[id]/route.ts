import connectDB from "@/database/db";
import Quiz from "@/database/quizSchema";
import quizData from "@/data/quiz.json";
import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

type QuizOption = {
  id: string;
  text: string;
};

type QuizQuestionDefinition = {
  questionId: string;
  question: string;
  options: QuizOption[];
  correctOptionId: string;
  correctAnswer: string;
};

type QuizDefinitions = {
  statesOfMatterQuiz: QuizQuestionDefinition[];
  penguinRunQuiz: QuizQuestionDefinition[];
};

type IncomingQuestionResult = {
  questionId?: unknown;
  questionText?: unknown;
  question?: unknown;
  answerOptions?: unknown;
  options?: unknown;
  selectedAnswer?: unknown;
  selectedOptionId?: unknown;
  correctAnswer?: unknown;
  correctOptionId?: unknown;
  isCorrect?: unknown;
};

const typedQuizData = quizData as QuizDefinitions;
const statesOfMatterMap = new Map(typedQuizData.statesOfMatterQuiz.map((q) => [q.questionId, q]));
const penguinRunMap = new Map(typedQuizData.penguinRunQuiz.map((q) => [q.questionId, q]));

function getQuizLookupFilter(id: string) {
  if (mongoose.Types.ObjectId.isValid(id)) {
    return { _id: id };
  }

  return { quizId: id };
}

function isObject(value: unknown): value is Record<string, unknown> {
  // Narrow unknown JSON input to a plain object before reading any fields.
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseNumber(value: unknown, field: string): number {
  // Enforce numeric fields early so invalid payloads fail with a clear 400 message.
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${field} must be a number`);
  }
  return value;
}

function parseBoolean(value: unknown, field: string): boolean {
  // Keep boolean flags strict to avoid accepting string/number lookalikes.
  if (typeof value !== "boolean") {
    throw new Error(`${field} must be a boolean`);
  }
  return value;
}

function parseString(value: unknown, field: string): string {
  // Require non-empty strings for identity fields like quizId/clerkId.
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function extractAnswerOptions(rawOptions: unknown, fallbackOptions: QuizOption[], questionId: string): string[] {
  if (rawOptions === undefined) {
    return fallbackOptions.map((option) => option.text);
  }

  if (!Array.isArray(rawOptions)) {
    throw new Error(`answerOptions/options must be an array for questionId=${questionId}`);
  }

  const normalizedOptions = rawOptions.map((option) => {
    if (typeof option === "string" && option.trim().length > 0) {
      return option.trim();
    }

    if (isObject(option) && typeof option.text === "string" && option.text.trim().length > 0) {
      return option.text.trim();
    }

    throw new Error(`Invalid option format for questionId=${questionId}`);
  });

  return normalizedOptions;
}

function optionIdToText(optionId: unknown, question: QuizQuestionDefinition): string | null {
  if (typeof optionId !== "string") {
    return null;
  }

  const match = question.options.find((option) => option.id === optionId);
  return match?.text ?? null;
}

function normalizeQuestionResults(
  rawResults: unknown,
  questionMap: Map<string, QuizQuestionDefinition>,
  fieldName: string,
) {
  if (!Array.isArray(rawResults)) {
    throw new Error(`${fieldName} must be an array`);
  }

  return rawResults.map((rawResult) => {
    if (!isObject(rawResult)) {
      throw new Error(`${fieldName} contains an invalid question result`);
    }

    const incoming = rawResult as IncomingQuestionResult;
    const questionId = parseString(incoming.questionId, `${fieldName}.questionId`);
    const questionDefinition = questionMap.get(questionId);

    if (!questionDefinition) {
      throw new Error(`Unknown questionId=${questionId} in ${fieldName}`);
    }

    const questionText =
      typeof incoming.questionText === "string" && incoming.questionText.trim().length > 0
        ? incoming.questionText.trim()
        : typeof incoming.question === "string" && incoming.question.trim().length > 0
          ? incoming.question.trim()
          : questionDefinition.question;

    const answerOptions = extractAnswerOptions(
      incoming.answerOptions ?? incoming.options,
      questionDefinition.options,
      questionId,
    );

    const selectedAnswer =
      typeof incoming.selectedAnswer === "string" && incoming.selectedAnswer.trim().length > 0
        ? incoming.selectedAnswer.trim()
        : optionIdToText(incoming.selectedOptionId, questionDefinition);

    if (!selectedAnswer) {
      throw new Error(`selectedAnswer or selectedOptionId is required for questionId=${questionId}`);
    }

    const correctAnswer =
      typeof incoming.correctAnswer === "string" && incoming.correctAnswer.trim().length > 0
        ? incoming.correctAnswer.trim()
        : (optionIdToText(incoming.correctOptionId, questionDefinition) ?? questionDefinition.correctAnswer);

    const isCorrect =
      typeof incoming.isCorrect === "boolean"
        ? incoming.isCorrect
        : selectedAnswer.toLowerCase() === correctAnswer.toLowerCase();

    return {
      questionId,
      questionText,
      answerOptions,
      selectedAnswer,
      correctAnswer,
      isCorrect,
    };
  });
}

function scoreFromResults(results: { isCorrect: boolean }[]) {
  return results.reduce((total, item) => total + (item.isCorrect ? 1 : 0), 0);
}

// GET /api/quiz/:id
// Finds a quiz by ObjectId or quizId
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectDB();

    const quiz = await Quiz.findOne(getQuizLookupFilter(id)).lean();
    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    return NextResponse.json(quiz, { status: 200 });
  } catch (err: any) {
    // Unexpected lookup failures are treated as server errors.
    console.error("GET /api/quiz/:id error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT /api/quiz/:id
// Updates an existing quiz by ObjectId or quizId
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rawBody: unknown = await req.json();
    // Reject non-object payloads before any field-level parsing.
    if (!isObject(rawBody)) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
    }

    const changes: Record<string, unknown> = {};

    if (rawBody.quizId !== undefined) changes.quizId = parseString(rawBody.quizId, "quizId");
    if (rawBody.clerkId !== undefined) changes.clerkId = parseString(rawBody.clerkId, "clerkId");
    if (rawBody.statesOfMatterScoreBefore !== undefined) {
      changes.statesOfMatterScoreBefore = parseNumber(rawBody.statesOfMatterScoreBefore, "statesOfMatterScoreBefore");
    }
    if (rawBody.stateOfMatterScoreAfter !== undefined) {
      changes.stateOfMatterScoreAfter = parseNumber(rawBody.stateOfMatterScoreAfter, "stateOfMatterScoreAfter");
    }
    if (rawBody.penguinRunScoreBefore !== undefined) {
      changes.penguinRunScoreBefore = parseNumber(rawBody.penguinRunScoreBefore, "penguinRunScoreBefore");
    }
    if (rawBody.penguinRunScoreAfter !== undefined) {
      changes.penguinRunScoreAfter = parseNumber(rawBody.penguinRunScoreAfter, "penguinRunScoreAfter");
    }
    if (rawBody.completed !== undefined) changes.completed = parseBoolean(rawBody.completed, "completed");

    if (rawBody.statesOfMatterQuestionResults !== undefined) {
      const normalizedStatesResults = normalizeQuestionResults(
        rawBody.statesOfMatterQuestionResults,
        statesOfMatterMap,
        "statesOfMatterQuestionResults",
      );
      changes.statesOfMatterQuestionResults = normalizedStatesResults;
      if (rawBody.stateOfMatterScoreAfter === undefined) {
        changes.stateOfMatterScoreAfter = scoreFromResults(normalizedStatesResults);
      }
    }

    if (rawBody.penguinRunQuestionResults !== undefined) {
      const normalizedPenguinResults = normalizeQuestionResults(
        rawBody.penguinRunQuestionResults,
        penguinRunMap,
        "penguinRunQuestionResults",
      );
      changes.penguinRunQuestionResults = normalizedPenguinResults;
      if (rawBody.penguinRunScoreAfter === undefined) {
        changes.penguinRunScoreAfter = scoreFromResults(normalizedPenguinResults);
      }
    }

    if (Object.keys(changes).length === 0) {
      // Prevent no-op or unknown-only payloads from silently succeeding.
      return NextResponse.json({ error: "No valid fields provided for update" }, { status: 400 });
    }

    await connectDB();

    const updatedQuiz = await Quiz.findOneAndUpdate(
      getQuizLookupFilter(id),
      { $set: changes },
      { new: true, runValidators: true },
    ).lean();

    if (!updatedQuiz) {
      // Return 404 when the requested quiz id/quizId does not exist.
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    return NextResponse.json(updatedQuiz, { status: 200 });
  } catch (err: any) {
    // Validation/parsing and DB update errors are surfaced as bad requests for the caller.
    console.error("PUT /api/quiz/:id error:", err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
