import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose";

const InquirySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    /*
     * 2026-09-09 부터 선택이다. 소유자는 `userId` 로 안다 — 전화번호가 없는(이메일 가입)
     * 회원이 저장할 때 `required` 가 빈 문자열을 거부해 500 이 났다. 새 문서에는 넣지 않는다.
     * → my-obsidian-vault / 50-Plans/E 개인정보 보호 보강.md 9번(B7)
     */
    phone: { type: String, default: "", index: true },
    /** 2026-09-09 부터 쓰지 않는다 — 이름은 회원을 조회해 붙인다. 옛 문서에만 남아 있다 */
    name: { type: String, default: "" },
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

/**
 * 답변이 끝난 문의는 1년 뒤 지운다 — 방침 5항. 답변 대기 중인 것은 남는다(부분 인덱스).
 * → my-obsidian-vault / 50-Plans/E 개인정보 보호 보강.md 8번
 */
InquirySchema.index(
  { answeredAt: 1 },
  { expireAfterSeconds: 31536000, partialFilterExpression: { status: "answered" }, name: "ttl_answered_1y" },
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
