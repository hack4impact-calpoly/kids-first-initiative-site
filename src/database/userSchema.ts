import mongoose, { Schema } from "mongoose";
import { AVATAR_PHOTOS, DEFAULT_AVATAR_PHOTO } from "@/lib/avatarPhotos";

// Updated UserSchema to match specifications
const UserSchema = new Schema({
  clerkId: { type: String, required: true, unique: true },
  name: { type: String, required: true, trim: true },
  username: { type: String, required: true, trim: true },
  role: { type: String, required: true, trim: true, default: "player" },
  email: { type: String, required: true, trim: true },
  photo: { type: String, required: true, trim: true, enum: [...AVATAR_PHOTOS], default: DEFAULT_AVATAR_PHOTO },
  quizId: { type: Schema.Types.ObjectId, ref: "Quiz", default: null },
});

// Added "users" at the end to ensure that it maps to the users schema that is in the Atlas Validator
export default mongoose.models.User || mongoose.model("User", UserSchema, "users");
