import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose";

/**
 * 체중 기록.
 *
 * 인바디는 몇 달에 한 번이지만 체중계는 매일 잴 수 있다.
 * 성격이 달라 측정(measurements)과 분리하고, 그래프에서는 두 소스를 함께 그린다.
 * 하루 1건만 유지한다(같은 날 다시 기록하면 덮어쓴다).
 */
const WeightLogSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    /** YYYY-MM-DD (KST 기준) */
    date: { type: String, required: true },
    weightKg: { type: Number, required: true },
    /** 체지방률을 재는 가정용 체중계도 있어 선택 항목으로 받는다 */
    percentBodyFat: { type: Number, default: null },
    skeletalMuscleMass: { type: Number, default: null },
    memo: { type: String, default: null },
  },
  { timestamps: true },
);

WeightLogSchema.index({ userId: 1, date: 1 }, { unique: true });

export type WeightLogDocument = InferSchemaType<typeof WeightLogSchema>;

export function getWeightLogModel(): Model<WeightLogDocument> {
  return (mongoose.models.WeightLog ??
    mongoose.model("WeightLog", WeightLogSchema)) as Model<WeightLogDocument>;
}
