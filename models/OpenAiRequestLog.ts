import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose";

const OpenAiRequestLogSchema = new Schema(
  {
    kind: {
      type: String,
      enum: ["plain_text", "vision"],
      required: true,
      index: true,
    },
    model: { type: String, required: true, index: true },
    temperature: { type: Number, required: true },
    responseFormat: { type: String, default: "json_object" },
    openaiCompletionId: { type: String, default: null, index: true },
    finishReason: { type: String, default: null },
    /** API가 준 usage 원본(세부 breakdown 포함 가능) */
    usage: { type: Schema.Types.Mixed, default: null },
    promptTokens: { type: Number, default: null, index: true },
    completionTokens: { type: Number, default: null },
    totalTokens: { type: Number, default: null, index: true },
    /** 이 함수 진입부터 로그 시점까지 경과(ms) */
    durationMs: { type: Number, required: true },
    success: { type: Boolean, required: true, index: true },
    errorMessage: { type: String, default: null },
    wordsCount: { type: Number, default: null },
    inputTextCharCount: { type: Number, default: null },
    inputImageBytes: { type: Number, default: null },
    inputImageMime: { type: String, default: null },
    inputImageDetail: { type: String, default: null },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false },
);

OpenAiRequestLogSchema.index({ createdAt: -1, kind: 1 });

export type OpenAiRequestLogDocument = InferSchemaType<typeof OpenAiRequestLogSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const OpenAiRequestLog: Model<OpenAiRequestLogDocument> =
  mongoose.models.OpenAiRequestLog ??
  mongoose.model<OpenAiRequestLogDocument>(
    "OpenAiRequestLog",
    OpenAiRequestLogSchema,
    "openai_request_logs",
  );
