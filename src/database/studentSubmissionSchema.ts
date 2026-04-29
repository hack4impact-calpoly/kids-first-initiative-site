import mongoose, { Schema } from "mongoose";

const StudentSubmissionSchema = new Schema(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: "ClassroomSession", required: true, index: true },
    accessCodeId: { type: Schema.Types.ObjectId, ref: "StudentAccessCode", required: true, index: true },
    formData: { type: Schema.Types.Mixed, required: true, default: () => ({}) },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
    versionKey: false,
  },
);

StudentSubmissionSchema.index({ sessionId: 1, accessCodeId: 1 }, { unique: true });
StudentSubmissionSchema.index({ sessionId: 1, updatedAt: -1 });

export default mongoose.models.StudentSubmission ||
  mongoose.model("StudentSubmission", StudentSubmissionSchema, "studentSubmissions");
