import mongoose from "mongoose";

const gameDataSchema = new mongoose.Schema({
  saveId: { type: String, required: true, unique: true },
  saveVersion: { type: Number, required: true },
  lastUpdated: { type: Date, default: Date.now },
  userId: { type: String, required: true },
  gameVersion: { type: String, required: true },
  gameId: { type: String, required: true },
  completedLevels: { type: [Number], default: [] },
});

const GameData = mongoose.models.GameData || mongoose.model("GameData", gameDataSchema);

export default GameData;
