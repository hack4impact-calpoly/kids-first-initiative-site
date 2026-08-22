import mongoose, { Schema } from "mongoose";

const ClassroomSessionSchema = new Schema(
  {
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    status: {
      type: String,
      required: true,
      enum: ["active", "closed"],
      default: "active",
      index: true,
    },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: true },
    closedAt: { type: Date, default: null },
    // A reopened class is a new session linked back to the one it continues, so historical
    // participants, game saves, and quiz results are never rewritten or re-attributed.
    continuedFromId: { type: Schema.Types.ObjectId, ref: "ClassroomSession", default: null, index: true },
    // Denormalized head of the continuation chain. Null on an original session, so the class a
    // session belongs to is always `rootSessionId ?? _id`.
    rootSessionId: { type: Schema.Types.ObjectId, ref: "ClassroomSession", default: null, index: true },
  },
  {
    versionKey: false,
  },
);

ClassroomSessionSchema.index({ teacherId: 1, status: 1, createdAt: -1 });
ClassroomSessionSchema.index({ status: 1, expiresAt: 1 });
ClassroomSessionSchema.index({ teacherId: 1, rootSessionId: 1, createdAt: 1 });

// Kept separate from the existing analytics Session model to avoid breaking current routes.
export default mongoose.models.ClassroomSession ||
  mongoose.model("ClassroomSession", ClassroomSessionSchema, "classroomSessions");
