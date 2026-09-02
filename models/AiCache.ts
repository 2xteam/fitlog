import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose";

const AiCacheSchema = new Schema(
  {
    word: { type: String, required: true, unique: true, index: true },
    kind: { type: String, enum: ["wotd", "translate"], default: "wotd" },
    prompt: { type: String, default: "" },
    answer: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

export type AiCacheDocument = InferSchemaType<typeof AiCacheSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const AiCache: Model<AiCacheDocument> =
  mongoose.models.AiCache ??
  mongoose.model<AiCacheDocument>("AiCache", AiCacheSchema, "ai_cache");
