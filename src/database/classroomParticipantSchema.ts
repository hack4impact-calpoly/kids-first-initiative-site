import mongoose, { Schema } from "mongoose";

const ClassroomParticipantSchema = new Schema(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: "ClassroomSession", required: true, index: true },
    accessCodeId: { type: Schema.Types.ObjectId, ref: "StudentAccessCode", required: true, index: true },
    participantKey: { type: String, required: true, trim: true, maxlength: 160 },
    clerkId: { type: String, default: null, trim: true },
    displayName: { type: String, required: true, trim: true, maxlength: 80 },
    joinedAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
  },
  {
    versionKey: false,
  },
);

ClassroomParticipantSchema.index({ sessionId: 1, participantKey: 1 }, { unique: true });
ClassroomParticipantSchema.index({ sessionId: 1, joinedAt: 1 });
ClassroomParticipantSchema.index({ sessionId: 1, lastSeenAt: -1 });

export default mongoose.models.ClassroomParticipant ||
  mongoose.model("ClassroomParticipant", ClassroomParticipantSchema, "classroomParticipants");
