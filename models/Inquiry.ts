import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose";

const InquirySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    phone: { type: String, required: true, index: true },
    name: { type: String, required: true },
    category: {
      type: String,
      required: true,
      enum: ["bug", "feature", "account", "other"],
      default: "other",
    },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "answered"],
      default: "pending",
    },
    answer: { type: String, default: "" },
    answeredAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

export type InquiryDocument = InferSchemaType<typeof InquirySchema> & {
  _id: mongoose.Types.ObjectId;
};

export function getInquiryModel(): Model<InquiryDocument> {
  return (
    (mongoose.models.Inquiry as Model<InquiryDocument> | undefined) ??
    mongoose.model<InquiryDocument>("Inquiry", InquirySchema, "inquiries")
  );
}
