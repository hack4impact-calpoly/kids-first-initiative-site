import mongoose, { Schema } from "mongoose";

const StudentAccessCodeSchema = new Schema(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: "ClassroomSession", required: true, index: true },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 4,
      maxlength: 16,
    },
    isActive: { type: Boolean, required: true, default: true, index: true },
    createdAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: null },
  },
  {
    versionKey: false,
  },
);

StudentAccessCodeSchema.index({ sessionId: 1, code: 1 }, { unique: true });
StudentAccessCodeSchema.index({ code: 1 }, { unique: true, partialFilterExpression: { isActive: true } });
StudentAccessCodeSchema.index({ sessionId: 1, isActive: 1, createdAt: -1 });

export default mongoose.models.StudentAccessCode ||
  mongoose.model("StudentAccessCode", StudentAccessCodeSchema, "studentAccessCodes");
