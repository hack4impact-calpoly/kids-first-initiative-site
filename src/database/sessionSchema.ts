import mongoose, { Schema } from "mongoose";

const SessionSchema = new Schema({
  anonUserId: { type: String, required: true },
  gameId: {
    type: String,
    enum: ["penguinRunGame", "statesOfMatterGame"],
    default: null,
  },
  startedAt: { type: Date, required: true },
  endedAt: { type: Date, default: null },
  durationMs: { type: Number, required: true, default: 0 },
});

// Uses "sessions" collection in the test database
export default mongoose.models.Session || mongoose.model("Session", SessionSchema, "sessions");
