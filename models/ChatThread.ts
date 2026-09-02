import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose";

const ChatThreadSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, default: "새 대화", trim: true },
    /** OpenAI Conversations API id (`conv_...`). 대화 본문은 OpenAI에만 저장됩니다. */
    openAiConversationId: { type: String, default: null, index: true },
    /** 누적 입력 토큰 (Responses usage.input_tokens 합) */
    totalInputTokens: { type: Number, default: 0 },
    /** 누적 출력 토큰 (Responses usage.output_tokens 합) */
    totalOutputTokens: { type: Number, default: 0 },
    /** 누적 총 토큰 (Responses usage.total_tokens 합) */
    totalTokens: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

ChatThreadSchema.index({ userId: 1, updatedAt: -1 });

export type ChatThreadDocument = InferSchemaType<typeof ChatThreadSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ChatThread: Model<ChatThreadDocument> =
  mongoose.models.ChatThread ??
  mongoose.model<ChatThreadDocument>("ChatThread", ChatThreadSchema, "chat_threads");
