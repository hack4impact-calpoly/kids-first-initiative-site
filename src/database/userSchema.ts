import mongoose, { Schema } from "mongoose";

// Updated UserSchema to match specifications
const UserSchema = new Schema({
  clerkId: { type: String, required: true, unique: true },
  name: { type: String, required: true, trim: true },
  username: { type: String, required: true, trim: true },
  role: { type: String, required: true, trim: true, default: "player" },
  email: { type: String, required: true, trim: true },
});

// Added "users" at the end to ensure that it maps to the users schema that is in the Atlas Validator
export default mongoose.models.User || mongoose.model("User", UserSchema, "users");
