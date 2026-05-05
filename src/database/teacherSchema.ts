import mongoose, { Schema } from "mongoose";

const TeacherSchema = new Schema(
  {
    clerkId: { type: String, required: true, unique: true, index: true, trim: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  },
  {
    timestamps: true,
  },
);

export default mongoose.models.Teacher || mongoose.model("Teacher", TeacherSchema, "teachers");
