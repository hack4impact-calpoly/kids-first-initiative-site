import mongoose, { Schema } from "mongoose";

const EventSchema = new Schema({
  eventId: { type: String, required: true },
  ts: { type: Date, required: true, default: Date.now },
  anonUserId: { type: String, required: true },
  sessionId: { type: Schema.Types.ObjectId, ref: "Session", required: true },
  event: { type: String, required: true },
  props: {
    gameId: { type: String, default: null },
    durationMs: { type: Number, default: null },
    result: { type: String, default: null },
  },
});

// uses the "events" collection in the testing database
export default mongoose.models.Event || mongoose.model("Event", EventSchema, "events");
