import mongoose, { Schema } from "mongoose";

const QuizSchema = new Schema(
  {
    quizId: { type: String, required: true, unique: true, trim: true },
    clerkId: { type: String, required: true, trim: true },
    statesOfMatterScoreBefore: { type: Number, required: true, default: 0 },
    stateOfMatterScoreAfter: { type: Number, required: true, default: 0 },
    penguinRunScoreBefore: { type: Number, required: true, default: 0 },
    penguinRunScoreAfter: { type: Number, required: true, default: 0 },
    completed: { type: Boolean, required: true, default: false },
  },
  { timestamps: true },
);

// Uses "quizzes" collection in MongoDB.
export default mongoose.models.Quiz || mongoose.model("Quiz", QuizSchema, "quizzes");
