import mongoose, { Schema } from "mongoose";

const QuizQuestionResultSchema = new Schema(
  {
    questionId: { type: String, required: true, trim: true },
    questionText: { type: String, required: true, trim: true },
    answerOptions: {
      type: [{ type: String, required: true, trim: true }],
      required: true,
      default: [],
    },
    selectedAnswer: { type: String, required: true, trim: true },
    correctAnswer: { type: String, required: true, trim: true },
    isCorrect: { type: Boolean, required: true },
  },
  { _id: false },
);

const QuizSchema = new Schema(
  {
    quizId: { type: String, required: true, unique: true, trim: true },
    clerkId: { type: String, required: true, trim: true },
    statesOfMatterScoreBefore: { type: Number, required: true, default: 0 },
    stateOfMatterScoreAfter: { type: Number, required: true, default: 0 },
    penguinRunScoreBefore: { type: Number, required: true, default: 0 },
    penguinRunScoreAfter: { type: Number, required: true, default: 0 },
    statesOfMatterQuestionResults: { type: [QuizQuestionResultSchema], default: [] },
    penguinRunQuestionResults: { type: [QuizQuestionResultSchema], default: [] },
    completed: { type: Boolean, required: true, default: false },
  },
  { timestamps: true },
);

// Uses "quizzes" collection in MongoDB.
export default mongoose.models.Quiz || mongoose.model("Quiz", QuizSchema, "quizzes");
