import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose";

const NoticeSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    pinned: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

export type NoticeDocument = InferSchemaType<typeof NoticeSchema> & {
  _id: mongoose.Types.ObjectId;
};

export function getNoticeModel(): Model<NoticeDocument> {
  return (
    (mongoose.models.Notice as Model<NoticeDocument> | undefined) ??
    mongoose.model<NoticeDocument>("Notice", NoticeSchema, "notices")
  );
}
